'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Pencil, Shirt, CalendarSearch, Plus, X, List, Trash2, Archive, CalendarDays, AlertCircle, AlertTriangle, Info, Phone, Calendar as CalendarIcon2, CreditCard, CheckCircle2, Filter, Search, Printer, Clock } from 'lucide-react';
import { calculateOrderStatus, calculatePaymentStatus } from '../../lib/orderStatus';
import CapacitySearchModal from '../../components/CapacitySearchModal';
import ExportButtons from '../../components/ExportButtons';
import AISearchBar from '../components/AISearchBar';
import StatisticsModal from '../components/StatisticsModal';
import { useLabels } from '@/app/components/LabelsContext';
import HebrewDatePicker from '../../components/HebrewDatePicker';
import HebrewDateRangePicker from '../../components/HebrewDateRangePicker';
import RentalReturnModal from '../../components/orders/RentalReturnModal';
import OrderModelSelector from '../../components/orders/OrderModelSelector';
import PrintWizardModal from '../components/PrintWizardModal';
import { fetchSharedJson, readCache, subscribe, TTL } from '../../lib/apiCache';
import { buildOrdersListParams, defaultOrdersAdvFilters } from '@/app/lib/prefetchRoutes';

// מיפוי סטטוס טקסטואלי (calculateOrderStatus/calculatePaymentStatus ב-lib/orderStatus.js, משותף
// לכמה עמודים) אל מחלקת הצבע של .status-dot כאן בעמוד ההזמנות בלבד — לא נוגעים בעוזר המשותף עצמו.
const getStatusDotClass = (status) => {
  switch (status) {
    case 'הוחזר':
    case 'הוחזר חלקי':
      return 'c-green';
    case 'הושכר':
    case 'הושכר חלקי':
      return 'c-blue';
    case 'בקרוב':
      return 'c-amber';
    case 'עבר':
      return 'c-purple';
    case 'מחוק':
      return 'c-gray';
    case 'טיוטה':
      return 'c-green';
    default:
      return 'c-gray';
  }
};

const getPaymentStatusDotClass = (status) => {
  switch (status) {
    case 'שולם':
      return 'c-green';
    case 'שולם חלקי':
      return 'c-amber';
    case 'ממתין לזיכוי':
      return 'c-purple';
    case 'לא שולם':
    default:
      return 'c-red';
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
  return <span style={{ color: timeLeft === 'פג תוקף' ? 'var(--error-color)' : '#ea580c', fontWeight: 'bold', fontSize: '0.85rem' }}>⏳ {timeLeft}</span>;
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

  const SortIcon = ({ column }) => {
    if (sort !== column) return <span style={{ opacity: 0.3, marginRight: '4px' }}>↕</span>;
    return <span style={{ marginRight: '4px' }}>{order === 'asc' ? '↑' : '↓'}</span>;
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

  const thStyle = { 
    padding: '1rem', 
    cursor: 'pointer', 
    userSelect: 'none', 
    whiteSpace: 'nowrap', 
    fontSize: 'clamp(0.75rem, 1.5vw, 1rem)',
    position: 'sticky',
    top: 0,
    zIndex: 35,
    backgroundColor: 'var(--sticky-header-bg, #ffffff)',
    boxShadow: '0 4px 10px -2px rgba(0,0,0,0.08)',
    borderBottom: '2px solid var(--border-color)'
  };

  return (
    <main data-agy-id="orders_page_main_1" className="container animate-fade-in page-shell">
      <div className="page-scroll">
      {/* סרגל אחד: כותרת + חיפוש + פילטרים + פעולות */}
      <div className="toolbar-row" style={{ marginBottom: '1.5rem' }}>
        <h1 className="toolbar-title">
          <strong>ניהול הזמנות</strong>
          <small>סה"כ רשומות: {totalCount}</small>
        </h1>

        <AISearchBar data-element-name="רכיב_page_22"
          placeholder="חיפוש הזמנה (מספר הזמנה, שם לקוח)..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onSearch={handleSearch}
          onClear={handleClearSearch}
          onAiSearch={handleAiSearch}
          onStatistics={(e) => setShowStatistics({ x: e.clientX, y: e.clientY })}
          loading={aiLoading}
        />

        {/* Status Filter Banner */}
        <div className="status-filters">
          <button data-element-name="כפתור_page_1" data-agy-id="orders_page_button_2" onClick={() => { setFilterStatus('soon'); setPage(1); }} className={filterStatus === 'soon' ? 'status-filter active c-amber' : 'status-filter'} title="בקרוב (החל מהיום ואילך)">
            <CalendarDays data-element-name="רכיב_page_2" size={16} />
            <span>בקרוב</span>
          </button>
          <button data-element-name="כפתור_page_3" data-agy-id="orders_page_button_3" onClick={() => { setFilterStatus('archive'); setPage(1); }} className={filterStatus === 'archive' ? 'status-filter active c-purple' : 'status-filter'} title="ארכיון / עבר">
            <Archive data-element-name="רכיב_page_4" size={16} />
            <span>ארכיון/עבר</span>
          </button>
          <button data-element-name="כפתור_page_5" data-agy-id="orders_page_button_4" onClick={() => { setFilterStatus('deleted'); setPage(1); }} className={filterStatus === 'deleted' ? 'status-filter active c-gray' : 'status-filter'} title="מחוקים">
            <Trash2 data-element-name="רכיב_page_6" size={16} />
            <span>מחוק</span>
          </button>
          <button data-element-name="כפתור_page_7" data-agy-id="orders_page_button_5" onClick={() => { setFilterStatus('unpaid'); setPage(1); }} className={filterStatus === 'unpaid' ? 'status-filter active c-red' : 'status-filter'} title="לא שולם (חודשים אחרונים)">
            <AlertCircle data-element-name="רכיב_page_8" size={16} />
            <span>לא שולם</span>
          </button>
          <button data-element-name="כפתור_page_drafts" data-agy-id="orders_page_button_drafts" onClick={() => { setFilterStatus('drafts'); setPage(1); }} className={filterStatus === 'drafts' ? 'status-filter active c-green' : 'status-filter'} title="טיוטות">
            <Pencil data-element-name="רכיב_page_drafts_icon" size={16} />
            <span>טיוטות</span>
          </button>
          <button data-element-name="כפתור_page_11" data-agy-id="orders_page_button_7" onClick={() => { setFilterStatus('all'); setPage(1); }} className={filterStatus === 'all' ? 'status-filter active c-blue' : 'status-filter'} title="הצג הכל">
            <List data-element-name="רכיב_page_12" size={16} />
            <span>הכל</span>
          </button>
        </div>
        <div className="icon-toolbar">
          <button data-element-name="כפתור_page_13" data-agy-id="orders_page_button_8"
             onClick={() => setShowAdvSearch(true)}
             className="icon-btn"
             title="חיפוש מתקדם"
          >
            <Filter data-element-name="רכיב_page_14" size={19} />
          </button>

          <button data-element-name="כפתור_page_15" data-agy-id="orders_page_button_9"
             onClick={() => setShowCapacitySearch(true)}
             className="icon-btn"
             title="חיפוש תפוסה"
          >
            <CalendarSearch data-element-name="רכיב_page_16" size={19} />
          </button>

          <button data-element-name="כפתור_page_17"
             onClick={() => setShowPrintWizard(true)}
             className="icon-btn"
             title="הדפסת דוחות"
          >
            <Printer data-element-name="רכיב_page_18" size={19} />
          </button>

          <span className="icon-sep"></span>

          <ExportButtons data-element-name="רכיב_page_19"
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

          <span className="icon-sep"></span>

          <Link data-element-name="רכיב_page_20"
             href="/orders/new"
             className="icon-btn icon-btn-primary"
             title="הזמנה חדשה"
          >
            <Plus data-element-name="רכיב_page_21" size={17} />
            <span>הזמנה חדשה</span>
          </Link>
        </div>
      </div>

      {showAdvSearch && typeof document !== 'undefined' && createPortal(
        <div data-element-name="לחיץ_page_23" className="modal-overlay" onClick={() => setShowAdvSearch(false)} style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div data-element-name="לחיץ_page_24" className="modal-content animate-slide-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', width: '100%', background: 'var(--card-bg)', borderRadius: '16px', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--divider)', paddingBottom: '1rem' }}>
              <h2 style={{ color: 'var(--primary-color)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Filter data-element-name="רכיב_page_25" size={20} />
                סינון מתקדם
              </h2>
              <button data-element-name="כפתור_page_26" data-agy-id="orders_page_button_15" onClick={() => setShowAdvSearch(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', borderRadius: '50%', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--element-bg)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <X data-element-name="רכיב_page_27" size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: '300px' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>טווח תאריכי אירוע</label>
                <HebrewDateRangePicker 
                  startDate={advFilters.eventDateFrom} 
                  endDate={advFilters.eventDateTo} 
                  onChange={(start, end) => setAdvFilters(p => ({...p, eventDateFrom: start, eventDateTo: end}))} 
                />
              </div>
              <div style={{ flex: 2, minWidth: '320px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>סטטוס פריטים</label>
                  <button
                    data-element-name="כפתור_בחר_הכל_סטטוסים"
                    type="button"
                    onClick={() => {
                      const allSelected = advFilters.rentalStatus.length === 3;
                      setAdvFilters(p => ({
                        ...p,
                        rentalStatus: allSelected ? [] : ['pendingOnly', 'activeOnly', 'returnedOnly']
                      }));
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary-color, #1976d2)',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      transition: 'background 0.2s',
                      userSelect: 'none'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--element-bg, #f1f5f9)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    {advFilters.rentalStatus.length === 3 ? 'בטל בחירת הכל' : 'בחר הכל'}
                  </button>
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', width: '100%' }}>
                  {[
                    { value: 'pendingOnly', label: 'ממתינים', icon: <Clock size={16} />, color: '#ef6c00', bgSelected: 'rgba(239, 108, 0, 0.1)' },
                    { value: 'activeOnly', label: 'מושכרים', icon: <Shirt size={16} />, color: '#1565c0', bgSelected: 'rgba(21, 101, 192, 0.1)' },
                    { value: 'returnedOnly', label: 'מוחזרים', icon: <CheckCircle2 size={16} />, color: '#2e7d32', bgSelected: 'rgba(46, 125, 50, 0.1)' }
                  ].map(opt => {
                    const isSelected = advFilters.rentalStatus.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        data-element-name={`סטטוס_כפתור_${opt.value}`}
                        type="button"
                        onClick={() => {
                          setAdvFilters(p => {
                            const current = p.rentalStatus;
                            const next = current.includes(opt.value)
                              ? current.filter(x => x !== opt.value)
                              : [...current, opt.value];
                            return { ...p, rentalStatus: next };
                          });
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '0.55rem 0.9rem',
                          borderRadius: '10px',
                          border: isSelected ? `2px solid ${opt.color}` : '1px solid var(--element-border, #cbd5e1)',
                          background: isSelected ? opt.bgSelected : 'var(--input-bg, white)',
                          color: isSelected ? opt.color : 'var(--text-main, #334155)',
                          fontSize: '0.85rem',
                          fontWeight: isSelected ? '700' : '500',
                          cursor: 'pointer',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: isSelected ? `0 2px 8px ${opt.bgSelected}` : 'none',
                          flex: '1',
                          minWidth: '100px',
                          justifyContent: 'center',
                          userSelect: 'none'
                        }}
                      >
                        <span style={{ display: 'flex', color: isSelected ? opt.color : 'var(--text-muted, #64748b)' }}>{opt.icon}</span>
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>{getLabel('order_id', 'מספר הזמנה')}</label>
                <div style={{ position: 'relative' }}>
                  <Search data-element-name="רכיב_page_30" size={16} style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input data-element-name="שדה_page_31" data-agy-id="orders_page_input_11" type="text" className="form-control" style={{ width: '100%', padding: '0.6rem 2.5rem 0.6rem 0.6rem', borderRadius: '8px', border: '1px solid var(--element-border)', background: 'var(--input-bg)', color: 'var(--text-main)' }} value={advFilters.advOrderId} onChange={e => setAdvFilters(p => ({...p, advOrderId: e.target.value}))} placeholder="חפש לפי מספר..." />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>ברקוד/פרטי פריט</label>
                <div style={{ position: 'relative' }}>
                  <Shirt data-element-name="רכיב_page_32" size={16} style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input data-element-name="שדה_page_33" data-agy-id="orders_page_input_12" type="text" className="form-control" style={{ width: '100%', padding: '0.6rem 2.5rem 0.6rem 0.6rem', borderRadius: '8px', border: '1px solid var(--element-border)', background: 'var(--input-bg)', color: 'var(--text-main)' }} value={advFilters.itemDetails} onChange={e => setAdvFilters(p => ({...p, itemDetails: e.target.value}))} placeholder="ברקוד או תיאור..." />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>דגם</label>
                <div style={{ position: 'relative' }}>
                  <OrderModelSelector data-element-name="רכיב_page_34" 
                    value={{ name: advFilters.advModelName }} 
                    onChange={m => setAdvFilters(p => ({...p, advModelName: m ? m.name : ''}))} 
                    placeholder="בחר דגם..."
                  />
                  {advFilters.advModelName && (
                    <button data-element-name="כפתור_page_35" 
                      onClick={() => setAdvFilters(p => ({...p, advModelName: ''}))}
                      style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error-color)' }}
                      title="נקה בחירה"
                    >
                      <X data-element-name="רכיב_page_36" size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>{getLabel('order_customerName', 'שם לקוח')}</label>
                <input data-element-name="שדה_page_37" data-agy-id="orders_page_input_13" type="text" className="form-control" style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--element-border)', background: 'var(--input-bg)', color: 'var(--text-main)' }} value={advFilters.customerName} onChange={e => setAdvFilters(p => ({...p, customerName: e.target.value}))} placeholder="שם הלקוח..." />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>טלפון לקוח</label>
                <input data-element-name="שדה_page_38" data-agy-id="orders_page_input_14" type="text" className="form-control" style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--element-border)', background: 'var(--input-bg)', color: 'var(--text-main)' }} value={advFilters.customerPhone} onChange={e => setAdvFilters(p => ({...p, customerPhone: e.target.value}))} placeholder="מספר טלפון..." />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>עיר מגורים</label>
                <input data-element-name="שדה_page_39" data-agy-id="orders_page_input_15" type="text" className="form-control" style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--element-border)', background: 'var(--input-bg)', color: 'var(--text-main)' }} value={advFilters.customerCity} onChange={e => setAdvFilters(p => ({...p, customerCity: e.target.value}))} placeholder="עיר..." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid var(--divider)', paddingTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button data-element-name="כפתור_page_40" data-agy-id="orders_page_button_16" className="btn btn-outline" style={{ padding: '0.6rem 1.5rem', borderRadius: '8px' }} onClick={() => {
                setAdvFilters({ customerName: '', customerPhone: '', customerCity: '', advOrderId: '', itemDetails: '', advModelName: '', eventDateFrom: '', eventDateTo: '', rentalStatus: [] });
              }}>נקה הכל</button>
              <button data-element-name="כפתור_page_41" data-agy-id="orders_page_button_17" className="btn btn-primary" style={{ padding: '0.6rem 2.5rem', borderRadius: '8px' }} onClick={() => setShowAdvSearch(false)}>החל סינון</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div style={{ display: 'flex', gap: '2rem', flexDirection: 'row', flexWrap: 'wrap' }}>
        
        {/* Orders List */}
        <div style={{ flex: '1 1 600px' }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1rem', boxShadow: 'var(--shadow-sm)' }}>
            {loading && orders.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>טוען נתונים...</div>
            ) : (
              <>
                <div style={{ overflow: 'visible', minHeight: '50vh' }}>
                  <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse', whiteSpace: 'nowrap', fontSize: 'clamp(0.75rem, 1.5vw, 1rem)' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--element-border)', color: 'var(--text-muted)' }}>
                      <th data-element-name="לחיץ_page_42" style={thStyle} onClick={() => handleSort('orderId')}>{getLabel('order_id', 'קוד הזמנה')} <SortIcon data-element-name="רכיב_page_43" column="orderId" /></th>
                      <th data-element-name="לחיץ_page_44" style={thStyle} onClick={() => handleSort('customerName')}>{getLabel('order_customerName', 'לקוח')} <SortIcon data-element-name="רכיב_page_45" column="customerName" /></th>
                      <th style={thStyle}>כמות פריטים</th>
                      <th data-element-name="לחיץ_page_46" style={thStyle} onClick={() => handleSort('eventDate')}>תאריך אירוע <SortIcon data-element-name="רכיב_page_47" column="eventDate" /></th>
                      <th data-element-name="לחיץ_page_48" style={thStyle} onClick={() => handleSort('totalAmount')}>{getLabel('order_totalAmount', 'סכום לחיוב')} <SortIcon data-element-name="רכיב_page_49" column="totalAmount" /></th>
                      <th data-element-name="לחיץ_page_50" style={thStyle} onClick={() => handleSort('totalPaid')}>שולם <SortIcon data-element-name="רכיב_page_51" column="totalPaid" /></th>
                      <th data-element-name="לחיץ_page_52" style={thStyle} onClick={() => handleSort('status')}>{getLabel('order_status', 'סטטוס')} <SortIcon data-element-name="רכיב_page_53" column="status" /></th>
                      <th style={thStyle}>פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => {
                      const isPaid = (order.totalPaid >= order.totalAmount && order.totalAmount > 0) || order.totalPaid > 0 || order.status === 'שולם' || order.status === 'שולם חלקי';
                      const pendingItem = (!order.legacyId && !isPaid) ? order.items?.find(i => i.cartStatus === 'pending') : null;
                      const isPending = pendingItem && new Date(pendingItem.cartStatusDate).getTime() + holdMinutes * 60000 > Date.now();
                      const isExpiredPending = pendingItem && new Date(pendingItem.cartStatusDate).getTime() + holdMinutes * 60000 <= Date.now();
                      
                      const isUnpaid = order.totalPaid < order.totalAmount && order.totalAmount > 0;
                      const hasCustomSpacing = order.customSpacing !== null && order.customSpacing !== undefined;
                      
                      let rowBg = 'transparent';
                      let rowBorder = 'none';
                      if (selectedOrder?.orderId === order.orderId) {
                        rowBg = 'var(--element-bg)';
                      } else if (hasCustomSpacing) {
                        rowBg = '#fef9c3';
                        rowBorder = '4px solid #facc15';
                      } else if (isPending) {
                        rowBg = '#fff7ed'; // light orange
                        rowBorder = '4px solid #ea580c';
                      } else if (isUnpaid) {
                        rowBg = 'var(--error-bg, rgba(239, 68, 68, 0.1))';
                        rowBorder = '4px solid var(--error-color, #ef4444)';
                      }
                      
                      return (
                      <tr data-element-name="לחיץ_page_54" key={order.orderId} style={{ 
                        borderBottom: '1px solid var(--element-border)', 
                        transition: 'background 0.2s', 
                        cursor: 'pointer', 
                        background: rowBg,
                        borderRight: rowBorder
                      }} onClick={() => router.push(`/orders/${order.orderId}`)}>
                        <td style={{ padding: '1rem', fontWeight: (isUnpaid || isPending) ? 'bold' : 'normal', color: isUnpaid ? 'var(--error-color, #b91c1c)' : (isPending ? '#ea580c' : 'inherit') }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>#{order.orderId}</span>
                            {pendingItem && <PendingTimer cartStatusDate={pendingItem.cartStatusDate} holdMinutes={holdMinutes} />}
                            <div 
                              className="detailsIcon"
                              style={{ marginRight: 'auto' }}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setPopoverPos({ top: rect.top - 12, left: rect.left + (rect.width / 2) });
                                setHoveredOrder(order);
                              }}
                              onMouseLeave={() => setHoveredOrder(null)}
                              onClick={(e) => { e.stopPropagation(); }}
                            >
                              <Info data-element-name="רכיב_page_55" size={16} strokeWidth={2.5} />
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '1rem', fontWeight: '500' }}>{order.customerName}</td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>{order.items ? order.items.filter(i => !i.isDeleted).length : 0}</td>
                        <td style={{ padding: '1rem' }}>{order.eventDateHebrew || ''}</td>
                        <td style={{ padding: '1rem' }}>₪{order.totalAmount}</td>
                        <td style={{ padding: '1rem', color: order.totalPaid >= order.totalAmount && order.totalAmount > 0 ? 'var(--success-color, #10b981)' : (isUnpaid ? 'var(--error-color, #dc2626)' : 'inherit'), fontWeight: isUnpaid ? 'bold' : 'normal' }}>
                          ₪{order.totalPaid}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'nowrap', alignItems: 'center' }}>
                            <span className={`status-dot ${getStatusDotClass(calculateOrderStatus(order))}`}>
                              {calculateOrderStatus(order)}
                            </span>
                            <span className={`status-dot ${getPaymentStatusDotClass(calculatePaymentStatus(order.totalAmount || 0, order.totalPaid || 0))}`}>
                              {calculatePaymentStatus(order.totalAmount || 0, order.totalPaid || 0)}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
                          <Link data-element-name="לחיץ_page_56"
                            href={`/orders/${order.orderId}`}
                            className="btn btn-outline"
                            style={{ padding: '0.5rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', width: '38px', height: '38px', border: 'none', backgroundColor: 'transparent', color: 'var(--primary-color, #1976d2)' }}
                            onClick={(e) => e.stopPropagation()}
                            title="כרטיס הזמנה"
                          >
                            <Pencil data-element-name="רכיב_page_57" size={18} />
                          </Link>
                          <button data-element-name="כפתור_page_58" data-agy-id="orders_page_button_18" 
                            className="btn btn-outline" 
                            style={{ padding: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', width: '38px', height: '38px', border: 'none', cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--success-color, #10b981)' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRentalModalOrderId(order.orderId);
                            }}
                            title="מעבר להשכרה/החזרה"
                          >
                            <Shirt data-element-name="רכיב_page_59" size={18} />
                          </button>
                          <button data-element-name="כפתור_page_60" data-agy-id="orders_page_button_19" 
                            className="btn btn-outline" 
                            style={{ padding: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', width: '38px', height: '38px', border: 'none', cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--error-color, #ef4444)' }}
                            onClick={(e) => handleDeleteOrder(order, e)}
                            title="מחיקת הזמנה"
                          >
                            <Trash2 data-element-name="רכיב_page_61" size={18} />
                          </button>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* סיכום הרשומות ועימוד — מוצמד תמיד לתחתית המסך */}
      <div className="page-footer-bar">
        <div className="page-footer-summary">סה"כ שורות מוצגות: {orders.length}</div>

        {totalPages > 1 && (
          <div className="page-footer-pager">
            <button data-element-name="כפתור_page_62" data-agy-id="orders_page_button_22" className="btn btn-outline" disabled={page <= 1 || isAiModeActive} onClick={() => setPage(p => p - 1)} style={{ padding: '0.5rem 1rem' }}>&lt; הקודם</button>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>עמוד <input data-element-name="שדה_page_63" data-agy-id="orders_page_input_21" type="number" min={1} max={totalPages || 1} value={page} onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) setPage(v); }} style={{ width: '60px', padding: '0.3rem', textAlign: 'center', borderRadius: '6px', border: '1px solid var(--element-border)', background: 'var(--input-bg)', color: 'var(--text-main)' }} disabled={isAiModeActive} /> מתוך {totalPages}</span>
            <button data-element-name="כפתור_page_64" data-agy-id="orders_page_button_20" className="btn btn-outline" disabled={page >= totalPages || isAiModeActive} onClick={() => setPage(p => p + 1)} style={{ padding: '0.5rem 1rem' }}>הבא &gt;</button>
          </div>
        )}
      </div>

      {/* Modals */}
      <CapacitySearchModal data-element-name="רכיב_page_65" 
        isOpen={showCapacitySearch} 
        onClose={() => setShowCapacitySearch(false)} 
      />

      {showPrintWizard && (
        <PrintWizardModal data-element-name="רכיב_page_66"
          onClose={() => setShowPrintWizard(false)}
          defaultReportType="orders_all"
          getCurrentOrderIds={getCurrentFilteredOrderIds}
        />
      )}

      {/* Rental Modal */}
      {rentalModalOrderId && (
        <RentalReturnModal data-element-name="רכיב_page_67" 
          orderId={rentalModalOrderId} 
          onClose={() => setRentalModalOrderId(null)} 
          onUpdate={fetchOrders}
        />
      )}

      <StatisticsModal data-element-name="רכיב_page_68" 
        isOpen={!!showStatistics} 
        onClose={() => setShowStatistics(false)} 
        pageContext="orders"
        contextQuery={aiQueryUsed}
        position={typeof showStatistics === 'object' ? showStatistics : null}
      />

      {hoveredOrder && typeof document !== 'undefined' && createPortal(
        <div 
          className="global-popover" 
          style={{ top: popoverPos.top, left: popoverPos.left }}
        >
          <div className="global-popoverHeader">
            <Info data-element-name="רכיב_page_69" size={18} />
            הזמנה #{hoveredOrder.orderId}
          </div>
          <div className="global-popoverRow">
            <span>לקוח:</span>
            <span>{hoveredOrder.customerName}</span>
          </div>
          <div className="global-popoverRow">
            <span><Phone data-element-name="רכיב_page_70" size={14} /> טלפון:</span>
            <span dir="ltr">{hoveredOrder.customerPhone || 'לא הוזן'}</span>
          </div>
          <div className="global-popoverRow">
            <span><CalendarIcon2 data-element-name="רכיב_page_71" size={14} /> תאריך עברי:</span>
            <span>{hoveredOrder.eventDateHebrew || 'לא צוין'}</span>
          </div>

          {/* ציפוף ימים מיוחד — מוצג רק כשהוגדר ערך מותאם להזמנה (אותו תנאי שצובע את השורה בצהוב) */}
          {hoveredOrder.customSpacing !== null && hoveredOrder.customSpacing !== undefined && (
            <div className="global-popoverRow">
              <span><AlertTriangle data-element-name="רכיב_page_76" size={14} /> ציפוף ימים:</span>
              <span style={{ color: '#d97706', fontWeight: 'bold' }}>
                {hoveredOrder.customSpacing} {hoveredOrder.customSpacing === 1 ? 'יום' : 'ימים'}
              </span>
            </div>
          )}

          <div className="global-popoverRow">
            <span><Shirt data-element-name="רכיב_page_72" size={14} /> הושכר:</span>
            <span>{hoveredOrder.items ? hoveredOrder.items.filter(i => !i.isDeleted && i.isTaken).length : 0}</span>
          </div>
          <div className="global-popoverRow">
            <span><Shirt data-element-name="רכיב_page_73" size={14} /> הוחזר:</span>
            <span>{hoveredOrder.items ? hoveredOrder.items.filter(i => !i.isDeleted && i.isReturned).length : 0}</span>
          </div>
          <div className="global-popoverRow">
            <span><CreditCard data-element-name="רכיב_page_74" size={14} /> סה"כ לתשלום:</span>
            <span>₪{hoveredOrder.totalAmount || 0}</span>
          </div>
          <div className="global-popoverRow">
            <span><CheckCircle2 data-element-name="רכיב_page_75" size={14} /> שולם:</span>
            <span style={{ color: hoveredOrder.totalPaid >= hoveredOrder.totalAmount && hoveredOrder.totalAmount > 0 ? 'var(--success-color, #10b981)' : (hoveredOrder.totalPaid > 0 ? 'var(--warning-color, #f59e0b)' : 'var(--error-color, #ef4444)'), fontWeight: 'bold' }}>
              ₪{hoveredOrder.totalPaid || 0}
            </span>
          </div>
          <div className="global-popoverRow">
            <span>סטטוס פריטים:</span>
            <span className={`status-dot ${getStatusDotClass(calculateOrderStatus(hoveredOrder))}`}>
              {calculateOrderStatus(hoveredOrder)}
            </span>
          </div>
          <div className="global-popoverRow">
            <span>סטטוס תשלום:</span>
            <span className={`status-dot ${getPaymentStatusDotClass(calculatePaymentStatus(hoveredOrder.totalAmount || 0, hoveredOrder.totalPaid || 0))}`}>
              {calculatePaymentStatus(hoveredOrder.totalAmount || 0, hoveredOrder.totalPaid || 0)}
            </span>
          </div>
        </div>,
        document.body
      )}
    </main>
  );
}
