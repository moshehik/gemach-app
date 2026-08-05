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

  async function fetchData() {
    try {
      setLoading(true);

      let showOnlyPending = reportType === 'alterations_pending' || reportType === 'labels';
      let hideNoAlterations = reportType === 'orders_no_alterations';
      let showAllOrders = reportType === 'orders_all';

      let url = `/api/alterations?showOnlyPending=${showOnlyPending}&hideNoAlterations=${hideNoAlterations}&showAllOrders=${showAllOrders}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      // Settings and alterations are independent - fetch them together instead of
      // waiting on settings before even starting the alterations request.
      const [settingsRes, res] = await Promise.all([
        fetch('/api/settings'),
        fetch(url)
      ]);

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        const altSetting = settingsData.find(s => s.key === 'enable_alterations');
        if (altSetting && altSetting.value === 'false') {
          setEnableAlterations(false);
          setLoading(false);
          return;
        }
      }

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
    return getHebrewDateString(dateString);
  };

  function getReportTitle() {
    if (reportType === 'orders_all') return 'דוח הזמנות כללי';
    if (reportType === 'orders_no_alterations') return 'רשימת הזמנות ללא תיקונים';
    if (reportType === 'alterations_all') return 'כל התיקונים';
    if (reportType === 'labels') return 'תוויות לתופרות';
    return 'רשימת תיקונים לביצוע';
  };

  let groupedItems = [];
  if ((reportType === 'labels' || reportType === 'orders_all') && items.length > 0) {
    const sorted = [...items].sort((a, b) => {
      const dateA = new Date(a.order?.eventDate || '2100-01-01').getTime();
      const dateB = new Date(b.order?.eventDate || '2100-01-01').getTime();
      if (dateA !== dateB) return dateA - dateB;

      const nameA = ((a.order?.customer?.firstName || '') + ' ' + (a.order?.customer?.lastName || '')).toLowerCase();
      const nameB = ((b.order?.customer?.firstName || '') + ' ' + (b.order?.customer?.lastName || '')).toLowerCase();
      if (nameA !== nameB) return nameA.localeCompare(nameB, 'he');

      const dressA = (a.dressItem?.dress?.name || a.dressItem?.dressName || '').toLowerCase();
      const dressB = (b.dressItem?.dress?.name || b.dressItem?.dressName || '').toLowerCase();
      if (dressA !== dressB) return dressA.localeCompare(dressB, 'he');

      const sizeA = (a.sizeText || a.size || '').toString().toLowerCase();
      const sizeB = (b.sizeText || b.size || '').toString().toLowerCase();
      return sizeA.localeCompare(sizeB, 'he', { numeric: true });
    });

    const groups = {};
    sorted.forEach(item => {
      const dateKey = item.order?.eventDate ? item.order.eventDate.split('T')[0] : 'ללא תאריך';
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(item);
    });
    
    groupedItems = Object.keys(groups).map(key => ({
       date: key,
       items: groups[key]
    }));
  }

  return (
    <div data-agy-id="print-alterations-container" className="print-container" style={{ padding: '20px', direction: 'rtl' }}>
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          body {
            background: white !important;
            height: auto !important;
            overflow: visible !important;
          }
          /* Hide layout elements instead of visibility trick */
          nav.navbar, 
          .dev-env-container, 
          .offline-indicator,
          .ai-floating-widget {
            display: none !important;
          }
          .print-container {
            width: 100%;
            height: auto !important;
            overflow: visible !important;
            margin: 0;
            padding: 0;
            display: block !important;
            filter: grayscale(100%);
            color: black !important;
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

      {reportType === 'orders_all' && (
        <div style={{ position: 'absolute', top: '20px', right: '20px', fontWeight: 'bold', fontSize: '14px' }}>בס"ד</div>
      )}

      <div className="print-header">
        <h1>{getReportTitle()}</h1>
        <h3>
          {dateMode === 'today' ? `תאריך: ${getHebrewDateString(new Date().toISOString())}` : `מתאריך: ${formatDate(startDate)} | עד תאריך: ${formatDate(endDate)}`}
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
        <div style={{ marginTop: '20px' }}>
          {groupedItems.length === 0 ? (
            <div style={{ textAlign: 'center' }}>לא נמצאו תיקונים להדפסה</div>
          ) : (
            groupedItems.map(group => (
              <div key={group.date} style={{ marginBottom: '30px' }}>
                <h3 style={{ borderBottom: '2px solid black', paddingBottom: '5px', marginBottom: '15px', color: 'black' }}>
                  תאריך אירוע: {group.items[0].order?.eventDateHebrew || (group.date !== 'ללא תאריך' ? getHebrewDateString(group.date) : 'ללא תאריך')}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                  {group.items.map(item => (
                    <div key={item.id} style={{ 
                      position: 'relative',
                      border: '1px solid #000', 
                      padding: '15px', 
                      borderRadius: '8px',
                      display: 'flex', 
                      flexDirection: 'column', 
                      justifyContent: 'center', 
                      alignItems: 'center',
                      textAlign: 'center',
                      minHeight: '150px',
                      pageBreakInside: 'avoid',
                      background: '#fff',
                      color: '#000'
                    }}>
                      <div style={{ position: 'absolute', top: '5px', right: '10px', fontSize: '12px', fontWeight: 'bold' }}>בס"ד</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
                        {item.order?.customer?.firstName} {item.order?.customer?.lastName}
                      </div>
                        דגם: {
                          item.dressItem?.dress?.name 
                            ? `${item.dressItem.dress.name} ${item.dressItem.dress.barcodePrefix || item.dressItem.barcodePrefix || item.barcodePrefix ? `(קוד: ${item.dressItem.dress.barcodePrefix || item.dressItem.barcodePrefix || item.barcodePrefix})` : ''}`
                            : (item.dressItem?.dressName || item.description || '-')
                        }
                      <div style={{ fontSize: '16px', marginBottom: '15px' }}>
                        מידה: <strong>{item.sizeText || item.size}</strong>
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 'bold', borderTop: '1px dashed #000', paddingTop: '10px', width: '100%' }}>
                        {item.neckAlteration > 0 ? `צוואר: הצרה ${item.neckAlteration} | ` : ''}
                        {item.sleeveAlteration > 0 ? `שרוול: הארכה ${item.sleeveAlteration} | ` : ''}
                        {item.lengthAlteration ? `אורך: ${item.lengthAlteration} | ` : ''}
                        {item.alterationDetails || ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : reportType === 'orders_all' ? (
        <div style={{ marginTop: '20px' }}>
          {groupedItems.length === 0 ? (
            <div style={{ textAlign: 'center' }}>לא נמצאו רשומות</div>
          ) : (
            groupedItems.map(group => {
              const dayOfWeek = group.date !== 'ללא תאריך' ? new Date(group.date).toLocaleDateString('he-IL', { weekday: 'long' }) : '';
              return (
                <div key={group.date} style={{ marginBottom: '40px', pageBreakInside: 'avoid' }}>
                  <h3 style={{ borderBottom: '2px solid black', paddingBottom: '5px', marginBottom: '10px' }}>
                    יום {dayOfWeek} - {group.items[0].order?.eventDateHebrew || (group.date !== 'ללא תאריך' ? getHebrewDateString(group.date) : 'ללא תאריך')}
                  </h3>
                  <table className="print-table" style={{ background: '#fff', border: '1px solid #000' }}>
                    <thead>
                      <tr>
                        <th style={{ backgroundColor: '#fff', color: '#000', border: '1px solid #000', WebkitPrintColorAdjust: 'exact', padding: '8px' }}>לקוח</th>
                        <th style={{ backgroundColor: '#fff', color: '#000', border: '1px solid #000', WebkitPrintColorAdjust: 'exact', padding: '8px' }}>דגם שמלה</th>
                        <th style={{ backgroundColor: '#fff', color: '#000', border: '1px solid #000', WebkitPrintColorAdjust: 'exact', padding: '8px' }}>מידה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map(item => (
                        <tr key={item.id}>
                          <td style={{ border: '1px solid #000', padding: '8px' }}>{item.order?.customer?.firstName} {item.order?.customer?.lastName}</td>
                          <td style={{ border: '1px solid #000', padding: '8px' }}>
                            {item.dressItem?.dress?.name 
                              ? `${item.dressItem.dress.name} ${item.dressItem.dress.barcodePrefix || item.dressItem.barcodePrefix || item.barcodePrefix ? `(קוד: ${item.dressItem.dress.barcodePrefix || item.dressItem.barcodePrefix || item.barcodePrefix})` : ''}`
                              : (item.dressItem?.dressName || item.description || '-')}
                          </td>
                          <td style={{ border: '1px solid #000', padding: '8px' }}>{item.sizeText || item.size}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })
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
                  </td>
                  <td>{item.order?.customer?.firstName} {item.order?.customer?.lastName}</td>
                  <td>
                    {item.dressItem?.dress?.name 
                      ? `${item.dressItem.dress.name} ${item.dressItem.dress.barcodePrefix || item.dressItem.barcodePrefix || item.barcodePrefix ? `(קוד: ${item.dressItem.dress.barcodePrefix || item.dressItem.barcodePrefix || item.barcodePrefix})` : ''}`
                      : (item.dressItem?.dressName || item.description || '-')}
                  </td>
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
