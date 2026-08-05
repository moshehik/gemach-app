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
    return getHebrewDateString(dateString);
  };

  function getReportTitle() {
    if (reportType === 'orders_all') return 'דוח הזמנות כללי';
    if (reportType === 'orders_no_alterations') return 'רשימת הזמנות ללא תיקונים';
    if (reportType === 'alterations_all') return 'כל התיקונים';
    if (reportType === 'labels') return 'תוויות לתופרות';
    return 'רשימת תיקונים לביצוע';
  };

  // Field fallbacks mirroring the legacy Access reports: the dress-model name
  // is resolved through the barcode prefix (dressModelName from the API) so
  // it prints even when no physical item was assigned yet.
  const dressLabelOf = (item) => {
    const name = item.dressModelName || item.dressItem?.dress?.name || item.dressItem?.dressName || item.description || '';
    const prefix = item.dressPrefix ?? item.dressItem?.dress?.barcodePrefix ?? item.barcodePrefix;
    if (name && prefix != null) return `${name} - ${prefix}`;
    if (name) return name;
    if (prefix != null) return `דגם ${prefix}`;
    return '-';
  };
  const sizeLabelOf = (item) => (item.sizeText || item.size || item.dressItem?.sizeText || '-').toString();
  const customerNameOf = (item) => `${item.order?.customer?.firstName || ''} ${item.order?.customer?.lastName || ''}`.trim();

  // Sorting per the Access reports:
  // labels (תופרות_תוויות): event date -> dress -> size -> customer
  // reports (הזמנות / תופרות_עבודות): event date -> customer -> order -> dress -> size
  let groupedItems = [];
  if (items.length > 0) {
    const sorted = [...items].sort((a, b) => {
      const dateA = new Date(a.order?.eventDate || '2100-01-01').getTime();
      const dateB = new Date(b.order?.eventDate || '2100-01-01').getTime();
      if (dateA !== dateB) return dateA - dateB;

      if (reportType === 'labels') {
        const dA = dressLabelOf(a), dB = dressLabelOf(b);
        if (dA !== dB) return dA.localeCompare(dB, 'he', { numeric: true });
        const sA = sizeLabelOf(a), sB = sizeLabelOf(b);
        if (sA !== sB) return sA.localeCompare(sB, 'he', { numeric: true });
        return customerNameOf(a).localeCompare(customerNameOf(b), 'he');
      }

      const cA = customerNameOf(a), cB = customerNameOf(b);
      if (cA !== cB) return cA.localeCompare(cB, 'he');
      const oA = a.order?.orderId || 0, oB = b.order?.orderId || 0;
      if (oA !== oB) return oA - oB;
      const dA = dressLabelOf(a), dB = dressLabelOf(b);
      if (dA !== dB) return dA.localeCompare(dB, 'he', { numeric: true });
      return sizeLabelOf(a).localeCompare(sizeLabelOf(b), 'he', { numeric: true });
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

  // Splits one date-group's items into per-order blocks (Access BreakLevel קוד_הזמנה).
  const buildOrderBlocks = (groupItems) => {
    const map = new Map();
    groupItems.forEach(item => {
      const key = item.order?.orderId ?? 'ללא';
      if (!map.has(key)) {
        map.set(key, {
          orderId: item.order?.orderId,
          customer: item.order?.customer,
          notes: item.order?.notes,
          items: []
        });
      }
      map.get(key).items.push(item);
    });
    return [...map.values()];
  };

  const showAlterationCols = reportType !== 'orders_no_alterations';
  const showDoneCol = reportType === 'alterations_all' || reportType === 'orders_all';

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
          .print-table thead {
            display: table-header-group;
          }
          .print-table tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .group-title {
            break-after: avoid-page;
            page-break-after: avoid;
          }
          .print-header {
            break-after: avoid-page;
            page-break-after: avoid;
          }
        }
        .print-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        .print-table th, .print-table td {
          border: 1px solid #000;
          padding: 6px 8px;
          text-align: right;
          font-size: 13px;
        }
        .print-table th {
          background-color: #f2f2f2;
          font-weight: bold;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .print-header {
          text-align: center;
          margin-bottom: 20px;
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
        }
        .date-group {
          margin-bottom: 34px;
        }
        .order-block {
          margin-bottom: 14px;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .order-header {
          font-size: 14px;
          padding: 4px 2px;
        }
        .order-notes {
          font-size: 13px;
          color: #333;
          padding: 0 2px 2px;
        }
        .date-summary {
          margin-top: 8px;
          padding: 6px 10px;
          border: 1px solid #000;
          display: inline-block;
          font-weight: bold;
          font-size: 13px;
          break-inside: avoid;
          page-break-inside: avoid;
        }
      `}</style>

      <div style={{ position: 'absolute', top: '20px', right: '20px', fontWeight: 'bold', fontSize: '14px' }}>בס"ד</div>

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
                <h3 className="group-title" style={{ borderBottom: '2px solid black', paddingBottom: '5px', marginBottom: '15px', color: 'black' }}>
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
                      breakInside: 'avoid',
                      background: '#fff',
                      color: '#000'
                    }}>
                      <div style={{ position: 'absolute', top: '5px', right: '10px', fontSize: '12px', fontWeight: 'bold' }}>בס"ד</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
                        {customerNameOf(item) || '-'}
                      </div>
                      <div style={{ fontSize: '15px', marginBottom: '6px' }}>
                        דגם: <strong>{dressLabelOf(item)}</strong>
                      </div>
                      <div style={{ fontSize: '16px', marginBottom: '15px' }}>
                        מידה: <strong>{sizeLabelOf(item)}</strong>
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 'bold', borderTop: '1px dashed #000', paddingTop: '10px', width: '100%' }}>
                        {[
                          item.neckAlteration > 0 ? `צוואר: הצרה ${item.neckAlteration}` : null,
                          item.sleeveAlteration > 0 ? `שרוול: הארכה ${item.sleeveAlteration}` : null,
                          item.lengthAlteration ? `אורך: ${item.lengthAlteration}` : null
                        ].filter(Boolean).join(' | ')}
                        {item.alterationDetails && (
                          <div style={{ fontWeight: 'normal', marginTop: '6px' }}>
                            פירוט: {item.alterationDetails}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div style={{ marginTop: '20px' }}>
          {groupedItems.length === 0 ? (
            <div style={{ textAlign: 'center' }}>לא נמצאו רשומות</div>
          ) : (
            groupedItems.map(group => {
              const dayOfWeek = group.date !== 'ללא תאריך' ? new Date(group.date).toLocaleDateString('he-IL', { weekday: 'long' }) : '';
              const sums = group.items.reduce((acc, item) => {
                const qty = item.quantity || 1;
                if (item.neckAlteration > 0) acc.neck += qty;
                if (item.lengthAlteration) acc.length += qty;
                if (item.sleeveAlteration > 0) acc.sleeve += qty;
                return acc;
              }, { neck: 0, length: 0, sleeve: 0 });
              return (
                <div key={group.date} className="date-group">
                  <h3 className="group-title" style={{ borderBottom: '2px solid black', paddingBottom: '5px', marginBottom: '12px' }}>
                    {dayOfWeek ? `${dayOfWeek} - ` : ''}{group.items[0].order?.eventDateHebrew || (group.date !== 'ללא תאריך' ? getHebrewDateString(group.date) : 'ללא תאריך')}
                  </h3>
                  {buildOrderBlocks(group.items).map(block => (
                    <div key={block.orderId ?? 'no-order'} className="order-block">
                      <div className="order-header">
                        <strong>{`${block.customer?.firstName || ''} ${block.customer?.lastName || ''}`.trim() || '-'}</strong>
                        {block.customer?.phone1 && <span> | טלפון: <span style={{ direction: 'ltr', unicodeBidi: 'embed' }}>{block.customer.phone1}</span></span>}
                        {block.orderId && <span> | הזמנה מס' {block.orderId}</span>}
                      </div>
                      {block.notes && <div className="order-notes">הערות: {block.notes}</div>}
                      <table className="print-table" style={{ marginTop: '6px', marginBottom: '0' }}>
                        <thead>
                          <tr>
                            <th style={{ width: showAlterationCols ? '22%' : '50%' }}>דגם שמלה</th>
                            <th>מידה</th>
                            <th>כמות</th>
                            {showAlterationCols && (
                              <>
                                <th>תיקון צוואר</th>
                                <th>תיקון אורך</th>
                                <th>תיקון שרוול</th>
                                <th>תיאור תיקון</th>
                              </>
                            )}
                            {showDoneCol && <th>בוצע</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {block.items.map(item => (
                            <tr key={item.id}>
                              <td style={{ fontWeight: '600' }}>{dressLabelOf(item)}</td>
                              <td>{sizeLabelOf(item)}</td>
                              <td>{item.quantity || 1}</td>
                              {showAlterationCols && (
                                <>
                                  <td>{item.neckAlteration > 0 ? `הצרה ${item.neckAlteration}` : ''}</td>
                                  <td>{item.lengthAlteration || ''}</td>
                                  <td>{item.sleeveAlteration > 0 ? `הארכה ${item.sleeveAlteration}` : ''}</td>
                                  <td>{item.alterationDetails || ''}</td>
                                </>
                              )}
                              {showDoneCol && <td style={{ textAlign: 'center' }}>{item.alterationDone ? '✔' : ''}</td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                  {showAlterationCols && (
                    <div className="date-summary">
                      כמות תיקוני צוואר: {sums.neck} | כמות תיקוני אורך: {sums.length} | כמות תיקוני שרוול: {sums.sleeve}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
