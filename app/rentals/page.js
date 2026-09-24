'use client';

import { useState, useEffect, Fragment } from 'react';
import { calculateOrderStatus } from '../../lib/orderStatus';
import { getHebrewDateString } from '../../lib/hebrewDate';
import ExportButtons from '../../components/ExportButtons';
import StatisticsModal from '../components/StatisticsModal';
import { useLabels } from '@/app/components/LabelsContext';
import RentalReturnModal from '../../components/orders/RentalReturnModal';
import OrderModelSelector from '../../components/orders/OrderModelSelector';
import useDebounce from '@/hooks/useDebounce';
import { cacheNamespace } from '@/app/lib/pageCache';
import { buildRentalsListParams, defaultRentalsAdvFilters } from '@/app/lib/prefetchRoutes';
import { getLateReturnInfo, LATE_RETURN_THRESHOLD_DAYS } from '@/lib/lateReturn';
import { postReturnScan } from '@/components/orders/returnScanClient';
import RentedPastEventWidget from '@/app/components/RentedPastEventWidget';
import { V3Page, Btn, Chip, Tabs, Seg, Tip, Dialog, Field, Switch, Empty, Row, Rows, Icon } from '@/app/v3/ui/components';
import { useListDialogs, IconAction } from '@/components/lists/listKit';

// שמור על 50 רשומות בטעינה - עקבי עם app/orders/page.js ו-app/refunds/page.js.
const PAGE_SIZE = 50;

// בונה משפט חיפוש טבעי מתוך שדות הסינון המתקדם שמולאו בפועל, לשימוש כשמסמנים
// "חפש עם AI על השדות שמולאו" ולוחצים "סגור והחל סינון" — נשלח ל-handleAiSearch
// הקיים במקום סינון מילולי (ראה item 32 בפאנץ'-ליסט).
const buildRentalsAiPrompt = (f) => {
  const parts = [];
  if (f.advOrderId) parts.push(`מספר הזמנה ${f.advOrderId}`);
  if (f.customerName) parts.push(`של לקוח בשם ${f.customerName}`);
  if (f.customerPhone) parts.push(`עם טלפון ${f.customerPhone}`);
  if (f.customerCity) parts.push(`בעיר ${f.customerCity}`);
  if (f.advModelName) parts.push(`בדגם ${f.advModelName}`);
  if (f.itemDetails) parts.push(`עם פריט/ברקוד ${f.itemDetails}`);
  if (parts.length === 0) return '';
  return `השכרות ${parts.join(', ')}`;
};

// מטמון SWR משותף — ראה app/lib/pageCache.js; בניית ה-query עברה ל-prefetchRoutes.js
// כדי שה-prefetch מדפים אחרים ייצר את אותו מפתח בדיוק.
const rentalsCache = cacheNamespace('rentals');

// חיפוש AI (/api/ai/smart-search) לא מכיר "מצב תצוגה" (לשונית) בכלל ומחזיר תוצאות מכל
// הסטטוסים - הפילטר הזה משכפל בצד הלקוח בדיוק את אותם תנאים שהחיפוש/הסינון-המתקדם
// הרגילים שולחים לשרת (activeOnly/partiallyRentedOnly/returnedOnly/partiallyReturnedOnly
// ב-app/api/orders/route.js), כדי שתוצאות AI גם יישארו בתוך הלשונית הפעילה.
const matchesRentalsViewMode = (order, viewMode) => {
  const status = calculateOrderStatus(order);
  switch (viewMode) {
    case 'rented': return status === 'הושכר' || status === 'הושכר חלקי' || status === 'הוחזר חלקי';
    case 'rented_partial': return status === 'הושכר חלקי';
    case 'returned': return status === 'הוחזר' || status === 'הוחזר חלקי';
    case 'returned_partial': return status === 'הוחזר חלקי';
    default: return true;
  }
};

// צבעי נקודת-הסטטוס בטבלה — עקבי עם הצבעים של כפתורי הסינון (.pill-tabs) מעל הטבלה.
const STATUS_DOT_COLORS = {
  'הושכר': 'var(--warning)',
  'הושכר חלקי': 'var(--accent)',
  'הוחזר': 'var(--success)',
  'הוחזר חלקי': 'var(--info)',
  'מחוק': 'var(--danger)',
  'טיוטה': 'var(--text-3)',
  'עבר': 'var(--text-3)',
  'בקרוב': 'var(--primary-solid)',
};

// סטטוס הזמנה -> וריאנט Chip של v3 (סטטוס = ניטרלי/navy; זהב = "בחוץ עכשיו").
const getStatusChip = (status) => {
  switch (status) {
    case 'הושכר':
      return { variant: 'gold', icon: 'bag' };
    case 'הושכר חלקי':
      return { variant: 'info', icon: 'bag' };
    case 'הוחזר':
      return { variant: 'done', icon: 'check-circle' };
    case 'הוחזר חלקי':
      return { variant: 'info', icon: 'refresh' };
    case 'מחוק':
      return { variant: undefined, icon: 'trash' };
    case 'טיוטה':
      return { variant: undefined, icon: 'edit' };
    case 'בקרוב':
      return { variant: undefined, icon: 'calendar' };
    default:
      return { variant: undefined, icon: 'folder' };
  }
};

// גוון שורה לפי סטטוס (הנגזר תמיד מ-calculateOrderStatus) — tokens של v3 בלבד.
const STATUS_TONES = {
  'הושכר': { bg: 'var(--v3-gold-a12)', bar: 'var(--v3-gold)' },
  'הושכר חלקי': { bg: 'var(--v3-gold-a12)', bar: 'var(--v3-gold-b)' },
  'הוחזר': { bg: 'var(--v3-sky-100)', bar: 'var(--v3-navy-500)' },
  'הוחזר חלקי': { bg: 'var(--v3-sky-50)', bar: 'var(--v3-sky-400)' },
};
const SPACING_TONE = { bg: 'var(--v3-rose-50)', bar: 'var(--v3-rose-500)' };

export default function RentalsPage() {
  const { getLabel } = useLabels();
  const { confirm: v3Confirm, notify: v3Alert, dialogs } = useListDialogs();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  // 'rented', 'rented_partial', 'returned', 'returned_partial' - שתי לשוניות ראשיות
  // ("השכרות"/"החזרות", דיווח e6c14620 + בקשה משלימה בצ'אט) + תת-סינון "חלקי בלבד" בכל אחת.
  // ברירת המחדל 'rented' (לא "הכל" מעורב) - כדי שהצוות לא יגלול בין השכרות פעילות להחזרות
  // מעורבבות יחד, ר' גם navConfig.js (#rented/#returned) שכבר קפץ ישירות ללשונית המתאימה.
  // 'all' עדיין ערך פנימי תקף (לא מוצג יותר בכפתורי הלשוניות) - נשאר לשימוש הפנימי היחיד
  // שלו: קישור עומק לפי מספר הזמנה (ר' ה-useEffect עם orderIdParam למטה), שם רוצים למצוא
  // את ההזמנה בלי קשר לאיזו לשונית היא שייכת אליה.
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === 'undefined') return 'rented';
    const h = window.location.hash.replace('#', '');
    return (h === 'rented' || h === 'returned') ? h : 'rented';
  });

  // ניווט מהסיידבר ל-/rentals#returned כשהעמוד כבר פתוח (/rentals#rented) הוא ניווט-לקוח
  // בלי רענון מלא, אז ה-useState למעלה (שקורא את ה-hash פעם אחת, בעת ה-mount בלבד) לא
  // מתעדכן - התוצאה: הכתובת/כותרת אומרות "החזרות" אבל התוכן נשאר "השכרות" (או להפך),
  // מה שנראה כאילו שתי הלשוניות "מעורבבות" - ר' דיווח org2 c8381e7f. מאזינים לשינוי ה-hash
  // כדי לעדכן את הלשונית גם כשהעמוד כבר טעון.
  useEffect(() => {
    const handleHashChange = () => {
      const h = window.location.hash.replace('#', '');
      if (h === 'rented' || h === 'returned') setViewMode(h);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // הלשונית הראשית הנוכחית (לצורך הדגשת כפתור הלשונית) - 'rented_partial' שייך
  // ללשונית "השכרות" (הוא תת-סינון שלה), 'returned_partial' ל"החזרות".
  const activeTabGroup = (viewMode === 'returned' || viewMode === 'returned_partial') ? 'returns' : 'rentals';

  // מעבר בין הלשוניות הראשיות + עדכון ה-hash בכתובת בהתאם (אותו hash שקישורי הסיידבר
  // #rented/#returned כבר משתמשים בו) - כדי ששני מנגנוני הניווט (סיידבר + לשונית בעמוד)
  // יישארו עקביים, בלי להוסיף רשומת היסטוריה חדשה לכל החלפת לשונית.
  const switchTabGroup = (group) => {
    const target = group === 'returns' ? 'returned' : 'rented';
    setViewMode(target);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${target}`);
    }
  };

  const [advFilters, setAdvFilters] = useState(defaultRentalsAdvFilters());
  const [showAdvSearch, setShowAdvSearch] = useState(false);
  // לשוניות מודל הסינון המתקדם (item 33) + מצב חיפוש AI על השדות שמולאו (item 32)
  const [advTab, setAdvTab] = useState('basic');
  const [advAiMode, setAdvAiMode] = useState(false);

  // Quick return state
  const [quickBarcode, setQuickBarcode] = useState('');
  const [quickStatus, setQuickStatus] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Modal state
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  const [expandedOrders, setExpandedOrders] = useState({});

  const [showStatistics, setShowStatistics] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQueryUsed, setAiQueryUsed] = useState('');
  const [isAiModeActive, setIsAiModeActive] = useState(false);

  // מצב תצוגת סרגל החיפוש (חיפוש רגיל / חכם AI) — מחליף את המצב הפנימי שהיה
  // חבוי בתוך רכיב AISearchBar הישן; ההתנהגות זהה, רק המבנה/הסגנון עברו לעיצוב החדש.
  const [aiInputMode, setAiInputMode] = useState(false);
  const [aiInputText, setAiInputText] = useState('');

  // ברירת המחדל 'eventDateSmart' היא מיון מיוחד (לא עמודה אמיתית בטבלה): היום →
  // מחר → עד כשבוע וחצי קדימה, ואז אחורה בעבר. לחיצה על כותרת עמודה (כולל "תאריך
  // אירוע" עצמה) עוברת למיון עמודה רגיל, ר' handleSort.
  // בקשה 16 - אם rentals_sort_recent_first מופעל, כל ההשכרות ממוינות מהאחרונים ביותר (אתמול למעלה) → eventDate desc
  const [sort, setSort] = useState('eventDateSmart');
  const [order, setOrder] = useState('desc');
  const [hideCustomSpacing, setHideCustomSpacing] = useState(false); // 1 - הסתרת ציפוף
  const [lateReturnThresholdDays, setLateReturnThresholdDays] = useState(LATE_RETURN_THRESHOLD_DAYS);
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(arr => {
      const v = Array.isArray(arr) ? arr.find(s => s.key === 'rentals_sort_recent_first')?.value : null;
      if (v === 'true') { setSort('eventDate'); setOrder('desc'); }
      const hide = Array.isArray(arr) ? arr.find(s => s.key === 'hide_custom_spacing')?.value : null;
      if (hide === 'true') setHideCustomSpacing(true);
      const threshold = Array.isArray(arr) ? arr.find(s => s.key === 'late_return_threshold_days')?.value : null;
      if (threshold) setLateReturnThresholdDays(Number(threshold) || LATE_RETURN_THRESHOLD_DAYS);
    }).catch(()=>{});
  }, []);

  // עימוד אמיתי (מעבר עמודים) - כמו ב-app/orders/page.js, לא "טען עוד".
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const handleSort = (column) => {
    if (sort === column) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(column);
      setOrder('asc');
    }
  };

  const renderSortIcon = (column) => {
    // 'eventDateSmart' (ברירת המחדל) מוצג ככיוון "עולה" על עמודת תאריך האירוע,
    // גם שאין ל-sort ערך 'eventDate' ממש - כדי שהעמודה לא תיראה לא-ממוינת.
    if (sort === 'eventDateSmart' && column === 'eventDate') {
      return <Icon name="chevron-down" size="sm" anim={false} className="is-on" />;
    }
    if (sort !== column) {
      return <Icon name="sort" size="sm" anim={false} />;
    }
    return (
      <Icon name="chevron-down" size="sm" anim={false} className="is-on" style={{ transform: order === 'desc' ? 'rotate(180deg)' : 'none' }} />
    );
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const orderIdParam = params.get('orderId');
      if (orderIdParam) {
        setSearch(orderIdParam);
        setViewMode('all');
        setSelectedOrderId(orderIdParam);
      }
    }
  }, []);

  const fetchOrders = async (targetPage = 1) => {
    setLoading(true);
    try {
      const queryParams = buildRentalsListParams({
        page: targetPage, limit: PAGE_SIZE, search: debouncedSearch, sort, order, viewMode, advFilters
      });

      const cacheKey = queryParams.toString();

      // SWR: הצגה מיידית מהמטמון, ואז רענון שקט מהשרת.
      if (rentalsCache.has(cacheKey)) {
        const cached = rentalsCache.get(cacheKey);
        setOrders(cached.data || []);
        setPage(targetPage);
        setTotalPages(cached.totalPages || 1);
        setTotalCount(cached.total || 0);
        setLoading(false);
      }

      const timestamp = new Date().getTime();
      queryParams.append('_t', timestamp);

      const res = await fetch(`/api/orders?${queryParams.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      rentalsCache.set(cacheKey, data);
      setOrders(data.data || []);
      setPage(targetPage);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const goToPage = (p) => {
    if (p < 1 || p > totalPages || p === page) return;
    fetchOrders(p);
  };

  useEffect(() => {
    if (!isAiModeActive) {
      fetchOrders(1);
    }
  }, [debouncedSearch, viewMode, advFilters, isAiModeActive, sort, order]);

  const handleAiSearch = async (query) => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/smart-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query, pageContext: 'rentals' })
      });
      const result = await res.json();
      if (res.ok) {
        // חיפוש AI פונה לנקודת קצה נפרדת שלא מכירה את "מצב התצוגה" (הלשונית הפעילה) -
        // בלי הסינון הזה תוצאות AI היו עוקפות את הלשונית לגמרי (דיווח org2 60cb1a48),
        // בניגוד לחיפוש/סינון-מתקדם הרגילים שכבר משלבים אותה מול /api/orders.
        const aiData = (result.data || []).filter(o => matchesRentalsViewMode(o, viewMode));
        setOrders(aiData);
        setTotalCount(aiData.length);
        setTotalPages(1);
        setPage(1);
        setIsAiModeActive(true);
        setAiQueryUsed(result.query || '');
      } else {
        v3Alert(result.error || 'החיפוש החכם לא הצליח. נסו שוב.', { title: 'החיפוש נכשל', icon: 'alert-circle' });
      }
    } catch (e) {
      console.error(e);
      v3Alert('אין קשר עם השרת כרגע. בדקו את החיבור ונסו שוב.', { title: 'בעיית תקשורת', icon: 'wifi-off' });
    } finally {
      setAiLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearch('');
    if (isAiModeActive) {
      setIsAiModeActive(false);
    }
  };

  // סרגל החיפוש: מצב רגיל מול מצב AI — מחליף את הלוגיקה הפנימית שהייתה ברכיב AISearchBar
  const toggleAiInputMode = () => {
    if (!aiInputMode) {
      setAiInputText(search || '');
    } else {
      setSearch(aiInputText || '');
    }
    setAiInputMode(v => !v);
  };

  const handleAiInputSubmit = (e) => {
    e.preventDefault();
    if (!aiInputText.trim()) return;
    handleAiSearch(aiInputText);
  };

  const handleQuickReturn = async (e) => {
    e.preventDefault();
    if (!quickBarcode) return;

    setIsProcessing(true);
    try {
      const cleanBarcode = quickBarcode.replace(/\s+/g, '');

      // בדיקת איחור (ר' lib/lateReturn.js, אותה לוגיקה כמו RentalReturnModal.js) לפני
      // ביצוע ההחזרה בפועל - בר ההחזרה המהיר הזה לא עובר דרך RentalReturnModal, ולכן
      // בלי הבדיקה כאן החזרה מאוחרת הייתה מסומנת "תקין" בשקט. אם ההחזרה מאוחרת ומאשרים,
      // פותחים את כרטיס ההזמנה המלא ונותנים לו לטפל בסימון "לא תקין" + הערה - כדי לא
      // לשכפל את הזרימה הזו גם כאן.
      try {
        const lookupRes = await fetch(`/api/returns/scan?barcode=${encodeURIComponent(cleanBarcode)}`);
        if (lookupRes.ok) {
          const lookupData = await lookupRes.json();
          const { isLate, daysLate } = getLateReturnInfo(lookupData.order, lateReturnThresholdDays);
          if (isLate) {
            const wantsFullCard = await v3Confirm(
              `ההחזרה מאוחרת ב-${daysLate} ימים מהמועד הצפוי. כדי לתעד אותה (ולסמן כלא תקינה אם צריך) יש לטפל בה בכרטיס ההשכרה המלא. לפתוח אותו?`,
              { title: 'החזרה באיחור', confirmLabel: 'פתיחת הכרטיס', cancelLabel: 'להחזיר בכל זאת', icon: 'clock' }
            );
            if (wantsFullCard) {
              setQuickBarcode('');
              setSelectedOrderId(lookupData.order.orderId);
              setIsProcessing(false);
              return;
            }
          }
        }
      } catch (lookupErr) {
        console.error(lookupErr);
        // בעיית תקשורת בבדיקת האיחור לא צריכה לחסום החזרה רגילה - ממשיכים לניסיון ההחזרה עצמו
      }

      // postReturnScan מטפל גם בדחיית השרת "האירוע עדיין לא הגיע" (require_approval_for_early_return)
      const { res, data } = await postReturnScan({ barcode: cleanBarcode });

      if (res.ok) {
        setQuickStatus('success');
        setQuickBarcode('');
        // Open the order that was just returned
        setSelectedOrderId(data.orderId);
      } else if (!data?.cancelled) {
        setQuickStatus('error');
        v3Alert(data?.error || 'החזרת הפריט נכשלה.', { title: 'ההחזרה נכשלה', icon: 'alert-circle' });
      } else {
        setQuickStatus(null);
      }
      setTimeout(() => setQuickStatus(null), 1000);
    } catch (err) {
      setQuickStatus('error');
      console.error(err);
      setTimeout(() => setQuickStatus(null), 1000);
    } finally {
      setIsProcessing(false);
    }
  };

  const openOrder = (orderId) => {
    setSelectedOrderId(orderId);
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
            <h1 className="v3-h1">{activeTabGroup === 'returns' ? 'החזרות' : 'השכרות'}</h1>
            <Chip icon="list"><bdi>{loading ? '…' : totalCount}</bdi> בסך הכול</Chip>
          </div>
          <div className="v3-pagehead__tools">
            <IconAction icon="list" label="סינון מתקדם" onClick={() => setShowAdvSearch(true)} />
            <ExportButtons
              data={orders.map(o => ({
                ...o,
                status: calculateOrderStatus(o),
                eventDateFormatted: o.eventDateHebrew || (o.eventDate ? getHebrewDateString(o.eventDate) : 'לא צוין'),
                itemsSummary: o.items ? o.items.filter(i => !i.isDeleted).map(i => `${i.description} (${i.barcode || 'ללא ברקוד'})`).join(' | ') : ''
              }))}
              filename="השכרות"
              columns={[
                { key: 'orderId', label: getLabel('order_id', 'קוד הזמנה') },
                { key: 'customerName', label: getLabel('order_customerName', 'לקוח') },
                { key: 'eventDateFormatted', label: getLabel('order_eventDate', 'תאריך אירוע') },
                { key: 'status', label: getLabel('order_status', 'סטטוס') },
                { key: 'itemsSummary', label: 'פריטים' }
              ]}
              iconOnly={true}
            />
          </div>
        </div>

        {activeTabGroup === 'rentals' && <RentedPastEventWidget />}

        {/* חיפוש חופשי (הזמנה/לקוח/דגם) + מעבר לחיפוש חכם (AI) + שאלות סטטיסטיקה */}
        {aiInputMode ? (
          <form onSubmit={handleAiInputSubmit} className="v3-filter-bar">
            <div className="v3-search">
              {aiLoading ? <span className="v3-spin" aria-hidden="true" /> : <Icon name="sparkles" />}
              <input
                type="text"
                aria-label="שאלה לחיפוש החכם"
                value={aiInputText}
                onChange={(e) => setAiInputText(e.target.value)}
                placeholder="תארו מה לחפש, למשל: הזמנות של משפחת כהן"
                disabled={aiLoading}
              />
              <button type="button" className={`v3-search__clear${aiInputText && !aiLoading ? ' is-on' : ''}`} aria-label="ניקוי" onClick={() => setAiInputText('')}>
                <Icon name="x" size="sm" />
              </button>
            </div>
            <IconAction icon="sparkles" label="חזרה לחיפוש רגיל" onClick={toggleAiInputMode} />
            <IconAction icon="activity" label="שאלות על הנתונים" onClick={(e) => setShowStatistics({ x: e.clientX, y: e.clientY })} />
            <Btn type="submit" variant="primary" icon="sparkles" loading={aiLoading}>{aiLoading ? 'מכינים חיפוש…' : 'חיפוש חכם'}</Btn>
          </form>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); if (isAiModeActive) setIsAiModeActive(false); }}
            className="v3-filter-bar"
          >
            <div className="v3-search">
              <Icon name="search" />
              <input
                type="text"
                aria-label="חיפוש השכרה"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="מספר הזמנה, לקוח או דגם…"
              />
              <button type="button" className={`v3-search__clear${search ? ' is-on' : ''}`} aria-label="ניקוי החיפוש" onClick={handleClearSearch}>
                <Icon name="x" size="sm" />
              </button>
            </div>
            <IconAction icon="sparkles" label="מעבר לחיפוש חכם (AI)" onClick={toggleAiInputMode} />
            <IconAction icon="activity" label="שאלות על הנתונים" onClick={(e) => setShowStatistics({ x: e.clientX, y: e.clientY })} />
            <Btn type="submit" variant="primary" icon="search">חיפוש</Btn>
          </form>
        )}

        {/* שתי לשוניות ראשיות נפרדות - "השכרות" (פריטים שנמצאים כרגע בחוץ) מול "החזרות"
           (פריטים שהוחזרו כבר) - דיווח e6c14620 + הבקשה המשלימה. */}
        <Tabs
          items={[
            { key: 'rentals', label: 'השכרות', icon: 'truck' },
            { key: 'returns', label: 'החזרות', icon: 'check' },
          ]}
          value={activeTabGroup}
          onChange={switchTabGroup}
          label="שכרות או החזרות"
        />

        {/* תת-סינון בתוך הלשונית הפעילה - "הכל" (כולל חלקי) מול "חלקי בלבד" */}
        <div className="v3-cluster">
          <Seg
            label="היקף ההצגה"
            value={viewMode}
            onChange={setViewMode}
            options={activeTabGroup === 'rentals'
              ? [{ value: 'rented', label: 'כל ההשכרות', icon: 'bag' }, { value: 'rented_partial', label: 'רק חלקיות', icon: 'clock' }]
              : [{ value: 'returned', label: 'כל ההחזרות', icon: 'check' }, { value: 'returned_partial', label: 'רק חלקיות', icon: 'refresh' }]}
          />
          <Tip label="מה ההבדל בין ההצגות">
            {activeTabGroup === 'rentals'
              ? 'כל ההשכרות: כל הזמנה שיש בה פריט בחוץ, כולל השכרה חלקית. רק חלקיות: הזמנות שחלק מהפריטים בחוץ וחלק עוד לא נלקח.'
              : 'כל ההחזרות: כל הזמנה שיש בה פריט שהוחזר, כולל החזרה חלקית. רק חלקיות: הזמנות שחלק מהפריטים הוחזר וחלק עוד לא.'}
          </Tip>
        </div>

        <div className="v3-table__wrap">
          <table className="v3-table">
            <thead>
              <tr>
                <th scope="col" aria-sort={ariaSort('orderId', 'customerName')}>
                  <span className="v3-cluster">
                    {sortHeader('orderId', 'מס׳ הזמנה')}
                    {sortHeader('customerName', 'לקוח')}
                  </span>
                </th>
                <th scope="col" aria-sort={(sort === 'eventDate' || sort === 'eventDateSmart') ? (order === 'asc' || sort === 'eventDateSmart' ? 'ascending' : 'descending') : 'none'}>
                  {sortHeader('eventDate', 'תאריך האירוע')}
                </th>
                <th scope="col" aria-sort={ariaSort('status')}>{sortHeader('status', 'מצב')}</th>
                <th scope="col">פריטים</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4}>
                    <div className="v3-empty" aria-busy="true">
                      <Icon name="loader" size="xl" loop />
                      <b className="v3-h2">טוענים…</b>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <Empty icon="search" title="אין כאן תוצאות" text="נסו לשנות את החיפוש או לעבור ללשונית אחרת." />
                  </td>
                </tr>
              ) : orders.map(ord => {
                const statusLabel = calculateOrderStatus(ord);
                const statusChip = getStatusChip(statusLabel);
                const totalItems = ord.items?.filter(i => !i.isDeleted).length || 0;
                const rentedItems = ord.items?.filter(i => i.isTaken && !i.isReturned && !i.isDeleted).length || 0;
                const returnedItems = ord.items?.filter(i => i.isReturned && !i.isDeleted).length || 0;
                const hasCustomSpacing = !hideCustomSpacing && ord.customSpacing !== null && ord.customSpacing !== undefined;

                // צבע הרקע נגזר תמיד מ-statusLabel (calculateOrderStatus, מקור האמת היחיד) ולא
                // מספירה מקומית של rentedItems/returnedItems — כך התווית והצבע תמיד מסכימים.
                let tone = null;
                if (hasCustomSpacing) {
                  tone = SPACING_TONE;
                } else if (totalItems > 0 && ['הושכר', 'הושכר חלקי', 'הוחזר', 'הוחזר חלקי'].includes(statusLabel)) {
                  tone = STATUS_TONES[statusLabel];
                }
                const rowStyle = tone ? { background: tone.bg } : {};
                const barStyle = tone ? { borderInlineStart: `var(--v3-sp-1) solid ${tone.bar}` } : {};
                const isExpanded = !!expandedOrders[ord.orderId];
                const activeItems = ord.items ? ord.items.filter(i => !i.isDeleted) : [];

                return (
                  <Fragment key={ord.orderId}>
                    <tr aria-expanded={isExpanded} onClick={() => openOrder(ord.orderId)} style={{ cursor: 'pointer', ...rowStyle }}>
                      <td style={barStyle}>
                        <div className="v3-cluster">
                          <b>#<bdi>{ord.orderId}</bdi></b>
                          {hasCustomSpacing && (
                            <Icon name="alert-tri" size="sm" title="מרווח החזרה מותאם להזמנה זו" />
                          )}
                          <button
                            type="button"
                            className="v3-btn v3-btn--icon v3-btn--sm"
                            title="פתיחת השכרה / החזרה"
                            aria-label={`פתיחת השכרה או החזרה של הזמנה ${ord.orderId}`}
                            onClick={(e) => { e.stopPropagation(); openOrder(ord.orderId); }}
                          >
                            <Icon name="box" />
                          </button>
                        </div>
                        <div className="v3-faint v3-text-sm">{ord.customerName}</div>
                      </td>
                      <td><b>{ord.eventDateHebrew || (ord.eventDate ? getHebrewDateString(ord.eventDate) : 'לא צוין תאריך')}</b></td>
                      <td><Chip variant={statusChip.variant} icon={statusChip.icon}>{statusLabel}</Chip></td>
                      <td>
                        <div className="v3-cluster">
                          <span>סך הכול <bdi>{totalItems}</bdi></span>
                          {rentedItems > 0 && <Chip variant="gold" icon="bag">בחוץ <bdi>{rentedItems}</bdi></Chip>}
                          {returnedItems > 0 && <Chip variant="done" icon="check">הוחזרו <bdi>{returnedItems}</bdi></Chip>}
                          <button
                            type="button"
                            className="v3-btn v3-btn--quiet v3-btn--sm"
                            aria-expanded={isExpanded}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedOrders(prev => ({ ...prev, [ord.orderId]: !prev[ord.orderId] }));
                            }}
                            title={isExpanded ? 'הסתרת הרשימה' : 'הצגת הרשימה'}
                          >
                            <Icon name="chevron-down" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }} />
                            <span>פירוט</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={4}>
                          <Rows>
                            <Row label="הערות להזמנה" icon="file">{ord.notes || '—'}</Row>
                            {activeItems.length > 0 ? activeItems.map(item => (
                              <Row key={item.id} label={item.description} icon="dress">
                                {item.barcode && <div className="v3-faint"><bdi>{item.barcode}</bdi></div>}
                                {item.isReturned ? (
                                  <Chip variant="done" icon="check">הוחזר</Chip>
                                ) : item.isTaken ? (
                                  <Chip variant="gold" icon="bag">בחוץ</Chip>
                                ) : (
                                  <Chip icon="clock">עוד לא נלקח</Chip>
                                )}
                              </Row>
                            )) : (
                              <Row label="פריטים" icon="dress"><span className="v3-faint">אין פריטים פעילים</span></Row>
                            )}
                          </Rows>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* סיכום הרשומות ועימוד */}
        <div className="v3-cluster">
          <span className="v3-muted"><bdi>{loading ? '…' : totalCount}</bdi> רשומות</span>
          {totalPages > 1 && (
            <div className="v3-cluster">
              <Btn size="sm" icon="chevron-end" disabled={page <= 1} onClick={() => goToPage(page - 1)} title="לעמוד הקודם">הקודם</Btn>
              <span className="v3-cluster">
                <label htmlFor="rentalsListPageNum">עמוד</label>
                <input
                  id="rentalsListPageNum"
                  type="number"
                  className="v3-input"
                  min={1}
                  max={totalPages || 1}
                  value={page}
                  onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) goToPage(v); }}
                  style={{ inlineSize: 'var(--v3-sp-9)', textAlign: 'center' }}
                />
                מתוך <bdi>{totalPages}</bdi>
              </span>
              <Btn size="sm" iconEnd="chevron-start" disabled={page >= totalPages} onClick={() => goToPage(page + 1)} title="לעמוד הבא">הבא</Btn>
            </div>
          )}
        </div>
      </div>

      {/* סינון מתקדם — חלונית עם שדות = בהיר בלבד. "החל" לא קורא ל-fetch (חי) למעט מצב AI. */}
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
                const prompt = buildRentalsAiPrompt(advFilters);
                setShowAdvSearch(false);
                if (prompt) handleAiSearch(prompt);
              } else {
                setShowAdvSearch(false);
              }
            }}>סגירה והחלת הסינון</Btn>
            <Btn variant="quiet" onClick={() => setAdvFilters(defaultRentalsAdvFilters())}>ניקוי כל השדות</Btn>
          </>
        )}
      >
        {/* שתי לשוניות (item 33): הזמנה/פריט/דגם מול פרטי לקוח */}
        <Tabs
          items={[{ key: 'basic', label: 'הזמנה ופריט' }, { key: 'details', label: 'פרטי הלקוח' }]}
          value={advTab}
          onChange={setAdvTab}
          label="חלקי הסינון"
        />

        <div className="v3-stack">
          {advTab === 'basic' && (
            <>
              <Field label={getLabel('order_id', 'מספר הזמנה')} value={advFilters.advOrderId} onChange={e => setAdvFilters(p => ({ ...p, advOrderId: e.target.value }))} />
              <Field label="ברקוד או פרטי פריט" value={advFilters.itemDetails} onChange={e => setAdvFilters(p => ({ ...p, itemDetails: e.target.value }))} />
              <div className="v3-field">
                <span className="v3-label">דגם</span>
                <OrderModelSelector
                  value={{ name: advFilters.advModelName }}
                  onChange={m => setAdvFilters(p => ({ ...p, advModelName: m ? m.name : '' }))}
                  placeholder="בחירת דגם…"
                />
              </div>
            </>
          )}

          {advTab === 'details' && (
            <>
              <Field label={getLabel('order_customerName', 'שם הלקוח')} value={advFilters.customerName} onChange={e => setAdvFilters(p => ({ ...p, customerName: e.target.value }))} />
              <Field label="טלפון הלקוח" type="tel" value={advFilters.customerPhone} onChange={e => setAdvFilters(p => ({ ...p, customerPhone: e.target.value }))} />
              <Field label="עיר" value={advFilters.customerCity} onChange={e => setAdvFilters(p => ({ ...p, customerCity: e.target.value }))} />
            </>
          )}

          {/* AI על השדות שמולאו (item 32) — מוצג משתי הלשוניות, מוסתר לגמרי כשה-AI כבוי ברמת המערכת */}
          <div className="ai-feature-element">
            <Switch
              id="rentals-adv-ai-mode"
              checked={advAiMode}
              onChange={(v) => setAdvAiMode(v)}
              label="חיפוש חכם (AI) לפי השדות שמילאתם"
            />
          </div>
        </div>
      </Dialog>

      {dialogs}

      {selectedOrderId && (
        <RentalReturnModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onUpdate={() => fetchOrders(page)}
        />
      )}

      <StatisticsModal
        isOpen={!!showStatistics}
        onClose={() => setShowStatistics(false)}
        pageContext="rentals"
        contextQuery={aiQueryUsed}
        position={typeof showStatistics === 'object' ? showStatistics : null}
      />
    </V3Page>
  );
}
