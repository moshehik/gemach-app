'use client';
// היסטוריית שינויים -- תצוגה v3 (פיד hf-*). הטבלאות FIELD_TRANSLATIONS/ACTION_TRANSLATIONS נשארות כ-export תואם
// לקבצים שמייבאים אותן (טאבים, ChangesChips, ModernItemsManager, RentalReturnModal) עד שכולם עוברים לפיד.
import { useState, useEffect, useMemo } from 'react';
import { V3Page, Card, Btn, IconBtn, Chip, Field, Banner } from '@/app/v3/ui/components';
import HistoryFeed from '@/app/v3/history/HistoryFeed';
import { loadOrderHistoryRows, loadDressHistoryRows, itemsIndexFromOrder } from '@/app/v3/history/adapter';

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

// ---------------------------------------------------------------------------
// HistoryViewer v3 -- נקודת הכניסה לכל מסך שמציג היסטוריה (R23).
// אותן קריאות ואותם פרמטרים של GET /api/audit כמו קודם (R8); הפיד עצמו ב-app/v3/history.
// props (כולן אופציונליות; <HistoryViewer entityType entityId/> ישן ממשיך לעבוד):
//   entityType, entityId   כמו קודם
//   order                  נתוני הזמנה שכבר בכרטיס (items/payments/obligations/refunds) -- חוסך קריאה
//   liveUndo, onUndo       חלון "ביטול מיידי" קיים של המסך המארח (ר' HISTORY-DESIGN §3.7)
//   embedded               בלי מסגרת כרטיס/כותרת (לשילוב בתוך טאב קיים)
// ---------------------------------------------------------------------------
async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) { const err = new Error('Failed to fetch history'); err.status = res.status; throw err; }
  return res.json();
}

export default function HistoryViewer({ entityType, entityId, order, liveUndo, onUndo, embedded = false }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [ctx, setCtx] = useState({});
  const [unified, setUnified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [error, setError] = useState(null);
  const [forbidden, setForbidden] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // סינון שרת (כמו במסך הישן): פעולה, תאריכים, חיפוש בתוך changesJson
  const [filterAction, setFilterAction] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  const resetFilters = () => { setFilterAction(''); setFilterStartDate(''); setFilterEndDate(''); setFilterSearch(''); };
  const hasFilters = !!(filterAction || filterStartDate || filterEndDate || filterSearch);

  const buildQuery = (extraPage) => {
    const query = new URLSearchParams();
    if (entityType) query.append('entityType', entityType);
    if (entityId) query.append('entityId', entityId);
    if (filterAction) query.append('action', filterAction);
    if (filterStartDate) query.append('startDate', filterStartDate);
    if (filterEndDate) query.append('endDate', filterEndDate);
    if (filterSearch) query.append('search', filterSearch);
    if (extraPage) query.append('page', String(extraPage));
    return query.toString();
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null); setForbidden(false);
      try {
        const extra = new URLSearchParams();
        if (filterAction) extra.append('action', filterAction);
        if (filterStartDate) extra.append('startDate', filterStartDate);
        if (filterEndDate) extra.append('endDate', filterEndDate);
        if (filterSearch) extra.append('search', filterSearch);
        const extraQs = extra.toString();
        const withExtra = (u) => getJson(extraQs ? `${u}&${extraQs}` : u);

        // הזמנה: איחוד Order+פריטים+תשלומים+חיובים+זיכויים (HISTORY-DESIGN §3.1), בלי שינוי שרת
        if (entityType === 'Order' && entityId) {
          let ord = order || null;
          if (!ord) { try { ord = await getJson(`/api/orders/${encodeURIComponent(entityId)}`); } catch { ord = null; } }
          if (ord) {
            const merged = await loadOrderHistoryRows({ ...ord, orderId: ord.orderId ?? entityId }, withExtra);
            if (cancelled) return;
            setRows(merged); setTotal(merged.totalAll || merged.length); setPage(1); setUnified(true);
            setCtx({ itemsById: itemsIndexFromOrder(ord), singleOrder: true });
            return;
          }
        }
        // דגם: DressModel + DressItem
        if (entityType === 'DressModel' && entityId) {
          let dress = null;
          try { dress = await getJson(`/api/dresses/${encodeURIComponent(entityId)}?includeDeleted=true`); } catch { dress = null; }
          if (dress) {
            const merged = await loadDressHistoryRows(entityId, (dress.items || []).map((i) => i.id).filter(Boolean), withExtra);
            if (cancelled) return;
            setRows(merged); setTotal(merged.totalAll || merged.length); setPage(1); setUnified(true); setCtx({});
            return;
          }
        }
        // כל השאר: קריאה אחת, בדיוק כמו ב-HistoryViewer הישן
        const data = await getJson(`/api/audit?${buildQuery()}`);
        if (cancelled) return;
        setRows(data.logs || []); setTotal(data.total || 0); setPage(1); setUnified(false); setCtx({});
      } catch (err) {
        if (cancelled) return;
        if (err.status === 403) setForbidden(true); else setError(err.message);
      } finally {
        if (!cancelled) { setLoading(false); setLoadedOnce(true); }
      }
    })();
    return () => { cancelled = true; };
  }, [entityType, entityId, order, filterAction, filterStartDate, filterEndDate, filterSearch]);

  // "טעינת עוד": רק במצב הקריאה היחידה (page= קיים בשרת)
  const hasMore = total > rows.length;
  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const data = await getJson(`/api/audit?${buildQuery(page + 1)}`);
      setRows((r) => { const seen = new Set(r.map((x) => x.id)); return [...r, ...(data.logs || []).filter((x) => !seen.has(x.id))]; });
      setPage((p) => p + 1);
    } catch (err) { setError(err.message); } finally { setLoadingMore(false); }
  };

  const feedCtx = useMemo(() => ({ ...ctx, liveUndo }), [ctx, liveUndo]);
  const global = !entityType && !entityId;

  const body = (
    <>
      <div className="v3-hadv">
        <Field label="פעולה" as="select" data-agy-id="history_viewer_action_filter_select" value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
          <option value="">הכל</option>
          <option value="CREATE">יצירה</option>
          <option value="UPDATE">עדכון</option>
          <option value="DELETE">מחיקה</option>
        </Field>
        <Field label="מתאריך" type="date" data-agy-id="history_viewer_start_date_input" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} />
        <Field label="עד תאריך" type="date" data-agy-id="history_viewer_end_date_input" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} />
        {hasFilters && <Btn variant="quiet" icon="x" data-agy-id="history_viewer_clear_filters_btn" onClick={resetFilters}>נקה</Btn>}
      </div>
      {!loadedOnce && loading ? (
        <div className="v3-hempty" role="status" aria-busy="true"><span className="v3-spin" aria-hidden="true" /><b>טוען היסטוריה...</b></div>
      ) : forbidden ? (
        <Banner kind="info" title="אין הרשאה לצפות בהיסטוריה הזו" text="ההיסטוריה של פרטי עובדים זמינה להנהלה הראשית בלבד." />
      ) : error ? (
        <Banner kind="alert" title="לא הצלחנו לטעון את ההיסטוריה" text={error} />
      ) : (
        <div aria-busy={loading || undefined} style={loading ? { opacity: 0.6, transition: 'opacity var(--v3-dur-fast)' } : undefined}>
          <HistoryFeed
            rows={rows} ctx={feedCtx} total={total} showEntity={global} canShowAll={global}
            hasMore={hasMore} loadingMore={loadingMore} onLoadMore={hasMore && !unified ? loadMore : undefined}
            serverQuery={filterSearch} onServerSearch={(s) => setFilterSearch(s)} onClearServerSearch={() => setFilterSearch('')}
            onUndo={onUndo}
          />
        </div>
      )}
    </>
  );

  if (embedded) return <V3Page page={false} data-agy-id="history_viewer_container">{body}</V3Page>;
  return (
    <V3Page page={false} data-agy-id="history_viewer_container" style={{ marginTop: '1rem' }}>
      <Card
        icon="history" title="היסטוריית שינויים"
        tip="כל שינוי שנעשה, מסודר לפי יום. לחיצה על שורה פותחת את הפרטים: מה היה ומה נהיה."
        actions={(
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--v3-sp-3)' }}>
            {!isExpanded && <Chip icon="history"><bdi>{total || rows.length}</bdi> רשומות</Chip>}
            <IconBtn icon="chevron-down" label={isExpanded ? 'כיווץ ההיסטוריה' : 'הרחבת ההיסטוריה'} aria-expanded={isExpanded} onClick={() => setIsExpanded((v) => !v)} />
          </span>
        )}
      >
        {isExpanded && body}
      </Card>
    </V3Page>
  );
}
