'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getHebrewDateString } from '../../../lib/hebrewDate';

export default function PrintOrderPage() {
  const searchParams = useSearchParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enableAlterations, setEnableAlterations] = useState(true);

  const orderId = searchParams.get('orderId');

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) throw new Error('Failed to fetch order data');
      const data = await res.json();
      setOrder(data);

      const settingsRes = await fetch('/api/settings');
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        const altSetting = settingsData.find(s => s.key === 'enable_alterations');
        if (altSetting && altSetting.value === 'false') {
          setEnableAlterations(false);
        }
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

  const getOrderStatus = (order) => {
    if (!order) return '';
    if (order.status === 'בוטל' || order.status === 'ARCHIVED') return 'ארכיון/מבוטל';
    const hasUnreturned = order.items && order.items.some(i => i.isTaken && !i.isReturned && !i.isDeleted);
    const hasPending = order.items && order.items.some(i => !i.isTaken && !i.isDeleted);
    if (hasUnreturned) return 'פעיל (אצל לקוח)';
    if (hasPending) return 'ממתין (טרם נלקח)';
    return 'הוחזר (מלא)';
  };

  const getStatusClass = (status) => {
    if (status.includes('ארכיון') || status.includes('מבוטל')) return 'status-archived';
    if (status.includes('פעיל')) return 'status-active';
    if (status.includes('הוחזר')) return 'status-returned';
    return 'status-pending';
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
          body {
            background-color: white;
            margin: 0;
            padding: 0;
          }
          .print-container {
            box-shadow: none;
            padding: 0;
            margin: 0;
            max-width: 100%;
            border-radius: 0;
          }
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
        .print-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #e9ecef;
          padding-bottom: 20px;
        }
        .print-header-content h1 {
          margin: 0;
          font-size: 28px;
          color: #2c3e50;
          font-weight: 700;
        }
        .print-header-content h2 {
          margin: 5px 0 0 0;
          font-size: 16px;
          color: #6c757d;
          font-weight: 400;
        }
        .order-number-badge {
          background: #e3f2fd;
          color: #1976d2;
          padding: 8px 20px;
          border-radius: 30px;
          font-size: 20px;
          font-weight: 700;
          -webkit-print-color-adjust: exact;
        }
        .order-details-card {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 35px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          -webkit-print-color-adjust: exact;
        }
        .detail-item {
          display: flex;
          flex-direction: column;
        }
        .detail-item span.label {
          font-size: 13px;
          color: #6c757d;
          margin-bottom: 4px;
          font-weight: 600;
        }
        .detail-item span.value {
          font-size: 16px;
          color: #212529;
          font-weight: 500;
        }
        .full-width {
          grid-column: 1 / -1;
        }
        .section-title {
          font-size: 20px;
          color: #2c3e50;
          margin-bottom: 15px;
          font-weight: 600;
          border-bottom: 2px solid #e9ecef;
          padding-bottom: 8px;
        }
        .print-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          overflow: hidden;
        }
        .print-table th, .print-table td {
          padding: 12px 16px;
          text-align: right;
          font-size: 14px;
        }
        .print-table th {
          background-color: #f1f3f5;
          color: #495057;
          font-weight: 600;
          border-bottom: 2px solid #e9ecef;
          -webkit-print-color-adjust: exact;
        }
        .print-table td {
          border-bottom: 1px solid #e9ecef;
          color: #212529;
        }
        .print-table tr:last-child td {
          border-bottom: none;
        }
        .print-table tr:nth-child(even) td {
          background-color: #fcfcfc;
          -webkit-print-color-adjust: exact;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
        }
        .status-pending { background: #fff3cd; color: #856404; border: 1px solid #ffeeba; -webkit-print-color-adjust: exact; }
        .status-active { background: #cce5ff; color: #004085; border: 1px solid #b8daff; -webkit-print-color-adjust: exact; }
        .status-returned { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; -webkit-print-color-adjust: exact; }
        .status-archived { background: #e2e3e5; color: #383d41; border: 1px solid #d6d8db; -webkit-print-color-adjust: exact; }
        
        .print-footer {
          margin-top: 40px;
          text-align: center;
          font-size: 13px;
          color: #adb5bd;
          border-top: 1px solid #e9ecef;
          padding-top: 20px;
        }
      `}</style>
      
      <div className="print-container">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px', color: '#6c757d', fontSize: '18px' }}>טוען נתונים להדפסה...</div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '50px', color: '#dc3545', fontSize: '18px' }}>{error}</div>
        ) : order ? (
          <>
            <div className="print-header">
              <div className="print-header-content">
                <h1>גמ&quot;ח שמלות</h1>
                <h2>דוח השכרות פירוט</h2>
              </div>
              <div className="order-number-badge">
                הזמנה #{order.orderId}
              </div>
            </div>

            <div className="order-details-card">
              <div className="detail-item">
                <span className="label">שם לקוח</span>
                <span className="value">{order.customer?.firstName} {order.customer?.lastName}</span>
              </div>
              <div className="detail-item">
                <span className="label">תאריך אירוע עברי</span>
                <span className="value">{order.eventDateHebrew || (order.eventDate ? getHebrewDateString(order.eventDate) : 'לא צוין')}</span>
              </div>
              
              <div className="detail-item">
                <span className="label">טלפון</span>
                <span className="value" style={{ direction: 'ltr', textAlign: 'right' }}>{order.customer?.phone1 || order.customer?.phone || '-'}</span>
              </div>
              <div className="detail-item">
                <span className="label">תאריך אירוע לועזי</span>
                <span className="value">{order.eventDate ? new Date(order.eventDate).toLocaleDateString('he-IL') : '-'}</span>
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

              {order.notes && (
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
                        <td style={{ fontWeight: '600', color: '#495057' }}>{item.barcode || '-'}</td>
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

            <h3 className="section-title" style={{ marginTop: '30px' }}>פירוט תשלומים וחובות</h3>
            
            <div className="order-details-card" style={{ marginBottom: '20px' }}>
              <div className="detail-item">
                <span className="label">סה&quot;כ לחיוב</span>
                <span className="value" style={{ color: '#b91c1c', fontWeight: 'bold' }}>₪{order.obligations?.filter(o => !o.isDeleted).reduce((sum, obs) => sum + obs.amount, 0) || 0}</span>
              </div>
              <div className="detail-item">
                <span className="label">סה&quot;כ שולם</span>
                <span className="value" style={{ color: '#166534', fontWeight: 'bold' }}>₪{order.payments?.filter(p => !p.isDeleted).reduce((sum, p) => sum + p.amount, 0) || 0}</span>
              </div>
              <div className="detail-item full-width">
                <span className="label">יתרה לתשלום</span>
                <span className="value" style={{ color: ((order.obligations?.filter(o => !o.isDeleted).reduce((sum, obs) => sum + obs.amount, 0) || 0) - (order.payments?.filter(p => !p.isDeleted).reduce((sum, p) => sum + p.amount, 0) || 0)) > 0 ? '#b91c1c' : '#212529', fontWeight: 'bold', fontSize: '18px' }}>
                  ₪{Math.max(0, (order.obligations?.filter(o => !o.isDeleted).reduce((sum, obs) => sum + obs.amount, 0) || 0) - (order.payments?.filter(p => !p.isDeleted).reduce((sum, p) => sum + p.amount, 0) || 0))}
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
                      try {
                        if (typeof notes === 'string' && notes.trim().startsWith('{')) {
                          const parsed = JSON.parse(notes);
                          notes = parsed.Confirmation || parsed.TransactionId || parsed['אישור'] ? `אישור: ${parsed.Confirmation || parsed.TransactionId || parsed['אישור']}` : 'סליקת אשראי';
                        } else if (typeof notes === 'string') {
                           const match = notes.match(/אישור:\s*([a-zA-Z0-9]+)/);
                           if (match && match[1]) notes = `אישור: ${match[1]}`;
                           else notes = notes.split(' | ')[0];
                        }
                      } catch (e) {}
                      return (
                        <tr key={idx}>
                          <td>{new Date(p.paymentDate).toLocaleDateString('he-IL')}</td>
                          <td>{p.paymentMethod || '-'}</td>
                          <td style={{ fontWeight: 'bold', color: '#16a34a' }}>₪{p.amount}</td>
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
