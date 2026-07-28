'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Printer, FileSpreadsheet, ArrowRight, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getHebrewDateString } from '../../../lib/hebrewDate';

export default function AttendanceReportPage() {
  const router = useRouter();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  useEffect(() => {
    fetchData(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear]);

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
    <div className="container animate-fade-in" style={{ paddingTop: '2rem', minHeight: '100vh', paddingBottom: '3rem' }}>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          .employee-page {
            page-break-after: always;
            margin-bottom: 2cm;
          }
        }
      `}} />

      <div className="no-print">
        <button 
          onClick={() => router.push('/employees')}
          className="btn btn-ghost" 
          style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <ArrowRight size={20} />
          חזור לניהול עובדים
        </button>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ color: 'var(--primary-color)', margin: 0 }}>דוח נוכחות חודשי</h1>
            <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0 0' }}>
              הפקת דוח נוכחות לכלל העובדים ב-PDF או אקסל (כל עובד בעמוד נפרד).
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select 
                value={selectedMonth} 
                onChange={e => setSelectedMonth(parseInt(e.target.value))}
                style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)' }}
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i+1} value={i+1}>{getMonthName(i+1)}</option>
                ))}
              </select>
              <select 
                value={selectedYear} 
                onChange={e => setSelectedYear(parseInt(e.target.value))}
                style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)' }}
              >
                {[...Array(5)].map((_, i) => {
                  const y = currentDate.getFullYear() - i;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
            </div>
            
            <button 
              onClick={handlePrint} 
              className="btn btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              disabled={loading || data.length === 0}
            >
              <Printer size={18} />
              הדפס / PDF
            </button>
            <button 
              onClick={handleExportExcel} 
              className="btn btn-primary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              disabled={loading || data.length === 0}
            >
              <FileSpreadsheet size={18} />
              ייצוא לאקסל
            </button>
          </div>
        </div>
      </div>

      <div id="print-area">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
            <Loader2 className="animate-spin" size={40} style={{ color: 'var(--primary-color)' }} />
          </div>
        ) : data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--card-bg)', borderRadius: '12px' }}>
            לא נמצאו נתוני נוכחות לחודש המבוקש.
          </div>
        ) : (
          <div>
            {data.map((employee) => {
              if (employee.shifts.length === 0) return null; // Skip employees with no shifts
              
              const totalMinutes = employee.shifts.reduce((sum, s) => sum + (s.totalMinutes || 0), 0);
              const totalHours = (totalMinutes / 60).toFixed(2);
              const totalAmount = employee.shifts.reduce((sum, s) => sum + (s.totalCalculated || 0), 0);

              return (
                <div key={employee.id} className="employee-page" style={{ background: '#fff', color: '#000', padding: '2rem', borderRadius: '12px', marginBottom: '2rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                  <div style={{ borderBottom: '2px solid #eee', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h2 style={{ margin: '0 0 0.5rem 0' }}>דוח נוכחות עובד: {employee.firstName} {employee.lastName}</h2>
                      <div style={{ fontSize: '1.1rem', color: '#555' }}>
                        תקופה: {getMonthName(selectedMonth)} {selectedYear}
                      </div>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      {employee.department && <div style={{ fontSize: '1rem', color: '#666' }}>מחלקה: {employee.department.name}</div>}
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
                      {employee.shifts.map((shift) => (
                        <tr key={shift.id}>
                          <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee' }}>
                            {shift.date ? getHebrewDateString(shift.date) : '-'}
                          </td>
                          <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee', textAlign: 'center' }}>
                            {shift.entryTime ? new Date(shift.entryTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </td>
                          <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee', textAlign: 'center' }}>
                            {shift.exitTime ? new Date(shift.exitTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '-'}
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
                      <strong style={{ fontSize: '1.2rem' }}>{employee.shifts.length}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#666', marginRight: '0.5rem' }}>סה"כ שעות:</span>
                      <strong style={{ fontSize: '1.2rem' }}>{totalHours}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#666', marginRight: '0.5rem' }}>סה"כ לתשלום:</span>
                      <strong style={{ fontSize: '1.2rem', color: '#10b981' }}>₪{totalAmount.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
