'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { calculatePaymentStatus, calculateOrderStatus } from '../../../lib/orderStatus';

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
          footer: settingsData.find(s => s.key === 'print_rental_footer')?.value || ''
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

  // סטטוס ההשכרה מגיע כעת מ-lib/orderStatus.js (מקור האמת היחיד לסטטוס הזמנה) במקום
  // עותק מקומי עם אוצר מילים משלו - כדי שלא יהיה פער בין מה שמוצג כאן לבין שאר המערכת.
  const getOrderStatus = (order) => calculateOrderStatus(order);

  // ממפה את אוצר המילים המלא של lib/orderStatus.js (כולל מצבים חלקיים/עתידיים/טיוטה)
  // לארבעת מחלקות העיצוב הקיימות בדף ההדפסה.
  const getStatusClass = (status) => {
    switch (status) {
      case 'מחוק':
        return 'status-archived';
      case 'הוחזר':
        return 'status-returned';
      case 'הושכר':
      case 'הושכר חלקי':
      case 'הוחזר חלקי':
        return 'status-active';
      default:
        // 'בקרוב', 'עבר', 'טיוטה' - טרם נלקח בפועל
        return 'status-pending';
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Helvetica+Neue:wght@300;400;500;600;700&display=swap');
        
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
          max-width: 900px;
          margin: 40px auto;
          padding: 20px;
          border: 1px solid #efefef;
          box-shadow: 0 2px 10px rgba(0,0,0,0.02);
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
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
            color: black !important;
          }
          .print-table thead {
            display: table-header-group;
          }
          .print-table tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .order-details-card,
          .rental-notes-box,
          .print-footer {
            break-inside: avoid;
            page-break-inside: avoid;
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
          color: #333;
          margin-bottom: 5px;
        }
        .print-header {
          text-align: center;
          margin-bottom: 40px;
        }
        .print-header-content h1 {
          margin: 0;
          font-size: 26px;
          color: #555;
          font-weight: 300;
          letter-spacing: 1px;
          margin-bottom: 10px;
        }
        .print-header-content h2 {
          margin: 0;
          font-size: 16px;
          color: #777;
          font-weight: normal;
        }
        .company-details {
          color: #999;
          font-size: 13px;
          margin-top: 5px;
        }
        .order-details-card {
          display: flex;
          justify-content: space-between;
          margin-bottom: 40px;
          padding: 20px;
          border: 1px solid #f0f0f0;
          font-size: 14px;
          color: #666;
          line-height: 1.7;
        }
        /* Right side: Customer, Left side: Order */
        .order-details-card > div:first-child {
          text-align: right;
          width: 48%;
        }
        .order-details-card > div:last-child {
          text-align: right;
          width: 48%;
          border-right: 1px solid #f0f0f0;
          padding-right: 20px;
        }
        .print-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 40px;
          border: 2px solid #e8e8e8;
        }
        .print-table th, .print-table td {
          padding: 15px;
          text-align: right;
          border: 1px solid #f0f0f0;
          font-size: 13px;
        }
        .print-table th {
          background-color: #fdfdfd;
          font-weight: bold;
          color: #666;
          letter-spacing: 0.5px;
        }
        .summary-section {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 50px;
        }
        .summary-table {
          width: 40%;
          border-collapse: collapse;
        }
        .summary-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #f5f5f5;
          color: #555;
          font-size: 14px;
        }
        .summary-table td:first-child {
          text-align: right;
          color: #888;
        }
        .summary-table .total td {
          font-size: 18px;
          font-weight: bold;
          color: #444;
          border-bottom: none;
          border-top: 2px solid #e8e8e8;
        }
        .terms {
          font-size: 13px;
          color: #888;
          margin-bottom: 50px;
          text-align: justify;
          line-height: 1.6;
        }
        .signatures {
          display: flex;
          justify-content: space-around;
          font-size: 14px;
          color: #777;
          margin-top: 20px;
        }
        .signatures div {
          text-align: center;
          width: 200px;
          border-top: 1px solid #ddd;
          padding-top: 10px;
        }
        .status-badge {
          display: inline-block;
          font-weight: 500;
          color: #444;
        }
        .rental-notes-box {
          border: 1px solid #e8e8e8; 
          padding: 15px; 
          margin-bottom: 15px; 
          text-align: center; 
          font-size: 14px; 
          color: #555;
        }
        .rental-notes-box-bg {
          background-color: #fcfcfc;
        }
      `}</style>
      
      <div data-agy-id="print-order-container" className="print-container">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px', color: '#6c757d', fontSize: '18px' }}>טוען נתונים להדפסה...</div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '50px', color: '#dc3545', fontSize: '18px' }}>{error}</div>
        ) : order ? (
          <>
          <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', border: 'none', marginBottom: 0 }}>
            <thead style={{ display: 'table-header-group', border: 'none' }}>
              <tr>
                <td colSpan={enableAlterations ? "7" : "4"} style={{ border: 'none', padding: 0 }}>
                  <div className="bsd">בס&quot;ד</div>
                  <div className="print-header">
                    <div className="print-header-content">
                      <h1>גמ&quot;ח שמלות</h1>
                      <div className="company-details">
                        רחוב ירושלים 15, בני ברק | טלפון: 03-1234567 | דוא"ל: info@gemach.co.il
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
                        <>סוג אירוע: אירוע חו"ל</>
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
                      {printSettings.footer && (
                        <div style={{ textAlign: 'center', marginTop: '15px', marginBottom: '15px' }}>
                          <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#222' }}>{printSettings.footer}</h3>
                          <div style={{ fontSize: '15px', fontWeight: '600', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#444' }}>
                            <span>על החתום:</span>
                            <span style={{ display: 'inline-block', width: '200px', borderBottom: '1px dashed #666', margin: '0 10px' }}></span>
                          </div>
                          <div style={{ marginTop: '8px', fontSize: '13px', fontWeight: '500', color: '#666' }}>
                            נא להחזיר טופס זה חתום בעת החזרת השמלות
                          </div>
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
                {enableAlterations && (
                  <>
                    <th>תיקון צואר</th>
                    <th>תיקון שרוול</th>
                    <th>תיקון אורך</th>
                  </>
                )}
                <th>סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {!order.items || order.items.filter(i => !i.isDeleted).length === 0 ? (
                <tr>
                  <td colSpan={enableAlterations ? "7" : "4"} style={{ textAlign: 'center', padding: '30px', color: '#6c757d' }}>אין פריטים פעילים בהזמנה זו</td>
                </tr>
              ) : (
                order.items.filter(i => !i.isDeleted).map((item) => {
                  let statusStr = 'טרם נלקח';
                  if (item.isReturned) statusStr = 'הוחזר';
                  else if (item.isTaken) statusStr = 'אצל הלקוח';
                  
                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: '500' }}>{item.description || item.dressItem?.dress?.name || item.dressItem?.dressName || '-'}</td>
                      <td>{item.sizeText || item.dressItem?.sizeText || '-'}</td>
                      <td style={{ fontWeight: '600', color: '#666' }}>{item.barcode || item.dressItem?.dressBarcode || ((item.barcodePrefix && item.sizeText) ? `${item.barcodePrefix}${item.sizeText}` : '-')}</td>
                      {enableAlterations && (
                        <>
                          <td>{item.neckAlteration ? `הצרה ${item.neckAlteration}` : '-'}</td>
                          <td>{item.sleeveAlteration ? `הארכה ${item.sleeveAlteration}` : '-'}</td>
                          <td>{item.lengthAlteration || '-'}</td>
                        </>
                      )}
                      <td>
                        {statusStr}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tbody>
              <tr>
                <td colSpan={enableAlterations ? "7" : "4"} style={{ border: 'none', padding: 0 }}>
                  <div className="summary-section">
                    <table className="summary-table">
                      <tbody>
                        <tr>
                          <td>סה&quot;כ לחיוב:</td>
                          <td>₪{order.obligations?.filter(o => !o.isDeleted).reduce((sum, obs) => sum + obs.amount, 0) || 0}</td>
                        </tr>
                        <tr>
                          <td>סה&quot;כ שולם:</td>
                          <td>₪{order.payments?.filter(p => !p.isDeleted).reduce((sum, p) => sum + p.amount, 0) || 0}</td>
                        </tr>
                        <tr className="total">
                          <td>יתרה לתשלום:</td>
                          <td>
                            ₪{Math.max(0, (order.obligations?.filter(o => !o.isDeleted).reduce((sum, obs) => sum + obs.amount, 0) || 0) - (order.payments?.filter(p => !p.isDeleted).reduce((sum, p) => sum + p.amount, 0) || 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {order.payments && order.payments.filter(p => !p.isDeleted).length > 0 && (
                    <>
                      <h4 style={{ color: '#555', fontSize: '15px', marginBottom: '10px' }}>תשלומים שהתקבלו</h4>
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
                          {order.payments.filter(p => !p.isDeleted).map((p, idx) => {
                            let notes = p.notes || '-';
                            let extraInfo = '';
                            try {
                              if (typeof notes === 'string' && notes.trim().startsWith('{')) {
                                const parsed = JSON.parse(notes);
                                const approval = parsed.Confirmation || parsed.TransactionId || parsed['אישור'];
                                notes = approval ? `אישור: ${approval}` : 'סליקת אשראי';
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
                            } catch (e) {}
                            const hebrewPaymentDate = p.paymentDate ? getHebrewDateString(p.paymentDate) : getHebrewDateString(new Date());
                            return (
                              <tr key={idx}>
                                <td>{hebrewPaymentDate}</td>
                                <td>{p.paymentMethod || '-'}</td>
                                <td style={{ fontWeight: 'bold' }}>₪{p.amount}</td>
                                <td>{notes}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </>
                  )}

                  {printType === 'rental' ? (
                    <div className="terms">
                      הבגדים נמסרים נקיים ומגוהצים ויש להחזירם באותו מצב. אין לבצע כביסה עצמאית בשום אופן. איחור בהחזרת הפריטים יגרור קנס לכל יום איחור כפי שנקבע בתקנון. במקרה של נזק בלתי הפיך, הלקוח יישא במלוא עלות התיקון או רכישה מחדש של הפריט.
                    </div>
                  ) : (
                     <div className="terms">
                      הבגדים נמסרים נקיים ומגוהצים ויש להחזירם באותו מצב בדיוק. אין לכבס בשום אופן באופן עצמאי. במקרה של קרע או נזק בלתי הפיך, הלקוח יישא בעלות התיקון או רכישה מחדש לפי שיקול דעת הגמ"ח.
                     </div>
                  )}

                  {printType === 'order' && (
                    <div className="signatures">
                      <div>חתימת הלקוח</div>
                      <div>אישור הגמ"ח</div>
                    </div>
                  )}
                  <div style={{ marginTop: '40px', textAlign: 'center', fontSize: '11px', color: '#999', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                    הופק על ידי מערכת גמ&quot;ח שמלות בתאריך: {getHebrewDateString(new Date())}
                  </div>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={enableAlterations ? "7" : "4"} style={{ border: 'none', padding: 0 }}>
                  <div style={{ height: '30px' }}></div>
                </td>
              </tr>
            </tfoot>
          </table>

          </>
        ) : null}
      </div>
    </>
  );
}
