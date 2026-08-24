'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Shirt, Scissors, Ruler, Check } from 'lucide-react';
import { getHebrewDateString } from '../../../lib/hebrewDate';

// "אבן חרוזים (קוד: 440)" -> "אבן חרוזים (440)" - item.description bakes the
// model code into the name with a "קוד:" label; the print report wants the
// bare number without that word.
const stripCodeLabel = (name) => (name || '').replace(/\(קוד:\s*([^)]*)\)/g, '($1)');

export default function PrintOrderPage() {
  const searchParams = useSearchParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enableAlterations, setEnableAlterations] = useState(true);
  const [printSettings, setPrintSettings] = useState(null);

  const orderId = searchParams.get('orderId');
  const printType = searchParams.get('type') || 'order';

  const fetchData = async () => {
    try {
      setLoading(true);
      const [res, settingsRes] = await Promise.all([
        fetch(`/api/orders/${orderId}`),
        fetch('/api/settings')
      ]);
      if (!res.ok) throw new Error('Failed to fetch order data');
      const data = await res.json();
      setOrder(data);

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        const altSetting = settingsData.find(s => s.key === 'enable_alterations');
        if (altSetting && altSetting.value === 'false') {
          setEnableAlterations(false);
        }

        // Extract print settings
        const pSettings = {
          box1: settingsData.find(s => s.key === 'print_rental_box1')?.value || '',
          box2: settingsData.find(s => s.key === 'print_rental_box2')?.value || '',
          footer: settingsData.find(s => s.key === 'print_rental_footer')?.value || '',
          gmachName: settingsData.find(s => s.key === 'gmach_name')?.value || 'גמ״ח שמלות',
          gmachAddress: settingsData.find(s => s.key === 'gmach_address')?.value || '',
          gmachPhone: settingsData.find(s => s.key === 'gmach_phone')?.value || '',
          gmachEmail: settingsData.find(s => s.key === 'main_email')?.value || ''
        };
        setPrintSettings(pSettings);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchData();
    } else {
      setError('לא סופק מספר הזמנה');
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    // Auto trigger print when loaded
    if (!loading && !error && order) {
      fetch('/api/log-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageUrl: `[הדפסת כרטיס השכרה] הזמנה #${order.orderId}` })
      }).catch(console.error);

      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loading, error, order]);

  const totalObligations = order?.obligations?.filter(o => !o.isDeleted).reduce((sum, o) => sum + o.amount, 0) || 0;
  const totalPayments = order?.payments?.filter(p => !p.isDeleted).reduce((sum, p) => sum + p.amount, 0) || 0;
  const balance = Math.max(0, totalObligations - totalPayments);
  const activeItems = order?.items ? order.items.filter(i => !i.isDeleted) : [];
  const activePayments = order?.payments ? order.payments.filter(p => !p.isDeleted) : [];
  const colCount = enableAlterations ? 5 : 4;

  const renderRepairChips = (item) => {
    const neck = item.neckAlteration === 1 || item.neckAlteration === true;
    const sleeve = item.sleeveAlteration === 1 || item.sleeveAlteration === true;
    const length = item.lengthAlteration && String(item.lengthAlteration).trim() !== '' ? item.lengthAlteration : null;
    if (!neck && !sleeve && !length) return <span style={{ color: '#999' }}>ללא תיקונים</span>;
    return (
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
        {neck && <span className="repair-chip" title="תיקון צוואר"><Shirt size={12} /> צוואר</span>}
        {sleeve && <span className="repair-chip" title="תיקון שרוול"><Scissors size={12} /> שרוול</span>}
        {length && <span className="repair-chip" title="קיצור אורך"><Ruler size={12} /> {length} ס״מ</span>}
        {item.alterationDone && <span className="repair-chip done" title="התיקון בוצע"><Check size={12} /> בוצע</span>}
        {item.alterationDetails && <span style={{ flexBasis: '100%', fontSize: '0.78em', color: '#888' }}>{item.alterationDetails}</span>}
      </span>
    );
  };

  const formatPaymentNotes = (rawNotes) => {
    let notes = rawNotes || '-';
    try {
      if (typeof notes === 'string' && notes.trim().startsWith('{')) {
        const parsed = JSON.parse(notes);
        const approval = parsed.Confirmation || parsed.TransactionId || parsed['אישור'];
        notes = approval ? `אישור: ${approval}` : 'סליקת אשראי';
        let extraInfo = '';
        if (parsed.Tashloumim || parsed['תשלומים']) {
          extraInfo = ` | תשלומים: ${parsed.Tashloumim || parsed['תשלומים']}`;
        }
        if (parsed['הערות משתמש']) {
          extraInfo += ` | ${parsed['הערות משתמש']}`;
        }
        notes += extraInfo;
      } else if (typeof notes === 'string') {
        const match = notes.match(/אישור:\s*([a-zA-Z0-9]+)/);
        const tashMatch = notes.match(/"Tashloumim"\s*:\s*"(\d+)"/);
        let approvalStr = notes;
        if (match && match[1]) {
          approvalStr = `אישור: ${match[1]}`;
          if (tashMatch && tashMatch[1]) {
            approvalStr += ` | תשלומים: ${tashMatch[1]}`;
          }
        } else if (notes.length > 50) {
          approvalStr = notes.substring(0, 50) + '...';
        }
        notes = approvalStr;
      }
    } catch (e) {
      // keep raw notes on parse failure
    }
    return notes;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=David+Libre:wght@400;500;600;700&family=Frank+Ruhl+Libre:wght@500;700;900&display=swap');

        body {
          background-color: #fafafa !important;
        }

        /* Hide global layout elements on screen */
        nav.navbar,
        .global-sidebar-container,
        .ai-floating-widget,
        [class*="sidebar"],
        [id*="sidebar"] {
          display: none !important;
        }

        .print-container {
          background: #fff;
          max-width: 850px;
          margin: 40px auto;
          padding: 45px 50px;
          border: 1px solid #efefef;
          box-shadow: 0 2px 10px rgba(0,0,0,0.03);
          font-family: 'David Libre', 'Times New Roman', Georgia, serif;
          color: #444;
          direction: rtl;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          html, body, #__next, .__next {
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-container {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100%;
            height: auto !important;
            display: block !important;
            color: #444 !important;
          }
          .print-table thead {
            display: table-header-group;
          }
          .print-table tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          /* The whole summary/payments/terms tail lives in ONE wrapper <tr> - the
             break-inside:avoid that's right for real data rows (and also arrives from
             globals.css's print block) must not apply to it: a several-hundred-px row
             that "can't" break gets pushed wholesale to the next page (half-empty page
             1, form "cut in the middle"), and when it's taller than a full page Chrome
             clips it instead of flowing. Let the wrapper fragment; each inner block
             below keeps its own integrity. */
          tr.print-flow-row {
            break-inside: auto !important;
            page-break-inside: auto !important;
          }
          .order-details-card,
          .rental-notes-box,
          .summary-section,
          .terms,
          .print-footer {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          /* payments-section is intentionally NOT break-inside:avoid - it can grow
             past a page with many payments, and forcing the whole block to stay
             together (instead of letting its own .print-table tr rows each avoid
             their own split) clipped the section instead of flowing to page 2+. */
          .payments-section table thead {
            display: table-header-group;
          }
          .section-title {
            break-after: avoid-page;
            page-break-after: avoid;
          }
        }
        .bsd {
          text-align: right;
          font-size: 13px;
          font-weight: 600;
          color: #999;
          margin-bottom: 6px;
          letter-spacing: 0.5px;
        }
        .print-header {
          text-align: center;
          border-bottom: 1px solid #eaeaea;
          padding-bottom: 22px;
          margin-bottom: 32px;
        }
        .print-header-content h1 {
          margin: 0 0 8px 0;
          font-family: 'Frank Ruhl Libre', 'David Libre', serif;
          font-size: 30px;
          color: #262626;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .print-header-content h2 {
          margin: 0;
          font-size: 15px;
          color: #888;
          font-weight: 500;
        }
        .company-details {
          color: #999;
          font-size: 13px;
          margin-top: 8px;
        }
        .order-details-card {
          display: flex;
          justify-content: space-between;
          margin-bottom: 32px;
          font-size: 15px;
          color: #555;
          line-height: 1.75;
        }
        /* Right side: Customer, Left side: Order */
        .order-details-card > div:first-child {
          text-align: right;
          width: 48%;
        }
        .order-details-card > div:last-child {
          text-align: right;
          width: 48%;
          border-right: 1px solid #eaeaea;
          padding-right: 24px;
        }
        .order-details-card strong {
          color: #262626;
          font-weight: 700;
        }
        .print-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 36px;
          border: 1px solid #e5e5e5;
        }
        .print-table th, .print-table td {
          padding: 13px 14px;
          text-align: right;
          border-bottom: 1px solid #eee;
          font-size: 13.5px;
        }
        /* globals.css has a global sticky-header rule (table thead tr th {...!important})
           meant for on-screen data tables - it forces position:sticky, a white/themed
           background and a gold border-bottom on every <th>. It has no class scope, so it
           also matches this print table; override every property it sets with !important
           so the print header keeps its own plain design. */
        .print-table th {
          position: static !important;
          top: auto !important;
          z-index: auto !important;
          background-color: #f4f4f4 !important;
          background-image: none !important;
          box-shadow: none !important;
          border-bottom: 1px solid #eee !important;
          color: #333;
          font-weight: 600;
          letter-spacing: 0.3px;
        }
        .print-table tbody tr:nth-child(even) {
          background-color: #fbfbfb;
        }
        .print-table tbody tr:last-child td {
          border-bottom: none;
        }
        .repair-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 20px;
          background: #f4f4f4;
          color: #555;
          font-size: 0.85em;
          white-space: nowrap;
        }
        .repair-chip.done {
          background: #e8f5e9;
          color: #2e7d32;
        }
        .summary-section {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 36px;
        }
        .summary-table {
          width: 320px;
          border-collapse: collapse;
        }
        .summary-table td {
          padding: 10px 14px;
          text-align: left;
          color: #666;
          font-size: 14.5px;
          border-bottom: 1px solid #f5f5f5;
        }
        .summary-table td:first-child {
          text-align: right;
          color: #888;
        }
        .summary-table .total {
          background-color: #f4f4f4;
        }
        .summary-table .total td {
          font-size: 18px;
          font-weight: 700;
          color: #222;
          border-bottom: none;
          border-top: 2px solid #e5e5e5;
        }
        .payments-title {
          color: #555;
          font-size: 15px;
          font-weight: 700;
          margin: 0 0 10px 0;
        }
        .terms {
          font-size: 13.5px;
          color: #777;
          margin-bottom: 40px;
          text-align: justify;
          line-height: 1.7;
          border-top: 1px solid #eee;
          padding-top: 18px;
        }
        .terms strong {
          color: #555;
        }
        .rental-notes-box {
          border: 1px solid #e5e5e5;
          padding: 15px;
          margin-bottom: 15px;
          text-align: center;
          font-size: 14.5px;
          color: #555;
        }
        .rental-notes-box-bg {
          background-color: #fbfbfb;
        }
        .rental-footer-title {
          font-size: 16px;
          font-weight: 700;
          margin: 0 0 10px 0;
          color: #262626;
        }
        .rental-footer-sign {
          font-size: 15px;
          font-weight: 600;
          display: flex;
          justify-content: center;
          align-items: center;
          color: #444;
        }
        .rental-footer-note {
          margin-top: 8px;
          font-size: 13px;
          font-weight: 500;
          color: #888;
        }
        .print-footer {
          margin-top: 40px;
          text-align: center;
          font-size: 11px;
          color: #aaa;
          border-top: 1px solid #eee;
          padding-top: 12px;
        }
      `}</style>

      <div
        data-agy-id="print-order-container"
        // Signals to app/api/pdf/route.js's Puppeteer render (page.goto() + waitForSelector)
        // that data has finished loading and the DOM reflects its final state.
        data-print-ready={loading ? undefined : 'true'}
        className="print-container"
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px', color: '#6c757d', fontSize: '18px' }}>טוען נתונים להדפסה...</div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '50px', color: '#dc3545', fontSize: '18px' }}>{error}</div>
        ) : order ? (
          // A single outer <table> (instead of stacked <div>s) so the letterhead + item-table
          // column headers are placed in a <thead> and repeat on every printed page when the
          // item list overflows to page 2+, and a spacer <tfoot> keeps the last row of each page
          // clear of the page edge. Mirrors the pagination trick used by print/alterations.
          <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', border: 'none', marginBottom: 0 }}>
            <thead style={{ display: 'table-header-group', border: 'none' }}>
              <tr>
                <td colSpan={colCount} style={{ border: 'none', padding: 0 }}>
                  <div className="bsd">בס&quot;ד</div>
                  <div className="print-header">
                    <div className="print-header-content">
                      {/* הלוגו מוגש מ-/api/logo (הגדרת BRAND_LOGO); כשאין לוגו מוגדר הנתיב
                          מחזיר 404 - onError מסתיר את התמונה והכותרת נשארת טקסטואלית בלבד. */}
                      <img
                        src="/api/logo"
                        alt=""
                        style={{ height: '64px', objectFit: 'contain', marginBottom: '10px' }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                      <h1>{printSettings?.gmachName || 'גמ"ח שמלות'}</h1>
                      <div className="company-details">
                        {[
                          printSettings?.gmachAddress,
                          printSettings?.gmachPhone && `טלפון: ${printSettings.gmachPhone}`,
                          printSettings?.gmachEmail && `דוא"ל: ${printSettings.gmachEmail}`
                        ].filter(Boolean).join(' | ')}
                      </div>
                    </div>
                  </div>

                  <div className="order-details-card">
                    {/* Right side: Customer */}
                    <div>
                      <strong>לכבוד: {order.customer?.firstName} {order.customer?.lastName}</strong><br />
                      טלפון: <span dir="ltr">{order.customer?.phone1 || order.customer?.phone || '-'}</span><br />
                      כתובת: {order.customer?.city ? `${order.customer.city}${order.customer?.address ? `, ${order.customer.address}` : ''}` : '-'}<br />
                    </div>
                    {/* Left side: Order Details */}
                    <div>
                      <strong>{printType === 'rental' ? 'דוח השכרה' : 'הזמנה'} #{order.orderId}</strong><br />
                      תאריך הזמנה: {order.createdAt ? getHebrewDateString(order.createdAt) : '-'}<br />
                      {(!order.isWeekdayEvent && !order.isAbroad) ? (
                        <>תאריך אירוע: {order.eventDateHebrew || (order.eventDate ? getHebrewDateString(order.eventDate) : 'לא צוין')}</>
                      ) : (
                        <>סוג אירוע: אירוע חו&quot;ל</>
                      )}
                      {printType === 'order' && order.notes && (
                        <><br />הערות: {order.notes}</>
                      )}
                    </div>
                  </div>

                  {printType === 'rental' && printSettings && (
                    <div style={{ marginBottom: '20px' }}>
                      {printSettings.box1 && (
                        <div className="rental-notes-box">
                          {printSettings.box1}
                        </div>
                      )}
                      {printSettings.box2 && (
                        <div className="rental-notes-box rental-notes-box-bg">
                          {printSettings.box2}
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
              <tr>
                <th>דגם / תיאור</th>
                <th>מידה</th>
                <th>ברקוד</th>
                {enableAlterations && <th>תיקונים</th>}
                <th>סטטוס</th>
              </tr>
            </thead>
            <tfoot>
              <tr>
                <td colSpan={colCount} style={{ border: 'none', padding: 0 }}>
                  <div style={{ height: '30px' }}></div>
                </td>
              </tr>
            </tfoot>
            <tbody>
              {activeItems.length === 0 ? (
                <tr>
                  <td colSpan={colCount} style={{ textAlign: 'center', padding: '30px', color: '#999' }}>אין פריטים פעילים בהזמנה זו</td>
                </tr>
              ) : (
                activeItems.map((item) => {
                  let statusStr = 'טרם נלקח';
                  if (item.isReturned) statusStr = 'הוחזר';
                  else if (item.isTaken) statusStr = 'אצל הלקוח';

                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: '600', color: '#333' }}>{stripCodeLabel(item.description || item.dressItem?.dress?.name || item.dressItem?.dressName) || '-'}</td>
                      <td>{item.sizeText || item.dressItem?.sizeText || '-'}</td>
                      <td style={{ fontWeight: '600', color: '#666' }}>{(item.isTaken && (item.barcode || item.dressItem?.dressBarcode)) || '-'}</td>
                      {enableAlterations && (
                        <td>{renderRepairChips(item)}</td>
                      )}
                      <td>{statusStr}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tbody>
              <tr className="print-flow-row">
                <td colSpan={colCount} style={{ border: 'none', padding: 0 }}>
                  <div className="summary-section">
                    <table className="summary-table">
                      <tbody>
                        <tr>
                          <td>סה&quot;כ לחיוב:</td>
                          <td>₪{totalObligations}</td>
                        </tr>
                        <tr>
                          <td>סה&quot;כ שולם:</td>
                          <td>₪{totalPayments}</td>
                        </tr>
                        <tr className="total">
                          <td>יתרה לתשלום:</td>
                          <td>₪{balance}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {activePayments.length > 0 && (
                    <div className="payments-section">
                      <h4 className="payments-title">תשלומים שהתקבלו</h4>
                      <table className="print-table" style={{ marginBottom: '30px' }}>
                        <thead>
                          <tr>
                            <th>תאריך (עברי)</th>
                            <th>אופן תשלום</th>
                            <th>סכום</th>
                            <th>הערות</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activePayments.map((p, idx) => {
                            const hebrewPaymentDate = p.paymentDate ? getHebrewDateString(p.paymentDate) : getHebrewDateString(new Date());
                            return (
                              <tr key={idx}>
                                <td>{hebrewPaymentDate}</td>
                                <td>{p.paymentMethod || '-'}</td>
                                <td style={{ fontWeight: 'bold' }}>₪{p.amount}</td>
                                <td>{formatPaymentNotes(p.notes)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {printType === 'rental' && (
                    <div className="terms">
                      <strong>תנאים:</strong> הבגדים נמסרים נקיים ומגוהצים ויש להחזירם באותו מצב. אין לבצע כביסה עצמאית בשום אופן. איחור בהחזרת הפריטים יגרור קנס לכל יום איחור כפי שנקבע בתקנון. במקרה של נזק בלתי הפיך, הלקוח יישא במלוא עלות התיקון או רכישה מחדש של הפריט.
                    </div>
                  )}

                  {printType === 'rental' && printSettings?.footer && (
                    <div style={{ textAlign: 'center', marginTop: '15px', marginBottom: '15px' }}>
                      <h3 className="rental-footer-title">{printSettings.footer}</h3>
                      <div className="rental-footer-sign">
                        <span>על החתום:</span>
                        <span style={{ display: 'inline-block', width: '200px', borderBottom: '1px dashed #999', margin: '0 10px' }}></span>
                      </div>
                      <div className="rental-footer-note">
                        נא להחזיר טופס זה חתום בעת החזרת השמלות
                      </div>
                    </div>
                  )}

                  <div className="print-footer">
                    הופק על ידי מערכת גמ&quot;ח שמלות בתאריך: {getHebrewDateString(new Date())}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        ) : null}
      </div>
    </>
  );
}
