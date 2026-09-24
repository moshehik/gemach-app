'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import StatisticsModal from '../components/StatisticsModal';
import ExportButtons from '../../components/ExportButtons';
import { fetchSharedJson, TTL } from '../../lib/apiCache';
import { V3Page, Btn, IconBtn, Tabs, Seg, Tag, Tip, Empty, Icon } from '@/app/v3/ui/components';

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

// כותרת עמודה ממוינת (תצוגה בלבד) - אותו state ואותה לחיצה כמו קודם.
const SortHead = ({ sort, colKey, onSort, children }) => {
  const on = sort.key === colKey;
  return (
    <th scope="col" aria-sort={on ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="v3-th-btn" onClick={() => onSort(colKey)}>
        {children}
        <Icon
          name={on ? 'chevron-down' : 'sort'}
          size="sm"
          anim={false}
          className={on ? 'is-on' : undefined}
          style={on && sort.direction === 'desc' ? { transform: 'rotate(180deg)' } : undefined}
        />
      </button>
    </th>
  );
};

export default function EmployeesPage() {
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

  // Attendance State
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [attendanceData, setAttendanceData] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [printEmployeeId, setPrintEmployeeId] = useState(null);
  // 'full' = דוח מלא (עמוד לכל עובד) / 'summary' = טבלת הסיכום של החודש המוצג בלבד
  const [printMode, setPrintMode] = useState('full');
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const printMenuRef = useRef(null);

  // מיון טבלת סיכום הנוכחות (גם היא נבנית מראש בלקוח מ-processedAttendance, ר' למטה)
  const [attSort, setAttSort] = useState({ key: null, direction: 'asc' });
  const handleAttSort = (key) => setAttSort(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));

  useEffect(() => {
    if (!printMenuOpen) return;
    const handler = (e) => {
      if (printMenuRef.current && !printMenuRef.current.contains(e.target)) setPrintMenuOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [printMenuOpen]);

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

  const fetchAttendanceData = async (month, year) => {
    setLoadingAttendance(true);
    try {
      const res = await fetch(`/api/employees/attendance?month=${month}&year=${year}`);
      const result = await res.json();
      if (result.success) {
        setAttendanceData(result.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAttendance(false);
    }
  };

  // Fetch Attendance Data
  useEffect(() => {
    if (activeTab === 'attendance') {
      fetchAttendanceData(selectedMonth, selectedYear);
    }
  }, [activeTab, selectedMonth, selectedYear]);

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

  // Attendance Handlers
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const getMonthName = (monthNum) => {
    const d = new Date(2000, monthNum - 1, 1);
    return d.toLocaleDateString('he-IL', { month: 'long' });
  };

  const handlePrintPdfs = (employeeId = null, mode = 'full') => {
    setPrintMenuOpen(false);
    setPrintEmployeeId(employeeId);
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // Process Attendance Data for the Table
  const processedAttendance = attendanceData.map(emp => {
    const shifts = emp.shifts || [];
    const daysCount = shifts.length;
    let totalMinutes = 0;
    let totalCalculated = 0;
    let issues = 0;
    let hasTravels = false;

    shifts.forEach(shift => {
      totalMinutes += (shift.totalMinutes || 0);
      totalCalculated += (shift.totalCalculated || 0);
      if (shift.travelExpensesSnapshot > 0) hasTravels = true;
      // "תקלה" = יש תאריך אבל חסרה כניסה או יציאה (אחת מהשתיים, לא שתיהן) - אותו קריטריון
      // כמו בכרטיס העובד הבודד (isIncompleteShift), כדי שההדגשה תהיה עקבית בין המסכים.
      if (!!shift.entryTime !== !!shift.exitTime) issues++;
    });

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const timeStr = `${hours} שעות ו ${minutes} דקות`;

    return {
      id: emp.id,
      firstName: emp.firstName,
      lastName: emp.lastName,
      fullName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
      department: emp.department,
      daysCount,
      totalMinutes,
      timeStr,
      totalCalculated,
      issues,
      hasTravels: hasTravels ? 'כן' : 'לא',
      shifts
    };
  }).filter(e => e.daysCount > 0);

  const sortedEmployees = sortRows(filteredEmployees, empSort, empSortValue);
  const sortedAttendance = sortRows(processedAttendance, attSort, (r, key) => r[key]);

  return (
    <V3Page>
      <style dangerouslySetInnerHTML={{__html: `
        #print-area { display: none; }
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * {
            visibility: visible;
            color: black !important;
            filter: grayscale(100%) !important;
          }
          #print-area {
            display: block !important;
            position: absolute; left: 0; top: 0; width: 100%; direction: rtl;
            overflow: visible !important;
          }
          .no-print { display: none !important; }
          .bsd-header { display: block !important; text-align: center; font-size: 1.2rem; font-weight: bold; margin-bottom: 1rem; }
          ::-webkit-scrollbar { display: none; }
          .employee-page { page-break-after: always; margin-bottom: 0; box-shadow: none !important; border-radius: 0 !important; }
          .employee-page:last-child { page-break-after: auto; }
          .employee-page thead { display: table-header-group; }
          .employee-page tr { break-inside: avoid; page-break-inside: avoid; }
          .summary-print-table thead { display: table-header-group; }
          .summary-print-table tr { break-inside: avoid; page-break-inside: avoid; }
        }
      `}} />

      <div className="no-print v3-stack">
        {showStatistics && <StatisticsModal isOpen={!!showStatistics} onClose={() => setShowStatistics(false)} pageContext="employees" position={typeof showStatistics === 'object' ? showStatistics : null} />}

        <header className="v3-pagehead">
          <div className="v3-pagehead__title">
            <h1 className="v3-h1">עובדים ונוכחות</h1>
            <Tip>כאן רואים את כל אנשי הצוות, נכנסים לכרטיס של כל אחד, ובודקים שעות עבודה וסיכום שכר לפי חודש.</Tip>
          </div>
        </header>

        <Tabs
          label="אזורי המסך"
          value={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'list', label: 'הצוות', icon: 'users' },
            { key: 'attendance', label: 'שעות עבודה', icon: 'clock' },
          ]}
        />

        {/* Employees List Tab Content */}
        {activeTab === 'list' && (
          <div className="v3-stack">
            {aiInputMode ? (
              <form onSubmit={handleAiInputSubmit} className="v3-filter-bar">
                <div className="v3-search">
                  {aiLoading
                    ? <Icon name="loader" loop />
                    : <Icon name="ai" />}
                  <input
                    type="text"
                    value={aiInputText}
                    onChange={(e) => setAiInputText(e.target.value)}
                    placeholder="תארו במילים מה לחפש"
                    aria-label="חיפוש חכם"
                    disabled={aiLoading}
                  />
                  {aiInputText && !aiLoading && (
                    <button type="button" className="v3-search__clear is-on" aria-label="ניקוי הטקסט" title="ניקוי הטקסט" onClick={() => setAiInputText('')}>
                      <Icon name="x" size="sm" />
                    </button>
                  )}
                </div>
                <IconBtn variant="primary" icon="ai" label="חזרה לחיפוש רגיל" title="חזרה לחיפוש רגיל" onClick={toggleAiInputMode} />
                <IconBtn icon="activity" label="שאלות על הנתונים" title="שאלות על הנתונים" onClick={(e) => setShowStatistics({ x: e.clientX, y: e.clientY })} />
                <Btn type="submit" variant="primary" loading={aiLoading}>
                  {aiLoading ? 'מכין שאילתה...' : 'חיפוש חכם'}
                </Btn>
              </form>
            ) : (
              <form onSubmit={handleSearch} className="v3-filter-bar">
                <div className="v3-search">
                  <Icon name="search" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="שם, טלפון או קוד עובד"
                    aria-label="חיפוש עובד"
                  />
                  {searchInput && (
                    <button type="button" className="v3-search__clear is-on" aria-label="ניקוי החיפוש" title="ניקוי החיפוש" onClick={handleClearSearch}>
                      <Icon name="x" size="sm" />
                    </button>
                  )}
                </div>
                <IconBtn icon="ai" label="חיפוש חכם" title="חיפוש חכם" onClick={toggleAiInputMode} />
                <IconBtn icon="activity" label="שאלות על הנתונים" title="שאלות על הנתונים" onClick={(e) => setShowStatistics({ x: e.clientX, y: e.clientY })} />
                <Btn type="submit" variant="primary">חיפוש</Btn>
              </form>
            )}

            <div className="v3-cluster">
              <Seg
                label="סינון לפי סטטוס"
                value={filterStatus}
                onChange={setFilterStatus}
                options={[
                  { value: 'active', label: 'פעילים', icon: 'user-check' },
                  { value: 'inactive', label: 'לא פעילים', icon: 'user' },
                  { value: 'all', label: 'כולם', icon: 'users' },
                ]}
              />
              <Btn variant="primary" icon="plus" onClick={() => router.push('/employees/new')}>עובד חדש</Btn>
            </div>

            <div className="v3-table__wrap">
              {loading ? (
                <div className="v3-empty" role="status">
                  <Icon name="loader" size="xl" loop />
                  <span>טוענים את הרשימה...</span>
                </div>
              ) : (
                <table className="v3-table">
                  <thead>
                    <tr>
                      <SortHead sort={empSort} colKey="code" onSort={handleEmpSort}>קוד</SortHead>
                      <SortHead sort={empSort} colKey="fullName" onSort={handleEmpSort}>שם</SortHead>
                      <SortHead sort={empSort} colKey="department" onSort={handleEmpSort}>תפקיד</SortHead>
                      <SortHead sort={empSort} colKey="phone1" onSort={handleEmpSort}>טלפון</SortHead>
                      <SortHead sort={empSort} colKey="isActive" onSort={handleEmpSort}>סטטוס</SortHead>
                      <SortHead sort={empSort} colKey="needsPasswordReset" onSort={handleEmpSort}>סיסמה</SortHead>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEmployees.map(employee => (
                      <tr
                        key={employee.id}
                        style={{ cursor: 'pointer' }}
                        tabIndex={0}
                        onClick={() => router.push(`/employees/${employee.id}`)}
                        onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/employees/${employee.id}`); }}
                      >
                        <td><bdi>{employee.legacyId || employee.id.substring(0, 5)}</bdi></td>
                        <td><b>{employee.firstName} {employee.lastName}</b></td>
                        <td>{employee.department ? employee.department.name : (employee.roleId || 'עובד')}</td>
                        <td>{employee.phone1 ? <bdi>{employee.phone1}</bdi> : '-'}</td>
                        <td>
                          {employee.isActive
                            ? <Tag variant="done" icon="user-check">פעיל</Tag>
                            : <Tag variant="soft" icon="user">לא פעיל</Tag>}
                        </td>
                        <td>
                          {employee.needsPasswordReset && (
                            <span className="v3-cluster" onClick={(e) => e.stopPropagation()}>
                              <Tag variant="attn" icon="alert-tri">לעדכן</Tag>
                              <Tip label="למה צריך לעדכן סיסמה">הסיסמה הישנה שמורה בצורה לא מאובטחת. בכרטיס העובד אפשר לאפס אותה או לקבוע סיסמה חדשה.</Tip>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredEmployees.length === 0 && (
                      <tr>
                        <td colSpan="6">
                          <Empty icon="search" text="לא נמצאו עובדים שמתאימים לחיפוש." />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
            <p className="v3-faint" role="status">מוצגים <bdi>{loading ? '...' : filteredEmployees.length}</bdi> עובדים</p>
          </div>
        )}

        {/* Attendance Tab Content */}
        {activeTab === 'attendance' && (
          <div className="v3-stack">
            <div className="v3-cluster">
              <IconBtn icon="chevron-end" label="החודש הקודם" title="החודש הקודם" onClick={handlePrevMonth} />
              <strong className="v3-big">
                {getMonthName(selectedMonth)} <bdi>{selectedYear}</bdi>
              </strong>
              <IconBtn icon="chevron-start" label="החודש הבא" title="החודש הבא" onClick={handleNextMonth} />

              <div ref={printMenuRef} style={{ position: 'relative', marginInlineStart: 'auto' }}>
                <IconBtn
                  icon="printer"
                  label="הדפסה"
                  title="הדפסה"
                  onClick={() => setPrintMenuOpen(o => !o)}
                  disabled={processedAttendance.length === 0}
                />
                {printMenuOpen && (
                  <div className="v3-popover is-on" style={{ insetInlineStart: 'auto', insetInlineEnd: 0, width: 'max-content' }}>
                    <div className="v3-btn-group">
                      <Btn variant="quiet" icon="file" onClick={() => handlePrintPdfs(null, 'full')}>דוח נפרד לכל עובד</Btn>
                      <Btn variant="quiet" icon="list" onClick={() => handlePrintPdfs(null, 'summary')}>
                        טבלת סיכום בלבד ({getMonthName(selectedMonth)} {selectedYear})
                      </Btn>
                    </div>
                  </div>
                )}
              </div>
              <ExportButtons
                data={processedAttendance}
                filename={`נוכחות_${selectedMonth}_${selectedYear}`}
                columns={[
                  { key: 'fullName', label: 'שם' },
                  { key: 'timeStr', label: 'ס"ה דקות' },
                  { key: 'daysCount', label: 'כמות ימים' },
                  { key: 'issues', label: 'תקלות' },
                  { key: 'totalCalculated', label: 'ס"ה' },
                  { key: 'hasTravels', label: 'נסיעות' }
                ]}
                iconOnly={true}
              />
            </div>

            <div className="v3-table__wrap">
              <table className="v3-table">
                <thead>
                  <tr>
                    <SortHead sort={attSort} colKey="fullName" onSort={handleAttSort}>שם</SortHead>
                    <SortHead sort={attSort} colKey="totalMinutes" onSort={handleAttSort}>זמן עבודה</SortHead>
                    <SortHead sort={attSort} colKey="daysCount" onSort={handleAttSort}>ימים</SortHead>
                    <SortHead sort={attSort} colKey="issues" onSort={handleAttSort}>תקלות</SortHead>
                    <SortHead sort={attSort} colKey="totalCalculated" onSort={handleAttSort}>לתשלום</SortHead>
                    <SortHead sort={attSort} colKey="hasTravels" onSort={handleAttSort}>נסיעות</SortHead>
                    <th className="no-print" scope="col"><span className="v3-sr">פעולות</span></th>
                  </tr>
                </thead>
                <tbody>
                  {loadingAttendance ? (
                    <tr>
                      <td colSpan="7">
                        <div className="v3-empty" role="status">
                          <Icon name="loader" size="xl" loop />
                        </div>
                      </td>
                    </tr>
                  ) : processedAttendance.length === 0 ? (
                    <tr>
                      <td colSpan="7">
                        <Empty icon="calendar" text="אין נתוני נוכחות לחודש הזה." />
                      </td>
                    </tr>
                  ) : (
                    sortedAttendance.map(emp => (
                      <tr
                        key={emp.id}
                        style={{ cursor: 'pointer', background: emp.issues > 0 ? 'var(--v3-charge-bg)' : undefined }}
                        tabIndex={0}
                        onClick={() => router.push(`/employees/${emp.id}`)}
                        onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/employees/${emp.id}`); }}
                      >
                        <td><b>{emp.fullName}</b></td>
                        <td>{emp.timeStr}</td>
                        <td><bdi>{emp.daysCount}</bdi></td>
                        <td>
                          {emp.issues > 0 && (
                            <Tag variant="attn" icon="alert-tri"><bdi>{emp.issues}</bdi></Tag>
                          )}
                        </td>
                        <td><b>₪<bdi>{emp.totalCalculated.toFixed(2)}</bdi></b></td>
                        <td>{emp.hasTravels}</td>
                        <td className="no-print">
                          <Btn size="sm" icon="printer" title="הדפסת דוח אישי" onClick={(e) => { e.stopPropagation(); handlePrintPdfs(emp.id); }}>
                            הדפסה
                          </Btn>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="v3-faint" role="status"><bdi>{loadingAttendance ? '...' : processedAttendance.length}</bdi> עובדים עם שעות בחודש הזה</p>
          </div>
        )}
      </div>

      {/* Hidden Print Area for Individual PDF Reports */}
      {activeTab === 'attendance' && (
        <div id="print-area">
          <div className="bsd-header" style={{ display: 'none' }}>בס&quot;ד</div>

          {printMode === 'summary' && !loadingAttendance && (
            <div style={{ background: '#fff', color: '#000', padding: '2rem', borderRadius: '12px' }}>
              <div style={{ borderBottom: '2px solid #eee', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: '0 0 0.5rem 0' }}>טבלת סיכום נוכחות - כלל העובדים</h2>
                <div style={{ fontSize: '1.1rem', color: '#555' }}>תקופה: {getMonthName(selectedMonth)} {selectedYear}</div>
              </div>
              <table className="summary-print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    <th style={{ padding: '0.75rem', borderBottom: '2px solid #ddd', textAlign: 'right' }}>שם</th>
                    <th style={{ padding: '0.75rem', borderBottom: '2px solid #ddd', textAlign: 'center' }}>סה&quot;כ שעות</th>
                    <th style={{ padding: '0.75rem', borderBottom: '2px solid #ddd', textAlign: 'center' }}>כמות ימים</th>
                    <th style={{ padding: '0.75rem', borderBottom: '2px solid #ddd', textAlign: 'center' }}>תקלות</th>
                    <th style={{ padding: '0.75rem', borderBottom: '2px solid #ddd', textAlign: 'center' }}>סה&quot;כ לתשלום</th>
                    <th style={{ padding: '0.75rem', borderBottom: '2px solid #ddd', textAlign: 'center' }}>נסיעות</th>
                  </tr>
                </thead>
                <tbody>
                  {processedAttendance.map(emp => (
                    <tr key={emp.id}>
                      <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee', fontWeight: 500 }}>{emp.fullName}</td>
                      <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee', textAlign: 'center' }}>{emp.timeStr}</td>
                      <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee', textAlign: 'center' }}>{emp.daysCount}</td>
                      <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee', textAlign: 'center', color: emp.issues > 0 ? '#b71c1c' : 'inherit', fontWeight: emp.issues > 0 ? 700 : 400 }}>{emp.issues || '-'}</td>
                      <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee', textAlign: 'center', fontWeight: 500 }}>₪{emp.totalCalculated.toFixed(2)}</td>
                      <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee', textAlign: 'center' }}>{emp.hasTravels}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {printMode === 'full' && !loadingAttendance && processedAttendance.length > 0 && processedAttendance.filter(emp => !printEmployeeId || emp.id === printEmployeeId).map(emp => {
            const totalHours = (emp.totalMinutes / 60).toFixed(2);
            return (
              <div key={emp.id} className="employee-page" style={{ background: '#fff', color: '#000', padding: '2rem', borderRadius: '12px', marginBottom: '2rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <div style={{ borderBottom: '2px solid #eee', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ margin: '0 0 0.5rem 0' }}>דוח נוכחות עובד: {emp.fullName}</h2>
                    <div style={{ fontSize: '1.1rem', color: '#555' }}>
                      תקופה: {getMonthName(selectedMonth)} {selectedYear}
                    </div>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    {emp.department && <div style={{ fontSize: '1rem', color: '#666' }}>מחלקה: {emp.department.name}</div>}
                  </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem', fontSize: '0.95rem' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa' }}>
                      <th style={{ padding: '0.75rem', borderBottom: '2px solid #ddd', textAlign: 'right' }}>תאריך</th>
                      <th style={{ padding: '0.75rem', borderBottom: '2px solid #ddd', textAlign: 'center' }}>כניסה</th>
                      <th style={{ padding: '0.75rem', borderBottom: '2px solid #ddd', textAlign: 'center' }}>יציאה</th>
                      <th style={{ padding: '0.75rem', borderBottom: '2px solid #ddd', textAlign: 'center' }}>סה&quot;כ שעות</th>
                      <th style={{ padding: '0.75rem', borderBottom: '2px solid #ddd', textAlign: 'left' }}>סה&quot;כ לתשלום</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emp.shifts.map((shift) => (
                      <tr key={shift.id}>
                        <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee' }}>
                          {shift.date ? new Date(shift.date).toLocaleDateString('he-IL') : '-'}
                        </td>
                        <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee', textAlign: 'center' }}>
                          {shift.entryTime ? new Date(shift.entryTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee', textAlign: 'center', color: !shift.exitTime ? '#d32f2f' : 'inherit' }}>
                          {shift.exitTime ? new Date(shift.exitTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : 'חסר'}
                        </td>
                        <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee', textAlign: 'center' }}>
                          {shift.totalMinutes ? (shift.totalMinutes / 60).toFixed(2) : '0.00'}
                        </td>
                        <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee', textAlign: 'left', fontWeight: '500' }}>
                          ₪{shift.totalCalculated ? shift.totalCalculated.toFixed(2) : '0.00'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ background: '#f8f9fa', padding: '1.5rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ color: '#666', marginRight: '0.5rem' }}>סה&quot;כ משמרות:</span>
                    <strong style={{ fontSize: '1.2rem' }}>{emp.daysCount}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#666', marginRight: '0.5rem' }}>סה&quot;כ שעות:</span>
                    <strong style={{ fontSize: '1.2rem' }}>{totalHours}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#666', marginRight: '0.5rem' }}>סה&quot;כ לתשלום:</span>
                    <strong style={{ fontSize: '1.2rem', color: '#10b981' }}>₪{emp.totalCalculated.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </V3Page>
  );
}
