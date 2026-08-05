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
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&display=swap');
        
        body {
          background-color: #f8f9fa;
        }
        .print-container {
          background: white;
          max-width: 900px;
          margin: 40px auto;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.06);
          font-family: 'Heebo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          direction: rtl;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          html, body, #__next, .__next {
            background-color: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact;
          }
          * {
            overflow: visible !important;
          }
          ::-webkit-scrollbar {
            display: none !important;
          }
          .print-container {
            box-shadow: none !important;
            padding: 0 10px !important;
            margin: 0 !important;
            max-width: 100% !important;
            border-radius: 0 !important;
            filter: grayscale(100%);
            width: 100%;
            height: auto !important;
            display: block !important;
            color: black !important;
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
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          border-bottom: 1px solid #ccc;
          padding-bottom: 12px;
        }
        .print-header-content h1 {
          margin: 0;
          font-size: 22px;
          color: #222;
          font-weight: 700;
        }
        .print-header-content h2 {
          margin: 0;
          font-size: 16px;
          color: #555;
          font-weight: 600;
        }
        .order-number-badge {
          background: #fff;
          color: #333;
          padding: 4px 12px;
          border: 1px solid #ccc;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
        }
        .order-details-card {
          background: #fff;
          border-top: 1px dashed #ccc;
          border-bottom: 1px dashed #ccc;
          padding: 12px 0;
          margin-bottom: 25px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .detail-item {
          display: flex;
          flex-direction: row;
          align-items: baseline;
          gap: 8px;
        }
        .detail-item span.label {
          font-size: 13px;
          color: #666;
          margin-bottom: 0;
          font-weight: 500;
          min-width: 110px;
        }
        .detail-item span.value {
          font-size: 14px;
          color: #222;
          font-weight: 600;
        }
        .full-width {
          grid-column: 1 / -1;
        }
        .section-title {
          font-size: 16px;
          color: #333;
          margin-bottom: 12px;
          font-weight: 700;
        }
        .print-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        .print-table th, .print-table td {
          padding: 8px 10px;
          text-align: right;
          font-size: 13px;
          border-bottom: 1px solid #eaeaea;
        }
        .print-table th {
          background-color: transparent;
          color: #555;
          font-weight: 600;
          border-bottom: 2px solid #ccc;
        }
        .print-table td {
          color: #333;
          font-weight: 500;
        }
        .print-table tr:nth-child(even) td {
          background-color: transparent;
        }
        .status-badge {
          display: inline-block;
          font-weight: 500;
          color: #444;
        }
        .status-pending, .status-active, .status-returned, .status-archived { 
          background: none; 
          border: none; 
          color: #444;
        }
        
        .print-footer {
          margin-top: 20px;
          text-align: center;
          font-size: 11px;
          color: #888;
          border-top: 1px solid #eaeaea;
          padding-top: 10px;
        }
        
        /* Adjust rental notes for space */
        .rental-notes-box {
          border: 1px solid #ccc; 
          border-radius: 6px;
          padding: 10px 14px; 
          margin-bottom: 12px; 
          white-space: pre-wrap; 
          text-align: center; 
          font-size: 13px; 
          font-weight: 500; 
          color: #333;
        }
        .rental-notes-box-bg {
          background-color: transparent;
        }

      `}</style>
      
      <div data-agy-id="print-order-container" className="print-container">
        <div className="bsd">בס&quot;ד</div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px', color: '#6c757d', fontSize: '18px' }}>טוען נתונים להדפסה...</div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '50px', color: '#dc3545', fontSize: '18px' }}>{error}</div>
        ) : order ? (
          <>
            <div className="print-header">
              <div className="print-header-content">
                <h1>גמ&quot;ח שמלות</h1>
                <h2>{printType === 'rental' ? 'סיכום השכרה' : 'סיכום הזמנה'}</h2>
              </div>
              <div className="order-number-badge">
                הזמנה #{order.orderId}
              </div>
            </div>

            {printType === 'rental' && printSettings && (
              <div style={{ marginBottom: '15px' }}>
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

            <div className="order-details-card">
              <div className="detail-item">
                <span className="label">שם לקוח</span>
                <span className="value">{order.customer?.firstName} {order.customer?.lastName}</span>
              </div>
              {(!order.isWeekdayEvent && !order.isAbroad) ? (
                <div className="detail-item">
                  <span className="label">תאריך אירוע עברי</span>
                  <span className="value">{order.eventDateHebrew || (order.eventDate ? getHebrewDateString(order.eventDate) : 'לא צוין')}</span>
                </div>
              ) : (
                <div className="detail-item">
                  <span className="label">סוג אירוע</span>
                  <span className="value">אירוע חו"ל</span>
                </div>
              )}
              
              <div className="detail-item">
                <span className="label">טלפון</span>
                <span className="value" style={{ direction: 'ltr', textAlign: 'right' }}>{order.customer?.phone1 || order.customer?.phone || '-'}</span>
              </div>
              
              <div className="detail-item">
                <span className="label">כתובת מגורים</span>
                <span className="value">{order.customer?.city ? `${order.customer.city}${order.customer?.address ? `, ${order.customer.address}` : ''}` : '-'}</span>
              </div>
              <div className="detail-item">
                <span className="label">סטטוס השכרה</span>
                <span className="value">
                  <span className={`status-badge ${getStatusClass(getOrderStatus(order))}`}>
                    {getOrderStatus(order)}
                  </span>
                </span>
              </div>

              {printType === 'order' && order.notes && (
                <div className="detail-item full-width">
                  <span className="label">הערות הזמנה</span>
                  <span className="value">{order.notes}</span>
                </div>
              )}
            </div>

            <h3 className="section-title">פירוט פריטים להשכרה</h3>
            
            <table className="print-table">
              <thead>
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
                    <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#6c757d' }}>אין פריטים פעילים בהזמנה זו</td>
                  </tr>
                ) : (
                  order.items.filter(i => !i.isDeleted).map((item) => {
                    let statusStr = 'טרם נלקח';
                    if (item.isReturned) statusStr = 'הוחזר';
                    else if (item.isTaken) statusStr = 'אצל הלקוח';
                    
                    return (
                      <tr key={item.id}>
                        <td style={{ fontWeight: '500' }}>{item.description || '-'}</td>
                        <td>{item.sizeText || '-'}</td>
                        <td style={{ fontWeight: '600', color: '#495057' }}>{item.barcode || item.dressItem?.dressBarcode || ((item.barcodePrefix && item.sizeText) ? `${item.barcodePrefix}${item.sizeText}` : '-')}</td>
                        {enableAlterations && (
                          <>
                            <td>{item.neckAlteration ? `הצרה ${item.neckAlteration}` : '-'}</td>
                            <td>{item.sleeveAlteration ? `הארכה ${item.sleeveAlteration}` : '-'}</td>
                            <td>{item.lengthAlteration || '-'}</td>
                          </>
                        )}
                        <td>
                          <span className={`status-badge ${getStatusClass(statusStr)}`} style={{ padding: '2px 8px', fontSize: '11px' }}>
                            {statusStr}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            <h3 className="section-title" style={{ marginTop: '15px' }}>פירוט תשלומים וחובות</h3>
            
            <div className="order-details-card" style={{ marginBottom: '10px' }}>
              <div className="detail-item">
                <span className="label">סה&quot;כ לחיוב</span>
                <span className="value" style={{ fontWeight: 'bold' }}>₪{order.obligations?.filter(o => !o.isDeleted).reduce((sum, obs) => sum + obs.amount, 0) || 0}</span>
              </div>
              <div className="detail-item">
                <span className="label">סה&quot;כ שולם</span>
                <span className="value" style={{ fontWeight: 'bold' }}>₪{order.payments?.filter(p => !p.isDeleted).reduce((sum, p) => sum + p.amount, 0) || 0}</span>
              </div>
              <div className="detail-item full-width">
                <span className="label">יתרה לתשלום</span>
                <span className="value" style={{ fontWeight: 'bold', fontSize: '16px' }}>
                  ₪{Math.max(0, (order.obligations?.filter(o => !o.isDeleted).reduce((sum, obs) => sum + obs.amount, 0) || 0) - (order.payments?.filter(p => !p.isDeleted).reduce((sum, p) => sum + p.amount, 0) || 0))}
                </span>
              </div>
              <div className="detail-item full-width" style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #ccc' }}>
                <span className="label">סטטוס תשלום</span>
                <span className="value" style={{ fontWeight: 'bold', fontSize: '16px' }}>
                  {calculatePaymentStatus(
                    order.obligations?.filter(o => !o.isDeleted).reduce((sum, obs) => sum + obs.amount, 0) || 0,
                    order.payments?.filter(p => !p.isDeleted).reduce((sum, p) => sum + p.amount, 0) || 0
                  )}
                </span>
              </div>
            </div>

            {order.payments && order.payments.filter(p => !p.isDeleted).length > 0 && (
              <>
                <h4 style={{ color: '#2c3e50', fontSize: '16px', marginBottom: '10px' }}>תשלומים שהתקבלו</h4>
                <table className="print-table" style={{ marginBottom: '20px' }}>
                  <thead>
                    <tr>
                      <th>תאריך</th>
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
                      return (
                        <tr key={idx}>
                          <td>{p.paymentDate ? `${new Date(p.paymentDate).toLocaleDateString('he-IL')} (${getHebrewDateString(p.paymentDate)})` : `${new Date().toLocaleDateString('he-IL')} (${getHebrewDateString(new Date())})`}</td>
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

            <div className="print-footer">
              <p>הופק על ידי מערכת גמ&quot;ח שמלות בתאריך: {new Date().toLocaleString('he-IL')}</p>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
