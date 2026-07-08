'use client';
import { useState, useEffect } from 'react';

const FIELD_TRANSLATIONS = {
  firstName: 'שם פרטי',
  lastName: 'שם משפחה',
  phone1: 'טלפון 1',
  phone2: 'טלפון 2',
  city: 'עיר',
  street: 'רחוב',
  houseNum: 'מספר בית',
  email: 'דוא"ל',
  emailSuffix: 'סיומת דוא"ל',
  notes: 'הערות',
  registrationDate: 'תאריך רישום',
  officeNotes: 'נתוני משרד',
  isDeleted: 'נמחק/בוטל',
  joinDate: 'תאריך הצטרפות',
  fullName: 'שם מלא',
  roleId: 'מזהה תפקיד',
  isActive: 'פעיל',
  hourlyWage: 'שכר שעתי',
  paymentMethod: 'אמצעי תשלום',
  travelExpenses: 'הוצאות נסיעה',
  name: 'שם',
  barcodePrefix: 'קידומת ברקוד',
  priceCategory: 'קטגוריית מחיר',
  inInspection: 'בבדיקה',
  imageUrl: 'תמונה',
  entryDateToRepo: 'תאריך כניסה למלאי',
  exitDateFromRepo: 'תאריך יציאה ממלאי',
  sizeText: 'מידה',
  serialNumber: 'מספר סידורי',
  dressBarcode: 'ברקוד שמלה',
  location: 'מיקום',
  locationNum: 'מספר מיקום',
  quantity: 'כמות',
  inRepair: 'בתיקון',
  notInUse: 'לא בשימוש',
  notInUseSince: 'לא בשימוש מתאריך',
  orderId: 'מספר הזמנה',
  totalAmount: 'סכום כולל',
  paymentDate: 'תאריך תשלום',
  status: 'סטטוס',
  isPaid: 'שולם',
  orderNotes: 'הערות הזמנה',
  eventDate: 'תאריך אירוע',
  eventDateHebrew: 'תאריך אירוע (עברי)',
  returnDate: 'תאריך החזרה',
  isWeekdayEvent: 'אירוע חול',
  orderDate: 'תאריך הזמנה',
  isAbroad: 'אירוע חו"ל',
  fromDate: 'מתאריך',
  toDate: 'עד תאריך',
  amount: 'סכום',
  productId: 'מק"ט',
  description: 'תיאור',
  isRefund: 'זיכוי',
  isManual: 'ידני',
  price: 'מחיר',
  repairs: 'תיקונים',
  basePrice: 'מחיר בסיס',
  finalPrice: 'מחיר סופי',
  barcode: 'ברקוד',
  size: 'מידה (מספר)',
  isTaken: 'נלקח',
  isReturned: 'הוחזר',
  returnedOk: 'הוחזר תקין',
  takenDate: 'תאריך לקיחה',
  neckAlteration: 'תיקון צוואר',
  lengthAlteration: 'תיקון אורך',
  sleeveAlteration: 'תיקון שרוול',
  alterationDetails: 'פרטי תיקון',
  alterationDone: 'תיקון בוצע',
  fromSize: 'ממידה',
  toSize: 'עד מידה',
  startDate: 'תאריך התחלה',
  endDate: 'תאריך סיום',
  category: 'קטגוריה',
  deposit: 'פיקדון',
  minSize: 'מידה מינימלית',
  maxSize: 'מידה מקסימלית',
  refund: 'החזר',
  key: 'מפתח',
  value: 'ערך',
  type: 'סוג',
  pageUrl: 'כתובת דף',
  employeeName: 'שם עובד',
  timestamp: 'זמן',
  loadingError: 'שגיאת טעינה',
  isGuest: 'אורח',
  to: 'נמען',
  cc: 'העתק',
  subject: 'נושא',
  body: 'גוף ההודעה',
  fileName: 'שם קובץ',
  errorMessage: 'שגיאה',
  sentAt: 'נשלח בתאריך',
  id: 'מזהה רשומה',
  customerId: 'מזהה לקוח',
  dressModelId: 'מזהה דגם',
  dressItemId: 'מזהה פריט שמלה',
  employeeId: 'מזהה עובד',
  deletedAt: 'תאריך מחיקה',
  createdAt: 'תאריך יצירה',
  updatedAt: 'תאריך עדכון'
};

const ACTION_TRANSLATIONS = {
  CREATE: 'יצירה',
  UPDATE: 'עדכון',
  DELETE: 'מחיקה'
};

export default function HistoryViewer({ entityType, entityId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const query = new URLSearchParams();
        if (entityType) query.append('entityType', entityType);
        if (entityId) query.append('entityId', entityId);
        
        const res = await fetch(`/api/audit?${query.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch history');
        
        const data = await res.json();
        setLogs(data.logs);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchLogs();
  }, [entityType, entityId]);

  const formatValue = (val) => {
    if (val === null || val === undefined || val === '') return <span className="text-gray-400">-</span>;
    if (typeof val === 'boolean') return val ? 'כן' : 'לא';
    if (typeof val === 'object') return JSON.stringify(val);
    
    // Format date strings if they look like ISO dates
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
      try {
         return new Date(val).toLocaleDateString('he-IL');
      } catch (e) {
         return val;
      }
    }
    
    return String(val);
  };

  const tableWrapperStyle = {
    overflowX: 'auto',
    marginTop: '1rem',
    borderRadius: '10px',
    border: '1px solid var(--border-color, #eaeaea)',
    boxShadow: 'var(--shadow-sm, 0 2px 4px rgba(0,0,0,0.02))',
    background: 'white'
  };

  const tableStyle = {
    width: '100%',
    fontSize: '0.95rem',
    textAlign: 'right',
    borderCollapse: 'collapse',
  };

  const thStyle = {
    padding: '12px 16px',
    fontWeight: '600',
    color: 'var(--text-main, #333)',
    background: 'rgba(212, 175, 55, 0.05)',
    borderBottom: '2px solid var(--border-color, #eaeaea)',
  };

  const tdStyle = {
    padding: '12px 16px',
    borderBottom: '1px solid #f1f1f1',
    color: '#444'
  };

  const tdLabelStyle = {
    ...tdStyle,
    fontWeight: 'bold',
    color: 'var(--text-main, #222)',
    width: '30%'
  };

  const valueOldStyle = {
    color: '#d32f2f',
    textDecoration: 'line-through',
    background: '#ffebee',
    padding: '4px 8px',
    borderRadius: '6px',
    display: 'inline-block',
    whiteSpace: 'pre-wrap'
  };

  const valueNewStyle = {
    color: '#2e7d32',
    fontWeight: 'bold',
    background: '#e8f5e9',
    padding: '4px 8px',
    borderRadius: '6px',
    display: 'inline-block',
    whiteSpace: 'pre-wrap'
  };

  const renderChanges = (changesJson) => {
    try {
      const changes = typeof changesJson === 'string' ? JSON.parse(changesJson) : changesJson;
      const allKeys = Object.keys(changes);
      
      if (allKeys.length === 0) return <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.5rem', fontSize: '0.9rem' }}>אין פירוט שינויים זמין.</div>;

      const filteredKeys = allKeys.filter(key => {
         const change = changes[key];
         if (change && typeof change === 'object' && ('from' in change || 'to' in change)) {
            const isEmptyFrom = change.from === null || change.from === undefined || change.from === '';
            const isEmptyTo = change.to === null || change.to === undefined || change.to === '';
            if (isEmptyFrom && isEmptyTo) return false;
            if (String(change.from) === String(change.to)) return false;
            return true;
         } else {
            const isEmpty = change === null || change === undefined || change === '';
            if (isEmpty) return false;
            return true;
         }
      });

      if (filteredKeys.length === 0) {
        return <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.5rem', fontSize: '0.9rem' }}>לא בוצעו שינויים מהותיים בשדות.</div>;
      }

      const hasFromTo = filteredKeys.some(key => {
         const change = changes[key];
         return change && typeof change === 'object' && ('from' in change || 'to' in change);
      });

      if (hasFromTo) {
        return (
          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: '30%' }}>שדה</th>
                  <th style={{ ...thStyle, width: '35%', borderRight: '1px solid #eaeaea' }}>ערך קודם</th>
                  <th style={{ ...thStyle, width: '35%', borderRight: '1px solid #eaeaea' }}>ערך מעודכן</th>
                </tr>
              </thead>
              <tbody>
                {filteredKeys.map(key => {
                  const label = FIELD_TRANSLATIONS[key] || key;
                  const change = changes[key];
                  
                  if (change && typeof change === 'object' && ('from' in change || 'to' in change)) {
                    const isEmptyFrom = change.from === null || change.from === undefined || change.from === '';
                    return (
                      <tr key={key} style={{ transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fafafa'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <td style={tdLabelStyle}>{label}</td>
                        <td style={{ ...tdStyle, borderRight: '1px solid #eaeaea' }}>
                          {isEmptyFrom ? (
                            <span style={{ color: '#aaa' }}>-</span>
                          ) : (
                            <span style={valueOldStyle}>
                              {formatValue(change.from)}
                            </span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, borderRight: '1px solid #eaeaea' }}>
                          <span style={valueNewStyle}>
                            {formatValue(change.to)}
                          </span>
                        </td>
                      </tr>
                    );
                  }
                  
                  return (
                    <tr key={key} style={{ transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fafafa'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td style={tdLabelStyle}>{label}</td>
                      <td style={{ ...tdStyle, borderRight: '1px solid #eaeaea', color: '#aaa', textAlign: 'center' }}>-</td>
                      <td style={{ ...tdStyle, borderRight: '1px solid #eaeaea' }}>
                        <span style={valueNewStyle}>
                          {formatValue(change)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      } else {
        return (
          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>שדה</th>
                  <th style={{ ...thStyle, borderRight: '1px solid #eaeaea' }}>ערך מעודכן</th>
                </tr>
              </thead>
              <tbody>
                {filteredKeys.map(key => {
                  const label = FIELD_TRANSLATIONS[key] || key;
                  const change = changes[key];
                  
                  return (
                    <tr key={key} style={{ transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fafafa'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td style={tdLabelStyle}>{label}</td>
                      <td style={{ ...tdStyle, borderRight: '1px solid #eaeaea' }}>
                        <span style={valueNewStyle}>
                          {formatValue(change)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }
    } catch (e) {
      return (
        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666', background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #eee', fontFamily: 'monospace', whiteSpace: 'pre-wrap', overflowX: 'auto' }} dir="ltr">
          {changesJson}
        </div>
      );
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center p-8 space-x-2 space-x-reverse" style={{ color: 'var(--primary-color)' }}>
      <div style={{ fontWeight: 'bold' }}>טוען היסטוריית שינויים...</div>
    </div>
  );
  
  if (error) return (
    <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-sm font-medium flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '20px', height: '20px' }} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      שגיאה בטעינת היסטוריה: {error}
    </div>
  );
  
  if (logs.length === 0) return (
    <div className="bg-gray-50 border border-gray-100 text-gray-500 p-8 rounded-xl text-center flex flex-col items-center justify-center space-y-3">
      <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '48px', height: '48px', color: '#d1d5db', marginBottom: '1rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="text-sm font-medium">לא נמצאו תיעודי היסטוריה או שינויים.</span>
    </div>
  );

  return (
    <div style={{ background: 'rgba(255,255,255,0.95)', borderRadius: '12px', padding: '24px', boxShadow: 'var(--shadow-sm, 0 4px 6px rgba(0,0,0,0.05))', border: '1px solid #eee', marginTop: '1rem', maxHeight: '500px', overflowY: 'auto' }} dir="rtl">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>
        <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '24px', height: '24px', color: 'var(--primary-color)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 style={{ fontWeight: 'bold', color: 'var(--text-main, #333)', fontSize: '1.2rem', margin: 0 }}>היסטוריית שינויים</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {logs.map((log) => {
          const actionLabel = ACTION_TRANSLATIONS[log.action] || log.action;
          const actionColorStyle = log.action === 'CREATE' ? { background: '#e8f5e9', color: '#2e7d32' } :
                               log.action === 'DELETE' ? { background: '#ffebee', color: '#c62828' } :
                               { background: '#e8eaf6', color: '#283593' };

          return (
            <div key={log.id} style={{ position: 'relative', paddingRight: '16px' }}>
              {/* Timeline line */}
              <div style={{ position: 'absolute', right: '11px', top: '32px', bottom: '-24px', width: '2px', background: '#eaeaea' }}></div>
              
              <div style={{ fontSize: '0.9rem', borderRight: '4px solid var(--primary-color, #d4af37)', paddingRight: '16px', background: 'rgba(249, 250, 251, 0.8)', padding: '16px', borderRadius: '12px', position: 'relative', zIndex: 10, transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(249, 250, 251, 0.8)'}>
                {/* Timeline dot */}
                <div style={{ position: 'absolute', right: '-15px', top: '20px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', border: '4px solid var(--primary-color, #d4af37)' }}></div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#666', fontSize: '0.8rem', marginBottom: '12px', gap: '8px' }}>
                  <span style={{ fontWeight: '600', color: '#555', background: 'white', padding: '4px 8px', borderRadius: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: '1px solid #eee' }}>
                    {new Date(log.createdAt).toLocaleString('he-IL', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </span>
                  <span style={{ ...actionColorStyle, padding: '4px 12px', borderRadius: '16px', fontWeight: 'bold', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    {actionLabel}
                  </span>
                </div>
                
                <div style={{ color: '#444', fontWeight: '500', marginBottom: '4px' }}>
                  {log.employeeId ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#283593' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      משתמש מערכת (קוד {log.employeeId})
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#666' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      מערכת
                    </span>
                  )}
                  <span style={{ color: '#666', marginRight: '8px', fontWeight: 'normal' }}>ביצע/ה {actionLabel}.</span>
                </div>
                
                <div style={{ marginTop: '12px' }}>
                  {renderChanges(log.changesJson)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
