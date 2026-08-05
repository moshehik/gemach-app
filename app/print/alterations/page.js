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
  const downloadPdf = searchParams.get('downloadPdf') === 'true';
  // Present only for dateMode=current when the caller (e.g. the orders list)
  // resolved the exact set of currently-filtered/displayed order IDs - takes
  // precedence over the date range so the report matches what's on screen.
  const orderIds = searchParams.get('orderIds');

  if (dateMode === 'today') {
    const todayStr = new Date().toISOString().split('T')[0];
    startDate = todayStr;
    endDate = todayStr;
  }

  useEffect(() => {
    fetchData();
  }, [reportType, startDate, endDate, orderIds]);

  useEffect(() => {
    // Auto trigger print when loaded
    if (!loading && !error) {
      const title = getReportTitle();
      fetch('/api/log-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageUrl: `[הדפסת דוח] ${title} (תאריכים: ${startDate} - ${endDate})` })
      }).catch(console.error);
      if (downloadPdf) {
        const timer = setTimeout(async () => {
          try {
            const element = document.querySelector('[data-agy-id="print-alterations-container"]');
            if (element) {
               // Load html2pdf dynamically to avoid SSR issues
               const html2pdf = (await import('html2pdf.js')).default;
               const opt = {
                 margin:       [15, 10, 15, 10], // top, left, bottom, right
                 filename:     `${title}.pdf`,
                 image:        { type: 'jpeg', quality: 0.98 },
                 html2canvas:  { scale: 2, useCORS: true, windowWidth: 1100 },
                 jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
                 pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
               };
               await html2pdf().set(opt).from(element).toPdf().get('pdf').then(function(pdf) {
                 const totalPages = pdf.internal.getNumberOfPages();
                 for (let i = 1; i <= totalPages; i++) {
                   pdf.setPage(i);
                   pdf.setFontSize(10);
                   pdf.setTextColor(150);
                   pdf.text('Page ' + i + ' of ' + totalPages, pdf.internal.pageSize.getWidth() / 2, pdf.internal.pageSize.getHeight() - 5, { align: 'center' });
                 }
               }).save();
               setTimeout(() => window.close(), 1000);
            }
          } catch (err) {
            console.error('PDF Generation Error:', err);
            alert('אירעה שגיאה ביצירת ה-PDF. נסה להשתמש בהדפסה רגילה.');
          }
        }, 1500);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => {
          window.print();
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, error, reportType, startDate, endDate, downloadPdf]);

  async function fetchData() {
    try {
      setLoading(true);

      let showOnlyPending = reportType === 'alterations_pending' || reportType === 'labels';
      let hideNoAlterations = reportType === 'orders_no_alterations';
      let showAllOrders = reportType === 'orders_all';

      let url = `/api/alterations?showOnlyPending=${showOnlyPending}&hideNoAlterations=${hideNoAlterations}&showAllOrders=${showAllOrders}`;
      if (orderIds) {
        url += `&orderIds=${orderIds}`;
      } else {
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;
      }

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
  // Legacy migration left some length values as '' / 'null' / '0' - treat as "no alteration"
  const lengthAltOf = (item) => {
    const v = (item.lengthAlteration ?? '').toString().trim();
    return (!v || v === 'null' || v === '0') ? '' : v;
  };

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
        @import url('https://fonts.googleapis.com/css2?family=Helvetica+Neue:wght@300;400;500;600;700&display=swap');
        
        body {
          background-color: #fafafa !important;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        }

        /* Hide global layout elements on screen */
        nav.navbar, 
        .global-sidebar-container, 
        .ai-floating-widget, 
        [class*="sidebar"], 
        [id*="sidebar"] {
          display: none !important;
        }

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
            padding: 0 !important;
            display: block !important;
            color: #333 !important;
            border: none !important;
            box-shadow: none !important;
          }
          .print-table thead {
            display: table-header-group;
          }
          .print-table tr, .order-block, .date-summary {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .group-title, .print-header {
            break-after: avoid-page;
            page-break-after: avoid;
          }
        }
        
        .print-container {
          background: #fff;
          max-width: 1100px;
          margin: 0 auto;
          padding: 40px !important;
          border: 1px solid #efefef;
          box-shadow: 0 2px 10px rgba(0,0,0,0.02);
          color: #555;
        }
        
        .print-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          border: 2px solid #e8e8e8;
        }
        .print-table th, .print-table td {
          border: 1px solid #f0f0f0;
          padding: 10px 12px;
          text-align: right;
          font-size: 13px;
        }
        .print-table th {
          background-color: #fdfdfd;
            .print-header {
          text-align: center;
          margin-bottom: 30px;
        }
        .print-header h1 {
          margin: 0; font-size: 26px; color: #555; font-weight: 300; letter-spacing: 1px; margin-bottom: 10px;
        }
        .print-header h3 {
          margin: 0; font-size: 15px; color: #777; font-weight: normal;
        }
        .date-group {
          margin-bottom: 40px;
        }
        .group-title {
          border-bottom: 1px solid #e8e8e8;
          padding-bottom: 8px;
          margin-bottom: 20px;
          color: #444;
          font-size: 18px;
          font-weight: 600;
        }
        .order-block {
          margin-bottom: 25px;
          background: #fafafa;
          border: 1px solid #f0f0f0;
          padding: 15px;
          border-radius: 6px;
        }
        .order-header {
          font-size: 14px;
          color: #333;
          margin-bottom: 8px;
        }
        .order-notes {
          font-size: 13px;
          color: #666;
          margin-bottom: 10px;
        }
        .date-summary {
          margin-top: 15px;
          padding: 10px 15px;
          border: 1px solid #e8e8e8;
          background: #fdfdfd;
          display: inline-block;
          font-weight: 600;
          color: #555;
          border-radius: 4px;
        }
      `}</style>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none' }}>
        <thead style={{ display: 'table-header-group' }}>
          <tr>
            <td style={{ border: 'none', padding: 0 }}>
              <div style={{ textAlign: 'right', fontWeight: '600', fontSize: '13px', color: '#333', marginBottom: '5px' }}>בס"ד</div>
              <div className="print-header">
                <h1>{getReportTitle()}</h1>
                <h3>
                  {dateMode === 'today'
                    ? `תאריך: ${getHebrewDateString(new Date().toISOString())}`
                    : orderIds
                      ? 'הנתונים המוצגים כעת (לפי הסינון הנוכחי)'
                      : `מתאריך: ${formatDate(startDate)} | עד תאריך: ${formatDate(endDate)}`}
                </h3>
              </div>
            </td>
          </tr>
        </thead>
        <tfoot style={{ display: 'table-footer-group' }}>
          <tr>
            <td style={{ border: 'none', padding: 0 }}>
              <div className="print-footer-spacer" style={{ height: '30px' }}></div>
            </td>
          </tr>
        </tfoot>
        <tbody>
          <tr>
            <td style={{ border: 'none', padding: 0 }}>
              {loading ? (
                <div>טוען נתונים להדפסה...</div>
              ) : error ? (
                <div style={{ color: 'red' }}>{error}</div>
              ) : !enableAlterations ? (
                <div style={{ textAlign: 'center', padding: '50px', fontSize: '20px', color: '#6c757d', fontWeight: 'bold' }}>
                  מערכת התיקונים מכובה בהגדרות. לא ניתן להפיק דוח תיקונים.
                </div>
              ) : null}
            </td>
          </tr>
          {enableAlterations && (reportType === 'labels' ? (
        <tr>
          <td style={{ border: 'none', padding: 0 }}>
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
                          border: '1px solid #e8e8e8',
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
                          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                          color: '#444'
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
                          <div style={{ fontSize: '15px', fontWeight: 'bold', borderTop: '1px dashed #e8e8e8', paddingTop: '10px', width: '100%', color: '#666' }}>
                            {[
                              item.neckAlteration > 0 ? `צוואר: הצרה ${item.neckAlteration}` : null,
                              item.sleeveAlteration > 0 ? `שרוול: הארכה ${item.sleeveAlteration}` : null,
                              lengthAltOf(item) ? `אורך: ${lengthAltOf(item)}` : null
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
          </td>
        </tr>
      ) : (
        groupedItems.length === 0 ? (
          <tr>
            <td style={{ border: 'none', padding: 0 }}>
              <div style={{ textAlign: 'center', marginTop: '20px' }}>לא נמצאו רשומות</div>
            </td>
          </tr>
        ) : (
          groupedItems.map(group => {
            const dayOfWeek = group.date !== 'ללא תאריך' ? new Date(group.date).toLocaleDateString('he-IL', { weekday: 'long' }) : '';
            const sums = group.items.reduce((acc, item) => {
              const qty = item.quantity || 1;
              if (item.neckAlteration > 0) acc.neck += qty;
              if (lengthAltOf(item)) acc.length += qty;
              if (item.sleeveAlteration > 0) acc.sleeve += qty;
              return acc;
            }, { neck: 0, length: 0, sleeve: 0 });
            return (
              <React.Fragment key={group.date}>
                <tr>
                  <td style={{ border: 'none', padding: 0 }}>
                    <h3 className="group-title" style={{ borderBottom: '2px solid black', paddingBottom: '5px', marginBottom: '12px', marginTop: '20px' }}>
                      {dayOfWeek ? `${dayOfWeek} - ` : ''}{group.items[0].order?.eventDateHebrew || (group.date !== 'ללא תאריך' ? getHebrewDateString(group.date) : 'ללא תאריך')}
                    </h3>
                  </td>
                </tr>
                {buildOrderBlocks(group.items).map(block => (
                  <tr key={block.orderId ?? 'no-order'}>
                    <td style={{ border: 'none', padding: 0 }}>
                      <div className="order-block">
                        <div className="order-header">
                          <strong>{`${block.customer?.firstName || ''} ${block.customer?.lastName || ''}`.trim() || '-'}</strong>
                          {block.customer?.phone1 && <span> | טלפון: <span style={{ direction: 'ltr', unicodeBidi: 'embed' }}>{block.customer.phone1}</span></span>}
                          {block.orderId && <span> | הזמנה מס' {block.orderId}</span>}
                        </div>
                        {block.notes && <div className="order-notes">הערות: {block.notes}</div>}
                        <table className="print-table">
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
                                <td style={{ fontWeight: '500' }}>{dressLabelOf(item)}</td>
                                <td>{sizeLabelOf(item)}</td>
                                <td>{item.quantity || 1}</td>
                                {showAlterationCols && (
                                  <>
                                    <td>{item.neckAlteration > 0 ? `הצרה ${item.neckAlteration}` : ''}</td>
                                    <td>{lengthAltOf(item)}</td>
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
                    </td>
                  </tr>
                ))}
                {showAlterationCols && (
                  <tr>
                    <td style={{ border: 'none', padding: 0 }}>
                      <div className="date-summary">
                        כמות תיקוני צוואר: {sums.neck} | כמות תיקוני אורך: {sums.length} | כמות תיקוני שרוול: {sums.sleeve}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })
        )
      ))}
        </tbody>
      </table>
      
      <div style={{ marginTop: '40px', textAlign: 'center', fontSize: '11px', color: '#999', borderTop: '1px solid #eee', paddingTop: '10px' }}>
        הופק על ידי מערכת גמ"ח שמלות בתאריך: {getHebrewDateString(new Date())}
      </div>
    </div>
  );
}
