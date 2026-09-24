'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { V3Page, Card, Btn, Field, Tag, Tip, Empty, Icon } from '@/app/v3/ui/components';
import { v3Toast } from '@/app/v3/notify';

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
        v3Toast('לא הצלחנו לטעון את נתוני הנוכחות.', 'error');
      }
    } catch (e) {
      console.error(e);
      v3Toast('אין תקשורת עם השרת, נסו שוב.', 'error');
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

  const handleExportExcel = async () => {
    // xlsx (~900KB) נטען דינמית רק בלחיצה על הייצוא — לא חלק מה-bundle של הדף
    const XLSX = await import('xlsx');
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
    <V3Page>
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
          #print-area .v3-card {
            background: #fff !important;
            box-shadow: none !important;
            border: none !important;
          }
          #print-area .v3-table__wrap {
            border: none !important;
            border-radius: 0 !important;
          }
          #print-area .v3-table thead th,
          #print-area .report-foot {
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

      <div className="no-print v3-stack">
        <div>
          <Btn variant="quiet" icon="arrow-end" onClick={() => router.push('/employees')}>חזרה לעובדים</Btn>
        </div>

        <header className="v3-pagehead">
          <div className="v3-pagehead__title">
            <h1 className="v3-h1">דוח נוכחות חודשי</h1>
            <Tip>מפיקים דוח שעות לכל העובדים בחודש שנבחר. אפשר להדפיס או לשמור כ-PDF (עמוד נפרד לכל עובד), או לייצא לאקסל.</Tip>
          </div>
        </header>

        <Card>
          <div className="v3-stack">
            <Field
              as="select"
              id="employees-report-month"
              label="חודש"
              value={selectedMonth}
              onChange={e => setSelectedMonth(parseInt(e.target.value))}
            >
              {[...Array(12)].map((_, i) => (
                <option key={i + 1} value={i + 1}>{getMonthName(i + 1)}</option>
              ))}
            </Field>
            <Field
              as="select"
              id="employees-report-year"
              label="שנה"
              value={selectedYear}
              onChange={e => setSelectedYear(parseInt(e.target.value))}
            >
              {[...Array(5)].map((_, i) => {
                const y = currentDate.getFullYear() - i;
                return <option key={y} value={y}>{y}</option>;
              })}
            </Field>
            <div className="v3-cluster">
              <Btn
                variant="primary"
                icon="printer"
                onClick={handlePrint}
                disabled={loading || data.length === 0}
              >
                הדפסה / PDF
              </Btn>
              <Btn
                icon="download"
                onClick={handleExportExcel}
                disabled={loading || data.length === 0}
              >
                ייצוא לאקסל
              </Btn>
            </div>
          </div>
        </Card>
      </div>

      <div id="print-area" className="v3-stack">
        <div className="bsd-header" style={{ display: 'none' }}>בס&quot;ד</div>
        {loading ? (
          <div className="v3-empty" role="status">
            <Icon name="loader" size="xl" loop />
          </div>
        ) : data.length === 0 ? (
          <Empty icon="calendar" text="אין נתוני נוכחות לחודש שנבחר." />
        ) : (
          <div className="v3-stack">
            {data.map((employee) => {
              if (employee.shifts.length === 0) return null; // Skip employees with no shifts

              const totalMinutes = employee.shifts.reduce((sum, s) => sum + (s.totalMinutes || 0), 0);
              const totalHours = (totalMinutes / 60).toFixed(2);
              const totalAmount = employee.shifts.reduce((sum, s) => sum + (s.totalCalculated || 0), 0);
              const initials = `${(employee.firstName || '').charAt(0)}${(employee.lastName || '').charAt(0)}`;

              return (
                <Card key={employee.id} className="employee-page">
                  <div className="v3-stack">
                    <div className="v3-cluster">
                      <span className="v3-avatar" aria-hidden="true">{initials}</span>
                      <div>
                        <h2 className="v3-h2">{employee.firstName} {employee.lastName}</h2>
                        <div className="v3-faint">תקופה: {getMonthName(selectedMonth)} <bdi>{selectedYear}</bdi></div>
                      </div>
                      {employee.department && (
                        <Tag variant="soft" icon="category">מחלקה: {employee.department.name}</Tag>
                      )}
                    </div>

                    <div className="v3-table__wrap">
                      <table className="v3-table">
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
                            <th scope="col">תאריך</th>
                            <th scope="col">כניסה</th>
                            <th scope="col">יציאה</th>
                            <th scope="col">שעות</th>
                            <th scope="col">לתשלום</th>
                          </tr>
                        </thead>
                        <tbody>
                          {employee.shifts.map((shift) => (
                            <tr key={shift.id}>
                              <td>{shift.date ? getHebrewDateString(shift.date) : '-'}</td>
                              <td>{shift.entryTime ? <bdi>{new Date(shift.entryTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</bdi> : '-'}</td>
                              <td>{shift.exitTime ? <bdi>{new Date(shift.exitTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</bdi> : '-'}</td>
                              <td><bdi>{shift.totalMinutes ? (shift.totalMinutes / 60).toFixed(2) : '0.00'}</bdi></td>
                              <td><b>₪<bdi>{shift.totalCalculated ? shift.totalCalculated.toFixed(2) : '0.00'}</bdi></b></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="report-foot v3-stack">
                      <div><span className="v3-faint">סה&quot;כ משמרות</span><br /><b><bdi>{employee.shifts.length}</bdi></b></div>
                      <div><span className="v3-faint">סה&quot;כ שעות</span><br /><b><bdi>{totalHours}</bdi></b></div>
                      <div><span className="v3-faint">סה&quot;כ לתשלום</span><br /><b className="v3-big">₪<bdi>{totalAmount.toFixed(2)}</bdi></b></div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </V3Page>
  );
}
