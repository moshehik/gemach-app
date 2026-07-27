'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getHebrewDateString } from '../../../lib/hebrewDate';

export default function PrintAlterationsPage() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enableAlterations, setEnableAlterations] = useState(true);

  const reportType = searchParams.get('reportType') || 'alterations_pending';
  const dateMode = searchParams.get('dateMode') || 'today';
  let startDate = searchParams.get('startDate');
  let endDate = searchParams.get('endDate');

  if (dateMode === 'today') {
    const todayStr = new Date().toISOString().split('T')[0];
    startDate = todayStr;
    endDate = todayStr;
  }

  useEffect(() => {
    fetchData();
  }, [reportType, startDate, endDate]);

  useEffect(() => {
    // Auto trigger print when loaded
    if (!loading && !error) {
      const title = getReportTitle();
      fetch('/api/log-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageUrl: `[הדפסת דוח] ${title} (תאריכים: ${startDate} - ${endDate})` })
      }).catch(console.error);

      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loading, error, reportType, startDate, endDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const settingsRes = await fetch('/api/settings');
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        const altSetting = settingsData.find(s => s.key === 'enable_alterations');
        if (altSetting && altSetting.value === 'false') {
          setEnableAlterations(false);
          setLoading(false);
          return;
        }
      }

      let showOnlyPending = reportType === 'alterations_pending' || reportType === 'labels';
      let hideNoAlterations = reportType === 'orders_no_alterations';
      let showAllOrders = reportType === 'orders_all';

      let url = `/api/alterations?showOnlyPending=${showOnlyPending}&hideNoAlterations=${hideNoAlterations}&showAllOrders=${showAllOrders}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch data');
      const data = await res.json();
      setItems(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('he-IL');
  };

  const getReportTitle = () => {
    if (reportType === 'orders_all') return 'דוח הזמנות כללי';
    if (reportType === 'orders_no_alterations') return 'רשימת הזמנות ללא תיקונים';
    if (reportType === 'alterations_all') return 'כל התיקונים';
    if (reportType === 'labels') return 'תוויות לתופרות';
    return 'רשימת תיקונים לביצוע';
  };

  return (
    <div data-agy-id="print-alterations-container" className="print-container" style={{ padding: '20px', direction: 'rtl' }}>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-container, .print-container * {
            visibility: visible;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          /* Hide the layout nav inside print */
          nav {
            display: none !important;
          }
        }
        .print-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        .print-table th, .print-table td {
          border: 1px solid #000;
          padding: 8px;
          text-align: right;
          font-size: 14px;
        }
        .print-table th {
          background-color: #f2f2f2;
          font-weight: bold;
          -webkit-print-color-adjust: exact;
        }
        .print-header {
          text-align: center;
          margin-bottom: 20px;
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
        }
      `}</style>

      <div className="print-header">
        <h1>{getReportTitle()}</h1>
        <h3>
          {dateMode === 'today' ? `תאריך: ${new Date().toLocaleDateString('he-IL')}` : `מתאריך: ${formatDate(startDate)} | עד תאריך: ${formatDate(endDate)}`}
        </h3>
      </div>

      {loading ? (
        <div>טוען נתונים להדפסה...</div>
      ) : error ? (
        <div style={{ color: 'red' }}>{error}</div>
      ) : !enableAlterations ? (
        <div style={{ textAlign: 'center', padding: '50px', fontSize: '20px', color: '#6c757d', fontWeight: 'bold' }}>
          מערכת התיקונים מכובה בהגדרות. לא ניתן להפיק דוח תיקונים.
        </div>
      ) : reportType === 'labels' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginTop: '20px' }}>
          {items.length === 0 ? (
            <div style={{ gridColumn: 'span 3', textAlign: 'center' }}>לא נמצאו תיקונים להדפסה</div>
          ) : (
            items.map(item => (
              <div key={item.id} style={{ 
                border: '1px solid #000', 
                padding: '15px', 
                borderRadius: '8px',
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                alignItems: 'center',
                textAlign: 'center',
                minHeight: '180px',
                pageBreakInside: 'avoid'
              }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
                  {item.order?.customer?.firstName} {item.order?.customer?.lastName}
                </div>
                <div style={{ fontSize: '16px', marginBottom: '5px' }}>
                  <strong>{item.dressItem?.dress?.name || item.dressItem?.dressName}</strong> | מידה: {item.sizeText || item.size}
                </div>
                <div style={{ fontSize: '14px', marginBottom: '10px' }}>
                  אירוע: <strong>{item.order?.eventDateHebrew || (item.order?.eventDate ? getHebrewDateString(item.order.eventDate) : '-')}</strong> {item.order?.eventDate ? `(${formatDate(item.order.eventDate)})` : ''}
                </div>
                <div style={{ fontSize: '15px', fontWeight: 'bold', borderTop: '1px dashed #ccc', paddingTop: '8px', width: '100%' }}>
                  {item.neckAlteration > 0 ? `צוואר: הצרה ${item.neckAlteration} | ` : ''}
                  {item.sleeveAlteration > 0 ? `שרוול: הארכה ${item.sleeveAlteration} | ` : ''}
                  {item.lengthAlteration ? `אורך: ${item.lengthAlteration} | ` : ''}
                  {item.alterationDetails || ''}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <table className="print-table">
          <thead>
            <tr>
              <th>תאריך אירוע</th>
              <th>לקוח</th>
              <th>דגם שמלה</th>
              <th>מידה</th>
              {reportType !== 'orders_no_alterations' && reportType !== 'orders_all' && (
                <>
                  <th>צוואר</th>
                  <th>שרוול</th>
                  <th>אורך</th>
                  <th>פירוט</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={(reportType === 'orders_no_alterations' || reportType === 'orders_all') ? 4 : 8} style={{ textAlign: 'center' }}>לא נמצאו רשומות</td>
              </tr>
            ) : (
              items.map(item => (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 'bold' }}>{item.order?.eventDateHebrew || (item.order?.eventDate ? getHebrewDateString(item.order.eventDate) : '-')}</div>
                    {item.order?.eventDate && <div style={{ fontSize: '11px', color: '#666' }}>{formatDate(item.order.eventDate)}</div>}
                  </td>
                  <td>{item.order?.customer?.firstName} {item.order?.customer?.lastName}</td>
                  <td>{item.dressItem?.dress?.name || item.dressItem?.dressName}</td>
                  <td>{item.sizeText || item.size}</td>
                  {reportType !== 'orders_no_alterations' && reportType !== 'orders_all' && (
                    <>
                      <td>{item.neckAlteration > 0 ? `הצרה ${item.neckAlteration}` : ''}</td>
                      <td>{item.sleeveAlteration > 0 ? `הארכה ${item.sleeveAlteration}` : ''}</td>
                      <td>{item.lengthAlteration ? item.lengthAlteration : ''}</td>
                      <td>{item.alterationDetails || ''}</td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
