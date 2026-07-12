'use client';
import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Search, Filter, MessageSquare, Loader2, X } from 'lucide-react';

export const FIELD_TRANSLATIONS = {
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

export const ACTION_TRANSLATIONS = {
  CREATE: 'יצירה',
  UPDATE: 'עדכון',
  DELETE: 'מחיקה',
  EMAIL_SENT: 'שליחת מייל'
};

export default function HistoryViewer({ entityType, entityId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);

  // Filters
  const [filterAction, setFilterAction] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterSearch, setFilterSearch] = useState(''); // Actual filter applied to API
  const [searchInput, setSearchInput] = useState(''); // Local state for input field
  
  // AI Chat Search
  const [chatQuery, setChatQuery] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState(null);
  
  const resetFilters = () => {
    setFilterAction('');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterSearch('');
    setSearchInput('');
    setChatQuery('');
    setAiMessage(null);
    // Let the useEffect handle the refetch
  };


  const fetchLogs = async (customFilters = null) => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      
      const targetEntityType = customFilters?.entityType !== undefined ? customFilters.entityType : entityType;
      const targetAction = customFilters?.action !== undefined ? customFilters.action : filterAction;
      const targetStartDate = customFilters?.startDate !== undefined ? customFilters.startDate : filterStartDate;
      const targetEndDate = customFilters?.endDate !== undefined ? customFilters.endDate : filterEndDate;
      const targetSearch = customFilters?.search !== undefined ? customFilters.search : filterSearch;

      if (targetEntityType) query.append('entityType', targetEntityType);
      if (entityId) query.append('entityId', entityId);
      if (targetAction) query.append('action', targetAction);
      if (targetStartDate) query.append('startDate', targetStartDate);
      if (targetEndDate) query.append('endDate', targetEndDate);
      if (targetSearch) query.append('search', targetSearch);
      
      const res = await fetch(`/api/audit?${query.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch history');
      
      const data = await res.json();
      setLogs(data.logs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [entityType, entityId, filterAction, filterStartDate, filterEndDate, filterSearch]);

  const handleSmartSearch = async (e) => {
    e.preventDefault();
    if (!chatQuery.trim()) return;

    setIsAiLoading(true);
    setAiMessage(null);
    try {
      const res = await fetch('/api/audit/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: chatQuery })
      });
      
      if (!res.ok) throw new Error('שגיאה בחיפוש חכם');
      const filters = await res.json();
      
      setFilterAction(filters.action || '');
      setFilterStartDate(filters.startDate ? filters.startDate.split('T')[0] : '');
      setFilterEndDate(filters.endDate ? filters.endDate.split('T')[0] : '');
      setFilterSearch(filters.search || '');
      setSearchInput(filters.search || '');
      
      if (filters.message) {
         setAiMessage(filters.message);
      }
      
      await fetchLogs(filters);

    } catch (err) {
      setAiMessage('מצטער, התרחשה שגיאה בהבנת הבקשה. אנא נסה שוב.');
    } finally {
      setIsAiLoading(false);
    }
  };


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

      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
          {filteredKeys.map(key => {
            const label = FIELD_TRANSLATIONS[key] || key;
            const change = changes[key];
            const isLongText = key === 'body' || key === 'notes' || key === 'orderNotes';
            
            if (change && typeof change === 'object' && ('from' in change || 'to' in change)) {
              const isEmptyFrom = change.from === null || change.from === undefined || change.from === '';
              
              if (isLongText) {
                return (
                  <div key={key} style={{ width: '100%', background: '#f8fafc', borderRadius: '12px', padding: '10px 14px', fontSize: '0.85rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontWeight: '600', color: '#64748b' }}>{label}:</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: '#fff', padding: '8px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                      {!isEmptyFrom && (
                        <div style={{ textDecoration: 'line-through', color: '#ef4444', whiteSpace: 'pre-wrap' }}>{formatValue(change.from)}</div>
                      )}
                      <div style={{ color: '#10b981', fontWeight: '500', whiteSpace: 'pre-wrap' }}>{formatValue(change.to)}</div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', borderRadius: '20px', padding: '6px 12px', fontSize: '0.85rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                  <span style={{ fontWeight: '600', color: '#64748b', marginLeft: '6px' }}>{label}:</span>
                  {!isEmptyFrom && (
                    <>
                      <span style={{ textDecoration: 'line-through', color: '#ef4444', marginLeft: '4px' }}>{formatValue(change.from)}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '12px', height: '12px', color: '#94a3b8', marginLeft: '4px', marginRight: '4px', transform: 'rotate(180deg)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                  <span style={{ color: '#10b981', fontWeight: '600' }}>{formatValue(change.to)}</span>
                </div>
              );
            }
            
            if (isLongText) {
              return (
                <div key={key} style={{ width: '100%', background: '#f8fafc', borderRadius: '12px', padding: '10px 14px', fontSize: '0.85rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontWeight: '600', color: '#64748b' }}>{label}:</span>
                  <div style={{ color: '#0f172a', fontWeight: '500', whiteSpace: 'pre-wrap', background: '#fff', padding: '8px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    {formatValue(change)}
                  </div>
                </div>
              );
            }

            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', borderRadius: '20px', padding: '6px 12px', fontSize: '0.85rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                <span style={{ fontWeight: '600', color: '#64748b', marginLeft: '6px' }}>{label}:</span>
                <span style={{ color: '#0f172a', fontWeight: '500' }}>{formatValue(change)}</span>
              </div>
            );
          })}
        </div>
      );
    } catch (e) {
      return (
        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-main)', background: 'var(--card-bg)', padding: '12px', borderRadius: '8px', border: '1px solid #eee', fontFamily: 'monospace', whiteSpace: 'pre-wrap', overflowX: 'auto' }} dir="ltr">
          {changesJson}
        </div>
      );
    }
  };


  return (
    <div style={{ background: 'rgba(255,255,255,0.95)', borderRadius: '12px', padding: '24px', boxShadow: 'var(--shadow-sm, 0 4px 6px rgba(0,0,0,0.05))', border: '1px solid #eee', marginTop: '1rem', /* Remove fixed height so it's less squished, except when in modal it can naturally scroll if restricted externally */ }} dir="rtl">
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isExpanded ? '24px' : '0', borderBottom: isExpanded ? '1px solid #eee' : 'none', paddingBottom: isExpanded ? '12px' : '0' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '24px', height: '24px', color: 'var(--primary-color)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 style={{ fontWeight: 'bold', color: 'var(--text-main, #333)', fontSize: '1.2rem', margin: 0 }}>היסטוריית שינויים</h3>
          {!isExpanded && (
            <span style={{ color: '#64748b', fontSize: '1.1rem', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginRight: '0.5rem' }}>
              <span style={{ color: '#cbd5e1' }}>|</span> {logs.length} תיעודי פעולות
            </span>
          )}
        </div>
        <div style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '50%', padding: '0.5rem', transition: 'all 0.2s' }}>
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>
      
      {isExpanded && (
        <div style={{ marginBottom: '24px', background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          
          {/* Search & Filters - One Line */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
            
            <form onSubmit={handleSmartSearch} style={{ display: 'flex', gap: '8px', flex: '2', minWidth: '250px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <div style={{ position: 'absolute', right: '12px', top: '10px', color: 'var(--primary-color)' }}>
                  <MessageSquare size={18} />
                </div>
                <input 
                  type="text" 
                  placeholder='חיפוש AI חכם (לדוג: "מי מחק?")' 
                  value={chatQuery}
                  onChange={e => setChatQuery(e.target.value)}
                  style={{ width: '100%', padding: '8px 32px 8px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
                  onFocus={e => e.target.style.borderColor = 'var(--primary-color)'}
                  onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                />
              </div>
              <button 
                type="submit" 
                disabled={isAiLoading || !chatQuery.trim()}
                style={{ background: 'var(--primary-color)', color: '#fff', padding: '0 16px', borderRadius: '6px', fontWeight: 'bold', border: 'none', cursor: isAiLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: isAiLoading || !chatQuery.trim() ? 0.7 : 1, fontSize: '0.9rem' }}
              >
                {isAiLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                חפש
              </button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '500' }}>פעולה</label>
              <select 
                value={filterAction} 
                onChange={e => setFilterAction(e.target.value)}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem' }}
              >
                <option value="">הכל</option>
                <option value="CREATE">יצירה</option>
                <option value="UPDATE">עדכון</option>
                <option value="DELETE">מחיקה</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '500' }}>מתאריך</label>
              <input 
                type="date" 
                value={filterStartDate} 
                onChange={e => setFilterStartDate(e.target.value)}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem' }}
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '500' }}>עד תאריך</label>
              <input 
                type="date" 
                value={filterEndDate} 
                onChange={e => setFilterEndDate(e.target.value)}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1', minWidth: '150px' }}>
              <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '500' }}>חיפוש חופשי</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="הקלד חופשי..."
                  value={searchInput} 
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      setFilterSearch(searchInput);
                    }
                  }}
                  onBlur={() => setFilterSearch(searchInput)}
                  style={{ width: '100%', padding: '8px 8px 8px 28px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem' }}
                />
                <Search size={14} style={{ position: 'absolute', left: '8px', top: '10px', color: '#94a3b8' }} />
              </div>
            </div>

            {(filterAction || filterStartDate || filterEndDate || filterSearch || chatQuery) && (
              <button 
                onClick={resetFilters}
                style={{ padding: '8px 12px', background: 'transparent', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500', fontSize: '0.9rem' }}
              >
                <X size={14} />
                נקה
              </button>
            )}
          </div>

          {aiMessage && (
            <div style={{ marginTop: '12px', padding: '10px 14px', background: '#e0f2fe', color: '#0369a1', borderRadius: '8px', fontSize: '0.9rem', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <MessageSquare size={16} style={{ marginTop: '2px' }} />
              <div>
                <strong>תשובת AI:</strong> {aiMessage}
              </div>
            </div>
          )}
        </div>
      )}

      
      {isExpanded && (
        <>
          {loading ? (
            <div className="flex justify-center items-center p-8 space-x-2 space-x-reverse" style={{ color: 'var(--primary-color)' }}>
              <Loader2 size={24} className="animate-spin" />
              <div style={{ fontWeight: 'bold' }}>טוען היסטוריית שינויים...</div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-sm font-medium flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '20px', height: '20px' }} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              שגיאה בטעינת היסטוריה: {error}
            </div>
          ) : logs.length === 0 ? (
            <div className="bg-gray-50 border border-gray-100 text-gray-500 p-8 rounded-xl text-center flex flex-col items-center justify-center space-y-3">
              <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '48px', height: '48px', color: '#d1d5db', marginBottom: '1rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium">לא נמצאו תיעודי היסטוריה או שינויים.</span>
            </div>
          ) : (
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
                <div style={{ position: 'absolute', right: '-15px', top: '20px', width: '16px', height: '16px', borderRadius: '50%', background: 'var(--card-bg)', border: '4px solid var(--primary-color, #d4af37)' }}></div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-main)', fontSize: '0.8rem', marginBottom: '12px', gap: '8px' }}>
                  <span style={{ fontWeight: '600', color: 'var(--text-muted)', background: 'var(--card-bg)', padding: '4px 8px', borderRadius: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: '1px solid #eee' }}>
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
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-main)' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      מערכת
                    </span>
                  )}
                  <span style={{ color: 'var(--text-main)', marginRight: '8px', fontWeight: 'normal' }}>ביצע/ה {actionLabel}.</span>
                </div>
                
                <div style={{ marginTop: '12px' }}>
                  {renderChanges(log.changesJson)}
                </div>
              </div>
            </div>
          );
        })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
