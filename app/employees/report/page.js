'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { getHebrewDateString } from '../../../lib/hebrewDate';

export default function AttendanceReportPage() {
  const router = useRouter();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  const fetchData = async (month, year) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/employees/attendance?month=${month}&year=${year}`);
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      } else {
        alert('שגיאה בטעינת הנתונים');
      }
    } catch (e) {
      console.error(e);
      alert('שגיאת תקשורת');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sort employees to have them in order
    const sortedData = [...data].sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));

    // Add summary sheet
    const summaryData = sortedData.map(emp => {
      const totalMinutes = emp.shifts.reduce((sum, shift) => sum + (shift.totalMinutes || 0), 0);
      const totalHours = (totalMinutes / 60).toFixed(2);
      const totalCalculated = emp.shifts.reduce((sum, shift) => sum + (shift.totalCalculated || 0), 0);

      return {
        'מזהה עובד': emp.id,
        'שם העובד': `${emp.firstName || ''} ${emp.lastName || ''}`,
        'מספר משמרות': emp.shifts.length,
        'סה"כ שעות': totalHours,
        'סה"כ תשלום': totalCalculated.toFixed(2)
      };
    });

    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'ריכוז נתונים');

    // Add a sheet for each employee
    sortedData.forEach(emp => {
      if (emp.shifts.length === 0) return; // Skip empty

      const sheetName = `${emp.firstName || 'עובד'} ${emp.lastName || ''}`.substring(0, 31).trim() || 'ללא שם';

      const empData = emp.shifts.map(shift => {
        return {
          'תאריך': shift.date ? getHebrewDateString(shift.date) : '',
          'כניסה': shift.entryTime ? new Date(shift.entryTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '',
          'יציאה': shift.exitTime ? new Date(shift.exitTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '',
          'סה"כ דקות': shift.totalMinutes || 0,
          'שכר שעה': shift.hourlyWageSnapshot || '',
          'נסיעות': shift.travelExpensesSnapshot || 0,
          'סה"כ יומי': shift.totalCalculated || 0,
          'הערות': shift.notes || ''
        };
      });

      const ws = XLSX.utils.json_to_sheet(empData);

      // We wrap appending in try-catch in case of duplicate sheet names (max 31 chars)
      try {
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      } catch (e) {
         try {
           XLSX.utils.book_append_sheet(wb, ws, `${sheetName} ${emp.id.substring(0,4)}`);
         } catch(err){}
      }
    });

    XLSX.writeFile(wb, `דוח_נוכחות_${selectedMonth}_${selectedYear}.xlsx`);
  };

  const getMonthName = (monthNum) => {
    const d = new Date(2000, monthNum - 1, 1);
    return d.toLocaleDateString('he-IL', { month: 'long' });
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
            color: black !important;
            filter: grayscale(100%) !important;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            direction: rtl;
            overflow: visible !important;
          }
          #print-area .card {
            background: #fff !important;
            box-shadow: none !important;
          }
          #print-area table.data thead th,
          #print-area .table-foot {
            background: #fff !important;
          }
          .no-print {
            display: none !important;
          }
          .bsd-header {
            display: block !important;
            text-align: center;
            font-size: 1.2rem;
            font-weight: bold;
            margin-bottom: 1rem;
          }
          ::-webkit-scrollbar { display: none; }
          .employee-page {
            page-break-after: always;
            margin-bottom: 0;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          .employee-page:last-child {
            page-break-after: auto;
          }
          .employee-page thead { display: table-header-group; }
          .employee-page tr { break-inside: avoid; page-break-inside: avoid; }
        }
      `}} />

      <div className="no-print">
        <button type="button" onClick={() => router.push('/employees')} className="btn btn-ghost" style={{ marginBottom: '16px' }}>
          <svg className="icon"><use href="#i-arrow-end" /></svg>
          חזור לניהול עובדים
        </button>

        <div className="page-head">
          <div>
            <h1>דוח נוכחות חודשי</h1>
            <div className="page-desc">הפקת דוח נוכחות לכלל העובדים ב-PDF או אקסל (כל עובד בעמוד נפרד).</div>
          </div>
          <div className="page-actions" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="employees-report-month">חודש</label>
              <select
                id="employees-report-month"
                className="select"
                value={selectedMonth}
                onChange={e => setSelectedMonth(parseInt(e.target.value))}
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>{getMonthName(i + 1)}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="employees-report-year">שנה</label>
              <select
                id="employees-report-year"
                className="select"
                value={selectedYear}
                onChange={e => setSelectedYear(parseInt(e.target.value))}
              >
                {[...Array(5)].map((_, i) => {
                  const y = currentDate.getFullYear() - i;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
            </div>
            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-secondary btn-icon-only"
              title="הדפס / PDF"
              disabled={loading || data.length === 0}
            >
              <svg className="icon"><use href="#i-printer" /></svg>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="btn btn-secondary btn-icon-only"
              title="ייצוא לאקסל"
              disabled={loading || data.length === 0}
            >
              <svg className="icon"><use href="#i-download" /></svg>
            </button>
          </div>
        </div>
      </div>

      <div id="print-area">
        <div className="bsd-header" style={{ display: 'none' }}>בס&quot;ד</div>
        {loading ? (
          <div className="page-loading">
            <span className="spinner lg" />
          </div>
        ) : data.length === 0 ? (
          <div className="empty-state">
            <svg className="icon"><use href="#i-calendar" /></svg>
            <p>לא נמצאו נתוני נוכחות לחודש המבוקש.</p>
          </div>
        ) : (
          <div>
            {data.map((employee) => {
              if (employee.shifts.length === 0) return null; // Skip employees with no shifts

              const totalMinutes = employee.shifts.reduce((sum, s) => sum + (s.totalMinutes || 0), 0);
              const totalHours = (totalMinutes / 60).toFixed(2);
              const totalAmount = employee.shifts.reduce((sum, s) => sum + (s.totalCalculated || 0), 0);
              const initials = `${(employee.firstName || '').charAt(0)}${(employee.lastName || '').charAt(0)}`;

              return (
                <div key={employee.id} className="card employee-page" style={{ marginBottom: '20px' }}>
                  <div className="card-head">
                    <div className="card-title-row">
                      <div className="avatar">{initials}</div>
                      <div>
                        <h2 style={{ fontSize: '15px', margin: 0 }}>דוח נוכחות עובד: {employee.firstName} {employee.lastName}</h2>
                        <div className="hint" style={{ color: 'var(--text-3)' }}>תקופה: {getMonthName(selectedMonth)} {selectedYear}</div>
                      </div>
                    </div>
                    {employee.department && (
                      <span className="badge badge-neutral">
                        <svg className="icon"><use href="#i-category" /></svg>
                        מחלקה: {employee.department.name}
                      </span>
                    )}
                  </div>

                  <div className="table-wrap" style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
                    <table className="data">
                      <thead>
                        {/* שורה נוספת ב-thead (לא רק כותרות העמודות) - כדי שהחודש/שנה יופיעו מחדש
                            בראש כל עמוד פיזי כשטבלת המשמרות של עובד נשברת לכמה עמודי הדפסה, בדיוק
                            כמו שורת כותרות העמודות עצמה חוזרת בזכות table-header-group. */}
                        <tr>
                          <th colSpan={5} style={{ textAlign: 'center' }}>
                            תקופה: {getMonthName(selectedMonth)} {selectedYear}
                          </th>
                        </tr>
                        <tr>
                          <th>תאריך</th>
                          <th>כניסה</th>
                          <th>יציאה</th>
                          <th>סה&quot;כ שעות</th>
                          <th>סה&quot;כ לתשלום</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employee.shifts.map((shift) => (
                          <tr key={shift.id}>
                            <td>{shift.date ? getHebrewDateString(shift.date) : '-'}</td>
                            <td>{shift.entryTime ? new Date(shift.entryTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                            <td>{shift.exitTime ? new Date(shift.exitTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                            <td>{shift.totalMinutes ? (shift.totalMinutes / 60).toFixed(2) : '0.00'}</td>
                            <td className="cell-primary">₪{shift.totalCalculated ? shift.totalCalculated.toFixed(2) : '0.00'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="table-foot">
                    <span>סה&quot;כ משמרות: <strong>{employee.shifts.length}</strong></span>
                    <span>סה&quot;כ שעות: <strong>{totalHours}</strong></span>
                    <span>סה&quot;כ לתשלום: <strong style={{ color: 'var(--success)' }}>₪{totalAmount.toFixed(2)}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
