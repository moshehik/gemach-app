'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import StatisticsModal from '../components/StatisticsModal';
import ExportButtons from '../../components/ExportButtons';
import { fetchSharedJson, TTL } from '../../lib/apiCache';

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

  return (
    <>
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
          <button type="button" className={activeTab === 'attendance' ? 'tab active' : 'tab'} style={{ background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' }} onClick={() => setActiveTab('attendance')}>
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
              {loading ? (
                <div className="page-loading">
                  <span className="spinner lg" />
                  טוען נתונים...
                </div>
              ) : (
                <table className="data">
                  <thead>
                    <tr>
                      <th>קוד עובד</th>
                      <th>שם מלא</th>
                      <th>תפקיד</th>
                      <th>טלפון</th>
                      <th>סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map(employee => (
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
                      </tr>
                    ))}
                    {filteredEmployees.length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)' }}>לא נמצאו עובדים התואמים את החיפוש.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
              <div className="table-foot">
                <span>סה&quot;כ שורות מוצגות: {loading ? '...' : filteredEmployees.length}</span>
              </div>
            </div>
          </div>
        )}

        {/* Attendance Tab Content */}
        {activeTab === 'attendance' && (
          <div>
            <div className="toolbar">
              <button type="button" onClick={handlePrevMonth} className="btn btn-ghost btn-icon-only" title="חודש קודם">
                <svg className="icon"><use href="#i-chevron-end" /></svg>
              </button>
              <strong style={{ minWidth: '110px', textAlign: 'center', color: 'var(--primary)' }}>
                {getMonthName(selectedMonth)} {selectedYear}
              </strong>
              <button type="button" onClick={handleNextMonth} className="btn btn-ghost btn-icon-only" title="חודש הבא">
                <svg className="icon"><use href="#i-chevron-start" /></svg>
              </button>

              <div className="spacer"></div>

              <div ref={printMenuRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setPrintMenuOpen(o => !o)}
                  className="btn btn-secondary btn-icon-only"
                  disabled={processedAttendance.length === 0}
                  title="הדפסת נוכחות"
                >
                  <svg className="icon"><use href="#i-printer" /></svg>
                </button>
                {printMenuOpen && (
                  <div className="card" style={{ position: 'absolute', top: 'calc(100% + 6px)', insetInlineEnd: 0, minWidth: '250px', padding: '6px', zIndex: 20 }}>
                    <button type="button" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => handlePrintPdfs(null, 'full')}>
                      <svg className="icon"><use href="#i-file" /></svg>
                      דוחות מלאים לכל עובד
                    </button>
                    <button type="button" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => handlePrintPdfs(null, 'summary')}>
                      <svg className="icon"><use href="#i-list" /></svg>
                      טבלת סיכום בלבד ({getMonthName(selectedMonth)} {selectedYear})
                    </button>
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

            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>שם</th>
                    <th>ס&quot;ה דקות</th>
                    <th>כמות ימים</th>
                    <th>תקלות</th>
                    <th>ס&quot;ה</th>
                    <th>נסיעות</th>
                    <th className="no-print" style={{ textAlign: 'center' }}>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingAttendance ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '4rem', textAlign: 'center' }}>
                        <span className="spinner lg" style={{ margin: '0 auto' }} />
                      </td>
                    </tr>
                  ) : processedAttendance.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-3)' }}>
                        לא נמצאו נתוני נוכחות לחודש זה.
                      </td>
                    </tr>
                  ) : (
                    processedAttendance.map(emp => (
                      <tr
                        key={emp.id}
                        className={emp.issues > 0 ? 'row-flag' : undefined}
                        style={{ cursor: 'pointer' }}
                        onClick={() => router.push(`/employees/${emp.id}`)}
                      >
                        <td className="cell-primary">{emp.fullName}</td>
                        <td>{emp.timeStr}</td>
                        <td>{emp.daysCount}</td>
                        <td>
                          {emp.issues > 0 && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--danger)', fontWeight: 700 }}>
                              {emp.issues} <svg className="icon"><use href="#i-alert-tri" /></svg>
                            </span>
                          )}
                        </td>
                        <td className="cell-primary">{emp.totalCalculated.toFixed(2)}</td>
                        <td>{emp.hasTravels}</td>
                        <td className="no-print" style={{ textAlign: 'center' }}>
                          <button type="button" onClick={(e) => { e.stopPropagation(); handlePrintPdfs(emp.id); }} className="btn btn-secondary btn-sm" title="הדפס דוח אישי לעובד זה">
                            <svg className="icon"><use href="#i-printer" /></svg>
                            הדפס
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="table-foot">
                <span>סה&quot;כ שורות מוצגות: {loadingAttendance ? '...' : processedAttendance.length}</span>
              </div>
            </div>
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
    </>
  );
}
