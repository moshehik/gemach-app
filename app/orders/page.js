'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { calculateOrderStatus, calculatePaymentStatus } from '../../lib/orderStatus';
import CapacitySearchModal from '../../components/CapacitySearchModal';
import ExportButtons from '../../components/ExportButtons';
import StatisticsModal from '../components/StatisticsModal';
import { useLabels } from '@/app/components/LabelsContext';
import HebrewDateRangePicker from '../../components/HebrewDateRangePicker';
import RentalReturnModal from '../../components/orders/RentalReturnModal';
import OrderModelSelector from '../../components/orders/OrderModelSelector';
import PrintWizardModal from '../components/PrintWizardModal';
import { fetchSharedJson, readCache, subscribe, TTL } from '../../lib/apiCache';
import { buildOrdersListParams, defaultOrdersAdvFilters } from '@/app/lib/prefetchRoutes';
import { listOrderDrafts } from '@/app/lib/orderDrafts';
import { V3Page, Btn, Chip, Tabs, Tip, Dialog, Field, Switch, Empty, Row, Rows, Icon } from '@/app/v3/ui/components';
import { useListDialogs, IconAction } from '@/components/lists/listKit';

// מיפוי סטטוס טקסטואלי (calculateOrderStatus/calculatePaymentStatus ב-lib/orderStatus.js, משותף
// לכמה עמודים) אל וריאנט ה-Chip של v3 כאן בעמוד ההזמנות בלבד — לא נוגעים בעוזר המשותף עצמו.
// סטטוס = ניטרלי/navy; "דורש תשומת לב" = אפרסק (DESIGN-LANGUAGE §1.2).
const getStatusChip = (status) => {
  switch (status) {
    case 'הוחזר':
      return { variant: 'done', icon: 'check-circle' };
    case 'הוחזר חלקי':
      return { variant: 'info', icon: 'refresh' };
    case 'הושכר':
      return { variant: 'gold', icon: 'bag' };
    case 'הושכר חלקי':
      return { variant: 'info', icon: 'bag' };
    case 'בקרוב':
      return { variant: undefined, icon: 'calendar' };
    case 'מחוק':
      return { variant: undefined, icon: 'trash' };
    case 'טיוטה':
      return { variant: undefined, icon: 'edit' };
    case 'עבר':
    default:
      return { variant: undefined, icon: 'folder' };
  }
};

// דגמי הפריטים (לא מחוקים) בהזמנה, ללא כפילויות - להצגה בעמודת "דגם" בטבלת ההזמנות,
// לפני עמודות הסכומים (דיווח ba717a16: שם הדגם חשוב יותר מהסכום בתצוגת החיפוש).
const getOrderModelNames = (order) => {
  const names = (order.items || [])
    .filter(i => !i.isDeleted && i.dressName)
    .map(i => i.dressName);
  return Array.from(new Set(names));
};

const getPaymentChip = (status) => {
  switch (status) {
    case 'שולם':
      return { variant: 'done', icon: 'check-circle' };
    case 'שולם חלקי':
      return { variant: 'attn', icon: 'card' };
    case 'ממתין לזיכוי':
      return { variant: 'info', icon: 'clock' };
    case 'לא שולם':
    default:
      return { variant: 'attn', icon: 'alert-circle' };
  }
};

// גוון שורה לפי מצב (סדר העדיפויות נשמר בקוד השורה: טיוטה > ציפוף > ממתין > לא שולם).
// ערכי צבע = tokens של v3 בלבד.
const ROW_TONES = {
  selected: { bg: 'var(--v3-surface-2)', bar: 'var(--v3-navy-500)' },
  draft: { bg: 'var(--v3-sky-100)', bar: 'var(--v3-navy-500)' },
  spacing: { bg: 'var(--v3-rose-50)', bar: 'var(--v3-rose-500)' },
  pending: { bg: 'var(--v3-pending-bg)', bar: 'var(--v3-pending-line)' },
  unpaid: { bg: 'var(--v3-rose-50)', bar: 'var(--v3-plum)' },
};

// בונה משפט חיפוש טבעי מתוך שדות הסינון המתקדם שמולאו בפועל, לשימוש כשמסמנים
// "חפש עם AI על השדות שמולאו" ולוחצים "החל סינון" — במקום סינון מילולי, השאילתה
// המורכבת נשלחת ל-handleAiSearch הקיים (ראה item 32 בפאנץ'-ליסט).
const RENTAL_STATUS_LABELS = { pendingOnly: 'ממתינים', activeOnly: 'מושכרים', returnedOnly: 'מוחזרים' };
const buildOrdersAiPrompt = (f) => {
  const parts = [];
  if (f.advOrderId) parts.push(`מספר הזמנה ${f.advOrderId}`);
  if (f.customerName) parts.push(`של לקוח בשם ${f.customerName}`);
  if (f.customerPhone) parts.push(`עם טלפון ${f.customerPhone}`);
  if (f.customerCity) parts.push(`בעיר ${f.customerCity}`);
  if (f.advModelName) parts.push(`בדגם ${f.advModelName}`);
  if (f.advSize) parts.push(`במידה ${f.advSize}`);
  if (f.itemDetails) parts.push(`עם פריט/ברקוד ${f.itemDetails}`);
  if (f.eventDateFrom && f.eventDateTo) parts.push(`בטווח תאריכי אירוע מ-${f.eventDateFrom} עד ${f.eventDateTo}`);
  else if (f.eventDateFrom) parts.push(`מתאריך אירוע ${f.eventDateFrom}`);
  else if (f.eventDateTo) parts.push(`עד תאריך אירוע ${f.eventDateTo}`);
  if (Array.isArray(f.rentalStatus) && f.rentalStatus.length > 0) {
    parts.push(`בסטטוס ${f.rentalStatus.map(s => RENTAL_STATUS_LABELS[s] || s).join(' או ')}`);
  }
  if (parts.length === 0) return '';
  return `הזמנות ${parts.join(', ')}`;
};

const PendingTimer = ({ cartStatusDate, holdMinutes = 15 }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!cartStatusDate) return;

    const calculateTime = () => {
      const expiry = new Date(cartStatusDate).getTime() + holdMinutes * 60000;
      const diff = expiry - Date.now();
      if (diff <= 0) {
        setTimeLeft('פג תוקף');
        return false;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}:${s.toString().padStart(2, '0')}`);
      return true;
    };

    if (calculateTime()) {
      const interval = setInterval(() => {
        if (!calculateTime()) clearInterval(interval);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [cartStatusDate, holdMinutes]);

  if (!timeLeft) return null;
  return (
    <Chip variant="attn" icon={timeLeft === 'פג תוקף' ? 'alert-circle' : 'clock'}>
      <bdi>{timeLeft}</bdi>
    </Chip>
  );
};

// הזמנות ממתינות (עגלה בתוקף) מוצגות תמיד בראש הרשימה
const sortPendingFirst = (list, holdMinutes) => {
  const now = Date.now();
  return [...list].sort((a, b) => {
    const aIsPaid = (a.totalPaid >= a.totalAmount && a.totalAmount > 0) || a.totalPaid > 0 || a.status === 'שולם' || a.status === 'שולם חלקי';
    const aPending = !a.legacyId && !aIsPaid && a.items?.some(i => i.cartStatus === 'pending' && new Date(i.cartStatusDate).getTime() + holdMinutes * 60000 > now);

    const bIsPaid = (b.totalPaid >= b.totalAmount && b.totalAmount > 0) || b.totalPaid > 0 || b.status === 'שולם' || b.status === 'שולם חלקי';
    const bPending = !b.legacyId && !bIsPaid && b.items?.some(i => i.cartStatus === 'pending' && new Date(i.cartStatusDate).getTime() + holdMinutes * 60000 > now);
    if (aPending && !bPending) return -1;
    if (!aPending && bPending) return 1;
    return 0;
  });
};

export default function OrdersPage() {
  const router = useRouter();
  const { getLabel } = useLabels();
  const { confirm: v3Confirm, notify: v3Alert, prompt: v3Prompt, dialogs } = useListDialogs();
  // הרחבת שורה (פרטים נוספים בטבלה מינימלית) — מצב תצוגה בלבד
  const [expandedRows, setExpandedRows] = useState({});
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [hoveredOrder, setHoveredOrder] = useState(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  // Default to the "בקרוב" (upcoming) tab sorted with the soonest event date first, so a
  // fresh page load opens on what the staff actually need to see, not the full archive.
  const [sort, setSort] = useState('eventDate');
  const [order, setOrder] = useState('asc');
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filterStatus, setFilterStatus] = useState('soon');

  // How long a pending cart holds its items. The server releases them back to the pool
  // based on the `inventory_hold_minutes` setting, so hardcoding 15 here made the countdown
  // and the pending/expired badges disagree with reality whenever that setting was changed.
  const [holdMinutes, setHoldMinutes] = useState(15);

  // Ticking clock for the pending-cart-hold row highlight below; reading Date.now() directly
  // during render is impure, so it's sampled in an effect instead.
  const [nowTick, setNowTick] = useState(null);
  useEffect(() => {
    setNowTick(Date.now());
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // טיוטות מקומיות של שינויים שלא נשמרו בכרטיסי הזמנה (app/lib/orderDrafts.js) —
  // { orderId: { savedAt, summary } }. שורה עם טיוטה נצבעת ומקבלת תג "לא נשמר";
  // נטען במעמד הרכבה ומתעדכן כשחוזרים לטאב/חלון (או מטאב אחר דרך storage).
  const [unsavedDrafts, setUnsavedDrafts] = useState({});
  useEffect(() => {
    const refresh = () => setUnsavedDrafts(listOrderDrafts());
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const [advFilters, setAdvFilters] = useState(defaultOrdersAdvFilters);
  const [showAdvSearch, setShowAdvSearch] = useState(false);
  // לשוניות מודל הסינון המתקדם (item 33) + מצב חיפוש AI על השדות שמולאו (item 32)
  const [advTab, setAdvTab] = useState('basic');
  const [advAiMode, setAdvAiMode] = useState(false);
  const [showCapacitySearch, setShowCapacitySearch] = useState(false);
  const [showPrintWizard, setShowPrintWizard] = useState(false);
  const [rentalModalOrderId, setRentalModalOrderId] = useState(null);

  const [showStatistics, setShowStatistics] = useState(false);
  const [aiQueryUsed, setAiQueryUsed] = useState('');
  const [isAiModeActive, setIsAiModeActive] = useState(false);

  // draft_orders_show_as_deleted (SystemSetting, default "true"): when on, autosaved-but-never-
  // finished 'טיוטה' orders are shown to staff as deleted instead of surfacing their own confusing
  // "טיוטות" tab (real bug report - see calculateOrderStatus in lib/orderStatus.js for the actual
  // status-string swap, and app/api/orders/route.js for the matching "מחוקים" query change).
  const [draftsAsDeleted, setDraftsAsDeleted] = useState(true);
  const [hideCustomSpacing, setHideCustomSpacing] = useState(false); // 1 - הסתרת ציפוף
  const [showNotTakenOrders, setShowNotTakenOrders] = useState(true); // 37 - הצג לא-נלקחו
  const [requireIdForEdit, setRequireIdForEdit] = useState(false); // 14 - ת״ז לעריכה/ביטול
  const [allowEditPartially, setAllowEditPartially] = useState(true); // 27 - עריכת מושכר חלקי
  // דיווח לקוח (הגמח הראשי): "כריכה" מיותרת שהודפסה - הפיצ'ר "פירוט הזמנות להכנה" באשף
  // ההדפסה פותח עבור נווה יעקב ויצא ללא הגדרה שמפרידה בין הגמחים. ברירת מחדל false כדי
  // לשמר את ההתנהגות הקודמת (בלי האפשרות הזו) אצל כל גמח שלא הפעיל את המפתח בפירוש.
  const [enableBatchPrintPrep, setEnableBatchPrintPrep] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSharedJson('/api/settings', { ttl: TTL.STATIC })
      .then(data => {
        if (cancelled || !Array.isArray(data)) return;
        const holdSetting = data.find(s => s.key === 'inventory_hold_minutes');
        const parsed = parseInt(holdSetting?.value, 10);
        if (!isNaN(parsed) && parsed > 0) setHoldMinutes(parsed);

        const draftsSetting = data.find(s => s.key === 'draft_orders_show_as_deleted');
        if (draftsSetting) setDraftsAsDeleted(draftsSetting.value === 'true');
        const hideSpacingSetting = data.find(s => s.key === 'hide_custom_spacing');
        if (hideSpacingSetting) setHideCustomSpacing(hideSpacingSetting.value === 'true');
        const notTakenSetting = data.find(s => s.key === 'show_not_taken_orders');
        if (notTakenSetting) setShowNotTakenOrders(notTakenSetting.value === 'true');
        const reqIdSetting = data.find(s => s.key === 'require_id_for_edit_cancel');
        if (reqIdSetting) setRequireIdForEdit(reqIdSetting.value === 'true');
        const allowPartialSetting = data.find(s => s.key === 'allow_edit_partially_rented');
        if (allowPartialSetting) setAllowEditPartially(allowPartialSetting.value === 'true');
        const batchPrintSetting = data.find(s => s.key === 'enable_batch_print_prep');
        if (batchPrintSetting) setEnableBatchPrintPrep(batchPrintSetting.value === 'true');
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // אם הוגדר להציג טיוטות כמחוקות אבל נשאר מצב-כתובת ישן על 'drafts' (טאב שהוסתר), נופלים
  // חזרה לתצוגת ברירת המחדל במקום להשאיר סינון שבור/בלתי-נגיש דרך ה-UI.
  useEffect(() => {
    if (draftsAsDeleted && filterStatus === 'drafts') {
      setFilterStatus('soon');
      setPage(1);
    }
  }, [draftsAsDeleted, filterStatus]);
  // 37 - אם לא-נלקחו מוסתר וחזר מצב ישן על not_taken, נופלים לברירת מחדל
  useEffect(() => {
    if (!showNotTakenOrders && filterStatus === 'not_taken') {
      setFilterStatus('soon');
      setPage(1);
    }
  }, [showNotTakenOrders, filterStatus]);

  // בניית ה-query דרך prefetchRoutes כדי שה-prefetch מדפים אחרים ייצר
  // את אותו מפתח מטמון בדיוק, תו בתו.
  const buildOrdersUrl = useCallback((targetPage) => {
    const queryParams = buildOrdersListParams({
      page: targetPage, limit, search, sort, order, filterStatus, advFilters
    });
    return `/api/orders?${queryParams.toString()}`;
  }, [limit, search, sort, order, advFilters, filterStatus]);

  const fetchOrders = useCallback(async (isPrefetch = false, targetPage = page) => {
    const url = buildOrdersUrl(targetPage);
    const cached = readCache(url);

    if (!isPrefetch) {
      // מטמון משותף (SWR): נתונים שנטענו כבר מוצגים מיידית, בלי מסך טעינה
      if (cached) {
        setOrders(sortPendingFirst(cached.data || [], holdMinutes));
        setTotalPages(cached.totalPages || 1);
        setTotalCount(cached.total || 0);
        setLoading(false);
      } else {
        setLoading(true);
      }
    }

    try {
      const showSpinner = !isPrefetch && !cached;
      if (showSpinner) window.dispatchEvent(new Event('app-data-fetching-start'));
      const data = await fetchSharedJson(url, { ttl: TTL.LIST });
      if (showSpinner) window.dispatchEvent(new Event('app-data-fetching-end'));

      if (!isPrefetch && targetPage === page) {
        setOrders(sortPendingFirst(data.data || [], holdMinutes));
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.total || 0);
      }
    } catch (e) {
      console.error(e);
      window.dispatchEvent(new Event('app-data-fetching-end'));
    } finally {
      if (!isPrefetch) setLoading(false);
    }
  }, [page, buildOrdersUrl, holdMinutes]);

  useEffect(() => {
    fetchOrders(false, page);

    // Background Prefetching for the next page
    const timer = setTimeout(() => {
      if (page < totalPages) {
        fetchOrders(true, page + 1);
      }
    }, 1500); // Wait 1.5s after load to not block UI
    return () => clearTimeout(timer);
  }, [fetchOrders, page, totalPages]);

  // רענון אוטומטי: כל mutation להזמנות/השכרות/תשלומים בכל מקום באפליקציה
  // מבטל את המטמון, והמנוי הזה מעדכן את הטבלה ברגע שהנתונים הטריים מגיעים.
  useEffect(() => {
    if (isAiModeActive) return undefined;
    const url = buildOrdersUrl(page);
    return subscribe(url, () => {
      const data = readCache(url);
      if (data) {
        setOrders(sortPendingFirst(data.data || [], holdMinutes));
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.total || 0);
      }
    });
  }, [buildOrdersUrl, page, holdMinutes, isAiModeActive]);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    setSearch(searchInput);
    setPage(1);
    setIsAiModeActive(false);
  };

  const handleAiSearch = async (query) => {
    try {
      const res = await fetch('/api/ai/smart-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query, pageContext: 'orders' })
      });
      const result = await res.json();
      if (res.ok) {
        setOrders(result.data || []);
        setTotalCount(result.data?.length || 0);
        setTotalPages(1);
        setIsAiModeActive(true);
        setAiQueryUsed(result.query || '');
      } else {
        v3Alert(result.error || 'החיפוש החכם לא הצליח. נסו שוב.', { title: 'החיפוש נכשל', icon: 'alert-circle' });
      }
    } catch (e) {
      console.error(e);
      v3Alert('אין קשר עם השרת כרגע. בדקו את החיבור ונסו שוב.', { title: 'בעיית תקשורת', icon: 'wifi-off' });
    }
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearch('');
    setPage(1);
    if (isAiModeActive) {
      setIsAiModeActive(false);
      fetchOrders();
    }
  };

  // תיקון באג (דיווח 3): לחיצה על "הכל" הייתה מחליפה רק את filterStatus, בלי לנקות חיפוש
  // טקסטואלי/סינון מתקדם/מצב AI שנשארו פעילים - כך שאם סינון קודם החזיר 0 תוצאות, "הכל"
  // המשיך להציג רשימה ריקה (אותם הפרמטרים עדיין נשלחים לשרת) ורק רענון מלא של העמוד, שמאפס
  // את כל ה-state בחזרה לברירת המחדל, החזיר את הרשימה. "הכל" צריך לנקות את כל הסינונים בפועל,
  // לא רק לעבור ללשונית - זו בדיוק ההתנהגות שרענון עמוד מספק במקרה.
  const handleShowAll = () => {
    setSearchInput('');
    setSearch('');
    setAdvFilters(defaultOrdersAdvFilters());
    setIsAiModeActive(false);
    setFilterStatus('all');
    setPage(1);
  };

  const handleSort = (column) => {
    if (sort === column) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(column);
      setOrder('asc');
    }
  };

  const renderSortIcon = (column) => {
    if (sort !== column) {
      return <Icon name="sort" size="sm" anim={false} />;
    }
    return (
      <Icon name="chevron-down" size="sm" anim={false} className="is-on" style={{ transform: order === 'desc' ? 'rotate(180deg)' : 'none' }} />
    );
  };

  const handleDeleteOrder = async (order, e) => {
    e.stopPropagation();
    const status = calculateOrderStatus(order, { draftsAsDeleted });
    if (status === 'הוחזר' || status === 'הוחזר חלקי' || status === 'הושכר' || status === 'הושכר חלקי') {
      await v3Alert('הזמנה שכבר יצאה להשכרה (מלאה או חלקית) או שהוחזרה — אי אפשר למחוק.', { title: 'המחיקה חסומה', icon: 'lock' });
      return;
    }
    // 27 - חסימת מחיקת מושכר חלקי גם בצד לקוח
    if (!allowEditPartially && order.items?.some(i => !i.isDeleted && i.isTaken)) {
      await v3Alert('הגדרות המערכת חוסמות מחיקה של הזמנה שהושכרה חלקית.', { title: 'המחיקה חסומה', icon: 'lock' });
      return;
    }

    if (await v3Confirm(`ההזמנה #${order.orderId} תימחק. להמשיך?`, { title: 'למחוק את ההזמנה?', confirmLabel: 'מחיקה', cancelLabel: 'להשאיר', danger: true })) {
      // 14 - בקשת ת״ז לפני ביטול אם מופעל
      // 2026-09-14 - רק כשללקוח יש בפועל ת״ז שמורה - ר' הערה מקבילה ב-app/orders/[id]/page.js
      let zeoutForDelete = null;
      if (requireIdForEdit && order.customer?.zeout) {
        const msg = 'כדי לבטל את ההזמנה צריך לאמת את תעודת הזהות של הלקוח.';
        zeoutForDelete = await v3Prompt(msg, { title: 'אימות זהות הלקוח', label: 'תעודת זהות', confirmLabel: 'אימות' });
        zeoutForDelete = zeoutForDelete ? String(zeoutForDelete).trim() : null;
        if (!zeoutForDelete) { await v3Alert('לא הוזנה תעודת זהות, ולכן ההזמנה לא נמחקה.', { title: 'הפעולה הופסקה', icon: 'info' }); return; }
      }
      try {
        const res = await fetch(`/api/orders/${order.orderId}`, {
          method: 'DELETE',
          headers: { ...(zeoutForDelete ? { 'x-zeout': zeoutForDelete, 'Content-Type': 'application/json' } : {}) },
          ...(zeoutForDelete ? { body: JSON.stringify({ zeout: zeoutForDelete }) } : {})
        });
        if (res.ok) {
          fetchOrders();
        } else {
          const data = await res.json();
          v3Alert(data.error || 'מחיקת ההזמנה נכשלה.', { title: 'המחיקה נכשלה', icon: 'alert-circle' });
        }
      } catch (err) {
        console.error(err);
        v3Alert('מחיקת ההזמנה נכשלה.', { title: 'המחיקה נכשלה', icon: 'alert-circle' });
      }
    }
  };

  const fetchOrdersForExport = async (exportLimit) => {
    try {
      const queryParams = new URLSearchParams({
        page: '1',
        limit: exportLimit.toString(),
        search,
        sort,
        order,
        filterStatus
      });
      Object.entries(advFilters).forEach(([k, v]) => {
        if (v && k !== 'rentalStatus') queryParams.append(k, v);
      });
      if (Array.isArray(advFilters.rentalStatus)) {
        if (advFilters.rentalStatus.includes('activeOnly')) queryParams.append('activeOnly', 'true');
        if (advFilters.rentalStatus.includes('returnedOnly')) queryParams.append('returnedOnly', 'true');
        if (advFilters.rentalStatus.includes('pendingOnly')) queryParams.append('pendingOnly', 'true');
      }
      const res = await fetch(`/api/orders?${queryParams.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      return (data.data || []).map(o => ({
        ...o,
        status: calculateOrderStatus(o, { draftsAsDeleted }),
        paymentStatus: calculatePaymentStatus(o.totalAmount || 0, o.totalPaid || 0),
        orderDateFormatted: o.orderDate ? new Date(o.orderDate).toLocaleDateString('he-IL') : '',
        orderTimeFormatted: o.orderDate ? new Date(o.orderDate).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : ''
      }));
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  // Used by the print wizard's "הנתונים המוצגים כעת" (currently displayed data)
  // option: reuses the exact same filter params the visible table is using
  // (search/sort/status/advanced filters) so the printed report matches
  // what's actually on screen, instead of ignoring the active filters.
  const getCurrentFilteredOrderIds = async () => {
    const list = await fetchOrdersForExport(2000);
    return list.map(o => o.orderId).filter(id => id != null);
  };

  const statusTabs = [
    { key: 'soon', label: 'בקרוב', icon: 'calendar' },
    { key: 'archive', label: 'ארכיון', icon: 'folder' },
    { key: 'deleted', label: 'מחוקות', icon: 'trash' },
    { key: 'unpaid', label: 'לא שולם', icon: 'alert-circle' },
    // מוסתר כש-draft_orders_show_as_deleted דלוק: טיוטות שלא הושלמו מוצגות כ"מחוק" ולא כטאב נפרד (ר' ההערה למעלה)
    ...(!draftsAsDeleted ? [{ key: 'drafts', label: 'טיוטות', icon: 'edit' }] : []),
    // 37 - הזמנות שלא נלקחו/חלקית - מוסתר כש-show_not_taken_orders כבוי
    ...(showNotTakenOrders ? [{ key: 'not_taken', label: 'לא נלקחו', icon: 'clock' }] : []),
    { key: 'all', label: 'הכל', icon: 'list' },
  ];

  const handleStatusTab = (key) => {
    if (key === 'all') { handleShowAll(); return; }
    setFilterStatus(key);
    setPage(1);
  };

  const sortHeader = (column, label) => (
    <button type="button" className="v3-th-btn" onClick={() => handleSort(column)}>
      {label}{renderSortIcon(column)}
    </button>
  );
  const ariaSort = (...columns) => {
    const on = columns.find(c => c === sort);
    return on ? (order === 'asc' ? 'ascending' : 'descending') : 'none';
  };

  return (
    <V3Page>
      <div className="v3-stack">
        <div className="v3-pagehead">
          <div className="v3-pagehead__title">
            <h1 className="v3-h1">ההזמנות</h1>
            <Chip icon="list"><bdi>{totalCount}</bdi> בסך הכול</Chip>
          </div>
          <div className="v3-pagehead__tools">
            <IconAction icon="list" label="סינון מתקדם" onClick={() => setShowAdvSearch(true)} />
            <IconAction icon="calendar" label="בדיקת תפוסה" onClick={() => setShowCapacitySearch(true)} />
            <IconAction icon="printer" label="הדפסות ודוחות" onClick={() => setShowPrintWizard(true)} />
            <ExportButtons
              data={orders.map(o => ({
                ...o,
                status: calculateOrderStatus(o, { draftsAsDeleted })
              }))}
              filename="הזמנות"
              columns={[
                { key: 'orderId', label: getLabel('order_id', 'קוד הזמנה') },
                { key: 'customerName', label: getLabel('order_customerName', 'לקוח') },
                { key: 'customerPhone', label: 'טלפון' },
                { key: 'customerEmail', label: 'אימייל' },
                { key: 'customerCity', label: 'עיר' },
                { key: 'orderDateFormatted', label: 'תאריך ביצוע ההזמנה' },
                { key: 'orderTimeFormatted', label: 'שעת ביצוע ההזמנה' },
                { key: 'totalAmount', label: getLabel('order_totalAmount', 'סכום לחיוב') },
                { key: 'totalPaid', label: 'שולם' },
                { key: 'paymentStatus', label: 'סטטוס תשלום' },
                { key: 'status', label: getLabel('order_status', 'סטטוס') }
              ]}
              iconOnly={true}
              onFetchData={fetchOrdersForExport}
            />
            <Link href="/orders/new" className="v3-btn v3-btn--primary">
              <Icon name="plus" />
              <span>הזמנה חדשה</span>
            </Link>
          </div>
        </div>

        {/* חיפוש טקסטואלי (Enter או כפתור) + שאלות סטטיסטיקה */}
        <form onSubmit={handleSearch} className="v3-filter-bar">
          <div className="v3-search">
            <Icon name="search" />
            <input
              type="text"
              aria-label="חיפוש הזמנה"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="מספר הזמנה, שם לקוח או דגם…"
            />
            <button type="button" className={`v3-search__clear${searchInput ? ' is-on' : ''}`} aria-label="ניקוי החיפוש" onClick={handleClearSearch}>
              <Icon name="x" size="sm" />
            </button>
          </div>
          <IconAction icon="activity" label="שאלות על הנתונים" onClick={(e) => setShowStatistics({ x: e.clientX, y: e.clientY })} />
          <Btn type="submit" variant="primary" icon="search">חיפוש</Btn>
        </form>

        {/* סינון סטטוס: הלשונית הפעילה קובעת אילו הזמנות מוצגות בטבלה */}
        <div className="v3-cluster">
          <Tabs items={statusTabs} value={filterStatus} onChange={handleStatusTab} label="סינון לפי מצב הזמנה" />
          <Tip label="מה כל לשונית מציגה">
            בקרוב: אירועים מהיום והלאה. ארכיון: אירועים שעברו. מחוקות: הזמנות שנמחקו. לא שולם: חובות מהחודשים האחרונים. לא נלקחו: הזמנות שלא נלקחו או נלקחו רק חלקית. הכל: מנקה את כל הסינונים.
          </Tip>
        </div>

        <div className="v3-table__wrap">
          {loading && orders.length === 0 ? (
            <div className="v3-empty" aria-busy="true">
              <Icon name="loader" size="xl" loop />
              <b className="v3-h2">טוענים הזמנות…</b>
            </div>
          ) : (
            <table className="v3-table">
              <thead>
                <tr>
                  <th scope="col" aria-sort={ariaSort('orderId', 'customerName')}>
                    <span className="v3-cluster">
                      {sortHeader('orderId', getLabel('order_id', 'מס׳ הזמנה'))}
                      {sortHeader('customerName', getLabel('order_customerName', 'לקוח'))}
                    </span>
                  </th>
                  <th scope="col">דגם</th>
                  <th scope="col" aria-sort={ariaSort('eventDate')}>{sortHeader('eventDate', 'תאריך האירוע')}</th>
                  <th scope="col" aria-sort={ariaSort('totalAmount', 'totalPaid')}>
                    <span className="v3-cluster">
                      {sortHeader('totalAmount', getLabel('order_totalAmount', 'סכום'))}
                      {sortHeader('totalPaid', 'שולם')}
                    </span>
                  </th>
                  <th scope="col" aria-sort={ariaSort('status')}>{sortHeader('status', getLabel('order_status', 'מצב'))}</th>
                  <th scope="col"><span className="v3-sr">פעולות</span></th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <Empty icon="search" title="לא נמצאו הזמנות" text="נסו לשנות את החיפוש או לעבור ללשונית אחרת." />
                    </td>
                  </tr>
                )}
                {orders.map(order => {
                  const isPaid = (order.totalPaid >= order.totalAmount && order.totalAmount > 0) || order.totalPaid > 0 || order.status === 'שולם' || order.status === 'שולם חלקי';
                  const pendingItem = (!order.legacyId && !isPaid) ? order.items?.find(i => i.cartStatus === 'pending') : null;
                  const isPending = pendingItem && nowTick && new Date(pendingItem.cartStatusDate).getTime() + holdMinutes * 60000 > nowTick;

                  const isUnpaid = order.totalPaid < order.totalAmount && order.totalAmount > 0;
                  const hasCustomSpacing = !hideCustomSpacing && order.customSpacing !== null && order.customSpacing !== undefined;
                  // טיוטה מקומית של שינויים שלא נשמרו בכרטיס (ר' app/lib/orderDrafts.js) —
                  // גוון ייחודי + תג, לפני שאר הצבעים: דורש החלטת משתמש בתוך הכרטיס.
                  const unsavedDraft = unsavedDrafts[order.orderId];

                  let tone = null;
                  if (selectedOrder?.orderId === order.orderId) {
                    tone = ROW_TONES.selected;
                  } else if (unsavedDraft) {
                    tone = ROW_TONES.draft;
                  } else if (hasCustomSpacing) {
                    tone = ROW_TONES.spacing;
                  } else if (isPending) {
                    tone = ROW_TONES.pending;
                  } else if (isUnpaid) {
                    tone = ROW_TONES.unpaid;
                  }
                  const rowStyle = tone ? { background: tone.bg } : {};
                  const barStyle = tone ? { borderInlineStart: `var(--v3-sp-1) solid ${tone.bar}` } : {};

                  const statusText = calculateOrderStatus(order, { draftsAsDeleted });
                  const paymentText = calculatePaymentStatus(order.totalAmount || 0, order.totalPaid || 0);
                  const statusChip = getStatusChip(statusText);
                  const paymentChip = getPaymentChip(paymentText);
                  const isExpanded = !!expandedRows[order.orderId];
                  const itemsCount = order.items ? order.items.filter(i => !i.isDeleted).length : 0;

                  return (
                    <Fragment key={order.orderId}>
                      <tr aria-expanded={isExpanded} style={{ cursor: 'pointer', ...rowStyle }} onClick={() => router.push(`/orders/${order.orderId}`)}>
                        <td style={barStyle}>
                          <div className="v3-cluster">
                            <b style={{ color: isUnpaid ? 'var(--v3-plum)' : (isPending ? 'var(--v3-gold-d)' : undefined) }}>#<bdi>{order.orderId}</bdi></b>
                            {unsavedDraft && (
                              <Tip content={(
                                <span style={{ whiteSpace: 'pre-line' }}>
                                  {`שינויים שלא נשמרו מ-${unsavedDraft.savedAt ? new Date(unsavedDraft.savedAt).toLocaleString('he-IL') : 'ביקור קודם'}${(unsavedDraft.summary || []).length ? ':\n' + unsavedDraft.summary.join('\n') : ''}\nפתחו את הכרטיס כדי לשחזר אותם או למחוק.`}
                                </span>
                              )}>
                                <Chip variant="info" icon="edit" tabIndex={-1}>לא נשמר</Chip>
                              </Tip>
                            )}
                            {pendingItem && <PendingTimer cartStatusDate={pendingItem.cartStatusDate} holdMinutes={holdMinutes} />}
                            {hasCustomSpacing && <Icon name="alert-tri" size="sm" title="מרווח החזרה מותאם להזמנה" />}
                            <span
                              role="button"
                              tabIndex={0}
                              className="v3-focusable"
                              aria-label={`פרטים מהירים על הזמנה ${order.orderId}`}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setPopoverPos({ top: rect.top - 12, left: rect.left + (rect.width / 2) });
                                setHoveredOrder(order);
                              }}
                              onMouseLeave={() => setHoveredOrder(null)}
                              onFocus={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setPopoverPos({ top: rect.top - 12, left: rect.left + (rect.width / 2) });
                                setHoveredOrder(order);
                              }}
                              onBlur={() => setHoveredOrder(null)}
                              onClick={(e) => { e.stopPropagation(); }}
                            >
                              <Icon name="info" size="sm" />
                            </span>
                          </div>
                          <div className="v3-faint v3-text-sm">{order.customerName}</div>
                        </td>
                        <td>{getOrderModelNames(order).join(', ') || '—'}</td>
                        <td>{order.eventDateHebrew || ''}</td>
                        <td>
                          <div><bdi>₪{order.totalAmount}</bdi></div>
                          <div
                            className="v3-text-sm"
                            style={{
                              color: order.totalPaid >= order.totalAmount && order.totalAmount > 0 ? 'var(--v3-navy-700)' : (isUnpaid ? 'var(--v3-plum)' : 'var(--v3-ink-3)'),
                              fontWeight: isUnpaid ? 'var(--v3-fw-bold)' : undefined,
                            }}
                          >
                            שולם <bdi>₪{order.totalPaid}</bdi>
                          </div>
                        </td>
                        <td>
                          <div className="v3-cluster">
                            <Chip variant={statusChip.variant} icon={statusChip.icon}>{statusText}</Chip>
                            <Chip variant={paymentChip.variant} icon={paymentChip.icon}>{paymentText}</Chip>
                          </div>
                        </td>
                        <td>
                          <div className="v3-cluster">
                            <Link
                              href={`/orders/${order.orderId}`}
                              className="v3-btn v3-btn--icon v3-btn--sm"
                              onClick={(e) => e.stopPropagation()}
                              title="כרטיס הזמנה"
                              aria-label="פתיחת כרטיס הזמנה"
                            >
                              <Icon name="edit" />
                            </Link>
                            <button
                              type="button"
                              className="v3-btn v3-btn--icon v3-btn--sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRentalModalOrderId(order.orderId);
                              }}
                              title="השכרה / החזרה"
                              aria-label="מעבר להשכרה או החזרה"
                            >
                              <Icon name="truck" />
                            </button>
                            <button
                              type="button"
                              className="v3-btn v3-btn--icon v3-btn--sm v3-btn--danger"
                              onClick={(e) => handleDeleteOrder(order, e)}
                              title="מחיקת הזמנה"
                              aria-label="מחיקת הזמנה"
                            >
                              <Icon name="trash" />
                            </button>
                            <button
                              type="button"
                              className="v3-btn v3-btn--icon v3-btn--sm v3-btn--quiet"
                              aria-expanded={isExpanded}
                              aria-label={isExpanded ? 'הסתרת פרטים נוספים' : 'הצגת פרטים נוספים'}
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedRows(prev => ({ ...prev, [order.orderId]: !prev[order.orderId] }));
                              }}
                            >
                              <Icon name="chevron-down" className={isExpanded ? 'is-on' : undefined} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6}>
                            <Rows>
                              <Row label="כמות פריטים" icon="box"><bdi>{itemsCount}</bdi></Row>
                              <Row label={getLabel('order_totalAmount', 'סכום לחיוב')} icon="card"><bdi>₪{order.totalAmount}</bdi></Row>
                              <Row label="שולם עד כה" icon="check-circle"><bdi>₪{order.totalPaid}</bdi></Row>
                            </Rows>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* סיכום הרשומות ועימוד */}
        <div className="v3-cluster">
          <span className="v3-muted">מוצגות <bdi>{orders.length}</bdi> הזמנות</span>
          {totalPages > 1 && (
            <div className="v3-cluster">
              <Btn size="sm" icon="chevron-end" disabled={page <= 1 || isAiModeActive} onClick={() => setPage(p => p - 1)} title="לעמוד הקודם">הקודם</Btn>
              <span className="v3-cluster">
                <label htmlFor="ordersListPageNum">עמוד</label>
                <input
                  id="ordersListPageNum"
                  type="number"
                  className="v3-input"
                  min={1}
                  max={totalPages || 1}
                  value={page}
                  onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) setPage(v); }}
                  disabled={isAiModeActive}
                  style={{ inlineSize: 'var(--v3-sp-9)', textAlign: 'center' }}
                />
                מתוך <bdi>{totalPages}</bdi>
              </span>
              <Btn size="sm" iconEnd="chevron-start" disabled={page >= totalPages || isAiModeActive} onClick={() => setPage(p => p + 1)} title="לעמוד הבא">הבא</Btn>
            </div>
          )}
        </div>
      </div>

      {/* סינון מתקדם — חלונית עם שדות = בהיר בלבד. הסינון חי בזמן אמת; "החל" רק סוגר (או מפעיל AI). */}
      <Dialog
        open={showAdvSearch}
        variant="form"
        icon="list"
        title="סינון מתקדם"
        onClose={() => setShowAdvSearch(false)}
        actions={(
          <>
            <Btn variant="primary" icon="check" onClick={() => {
              if (advAiMode) {
                const prompt = buildOrdersAiPrompt(advFilters);
                setShowAdvSearch(false);
                if (prompt) handleAiSearch(prompt);
              } else {
                setShowAdvSearch(false);
              }
            }}>החלת הסינון</Btn>
            <Btn variant="quiet" onClick={() => {
              setAdvFilters({ customerName: '', customerPhone: '', customerCity: '', advOrderId: '', itemDetails: '', advModelName: '', advSize: '', eventDateFrom: '', eventDateTo: '', rentalStatus: [] });
            }}>ניקוי כל השדות</Btn>
          </>
        )}
      >
        {/* שתי לשוניות (item 33): תאריך + סטטוס פריטים מול פרטי הזמנה/פריט/לקוח */}
        <Tabs
          items={[{ key: 'basic', label: 'תאריך ומצב' }, { key: 'details', label: 'הזמנה ולקוח' }]}
          value={advTab}
          onChange={setAdvTab}
          label="חלקי הסינון"
        />

        <div className="v3-stack">
          {advTab === 'basic' && (
            <>
              <div className="v3-field">
                <span className="v3-label">טווח תאריכי האירוע</span>
                <HebrewDateRangePicker
                  startDate={advFilters.eventDateFrom}
                  endDate={advFilters.eventDateTo}
                  onChange={(start, end) => setAdvFilters(p => ({ ...p, eventDateFrom: start, eventDateTo: end }))}
                />
              </div>

              <div className="v3-field">
                <div className="v3-cluster">
                  <span className="v3-label">מצב הפריטים</span>
                  <Btn
                    variant="quiet"
                    size="sm"
                    onClick={() => {
                      const allSelected = advFilters.rentalStatus.length === 3;
                      setAdvFilters(p => ({
                        ...p,
                        rentalStatus: allSelected ? [] : ['pendingOnly', 'activeOnly', 'returnedOnly']
                      }));
                    }}
                  >
                    {advFilters.rentalStatus.length === 3 ? 'ביטול הכל' : 'בחירת הכל'}
                  </Btn>
                </div>
                <div className="v3-cluster">
                  {[
                    { value: 'pendingOnly', label: 'ממתינים', icon: 'clock' },
                    { value: 'activeOnly', label: 'מושכרים', icon: 'bag' },
                    { value: 'returnedOnly', label: 'הוחזרו', icon: 'check' }
                  ].map(opt => {
                    const isSelected = advFilters.rentalStatus.includes(opt.value);
                    return (
                      <Chip
                        key={opt.value}
                        variant={isSelected ? 'done' : 'info'}
                        icon={opt.icon}
                        aria-pressed={isSelected}
                        onClick={() => {
                          setAdvFilters(p => {
                            const current = p.rentalStatus;
                            const next = current.includes(opt.value)
                              ? current.filter(x => x !== opt.value)
                              : [...current, opt.value];
                            return { ...p, rentalStatus: next };
                          });
                        }}
                      >
                        {opt.label}
                      </Chip>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {advTab === 'details' && (
            <>
              <Field label={getLabel('order_id', 'מספר הזמנה')} value={advFilters.advOrderId} onChange={e => setAdvFilters(p => ({ ...p, advOrderId: e.target.value }))} placeholder="למשל 1024" />
              <Field label="ברקוד או פרטי פריט" value={advFilters.itemDetails} onChange={e => setAdvFilters(p => ({ ...p, itemDetails: e.target.value }))} placeholder="ברקוד או תיאור" />
              <div className="v3-field">
                <span className="v3-label">דגם</span>
                <OrderModelSelector
                  value={{ name: advFilters.advModelName }}
                  onChange={m => setAdvFilters(p => ({ ...p, advModelName: m ? m.name : '' }))}
                  placeholder="בחירת דגם…"
                />
              </div>
              <Field label="מידה" value={advFilters.advSize} onChange={e => setAdvFilters(p => ({ ...p, advSize: e.target.value }))} placeholder="למשל 38" />
              <Field label={getLabel('order_customerName', 'שם הלקוח')} value={advFilters.customerName} onChange={e => setAdvFilters(p => ({ ...p, customerName: e.target.value }))} placeholder="שם מלא או חלקי" />
              <Field label="טלפון הלקוח" type="tel" value={advFilters.customerPhone} onChange={e => setAdvFilters(p => ({ ...p, customerPhone: e.target.value }))} placeholder="מספר טלפון" />
              <Field label="עיר" value={advFilters.customerCity} onChange={e => setAdvFilters(p => ({ ...p, customerCity: e.target.value }))} placeholder="עיר מגורים" />
            </>
          )}

          {/* AI על השדות שמולאו (item 32) — מוצג משתי הלשוניות, מוסתר לגמרי כשה-AI כבוי ברמת המערכת */}
          <div className="ai-feature-element">
            <Switch
              id="orders-adv-ai-mode"
              checked={advAiMode}
              onChange={(v) => setAdvAiMode(v)}
              label="חיפוש חכם (AI) לפי השדות שמילאתם"
            />
          </div>
        </div>
      </Dialog>

      {dialogs}

      {/* Modals */}
      <CapacitySearchModal
        isOpen={showCapacitySearch}
        onClose={() => setShowCapacitySearch(false)}
      />

      {showPrintWizard && (
        <PrintWizardModal
          onClose={() => setShowPrintWizard(false)}
          defaultReportType={enableBatchPrintPrep ? 'order_prep_by_date' : undefined}
          enableBatchPrintPrep={enableBatchPrintPrep}
          getCurrentOrderIds={getCurrentFilteredOrderIds}
        />
      )}

      {/* Rental Modal */}
      {rentalModalOrderId && (
        <RentalReturnModal
          orderId={rentalModalOrderId}
          onClose={() => setRentalModalOrderId(null)}
          onUpdate={fetchOrders}
        />
      )}

      <StatisticsModal
        isOpen={!!showStatistics}
        onClose={() => setShowStatistics(false)}
        pageContext="orders"
        contextQuery={aiQueryUsed}
        position={typeof showStatistics === 'object' ? showStatistics : null}
      />

      {/* כרטיס פרטים מהיר בריחוף על ⓘ (מיקום מחושב ב-JS — לא CSS-tooltip; ר' חוזה orders-list §k.4) */}
      {hoveredOrder && typeof document !== 'undefined' && createPortal(
        <div data-v3="" dir="rtl">
          <div
            className="v3-rich-tip is-on"
            role="tooltip"
            style={{
              top: popoverPos.top,
              left: popoverPos.left,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="v3-rich-tip__h">הזמנה #<bdi>{hoveredOrder.orderId}</bdi></div>
            <div className="v3-rich-tip__r">
              <Icon name="user" size="sm" />
              <div><small>לקוח</small><div>{hoveredOrder.customerName}</div></div>
            </div>
            <div className="v3-rich-tip__r">
              <Icon name="phone" size="sm" />
              <div><small>טלפון</small><div dir="ltr">{hoveredOrder.customerPhone || 'לא הוזן'}</div></div>
            </div>
            <div className="v3-rich-tip__r">
              <Icon name="calendar" size="sm" />
              <div><small>תאריך עברי</small><div>{hoveredOrder.eventDateHebrew || 'לא צוין'}</div></div>
            </div>

            {/* ציפוף ימים מיוחד — מוצג רק כשהוגדר ערך מותאם להזמנה (אותו תנאי שצובע את השורה), מוסתר כש-hide_custom_spacing מופעל (בקשה 1) */}
            {!hideCustomSpacing && hoveredOrder.customSpacing !== null && hoveredOrder.customSpacing !== undefined && (
              <div className="v3-rich-tip__r">
                <Icon name="alert-tri" size="sm" />
                <div><small>ציפוף ימים</small><div><bdi>{hoveredOrder.customSpacing}</bdi> {hoveredOrder.customSpacing === 1 ? 'יום' : 'ימים'}</div></div>
              </div>
            )}

            <div className="v3-rich-tip__r">
              <Icon name="truck" size="sm" />
              <div><small>הושכרו</small><div><bdi>{hoveredOrder.items ? hoveredOrder.items.filter(i => !i.isDeleted && i.isTaken).length : 0}</bdi></div></div>
            </div>
            <div className="v3-rich-tip__r">
              <Icon name="check" size="sm" />
              <div><small>הוחזרו</small><div><bdi>{hoveredOrder.items ? hoveredOrder.items.filter(i => !i.isDeleted && i.isReturned).length : 0}</bdi></div></div>
            </div>
            <div className="v3-rich-tip__r">
              <Icon name="card" size="sm" />
              <div><small>סכום לתשלום</small><div><bdi>₪{hoveredOrder.totalAmount || 0}</bdi></div></div>
            </div>
            <div className="v3-rich-tip__r">
              <Icon name="check-circle" size="sm" />
              <div><small>שולם</small><div><b><bdi>₪{hoveredOrder.totalPaid || 0}</bdi></b></div></div>
            </div>
            <div className="v3-rich-tip__r">
              <Icon name="bag" size="sm" />
              <div><small>מצב הפריטים</small><div>{calculateOrderStatus(hoveredOrder, { draftsAsDeleted })}</div></div>
            </div>
            <div className="v3-rich-tip__r">
              <Icon name="card" size="sm" />
              <div><small>מצב התשלום</small><div>{calculatePaymentStatus(hoveredOrder.totalAmount || 0, hoveredOrder.totalPaid || 0)}</div></div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </V3Page>
  );
}
