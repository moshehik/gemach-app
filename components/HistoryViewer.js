'use client';
import { useState, useEffect } from 'react';

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
  isWeekdayEvent: 'אירוע חו"ל',
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
  updatedAt: 'תאריך עדכון',
  note: 'הערה',
  discarded: 'שינויים שבוטלו',
  approvedDebtAmount: 'סכום חוב שאושר',
  // Shift (נוכחות)
  date: 'תאריך',
  hebrewDate: 'תאריך עברי',
  entryTime: 'שעת כניסה',
  exitTime: 'שעת יציאה',
  totalMinutes: 'סה"כ דקות',
  totalCalculated: 'סה"כ לתשלום',
  hourlyWageSnapshot: 'שכר שעה (בעת המשמרת)',
  travelExpensesSnapshot: 'נסיעות (בעת המשמרת)'
};

export const ACTION_TRANSLATIONS = {
  CREATE: 'יצירה',
  UPDATE: 'עדכון',
  DELETE: 'מחיקה',
  EMAIL_SENT: 'שליחת מייל',
  ADD_PAYMENT: 'הוספת תשלום',
  UPDATE_PAYMENT: 'עדכון תשלום',
  DELETE_PAYMENT: 'מחיקת תשלום',
  REMOVE_PAYMENT: 'הסרת תשלום מזיכוי',
  REFUND: 'זיכוי',
  // מחזור החיים של השכרה/החזרה
  CONFIRM_RENTAL: 'אישור השכרה',
  RETURN_RENTAL: 'החזרת פריט',
  RETURN_CONDITION: 'עדכון מצב בהחזרה',
  ADD_AUTO_NOTE: 'הערה אוטומטית',
  DEBT_APPROVED: 'אישור יתרת חוב',
  CANCEL_DEBT_APPROVAL: 'ביטול אישור יתרת חוב',
  // פעולות ביטול
  CANCEL_RENTAL: 'ביטול השכרה',
  CANCEL_RETURN: 'ביטול החזרה',
  CANCEL_SCAN: 'ביטול סריקה',
  CANCEL_ITEM: 'ביטול פריט מההזמנה',
  RESTORE_ITEM: 'שחזור פריט להזמנה',
  CANCEL_OBLIGATION: 'ביטול התחייבות תשלום',
  RESTORE_OBLIGATION: 'שחזור התחייבות תשלום',
  CANCEL_PAYMENT: 'ביטול תשלום',
  RESTORE_PAYMENT: 'שחזור תשלום',
  CANCEL_ORDER: 'ביטול הזמנה',
  CANCEL_CHANGES: 'ביטול שינויים שלא נשמרו'
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

  // Removed AI Search state

  const resetFilters = () => {
    setFilterAction('');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterSearch('');
    setSearchInput('');
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



  const formatValue = (val) => {
    if (val === null || val === undefined || val === '') return <span style={{ color: 'var(--text-3)' }}>-</span>;
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

      if (allKeys.length === 0) return <div style={{ color: 'var(--text-3)', fontStyle: 'italic', marginTop: '0.5rem', fontSize: '0.9rem' }}>אין פירוט שינויים זמין.</div>;

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
        return <div style={{ color: 'var(--text-3)', fontStyle: 'italic', marginTop: '0.5rem', fontSize: '0.9rem' }}>לא בוצעו שינויים מהותיים בשדות.</div>;
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
                  <div key={key} style={{ width: '100%', background: 'var(--surface-alt)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '0.85rem', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontWeight: '600', color: 'var(--text-3)' }}>{label}:</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--surface)', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      {!isEmptyFrom && (
                        <div style={{ textDecoration: 'line-through', color: 'var(--danger)', whiteSpace: 'pre-wrap' }}>{formatValue(change.from)}</div>
                      )}
                      <div style={{ color: 'var(--success)', fontWeight: '500', whiteSpace: 'pre-wrap' }}>{formatValue(change.to)}</div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={key} className="chip">
                  <span style={{ fontWeight: '600', color: 'var(--text-3)' }}>{label}:</span>
                  {!isEmptyFrom && (
                    <>
                      <span style={{ textDecoration: 'line-through', color: 'var(--danger)' }}>{formatValue(change.from)}</span>
                      <span style={{ color: 'var(--text-3)' }}>←</span>
                    </>
                  )}
                  <span style={{ color: 'var(--success)', fontWeight: '600' }}>{formatValue(change.to)}</span>
                </div>
              );
            }

            if (isLongText) {
              return (
                <div key={key} style={{ width: '100%', background: 'var(--surface-alt)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '0.85rem', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontWeight: '600', color: 'var(--text-3)' }}>{label}:</span>
                  <div style={{ color: 'var(--text)', fontWeight: '500', whiteSpace: 'pre-wrap', background: 'var(--surface)', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    {formatValue(change)}
                  </div>
                </div>
              );
            }

            return (
              <div key={key} className="chip">
                <span style={{ fontWeight: '600', color: 'var(--text-3)' }}>{label}:</span>
                <span style={{ color: 'var(--text)', fontWeight: '500' }}>{formatValue(change)}</span>
              </div>
            );
          })}
        </div>
      );
    } catch (e) {
      return (
        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text)', background: 'var(--surface)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', overflowX: 'auto' }} dir="ltr">
          {changesJson}
        </div>
      );
    }
  };


  return (
    <div data-agy-id="history_viewer_container" className="card card-pad" style={{ marginTop: '1rem' }} dir="rtl">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isExpanded ? '24px' : '0', borderBottom: isExpanded ? '1px solid var(--border)' : 'none', paddingBottom: isExpanded ? '12px' : '0' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg className="icon" style={{ width: '24px', height: '24px', color: 'var(--primary-solid)' }}><use href="#i-history" /></svg>
          <h3 style={{ fontSize: '1.2rem', margin: 0 }}>היסטוריית שינויים</h3>
          {!isExpanded && (
            <span style={{ color: 'var(--text-2)', fontSize: '1.1rem', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginInlineStart: '0.5rem' }}>
              <span style={{ color: 'var(--border-strong)' }}>|</span> {logs.length} תיעודי פעולות
            </span>
          )}
        </div>
        <div style={{ color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-alt)', borderRadius: '50%', padding: '0.5rem', transition: 'all 0.2s' }}>
          <svg className="icon" style={{ width: '20px', height: '20px', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}><use href="#i-chevron-down" /></svg>
        </div>
      </div>

      {isExpanded && (
        <div style={{ marginBottom: '24px', background: 'var(--surface-alt)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>

          {/* Search & Filters - One Line */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>

            <form onSubmit={(e) => { e.preventDefault(); setFilterSearch(searchInput); }} style={{ display: 'flex', gap: '8px', flex: '2', minWidth: '250px' }}>
              <div className="input-icon-wrap" style={{ flex: 1 }}>
                <svg className="icon"><use href="#i-search" /></svg>
                <input
                  className="input"
                  type="text"
                  placeholder="חיפוש חופשי בהיסטוריה..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-sm">
                <svg className="icon"><use href="#i-search" /></svg>
                חפש
              </button>
            </form>

            <div className="field" style={{ marginBottom: 0 }}>
              <label>פעולה</label>
              <select
                data-agy-id="history_viewer_action_filter_select"
                className="select"
                value={filterAction}
                onChange={e => setFilterAction(e.target.value)}
              >
                <option value="">הכל</option>
                <option value="CREATE">יצירה</option>
                <option value="UPDATE">עדכון</option>
                <option value="DELETE">מחיקה</option>
              </select>
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label>מתאריך</label>
              <input
                data-agy-id="history_viewer_start_date_input"
                className="input"
                type="date"
                value={filterStartDate}
                onChange={e => setFilterStartDate(e.target.value)}
              />
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label>עד תאריך</label>
              <input
                data-agy-id="history_viewer_end_date_input"
                className="input"
                type="date"
                value={filterEndDate}
                onChange={e => setFilterEndDate(e.target.value)}
              />
            </div>

            {(filterAction || filterStartDate || filterEndDate || filterSearch) && (
              <button
                data-agy-id="history_viewer_clear_filters_btn"
                onClick={resetFilters}
                type="button"
                className="btn btn-danger-ghost btn-sm"
              >
                <svg className="icon"><use href="#i-x" /></svg>
                נקה
              </button>
            )}
          </div>
        </div>
      )}


      {isExpanded && (
        <>
          {loading ? (
            <div className="loading-inline">
              <span className="spinner" />
              <span style={{ fontWeight: 'bold' }}>טוען היסטוריית שינויים...</span>
            </div>
          ) : error ? (
            <div className="callout callout-danger">
              <svg className="icon"><use href="#i-alert-circle" /></svg>
              שגיאה בטעינת היסטוריה: {error}
            </div>
          ) : logs.length === 0 ? (
            <div className="empty-state">
              <svg className="icon"><use href="#i-history" /></svg>
              <p>לא נמצאו תיעודי היסטוריה או שינויים.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {logs.map((log) => {
                const actionLabel = ACTION_TRANSLATIONS[log.action] || log.action;
          const actionBadgeClass = log.action === 'CREATE' ? 'badge-success' :
                               log.action === 'DELETE' ? 'badge-danger' :
                               'badge-primary';

          return (
            <div key={log.id} style={{ position: 'relative', paddingInlineStart: '16px' }}>
              {/* Timeline line */}
              <div style={{ position: 'absolute', insetInlineStart: '11px', top: '32px', bottom: '-24px', width: '2px', background: 'var(--border)' }}></div>

              <div
                style={{ fontSize: '0.9rem', borderInlineStart: '4px solid var(--primary-solid)', paddingInlineStart: '16px', background: 'var(--surface-alt)', padding: '16px', borderRadius: 'var(--radius-md)', position: 'relative', zIndex: 10, transition: 'background-color 0.2s' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-sunken)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-alt)'}
              >
                {/* Timeline dot */}
                <div style={{ position: 'absolute', insetInlineStart: '-15px', top: '20px', width: '16px', height: '16px', borderRadius: '50%', background: 'var(--surface)', border: '4px solid var(--primary-solid)' }}></div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text)', fontSize: '0.8rem', marginBottom: '12px', gap: '8px' }}>
                  <span style={{ fontWeight: '600', color: 'var(--text-3)', background: 'var(--surface)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
                    {new Date(log.createdAt).toLocaleString('he-IL', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </span>
                  <span className={`badge ${actionBadgeClass}`}>
                    {actionLabel}
                  </span>
                </div>

                <div style={{ color: 'var(--text-2)', fontWeight: '500', marginBottom: '4px' }}>
                  {log.employeeId ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--primary-solid)' }}>
                      <svg className="icon" style={{ width: '16px', height: '16px' }}><use href="#i-user" /></svg>
                      {log.employeeName || 'עובד שנמחק'}
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text)' }}>
                      <svg className="icon" style={{ width: '16px', height: '16px' }}><use href="#i-database" /></svg>
                      מערכת
                    </span>
                  )}
                  <span style={{ color: 'var(--text)', marginInlineStart: '8px', fontWeight: 'normal' }}> ביצע/ה {actionLabel}.</span>
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
