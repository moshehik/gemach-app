'use client';

import { useState, useEffect, useCallback } from 'react';
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

// מיפוי סטטוס טקסטואלי (calculateOrderStatus/calculatePaymentStatus ב-lib/orderStatus.js, משותף
// לכמה עמודים) אל מחלקת ה-badge של מערכת העיצוב "אריג" כאן בעמוד ההזמנות בלבד — לא נוגעים בעוזר המשותף עצמו.
const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'הוחזר':
    case 'הוחזר חלקי':
      return 'badge-success';
    case 'הושכר':
    case 'הושכר חלקי':
      return 'badge-info';
    case 'בקרוב':
      return 'badge-warning';
    case 'עבר':
      return 'badge-neutral';
    case 'מחוק':
      return 'badge-neutral';
    case 'טיוטה':
      return 'badge-neutral';
    default:
      return 'badge-neutral';
  }
};

const getPaymentBadgeClass = (status) => {
  switch (status) {
    case 'שולם':
      return 'badge-success';
    case 'שולם חלקי':
      return 'badge-warning';
    case 'ממתין לזיכוי':
      return 'badge-info';
    case 'לא שולם':
    default:
      return 'badge-danger';
  }
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
    <span className={`badge ${timeLeft === 'פג תוקף' ? 'badge-danger' : 'badge-warning'}`}>
      <svg className="icon"><use href="#i-clock" /></svg>
      {timeLeft}
    </span>
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

  const [advFilters, setAdvFilters] = useState(defaultOrdersAdvFilters);
  const [showAdvSearch, setShowAdvSearch] = useState(false);
  const [showCapacitySearch, setShowCapacitySearch] = useState(false);
  const [showPrintWizard, setShowPrintWizard] = useState(false);
  const [rentalModalOrderId, setRentalModalOrderId] = useState(null);

  const [showStatistics, setShowStatistics] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQueryUsed, setAiQueryUsed] = useState('');
  const [isAiModeActive, setIsAiModeActive] = useState(false);

  // מצב תצוגת סרגל החיפוש (חיפוש רגיל / חכם AI) — מחליף את המצב הפנימי שהיה
  // חבוי בתוך רכיב AISearchBar הישן; ההתנהגות זהה, רק המבנה/הסגנון עברו לעיצוב החדש.
  const [aiInputMode, setAiInputMode] = useState(false);
  const [aiInputText, setAiInputText] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchSharedJson('/api/settings', { ttl: TTL.STATIC })
      .then(data => {
        const setting = Array.isArray(data) ? data.find(s => s.key === 'inventory_hold_minutes') : null;
        const parsed = parseInt(setting?.value, 10);
        if (!cancelled && !isNaN(parsed) && parsed > 0) setHoldMinutes(parsed);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

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
    setAiLoading(true);
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
        alert(result.error || 'שגיאה בחיפוש החכם');
      }
    } catch (e) {
      console.error(e);
      alert('שגיאת תקשורת');
    } finally {
      setAiLoading(false);
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
      return <svg className="icon"><use href="#i-sort" /></svg>;
    }
    return (
      <svg className="icon" style={{ opacity: 1, color: 'var(--primary-solid)', transform: order === 'desc' ? 'rotate(180deg)' : 'none' }}>
        <use href="#i-chevron-down" />
      </svg>
    );
  };

  // סרגל החיפוש: מצב רגיל מול מצב AI — מחליף את הלוגיקה הפנימית שהייתה ברכיב AISearchBar
  const toggleAiInputMode = () => {
    if (!aiInputMode) {
      setAiInputText(searchInput || '');
    } else {
      setSearchInput(aiInputText || '');
    }
    setAiInputMode(v => !v);
  };

  const handleAiInputSubmit = (e) => {
    e.preventDefault();
    if (!aiInputText.trim()) return;
    handleAiSearch(aiInputText);
  };

  const handleDeleteOrder = async (order, e) => {
    e.stopPropagation();
    const status = calculateOrderStatus(order);
    if (status === 'הוחזר' || status === 'הוחזר חלקי' || status === 'הושכר' || status === 'הושכר חלקי') {
      alert('לא ניתן למחוק הזמנה לאחר השכרה חלקית/מלאה או לאחר שנלקח והוחזר');
      return;
    }

    if (await window.customConfirm('האם אתה בטוח שברצונך למחוק הזמנה זו?')) {
      try {
        const res = await fetch(`/api/orders/${order.orderId}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          fetchOrders();
        } else {
          const data = await res.json();
          alert(data.error || 'שגיאה במחיקת הזמנה');
        }
      } catch (err) {
        console.error(err);
        alert('שגיאה במחיקת הזמנה');
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
        status: calculateOrderStatus(o),
        paymentStatus: calculatePaymentStatus(o.totalAmount || 0, o.totalPaid || 0)
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

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ניהול הזמנות</h1>
          <div className="page-desc">סה&quot;כ רשומות: {totalCount}</div>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-secondary btn-icon-only" title="חיפוש מתקדם" onClick={() => setShowAdvSearch(true)}>
            <svg className="icon"><use href="#i-list" /></svg>
          </button>
          <button type="button" className="btn btn-secondary btn-icon-only" title="חיפוש תפוסה" onClick={() => setShowCapacitySearch(true)}>
            <svg className="icon"><use href="#i-calendar" /></svg>
          </button>
          <button type="button" className="btn btn-secondary btn-icon-only" title="הדפסת דוחות" onClick={() => setShowPrintWizard(true)}>
            <svg className="icon"><use href="#i-printer" /></svg>
          </button>
          <ExportButtons
            data={orders.map(o => ({
              ...o,
              status: calculateOrderStatus(o)
            }))}
            filename="הזמנות"
            columns={[
              { key: 'orderId', label: getLabel('order_id', 'קוד הזמנה') },
              { key: 'customerName', label: getLabel('order_customerName', 'לקוח') },
              { key: 'totalAmount', label: getLabel('order_totalAmount', 'סכום לחיוב') },
              { key: 'totalPaid', label: 'שולם' },
              { key: 'paymentStatus', label: 'סטטוס תשלום' },
              { key: 'status', label: getLabel('order_status', 'סטטוס') }
            ]}
            iconOnly={true}
            onFetchData={fetchOrdersForExport}
          />
          <Link href="/orders/new" className="btn btn-primary">
            <svg className="icon"><use href="#i-plus" /></svg>
            הזמנה חדשה
          </Link>
        </div>
      </div>

      {/* סרגל חיפוש: חיפוש טקסטואלי רגיל + מעבר לחיפוש חכם (AI) + שאלות סטטיסטיקה, במסגרת אחת */}
      <div className="toolbar">
        {aiInputMode ? (
          <form onSubmit={handleAiInputSubmit} className="search-toolbar">
            {aiLoading
              ? <span className="spinner" style={{ width: '15px', height: '15px', borderWidth: '2px' }} />
              : <svg className="icon" style={{ color: 'var(--accent)' }}><use href="#i-star" /></svg>}
            <input
              type="text"
              value={aiInputText}
              onChange={(e) => setAiInputText(e.target.value)}
              placeholder="בקש מה-AI למצוא נתונים (למשל: 'הזמנות של משפחת שיינועטר')..."
              disabled={aiLoading}
            />
            <div className="search-toolbar-actions">
              {aiInputText && !aiLoading && (
                <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="נקה" onClick={() => setAiInputText('')}>
                  <svg className="icon"><use href="#i-x" /></svg>
                </button>
              )}
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="חיפוש חכם (AI)" style={{ color: 'var(--accent)', background: 'var(--accent-tint)' }} onClick={toggleAiInputMode}>
                <svg className="icon"><use href="#i-star" /></svg>
              </button>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="שאלות סטטיסטיקה" onClick={(e) => setShowStatistics({ x: e.clientX, y: e.clientY })}>
                <svg className="icon"><use href="#i-activity" /></svg>
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={aiLoading}>
                {aiLoading ? 'מייצר שאילתה...' : 'חפש בחכמה'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSearch} className="search-toolbar">
            <svg className="icon"><use href="#i-search" /></svg>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="חיפוש הזמנה (מספר הזמנה, שם לקוח)..."
            />
            <div className="search-toolbar-actions">
              {searchInput && (
                <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="ניקוי חיפוש" onClick={handleClearSearch}>
                  <svg className="icon"><use href="#i-x" /></svg>
                </button>
              )}
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="חיפוש חכם (AI)" onClick={toggleAiInputMode}>
                <svg className="icon" style={{ color: 'var(--accent)' }}><use href="#i-star" /></svg>
              </button>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="שאלות סטטיסטיקה" onClick={(e) => setShowStatistics({ x: e.clientX, y: e.clientY })}>
                <svg className="icon"><use href="#i-activity" /></svg>
              </button>
              <button type="submit" className="btn btn-primary btn-sm">חיפוש</button>
            </div>
          </form>
        )}
      </div>

      {/* סינון סטטוס: הכפתור הפעיל קובע אילו הזמנות מוצגות בטבלה */}
      <div className="pill-tabs" style={{ marginBottom: '20px' }}>
        <button type="button" onClick={() => { setFilterStatus('soon'); setPage(1); }} className={filterStatus === 'soon' ? 'pill-tab active' : 'pill-tab'} title="בקרוב (החל מהיום ואילך)">
          <svg className="icon"><use href="#i-calendar" /></svg>
          בקרוב
        </button>
        <button type="button" onClick={() => { setFilterStatus('archive'); setPage(1); }} className={filterStatus === 'archive' ? 'pill-tab active' : 'pill-tab'} title="ארכיון / עבר">
          <svg className="icon"><use href="#i-folder" /></svg>
          ארכיון/עבר
        </button>
        <button type="button" onClick={() => { setFilterStatus('deleted'); setPage(1); }} className={filterStatus === 'deleted' ? 'pill-tab active' : 'pill-tab'} title="מחוקים">
          <svg className="icon"><use href="#i-trash" /></svg>
          מחוק
        </button>
        <button type="button" onClick={() => { setFilterStatus('unpaid'); setPage(1); }} className={filterStatus === 'unpaid' ? 'pill-tab active' : 'pill-tab'} title="לא שולם (חודשים אחרונים)">
          <svg className="icon"><use href="#i-alert-circle" /></svg>
          לא שולם
        </button>
        <button type="button" onClick={() => { setFilterStatus('drafts'); setPage(1); }} className={filterStatus === 'drafts' ? 'pill-tab active' : 'pill-tab'} title="טיוטות">
          <svg className="icon"><use href="#i-edit" /></svg>
          טיוטות
        </button>
        <button type="button" onClick={() => { setFilterStatus('all'); setPage(1); }} className={filterStatus === 'all' ? 'pill-tab active' : 'pill-tab'} title="הצג הכל">
          <svg className="icon"><use href="#i-list" /></svg>
          הכל
        </button>
      </div>

      {showAdvSearch && typeof document !== 'undefined' && createPortal(
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowAdvSearch(false)}>
          <div className="modal" style={{ maxWidth: '760px', width: '100%', margin: 0 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <strong>
                <svg className="icon"><use href="#i-list" /></svg>
                סינון מתקדם
              </strong>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="סגירה" onClick={() => setShowAdvSearch(false)}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>טווח תאריכי אירוע</label>
                <HebrewDateRangePicker
                  startDate={advFilters.eventDateFrom}
                  endDate={advFilters.eventDateTo}
                  onChange={(start, end) => setAdvFilters(p => ({ ...p, eventDateFrom: start, eventDateTo: end }))}
                />
              </div>

              <div className="field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ margin: 0 }}>סטטוס פריטים</label>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      const allSelected = advFilters.rentalStatus.length === 3;
                      setAdvFilters(p => ({
                        ...p,
                        rentalStatus: allSelected ? [] : ['pendingOnly', 'activeOnly', 'returnedOnly']
                      }));
                    }}
                  >
                    {advFilters.rentalStatus.length === 3 ? 'בטל בחירת הכל' : 'בחר הכל'}
                  </button>
                </div>
                <div className="pill-tabs">
                  {[
                    { value: 'pendingOnly', label: 'ממתינים', icon: 'i-clock' },
                    { value: 'activeOnly', label: 'מושכרים', icon: 'i-bag' },
                    { value: 'returnedOnly', label: 'מוחזרים', icon: 'i-check' }
                  ].map(opt => {
                    const isSelected = advFilters.rentalStatus.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        className={isSelected ? 'pill-tab active' : 'pill-tab'}
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
                        <svg className="icon"><use href={`#${opt.icon}`} /></svg>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-grid">
                <div className="field">
                  <label>{getLabel('order_id', 'מספר הזמנה')}</label>
                  <div className="input-icon-wrap">
                    <svg className="icon"><use href="#i-search" /></svg>
                    <input type="text" className="input" value={advFilters.advOrderId} onChange={e => setAdvFilters(p => ({ ...p, advOrderId: e.target.value }))} placeholder="חפש לפי מספר..." />
                  </div>
                </div>
                <div className="field">
                  <label>ברקוד/פרטי פריט</label>
                  <div className="input-icon-wrap">
                    <svg className="icon"><use href="#i-tag" /></svg>
                    <input type="text" className="input" value={advFilters.itemDetails} onChange={e => setAdvFilters(p => ({ ...p, itemDetails: e.target.value }))} placeholder="ברקוד או תיאור..." />
                  </div>
                </div>
                <div className="field">
                  <label>דגם</label>
                  <div style={{ position: 'relative' }}>
                    <OrderModelSelector
                      value={{ name: advFilters.advModelName }}
                      onChange={m => setAdvFilters(p => ({ ...p, advModelName: m ? m.name : '' }))}
                      placeholder="בחר דגם..."
                    />
                    {advFilters.advModelName && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon-only btn-sm"
                        onClick={() => setAdvFilters(p => ({ ...p, advModelName: '' }))}
                        style={{ position: 'absolute', left: '4px', top: '50%', transform: 'translateY(-50%)', color: 'var(--danger)' }}
                        title="נקה בחירה"
                      >
                        <svg className="icon"><use href="#i-x" /></svg>
                      </button>
                    )}
                  </div>
                </div>
                <div className="field">
                  <label>{getLabel('order_customerName', 'שם לקוח')}</label>
                  <input type="text" className="input" value={advFilters.customerName} onChange={e => setAdvFilters(p => ({ ...p, customerName: e.target.value }))} placeholder="שם הלקוח..." />
                </div>
                <div className="field">
                  <label>טלפון לקוח</label>
                  <div className="input-icon-wrap">
                    <svg className="icon"><use href="#i-phone" /></svg>
                    <input type="text" className="input" value={advFilters.customerPhone} onChange={e => setAdvFilters(p => ({ ...p, customerPhone: e.target.value }))} placeholder="מספר טלפון..." />
                  </div>
                </div>
                <div className="field">
                  <label>עיר מגורים</label>
                  <div className="input-icon-wrap">
                    <svg className="icon"><use href="#i-pin" /></svg>
                    <input type="text" className="input" value={advFilters.customerCity} onChange={e => setAdvFilters(p => ({ ...p, customerCity: e.target.value }))} placeholder="עיר..." />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => {
                setAdvFilters({ customerName: '', customerPhone: '', customerCity: '', advOrderId: '', itemDetails: '', advModelName: '', eventDateFrom: '', eventDateTo: '', rentalStatus: [] });
              }}>נקה הכל</button>
              <button type="button" className="btn btn-primary" onClick={() => setShowAdvSearch(false)}>
                <svg className="icon"><use href="#i-check" /></svg>
                החל סינון
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="table-wrap">
        {loading && orders.length === 0 ? (
          <div className="page-loading">
            <span className="spinner lg" />
            טוען נתונים...
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th className={sort === 'orderId' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('orderId')}>{getLabel('order_id', 'קוד הזמנה')} {renderSortIcon('orderId')}</th>
                <th className={sort === 'customerName' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('customerName')}>{getLabel('order_customerName', 'לקוח')} {renderSortIcon('customerName')}</th>
                <th>כמות פריטים</th>
                <th className={sort === 'eventDate' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('eventDate')}>תאריך אירוע {renderSortIcon('eventDate')}</th>
                <th className={sort === 'totalAmount' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('totalAmount')}>{getLabel('order_totalAmount', 'סכום לחיוב')} {renderSortIcon('totalAmount')}</th>
                <th className={sort === 'totalPaid' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('totalPaid')}>שולם {renderSortIcon('totalPaid')}</th>
                <th className={sort === 'status' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('status')}>{getLabel('order_status', 'סטטוס')} {renderSortIcon('status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => {
                const isPaid = (order.totalPaid >= order.totalAmount && order.totalAmount > 0) || order.totalPaid > 0 || order.status === 'שולם' || order.status === 'שולם חלקי';
                const pendingItem = (!order.legacyId && !isPaid) ? order.items?.find(i => i.cartStatus === 'pending') : null;
                const isPending = pendingItem && new Date(pendingItem.cartStatusDate).getTime() + holdMinutes * 60000 > Date.now();

                const isUnpaid = order.totalPaid < order.totalAmount && order.totalAmount > 0;
                const hasCustomSpacing = order.customSpacing !== null && order.customSpacing !== undefined;

                let rowClassName = '';
                let rowStyle = {};
                if (selectedOrder?.orderId === order.orderId) {
                  rowStyle = { background: 'var(--surface-alt)' };
                } else if (hasCustomSpacing) {
                  rowStyle = { background: 'var(--warning-tint)', borderRight: '4px solid var(--warning)' };
                } else if (isPending) {
                  rowStyle = { background: 'var(--accent-tint)', borderRight: '4px solid var(--accent)' };
                } else if (isUnpaid) {
                  rowClassName = 'row-flag';
                  rowStyle = { borderRight: '4px solid var(--danger)' };
                }

                return (
                  <tr key={order.orderId} className={rowClassName} style={{ cursor: 'pointer', ...rowStyle }} onClick={() => router.push(`/orders/${order.orderId}`)}>
                    <td className="cell-primary" style={{ color: isUnpaid ? 'var(--danger)' : (isPending ? 'var(--accent)' : undefined) }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>#{order.orderId}</span>
                        {pendingItem && <PendingTimer cartStatusDate={pendingItem.cartStatusDate} holdMinutes={holdMinutes} />}
                        <span
                          style={{ marginRight: 'auto', display: 'flex', color: 'var(--text-3)', cursor: 'pointer', pointerEvents: 'auto' }}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setPopoverPos({ top: rect.top - 12, left: rect.left + (rect.width / 2) });
                            setHoveredOrder(order);
                          }}
                          onMouseLeave={() => setHoveredOrder(null)}
                          onClick={(e) => { e.stopPropagation(); }}
                          title="פרטי הזמנה"
                        >
                          <svg className="icon"><use href="#i-info" /></svg>
                        </span>
                      </div>
                    </td>
                    <td>{order.customerName}</td>
                    <td>{order.items ? order.items.filter(i => !i.isDeleted).length : 0}</td>
                    <td>{order.eventDateHebrew || ''}</td>
                    <td>₪{order.totalAmount}</td>
                    <td style={{ color: order.totalPaid >= order.totalAmount && order.totalAmount > 0 ? 'var(--success)' : (isUnpaid ? 'var(--danger)' : undefined), fontWeight: isUnpaid ? '700' : undefined }}>
                      ₪{order.totalPaid}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'nowrap', alignItems: 'center' }}>
                        <span className={`badge ${getStatusBadgeClass(calculateOrderStatus(order))}`}>{calculateOrderStatus(order)}</span>
                        <span className={`badge ${getPaymentBadgeClass(calculatePaymentStatus(order.totalAmount || 0, order.totalPaid || 0))}`}>{calculatePaymentStatus(order.totalAmount || 0, order.totalPaid || 0)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="row-actions">
                        <Link
                          href={`/orders/${order.orderId}`}
                          className="btn btn-ghost btn-icon-only btn-sm"
                          onClick={(e) => e.stopPropagation()}
                          title="כרטיס הזמנה"
                        >
                          <svg className="icon"><use href="#i-edit" /></svg>
                        </Link>
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon-only btn-sm"
                          style={{ color: 'var(--success)' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setRentalModalOrderId(order.orderId);
                          }}
                          title="מעבר להשכרה/החזרה"
                        >
                          <svg className="icon"><use href="#i-truck" /></svg>
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon-only btn-sm"
                          style={{ color: 'var(--danger)' }}
                          onClick={(e) => handleDeleteOrder(order, e)}
                          title="מחיקת הזמנה"
                        >
                          <svg className="icon"><use href="#i-trash" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* סיכום הרשומות ועימוד */}
        <div className="table-foot">
          <span>סה&quot;כ שורות מוצגות: {orders.length}</span>
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1 || isAiModeActive} onClick={() => setPage(p => p - 1)} title="עמוד קודם">
                <svg className="icon"><use href="#i-chevron-end" /></svg>
                הקודם
              </button>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label htmlFor="ordersListPageNum">עמוד</label>
                <input
                  id="ordersListPageNum"
                  type="number"
                  className="input"
                  min={1}
                  max={totalPages || 1}
                  value={page}
                  onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) setPage(v); }}
                  disabled={isAiModeActive}
                  style={{ width: '52px', padding: '4px 6px', textAlign: 'center', display: 'inline-block' }}
                />
                מתוך {totalPages}
              </span>
              <button type="button" className="btn btn-secondary btn-sm" disabled={page >= totalPages || isAiModeActive} onClick={() => setPage(p => p + 1)} title="עמוד הבא">
                הבא
                <svg className="icon"><use href="#i-chevron-start" /></svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CapacitySearchModal
        isOpen={showCapacitySearch}
        onClose={() => setShowCapacitySearch(false)}
      />

      {showPrintWizard && (
        <PrintWizardModal
          onClose={() => setShowPrintWizard(false)}
          defaultReportType="orders_all"
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

      {hoveredOrder && typeof document !== 'undefined' && createPortal(
        <div
          className="card"
          style={{
            position: 'fixed',
            top: popoverPos.top,
            left: popoverPos.left,
            transform: 'translate(-50%, -100%)',
            width: 'max-content',
            maxWidth: '320px',
            zIndex: 1000,
            pointerEvents: 'none'
          }}
        >
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '12.5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '14px', color: 'var(--primary-solid)', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '2px' }}>
              <svg className="icon"><use href="#i-info" /></svg>
              הזמנה #{hoveredOrder.orderId}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
              <span style={{ color: 'var(--text-2)' }}>לקוח:</span>
              <span style={{ fontWeight: 500 }}>{hoveredOrder.customerName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
              <span style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '5px' }}><svg className="icon"><use href="#i-phone" /></svg> טלפון:</span>
              <span style={{ fontWeight: 500 }} dir="ltr">{hoveredOrder.customerPhone || 'לא הוזן'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
              <span style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '5px' }}><svg className="icon"><use href="#i-calendar" /></svg> תאריך עברי:</span>
              <span style={{ fontWeight: 500 }}>{hoveredOrder.eventDateHebrew || 'לא צוין'}</span>
            </div>

            {/* ציפוף ימים מיוחד — מוצג רק כשהוגדר ערך מותאם להזמנה (אותו תנאי שצובע את השורה) */}
            {hoveredOrder.customSpacing !== null && hoveredOrder.customSpacing !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                <span style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '5px' }}><svg className="icon"><use href="#i-alert-tri" /></svg> ציפוף ימים:</span>
                <span style={{ fontWeight: 700, color: 'var(--warning)' }}>
                  {hoveredOrder.customSpacing} {hoveredOrder.customSpacing === 1 ? 'יום' : 'ימים'}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
              <span style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '5px' }}><svg className="icon"><use href="#i-truck" /></svg> הושכר:</span>
              <span style={{ fontWeight: 500 }}>{hoveredOrder.items ? hoveredOrder.items.filter(i => !i.isDeleted && i.isTaken).length : 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
              <span style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '5px' }}><svg className="icon"><use href="#i-check" /></svg> הוחזר:</span>
              <span style={{ fontWeight: 500 }}>{hoveredOrder.items ? hoveredOrder.items.filter(i => !i.isDeleted && i.isReturned).length : 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
              <span style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '5px' }}><svg className="icon"><use href="#i-card" /></svg> סה&quot;כ לתשלום:</span>
              <span style={{ fontWeight: 500 }}>₪{hoveredOrder.totalAmount || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
              <span style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '5px' }}><svg className="icon"><use href="#i-check-circle" /></svg> שולם:</span>
              <span style={{ fontWeight: 700, color: hoveredOrder.totalPaid >= hoveredOrder.totalAmount && hoveredOrder.totalAmount > 0 ? 'var(--success)' : (hoveredOrder.totalPaid > 0 ? 'var(--warning)' : 'var(--danger)') }}>
                ₪{hoveredOrder.totalPaid || 0}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
              <span style={{ color: 'var(--text-2)' }}>סטטוס פריטים:</span>
              <span className={`badge ${getStatusBadgeClass(calculateOrderStatus(hoveredOrder))}`}>{calculateOrderStatus(hoveredOrder)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
              <span style={{ color: 'var(--text-2)' }}>סטטוס תשלום:</span>
              <span className={`badge ${getPaymentBadgeClass(calculatePaymentStatus(hoveredOrder.totalAmount || 0, hoveredOrder.totalPaid || 0))}`}>{calculatePaymentStatus(hoveredOrder.totalAmount || 0, hoveredOrder.totalPaid || 0)}</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
