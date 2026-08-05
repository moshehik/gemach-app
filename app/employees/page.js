'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserCheck, UserMinus, Plus, FileSpreadsheet, ChevronRight, ChevronLeft, CalendarClock, Printer, AlertTriangle, Loader2 } from 'lucide-react';
import AISearchBar from '../components/AISearchBar';
import StatisticsModal from '../components/StatisticsModal';
import ExportButtons from '../../components/ExportButtons';

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
  
  // Attendance State
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [attendanceData, setAttendanceData] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [printEmployeeId, setPrintEmployeeId] = useState(null);

  // Fetch Employees List
  useEffect(() => {
    if (activeTab === 'list' && !isAiModeActive) {
      fetch(`/api/employees?all=true`)
        .then(res => res.json())
        .then(data => {
          setEmployees(data);
          setLoading(false);
        });
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

  const handlePrintPdfs = (employeeId = null) => {
    setPrintEmployeeId(employeeId);
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
      if (shift.entryTime && !shift.exitTime) issues++;
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
    <main data-agy-id="employees-page-main" className="container animate-fade-in page-shell">
      
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
        }
      `}} />

      <div className="page-scroll">
      <div className="no-print">
        {showStatistics && <StatisticsModal data-element-name="רכיב_page_1" isOpen={!!showStatistics} onClose={() => setShowStatistics(false)} pageContext="employees" position={typeof showStatistics === 'object' ? showStatistics : null} />}
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ color: 'var(--primary-color)', margin: 0, fontSize: '2rem', fontWeight: 'bold' }}>ניהול עובדים ונוכחות</h1>
        </div>

        {/* Tabs Navigation */}
        <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid var(--element-border)', marginBottom: '2rem' }}>
          <button data-element-name="כפתור_page_4" 
            data-agy-id="tab-employees-list"
            onClick={() => setActiveTab('list')} 
            style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'list' ? '3px solid var(--primary-color)' : '3px solid transparent', color: activeTab === 'list' ? 'var(--primary-color)' : 'var(--text-muted)', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}
          >
            <Users data-element-name="רכיב_page_5" size={20} />
            רשימת עובדים
          </button>
          <button data-element-name="כפתור_page_6" 
            data-agy-id="tab-attendance"
            onClick={() => setActiveTab('attendance')} 
            style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'attendance' ? '3px solid var(--primary-color)' : '3px solid transparent', color: activeTab === 'attendance' ? 'var(--primary-color)' : 'var(--text-muted)', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}
          >
            <CalendarClock data-element-name="רכיב_page_7" size={20} />
            נוכחות
          </button>
        </div>

        {/* Employees List Tab Content */}
        {activeTab === 'list' && (
          <div className="animate-fade-in">
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ maxWidth: '600px', flex: 1, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <AISearchBar data-element-name="רכיב_page_8" 
                    placeholder="חיפוש עובד (שם, טלפון, קוד)..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onSearch={(e) => { e.preventDefault(); setSearch(searchInput); setIsAiModeActive(false); }}
                    onClear={() => { setSearchInput(''); setSearch(''); setIsAiModeActive(false); }}
                    onAiSearch={handleAiSearch}
                    onStatistics={(e) => setShowStatistics({ x: e.clientX, y: e.clientY })}
                    loading={aiLoading}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '0.3rem', background: 'var(--element-bg)', padding: '0.2rem', borderRadius: '8px', marginRight: '1rem' }}>
                  <button data-element-name="כפתור_page_9" data-agy-id="filter-active-employees" onClick={() => { setFilterStatus('active'); }} style={{ padding: '0.4rem', border: 'none', background: filterStatus === 'active' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: filterStatus === 'active' ? '#10b981' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="עובדים פעילים">
                    <UserCheck data-element-name="רכיב_page_10" size={20} />
                    <span style={{ fontWeight: filterStatus === 'active' ? 'bold' : 'normal' }}>פעילים</span>
                  </button>
                  <button data-element-name="כפתור_page_11" data-agy-id="filter-inactive-employees" onClick={() => { setFilterStatus('inactive'); }} style={{ padding: '0.4rem', border: 'none', background: filterStatus === 'inactive' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: filterStatus === 'inactive' ? '#ef4444' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="לא פעילים">
                    <UserMinus data-element-name="רכיב_page_12" size={20} />
                    <span style={{ fontWeight: filterStatus === 'inactive' ? 'bold' : 'normal' }}>לא פעילים</span>
                  </button>
                  <button data-element-name="כפתור_page_13" data-agy-id="filter-all-employees" onClick={() => { setFilterStatus('all'); }} style={{ padding: '0.4rem', border: 'none', background: filterStatus === 'all' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: filterStatus === 'all' ? '#3b82f6' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="הצג הכל">
                    <Users data-element-name="רכיב_page_14" size={20} />
                    <span style={{ fontWeight: filterStatus === 'all' ? 'bold' : 'normal' }}>הכל</span>
                  </button>
                </div>
                <button data-element-name="כפתור_page_2" 
                  data-agy-id="new-employee-button"
                  onClick={() => router.push('/employees/new')} 
                  className="btn-header-icon"
                  title="עובד חדש"
                >
                  <Plus data-element-name="רכיב_page_3" size={20} />
                </button>
              </div>
            </div>

            <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1rem', boxShadow: 'var(--shadow-sm)' }}>
              {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}>טוען נתונים...</div>
              ) : (
                <>
                <div style={{ overflow: 'visible', minHeight: '50vh' }}>
                <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #ddd', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.4rem 0.5rem' }}>קוד עובד</th>
                      <th style={{ padding: '0.4rem 0.5rem' }}>שם מלא</th>
                      <th style={{ padding: '0.4rem 0.5rem' }}>תפקיד</th>
                      <th style={{ padding: '0.4rem 0.5rem' }}>טלפון</th>
                      <th style={{ padding: '0.4rem 0.5rem' }}>סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map(employee => (
                      <tr data-element-name="לחיץ_page_15" data-agy-id={`employee-row-${employee.id}`} key={employee.id} style={{ borderBottom: '1px solid #eee', cursor: 'pointer', transition: 'background 0.2s' }} onClick={() => router.push(`/employees/${employee.id}`)} onMouseEnter={e => e.currentTarget.style.background = 'var(--element-bg)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{employee.legacyId || employee.id.substring(0, 5)}</td>
                        <td style={{ padding: '0.4rem 0.5rem', fontWeight: '500' }}>{employee.firstName} {employee.lastName}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{employee.department ? employee.department.name : (employee.roleId || 'עובד')}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{employee.phone1 || '-'}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>
                          <span style={{ 
                            padding: '0.3rem 0.8rem', 
                            borderRadius: '20px', 
                            fontSize: '0.85rem',
                            background: employee.isActive ? 'rgba(76, 175, 80, 0.1)' : 'rgba(158, 158, 158, 0.1)',
                            color: employee.isActive ? '#2e7d32' : '#616161'
                          }}>
                            {employee.isActive ? 'פעיל' : 'לא פעיל'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredEmployees.length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>לא נמצאו עובדים התואמים את החיפוש.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Attendance Tab Content */}
        {activeTab === 'attendance' && (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--card-bg)', padding: '0.5rem 1rem', borderRadius: '24px', boxShadow: 'var(--shadow-sm)' }}>
                <button data-element-name="כפתור_page_16" onClick={handlePrevMonth} className="btn btn-ghost" style={{ padding: '0.5rem', borderRadius: '50%', color: 'var(--text-main)' }}>
                  <ChevronRight data-element-name="רכיב_page_17" size={20} />
                </button>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary-color)', minWidth: '130px', textAlign: 'center' }}>
                  {getMonthName(selectedMonth)} {selectedYear}
                </span>
                <button data-element-name="כפתור_page_18" onClick={handleNextMonth} className="btn btn-ghost" style={{ padding: '0.5rem', borderRadius: '50%', color: 'var(--text-main)' }}>
                  <ChevronLeft data-element-name="רכיב_page_19" size={20} />
                </button>
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button data-element-name="כפתור_page_20" 
                  onClick={handlePrintPdfs} 
                  className="btn-header-icon" 
                  disabled={processedAttendance.length === 0}
                  title="הורדת PDF עם דף נוכחות אישי לכל עובד"
                >
                  <Printer data-element-name="רכיב_page_21" size={20} />
                </button>
                <ExportButtons data-element-name="רכיב_page_22" 
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
            </div>

            <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1rem', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ overflow: 'visible', minHeight: '50vh' }}>
              <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.4rem 0.5rem' }}>שם</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>ס"ה דקות</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>כמות ימים</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>תקלות</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>ס"ה</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>נסיעות</th>
                    <th className="no-print" style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingAttendance ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '4rem', textAlign: 'center' }}>
                        <Loader2 data-element-name="רכיב_page_23" className="animate-spin" size={40} style={{ color: 'var(--primary-color)', margin: '0 auto' }} />
                      </td>
                    </tr>
                  ) : processedAttendance.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        לא נמצאו נתוני נוכחות לחודש זה.
                      </td>
                    </tr>
                  ) : (
                    processedAttendance.map(emp => (
                      <tr key={emp.id} style={{ 
                        borderBottom: '1px solid #eee', 
                        background: emp.issues > 0 ? '#ffeb3b4a' : 'transparent',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = emp.issues > 0 ? '#ffeb3b70' : 'var(--element-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = emp.issues > 0 ? '#ffeb3b4a' : 'transparent'}
                      >
                        <td style={{ padding: '0.4rem 0.5rem', fontWeight: '500' }}>{emp.fullName}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{emp.timeStr}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{emp.daysCount}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>
                          {emp.issues > 0 && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#b71c1c', fontWeight: 'bold' }}>
                              {emp.issues} <AlertTriangle data-element-name="רכיב_page_24" size={16} />
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', fontWeight: '500' }}>{emp.totalCalculated.toFixed(2)}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{emp.hasTravels}</td>
                        <td className="no-print" style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                          <button data-element-name="כפתור_page_25" onClick={(e) => { e.stopPropagation(); handlePrintPdfs(emp.id); }} className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="הדפס דוח אישי לעובד זה">
                            <Printer data-element-name="רכיב_page_26" size={16} />
                            הדפס
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hidden Print Area for Individual PDF Reports */}
      {activeTab === 'attendance' && (
        <div id="print-area">
          <div className="bsd-header" style={{ display: 'none' }}>בס"ד</div>
          {!loadingAttendance && processedAttendance.length > 0 && processedAttendance.filter(emp => !printEmployeeId || emp.id === printEmployeeId).map(emp => {
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
                      <th style={{ padding: '0.75rem', borderBottom: '2px solid #ddd', textAlign: 'center' }}>סה"כ שעות</th>
                      <th style={{ padding: '0.75rem', borderBottom: '2px solid #ddd', textAlign: 'left' }}>סה"כ לתשלום</th>
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
                    <span style={{ color: '#666', marginRight: '0.5rem' }}>סה"כ משמרות:</span>
                    <strong style={{ fontSize: '1.2rem' }}>{emp.daysCount}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#666', marginRight: '0.5rem' }}>סה"כ שעות:</span>
                    <strong style={{ fontSize: '1.2rem' }}>{totalHours}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#666', marginRight: '0.5rem' }}>סה"כ לתשלום:</span>
                    <strong style={{ fontSize: '1.2rem', color: '#10b981' }}>₪{emp.totalCalculated.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* סיכום הרשומות — מוצמד תמיד לתחתית המסך */}
      <div className="page-footer-bar no-print">
        <div className="page-footer-summary" style={{ width: '100%', textAlign: 'center' }}>
          {activeTab === 'list'
            ? `סה"כ שורות מוצגות: ${loading ? '...' : filteredEmployees.length}`
            : `סה"כ שורות מוצגות: ${loadingAttendance ? '...' : processedAttendance.length}`}
        </div>
      </div>
    </main>
  );
}
