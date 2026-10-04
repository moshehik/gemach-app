'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import StatisticsModal from '../components/StatisticsModal';
import { fetchSharedJson, TTL } from '../../lib/apiCache';
import { useUiVariant } from '../components/UiVariantContext';
import VariantFrame from '../components/variant/VariantFrame';
import LegacyEmployeesPage from './LegacyEmployeesPage';

// מיון בצד הלקוח לשתי הטבלאות בעמוד זה (רשימת עובדים + סיכום נוכחות) - שתיהן טוענות
// את כל הנתונים למקשה אחת בלי pagination בשרת, אז אין צורך במיון צד-שרת. אותו דפוס
// כמו ה-SortIcon/מיון הגנרי ב-components/dresses/modern/ModernDressItemsTab.js.
const compareSortValues = (av, bv) => {
  const an = Number(av);
  const bn = Number(bv);
  if (av != null && bv != null && av !== '' && bv !== '' && !isNaN(an) && !isNaN(bn)) return an - bn;
  return String(av ?? '').localeCompare(String(bv ?? ''), 'he');
};

const sortRows = (rows, sort, getValue) => {
  if (!sort.key) return rows;
  const copy = [...rows];
  copy.sort((a, b) => {
    const cmp = compareSortValues(getValue(a, sort.key), getValue(b, sort.key));
    return sort.direction === 'asc' ? cmp : -cmp;
  });
  return copy;
};

const SortIcon = ({ sort, colKey }) => {
  if (sort.key !== colKey) return <svg className="icon"><use href="#i-sort" /></svg>;
  return (
    <svg className="icon" style={{ opacity: 1, color: 'var(--primary-solid)', transform: sort.direction === 'desc' ? 'rotate(180deg)' : 'none' }}>
      <use href="#i-chevron-down" />
    </svg>
  );
};

// "ישן / חדש" (4.10.2026, lib/uiVariantScreens.js מסך 'attendance'): בגרסה הישנה /employees הוא הדף הקודם במלואו, כולל לשונית
// "נוכחות" הישנה (LegacyEmployeesPage.js = f3b1f771^1:app/employees/page.js כפי שהוא; הנתונים מנתיב התאימות המוקשח
// של הנוכחות הישנה, ר' docs/page-variant-switch-2026-10-04.md). בגרסה החדשה - הדף הזה, שהלשונית בו מובילה ל-/employees/attendance. ההכרעה: useUiVariant
// (אותם קלטים כמו בשרת - app/layout.js). בישן האייקון "מעבר לתצוגה החדשה" בפינה (VariantFrame); בחדש אין אייקון בדף הזה
// (רשימת העובדים זהה בשתי הגרסאות) - הוא בכותרת "סיכום נוכחות".
export default function EmployeesRoute() {
  const variant = useUiVariant('attendance');
  if (variant === 'legacy') {
    return (
      <VariantFrame screen="attendance" variant="legacy">
        <LegacyEmployeesPage />
      </VariantFrame>
    );
  }
  return <EmployeesPage />;
}

function EmployeesPage() {
  const router = useRouter();

  // Tab State
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'attendance'

  // Employees List State
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterStatus, setFilterStatus] = useState('active'); // active, inactive, all
  const [isAiModeActive, setIsAiModeActive] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);

  // מיון טבלת רשימת העובדים (כל הנתונים כבר בזיכרון - ר' הערה מעל sortRows)
  const [empSort, setEmpSort] = useState({ key: null, direction: 'asc' });
  const handleEmpSort = (key) => setEmpSort(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  const empSortValue = (e, key) => {
    switch (key) {
      case 'code': return e.legacyId || e.id;
      case 'fullName': return `${e.firstName || ''} ${e.lastName || ''}`.trim();
      case 'department': return e.department ? e.department.name : (e.roleId || 'עובד');
      case 'isActive': return e.isActive ? 1 : 0;
      default: return e[key];
    }
  };

  // מצב תצוגת סרגל החיפוש (חיפוש רגיל / חכם AI) — מחליף את המצב הפנימי שהיה
  // חבוי בתוך רכיב AISearchBar הישן; ההתנהגות זהה, רק המבנה/הסגנון עברו לעיצוב החדש.
  const [aiInputMode, setAiInputMode] = useState(false);
  const [aiInputText, setAiInputText] = useState('');

  // ה-state הזה חי ברמת הדף (לא ברכיב AISearchBar הישן שהתפרק בכל מעבר טאב),
  // אז צריך לאפס אותו ידנית ביציאה מהטאב "רשימה" כדי לשמר את אותה התנהגות בדיוק.
  useEffect(() => {
    if (activeTab !== 'list') {
      setAiInputMode(false);
      setAiInputText('');
    }
  }, [activeTab]);

  // Fetch Employees List
  useEffect(() => {
    if (activeTab === 'list' && !isAiModeActive) {
      fetchSharedJson('/api/employees?all=true', { ttl: TTL.STATIC })
        .then(data => {
          setEmployees(data);
          setLoading(false);
        })
        .catch(e => console.error(e));
    }
  }, [activeTab, isAiModeActive]);

  const handleAiSearch = async (query) => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/smart-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query, pageContext: 'employees' })
      });
      const result = await res.json();
      if (res.ok) {
        setEmployees(result.data || []);
        setIsAiModeActive(true);
      } else {
        alert(result.error || 'שגיאה בחיפוש החכם');
      }
    } catch (e) {
      console.error(e);
      alert('שגיאת תקשורת');
    } finally {
      setAiLoading(false);
    }
  };

  const filteredEmployees = employees.filter(e => {
    if (filterStatus === 'active' && !e.isActive) return false;
    if (filterStatus === 'inactive' && e.isActive) return false;

    if (isAiModeActive) return true; // AI already filtered the data

    const term = search.toLowerCase();
    const fullName = `${e.firstName || ''} ${e.lastName || ''}`.toLowerCase();
    return fullName.includes(term) || (e.phone1 && e.phone1.includes(term)) || String(e.id).includes(term) || String(e.legacyId || '').includes(term);
  });

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    setSearch(searchInput);
    setIsAiModeActive(false);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearch('');
    setIsAiModeActive(false);
  };

  // סרגל החיפוש: מצב רגיל מול מצב AI — מחליף את הלוגיקה הפנימית שהייתה ברכיב AISearchBar
  const toggleAiInputMode = () => {
    if (!aiInputMode) {
      setAiInputText(searchInput || '');
    } else {
      setSearchInput(aiInputText || '');
    }
    setAiInputMode(v => !v);
  };

  const handleAiInputSubmit = (e) => {
    e.preventDefault();
    if (!aiInputText.trim()) return;
    handleAiSearch(aiInputText);
  };

  const sortedEmployees = sortRows(filteredEmployees, empSort, empSortValue);

  return (
    <>
      <div className="no-print">
        {showStatistics && <StatisticsModal isOpen={!!showStatistics} onClose={() => setShowStatistics(false)} pageContext="employees" position={typeof showStatistics === 'object' ? showStatistics : null} />}

        <div className="page-head">
          <div>
            <h1>ניהול עובדים ונוכחות</h1>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="tabs">
          <button type="button" className={activeTab === 'list' ? 'tab active' : 'tab'} style={{ background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' }} onClick={() => setActiveTab('list')}>
            <svg className="icon"><use href="#i-users" /></svg>
            רשימת עובדים
          </button>
          <button type="button" className={activeTab === 'attendance' ? 'tab active' : 'tab'} style={{ background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' }} onClick={() => router.push('/employees/attendance')}>
            <svg className="icon"><use href="#i-clock" /></svg>
            נוכחות
          </button>
        </div>

        {/* Employees List Tab Content */}
        {activeTab === 'list' && (
          <div>
            <div className="toolbar">
              {aiInputMode ? (
                <form onSubmit={handleAiInputSubmit} className="search-toolbar">
                  {aiLoading
                    ? <span className="spinner" style={{ width: '15px', height: '15px', borderWidth: '2px' }} />
                    : <svg className="icon" style={{ color: 'var(--accent)' }}><use href="#i-star" /></svg>}
                  <input
                    type="text"
                    value={aiInputText}
                    onChange={(e) => setAiInputText(e.target.value)}
                    placeholder="בקש מה-AI למצוא נתונים (למשל: 'הזמנות של משפחת שיינועטר')..."
                    disabled={aiLoading}
                  />
                  <div className="search-toolbar-actions">
                    {aiInputText && !aiLoading && (
                      <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="נקה" onClick={() => setAiInputText('')}>
                        <svg className="icon"><use href="#i-x" /></svg>
                      </button>
                    )}
                    <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="חיפוש חכם (AI)" style={{ color: 'var(--accent)', background: 'var(--accent-tint)' }} onClick={toggleAiInputMode}>
                      <svg className="icon"><use href="#i-star" /></svg>
                    </button>
                    <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="שאלות סטטיסטיקה" onClick={(e) => setShowStatistics({ x: e.clientX, y: e.clientY })}>
                      <svg className="icon"><use href="#i-activity" /></svg>
                    </button>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={aiLoading}>
                      {aiLoading ? 'מייצר שאילתה...' : 'חפש בחכמה'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleSearch} className="search-toolbar">
                  <svg className="icon"><use href="#i-search" /></svg>
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="חיפוש עובד (שם, טלפון, קוד)..."
                  />
                  <div className="search-toolbar-actions">
                    {searchInput && (
                      <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="ניקוי חיפוש" onClick={handleClearSearch}>
                        <svg className="icon"><use href="#i-x" /></svg>
                      </button>
                    )}
                    <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="חיפוש חכם (AI)" onClick={toggleAiInputMode}>
                      <svg className="icon" style={{ color: 'var(--accent)' }}><use href="#i-star" /></svg>
                    </button>
                    <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="שאלות סטטיסטיקה" onClick={(e) => setShowStatistics({ x: e.clientX, y: e.clientY })}>
                      <svg className="icon"><use href="#i-activity" /></svg>
                    </button>
                    <button type="submit" className="btn btn-primary btn-sm">חיפוש</button>
                  </div>
                </form>
              )}

              <div className="spacer"></div>

              <div className="pill-tabs">
                <button type="button" onClick={() => setFilterStatus('active')} className={filterStatus === 'active' ? 'pill-tab active' : 'pill-tab'} title="עובדים פעילים">
                  <svg className="icon"><use href="#i-user-check" /></svg>
                  פעילים
                </button>
                <button type="button" onClick={() => setFilterStatus('inactive')} className={filterStatus === 'inactive' ? 'pill-tab active' : 'pill-tab'} title="לא פעילים">
                  <svg className="icon"><use href="#i-user" /></svg>
                  לא פעילים
                </button>
                <button type="button" onClick={() => setFilterStatus('all')} className={filterStatus === 'all' ? 'pill-tab active' : 'pill-tab'} title="הצג הכל">
                  <svg className="icon"><use href="#i-users" /></svg>
                  הכל
                </button>
              </div>

              <button type="button" onClick={() => router.push('/employees/new')} className="btn btn-primary" title="עובד חדש">
                <svg className="icon"><use href="#i-plus" /></svg>
                עובד חדש
              </button>
            </div>

            <div className="table-wrap">
              <div className="table-scroll">
                {loading ? (
                  <div className="page-loading">
                    <span className="spinner lg" />
                    טוען נתונים...
                  </div>
                ) : (
                  <table className="data">
                    <thead>
                      <tr>
                        <th className={empSort.key === 'code' ? 'sortable sort-active' : 'sortable'} onClick={() => handleEmpSort('code')}>קוד עובד <SortIcon sort={empSort} colKey="code" /></th>
                        <th className={empSort.key === 'fullName' ? 'sortable sort-active' : 'sortable'} onClick={() => handleEmpSort('fullName')}>שם מלא <SortIcon sort={empSort} colKey="fullName" /></th>
                        <th className={empSort.key === 'department' ? 'sortable sort-active' : 'sortable'} onClick={() => handleEmpSort('department')}>תפקיד <SortIcon sort={empSort} colKey="department" /></th>
                        <th className={empSort.key === 'phone1' ? 'sortable sort-active' : 'sortable'} onClick={() => handleEmpSort('phone1')}>טלפון <SortIcon sort={empSort} colKey="phone1" /></th>
                        <th className={empSort.key === 'isActive' ? 'sortable sort-active' : 'sortable'} onClick={() => handleEmpSort('isActive')}>סטטוס <SortIcon sort={empSort} colKey="isActive" /></th>
                        <th className={empSort.key === 'needsPasswordReset' ? 'sortable sort-active' : 'sortable'} onClick={() => handleEmpSort('needsPasswordReset')}>סיסמה <SortIcon sort={empSort} colKey="needsPasswordReset" /></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedEmployees.map(employee => (
                        <tr key={employee.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/employees/${employee.id}`)}>
                          <td className="cell-primary">{employee.legacyId || employee.id.substring(0, 5)}</td>
                          <td className="cell-primary">{employee.firstName} {employee.lastName}</td>
                          <td>{employee.department ? employee.department.name : (employee.roleId || 'עובד')}</td>
                          <td>{employee.phone1 || '-'}</td>
                          <td>
                            <span className={employee.isActive ? 'badge badge-success' : 'badge badge-neutral'}>
                              {employee.isActive ? 'פעיל' : 'לא פעיל'}
                            </span>
                          </td>
                          <td>
                            {employee.needsPasswordReset && (
                              <span className="badge badge-warning" title="הסיסמה ישנה/לא מוצפנת - יש לאפס או לקבוע סיסמה חדשה בכרטיס העובד">
                                <svg className="icon"><use href="#i-alert-tri" /></svg>
                                יש לעדכן
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filteredEmployees.length === 0 && (
                        <tr>
                          <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)' }}>לא נמצאו עובדים התואמים את החיפוש.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="table-foot">
                <span>סה&quot;כ שורות מוצגות: {loading ? '...' : filteredEmployees.length}</span>
              </div>
            </div>
          </div>
        )}

      </div>

    </>
  );
}
