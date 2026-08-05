'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { HDate, Sedra, Locale, HebrewCalendar } from '@hebcal/core';
import { getHebrewMonthYear } from '@/lib/hebrewDate';
import { ChevronRight, ChevronLeft, Calendar as CalendarIcon, FileText, MapPin, Search, AlertCircle, AlertTriangle, RefreshCw, Smartphone, List, CheckCircle2, Phone, Calendar as CalendarIcon2, Shirt, CreditCard, Info, Maximize2, User, X, Filter } from 'lucide-react';
import AISearchBar from '../components/AISearchBar';
import HebrewDatePicker from '../../components/HebrewDatePicker';
import StatisticsModal from '../components/StatisticsModal';
import styles from './board.module.css';
import RentalReturnModal from '../../components/orders/RentalReturnModal';

const boardCache = new Map();

export default function BoardPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hoveredOrder, setHoveredOrder] = useState(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  
  // Action Menu state (Order Card vs Rental Card)
  const [actionOrder, setActionOrder] = useState(null);
  const [actionPos, setActionPos] = useState({ top: 0, left: 0 });

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dayOrdersFilter, setDayOrdersFilter] = useState('');
  const [advFilters, setAdvFilters] = useState({
    customerName: '', customerPhone: '', customerCity: '', 
    advOrderId: '', itemDetails: '', eventDateFrom: '', eventDateTo: ''
  });
  const [showAdvSearch, setShowAdvSearch] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [selectedRentalOrderId, setSelectedRentalOrderId] = useState(null);
  const [selectedDayOrders, setSelectedDayOrders] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQueryUsed, setAiQueryUsed] = useState('');
  const [isAiModeActive, setIsAiModeActive] = useState(false);
  const [highlightedDate, setHighlightedDate] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState(null);
  const [showGlobalSearchModal, setShowGlobalSearchModal] = useState(false);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  
  const [jumpDate, setJumpDate] = useState(null);

  useEffect(() => {
    if (jumpDate) {
      setSelectedDate(new Date(jumpDate));
    }
  }, [jumpDate]);

  const handleGlobalSearch = async () => {
    if (!searchInput) {
      alert("נא להזין טקסט לחיפוש גלובלי (לפי מספר הזמנה או שם לקוח)");
      return;
    }
    setGlobalSearchLoading(true);
    setShowGlobalSearchModal(true);
    try {
      const res = await fetch(`/api/orders?search=${encodeURIComponent(searchInput)}&limit=100&filterStatus=all`);
      const data = await res.json();
      setGlobalSearchResults(data.data || data.orders || []);
    } catch (e) {
      console.error(e);
    } finally {
      setGlobalSearchLoading(false);
    }
  };

  // Fetch orders for the currently viewed month
  const fetchOrdersForMonth = useCallback(async () => {
    if (isAiModeActive) return;
    
    try {
      let hCurrent;
      try {
        hCurrent = new HDate(selectedDate);
      } catch(e) {
        hCurrent = new HDate(new Date());
      }
      
      // Start date is roughly a month before (to cover leading grid days)
      // End date is roughly a month after (to cover trailing grid days)
      const firstDayHDate = new HDate(1, hCurrent.getMonth(), hCurrent.getFullYear());
      const lastDayHDate = new HDate(hCurrent.daysInMonth(), hCurrent.getMonth(), hCurrent.getFullYear());
      
      const fromDate = new Date(firstDayHDate.greg());
      fromDate.setDate(fromDate.getDate() - 14); // Buffer for leading days
      
      const toDate = new Date(lastDayHDate.greg());
      toDate.setDate(toDate.getDate() + 14); // Buffer for trailing days

      const queryParams = new URLSearchParams({
        eventDateFrom: fromDate.toISOString(),
        eventDateTo: toDate.toISOString(),
        filterStatus: 'all',
        limit: '2000'
      });
      
      if (search) queryParams.append('search', search);
      
      Object.entries(advFilters).forEach(([k, v]) => {
        if (v) queryParams.append(k, v);
      });

      const cacheKey = queryParams.toString();
      
      // Instant cache hit
      if (boardCache.has(cacheKey)) {
        const cachedData = boardCache.get(cacheKey);
        if (cachedData.data) {
          setOrders(cachedData.data);
        } else if (cachedData.orders) {
          setOrders(cachedData.orders);
        }
      } else {
        setLoading(true);
      }

      const res = await fetch(`/api/orders?${queryParams.toString()}`);
      const data = await res.json();
      
      // Update cache
      boardCache.set(cacheKey, data);
      
      if (data.data) {
        setOrders(data.data);
      } else if (data.orders) {
        setOrders(data.orders);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, search, advFilters, isAiModeActive]);

  useEffect(() => {
    fetchOrdersForMonth();
  }, [fetchOrdersForMonth]);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    setSearch(searchInput);
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
    if (isAiModeActive) {
      setIsAiModeActive(false);
    }
  };

  const changeMonth = (delta) => {
    try {
      const hCurrent = new HDate(selectedDate);
      const current15 = new HDate(15, hCurrent.getMonth(), hCurrent.getFullYear());
      const nextMonthHDate = new HDate(current15.abs() + (30 * delta));
      const newMonthFirstDay = new HDate(1, nextMonthHDate.getMonth(), nextMonthHDate.getFullYear());
      setSelectedDate(newMonthFirstDay.greg());
    } catch(e) {
      const d = new Date(selectedDate);
      d.setMonth(d.getMonth() + delta);
      setSelectedDate(d);
    }
  };

  const getOrderCategory = (order) => {
    const isEmpty = !order.items || order.items.length === 0;
    const hasRepairs = order.items && order.items.some(i => i.neckAlteration || i.lengthAlteration || i.sleeveAlteration || i.alterationDetails);
    const isUnpaid = (order.totalPaid || 0) < (order.totalAmount || 0);
    const isPaidInFull = (order.totalAmount || 0) > 0 && (order.totalPaid || 0) >= order.totalAmount;
    
    const validItems = order.items ? order.items.filter(i => !i.isDeleted) : [];
    const allReturned = validItems.length > 0 && validItems.every(i => i.isReturned);
    const someReturned = validItems.some(i => i.isReturned);
    const allTaken = validItems.length > 0 && validItems.every(i => i.isTaken);
    const someTaken = validItems.some(i => i.isTaken);
    
    if (isEmpty) return 'empty';
    if (allReturned) return 'returned';
    if (allTaken || someTaken || someReturned) return 'rented';
    if (hasRepairs) return 'repairs';
    if (isUnpaid) return 'unpaid';
    if (isPaidInFull) return 'completed';
    return 'other';
  };

  const getColorStyles = (category) => {
    switch (category) {
      case 'empty':
        return { background: 'var(--cat-empty-bg, #fee2e2)', border: '1px solid var(--cat-empty-border, #fecaca)', color: 'var(--cat-empty-text, #991b1b)' }; // Red
      case 'repairs':
        return { background: 'var(--cat-repairs-bg, #fce7f3)', border: '1px solid var(--cat-repairs-border, #fbcfe8)', color: 'var(--cat-repairs-text, #9d174d)' }; // Pink/Purple
      case 'unpaid':
        return { background: 'var(--cat-unpaid-bg, #ffedd5)', border: '1px solid var(--cat-unpaid-border, #fed7aa)', color: 'var(--cat-unpaid-text, #c2410c)' }; // Orange
      case 'returned':
        return { background: 'var(--cat-returned-bg, #e8f5e9)', border: '1px solid var(--cat-returned-border, #a5d6a7)', color: 'var(--cat-returned-text, #2e7d32)' }; // Green
      case 'rented':
        return { background: 'var(--cat-rented-bg, #e3f2fd)', border: '1px solid var(--cat-rented-border, #90caf9)', color: 'var(--cat-rented-text, #1565c0)' }; // Blue
      case 'completed':
        return { background: 'var(--cat-completed-bg, #dcfce7)', border: '1px solid var(--cat-completed-border, #bbf7d0)', color: 'var(--cat-completed-text, #15803d)' }; // Green
      default:
        return { background: 'var(--cat-other-bg, #f1f5f9)', border: '1px solid var(--cat-other-border, #e2e8f0)', color: 'var(--cat-other-text, #475569)' }; // Gray
    }
  };

  const getCategoryLabel = (category) => {
    switch (category) {
      case 'empty': return 'הזמנה פגומה (0 פריטים)';
      case 'repairs': return 'יש תיקונים';
      case 'unpaid': return 'לא שולם';
      case 'returned': return 'הוחזר';
      case 'rented': return 'מושכר/חלקית';
      case 'completed': return 'הושלם (שולם)';
      default: return 'אחר';
    }
  };

  // Group orders by their event date (YYYY-MM-DD string)
  const ordersByDate = useMemo(() => {
    const grouped = {};
    orders.forEach(order => {
      if (order.eventDate) {
        const d = new Date(order.eventDate);
        // Format as local YYYY-MM-DD
        const dStr = d.toLocaleDateString('en-CA'); 
        if (!grouped[dStr]) grouped[dStr] = [];
        grouped[dStr].push(order);
      }
    });
    return grouped;
  }, [orders]);

  
  const renderOrderCard = (order) => {
    const validItems = order.items ? order.items.filter(i => !i.isDeleted) : [];
    let isOrderLate = false;
    if (validItems.length > 0) {
      const hasTakenNotReturned = validItems.some(i => i.isTaken && !i.isReturned);
      if (hasTakenNotReturned) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const evDate = new Date(order.eventDate);
        evDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((today - evDate) / (1000 * 60 * 60 * 24));
        if (diffDays > 2) {
          isOrderLate = true;
        }
      }
    }

    const category = getOrderCategory(order);
    const colorStyle = { ...getColorStyles(category) };
    
    if (isOrderLate) {
      colorStyle.background = 'var(--cat-late-bg, #fee2e2)';
      colorStyle.border = '2px solid var(--cat-late-border, #ef4444)';
      colorStyle.color = 'var(--cat-late-text, #991b1b)';
    }
    
    return (
      <div data-element-name="לחיץ_page_1"
        key={order.orderId} 
        className={styles.orderCard}
        style={{ background: colorStyle.background, borderColor: colorStyle.border, color: colorStyle.color, cursor: 'pointer', position: 'relative' }}
        title={`סטטוס: ${getCategoryLabel(category)}\nסה"כ: ₪${order.totalAmount}\nשולם: ₪${order.totalPaid}`}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setActionPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
          setActionOrder(order);
        }}
      >
        <div className={styles.orderHeader}>
          <span className={styles.orderCustomer} style={{ fontWeight: isOrderLate ? 'bold' : 'normal' }}>
            {order.customerName || `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: isOrderLate ? 'bold' : 'normal' }}>
            {isOrderLate && <AlertCircle data-element-name="רכיב_page_2" size={14} color="var(--danger-color, #ef4444)" />}
            #{order.orderId}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
          {category !== 'other' ? (
             <span className={styles.statusIndicator} style={{ color: colorStyle.color, border: `1px solid ${colorStyle.border}` }}>
               {getCategoryLabel(category)}
             </span>
          ) : <span></span>}
          
          <div 
            className={styles.detailsIcon}
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setPopoverPos({ top: rect.top - 12, left: rect.left + (rect.width / 2) });
              setHoveredOrder({ order, category });
            }}
            onMouseLeave={() => setHoveredOrder(null)}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <Info data-element-name="רכיב_page_3" size={16} strokeWidth={2.5} />
          </div>
        </div>
      </div>
    );
  };

  const renderCalendar = () => {
    let hCurrent;
    try {
      hCurrent = new HDate(selectedDate);
    } catch(e) {
      hCurrent = new HDate(new Date());
    }
    const hYear = hCurrent.getFullYear();
    const hMonth = hCurrent.getMonth();
    
    const firstDayHDate = new HDate(1, hMonth, hYear);
    const firstDayOfWeek = firstDayHDate.getDay(); 
    const daysInHebMonth = hCurrent.daysInMonth();
    
    const weeks = [];
    let currentWeek = [];
    
    // Fill leading empty days
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push(null);
    }
    
    for (let day = 1; day <= daysInHebMonth; day++) {
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(day);
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      weeks.push(currentWeek);
    }
    
    return (
      <div className={styles.calendarGrid}>
        {["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"].map(d => (
          <div key={d} className={styles.dayHeader}>{d}</div>
        ))}
        
        {weeks.map((week, i) => (
          week.map((day, j) => {
            if (!day) return <div key={`empty-${i}-${j}`} className={`${styles.dayCell} ${styles.empty}`}></div>;
            
            const cellHDate = new HDate(day, hMonth, hYear);
            const cellGreg = cellHDate.greg();
            const dateStr = cellGreg.toLocaleDateString('en-CA');
            const dayOrders = ordersByDate[dateStr] || [];
            
            const isToday = cellGreg.toDateString() === new Date().toDateString();
            const isHighlighted = dateStr === highlightedDate;
            
            let isLate = false;
            dayOrders.forEach(order => {
              const validItems = order.items ? order.items.filter(i => !i.isDeleted) : [];
              if (validItems.length > 0) {
                const hasTakenNotReturned = validItems.some(i => i.isTaken && !i.isReturned);
                if (hasTakenNotReturned) {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const evDate = new Date(order.eventDate);
                  evDate.setHours(0, 0, 0, 0);
                  const diffDays = Math.ceil((today - evDate) / (1000 * 60 * 60 * 24));
                  if (diffDays > 2) {
                    isLate = true;
                  }
                }
              }
            });
            
            let hebrewDayStr = day;
            try {
              hebrewDayStr = cellHDate.renderGematriya().split(' ')[0];
            } catch(e) {}
            
            let parashaText = '';
            if (j === 6) { // Shabbat
              try {
                const s = new Sedra(hYear, true);
                const p = s.lookup(cellHDate);
                if (p && p.parsha && p.parsha.length > 0) {
                  parashaText = p.parsha.map(name => Locale.gettext(name, 'he')).join('-');
                }
              } catch(e) {}
            }

            let holidays = [];
            try {
              const evs = HebrewCalendar.getHolidaysOnDate(cellHDate, true) || [];
              holidays = evs.filter(e => {
                const flags = e.getFlags();
                const name = e.render('he');
                if (flags & 8192) return false; // Exclude Modern Holidays
                if (name.includes('בנות') || name.includes('מעשר בהמה') || name.includes('סליחות')) return false; 
                return (flags & 1) || (flags & 524288) || (flags & 2097152) || (flags & 16384) || (flags & 256);
              }).map(e => e.render('he'));
            } catch (e) {}

            return (
              <div key={j} className={`${styles.dayCell} ${isToday ? styles.today : ''} ${isLate ? styles.lateDay : ''} ${isHighlighted ? styles.highlightedDay : ''}`}>
                {isLate && <div className={styles.lateIcon}>!</div>}
                <div className={styles.dateHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className={styles.hebrewDate}>{hebrewDayStr}</div>
                    {dayOrders.length > 2 && (
                      <button data-element-name="כפתור_page_4"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDayOrders({
                            date: cellGreg,
                            hebrewDate: hebrewDayStr,
                            orders: dayOrders
                          });
                        }}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--primary-color)', display: 'flex', padding: 0 }}
                        title="תצוגה מורחבת ליום זה"
                      >
                        <Maximize2 data-element-name="רכיב_page_5" size={16} />
                      </button>
                    )}
                  </div>
                  <div className={styles.gregorianDate}>{cellGreg.getDate()}/{cellGreg.getMonth() + 1}</div>
                </div>
                
                {(parashaText || holidays.length > 0) && (
                  <div className={styles.eventsContainer}>
                    {parashaText && <div className={styles.parasha}>{parashaText}</div>}
                    {holidays.map((h, idx) => (
                      <div key={idx} className={styles.holiday}>{h}</div>
                    ))}
                  </div>
                )}
                
                <div className={styles.ordersContainer}>
                  {dayOrders.map(order => renderOrderCard(order))}
                  
                </div>
              </div>
            );
          })
        ))}
      </div>
    );
  };

  const currentMonthYear = getHebrewMonthYear(selectedDate);

  return (
    <div data-agy-id="board-page-container" className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CalendarIcon data-element-name="רכיב_page_6" size={28} />
            לוח שנה
          </h1>
                    <div className={styles.navControls}>
            <button data-element-name="כפתור_page_7" data-agy-id="nav-prev-month-button" className={styles.navBtn} onClick={() => changeMonth(-1)} title="חודש קודם">
              <ChevronRight data-element-name="רכיב_page_8" size={20} />
            </button>
            <div className={styles.monthDisplay} style={{ position: 'relative' }}>
              <span>{currentMonthYear}</span>
              <HebrewDatePicker data-element-name="רכיב_page_9" value={jumpDate} onChange={setJumpDate} placeholder="קפוץ לתאריך..." iconOnly={true} />
            </div>
            <button data-element-name="כפתור_page_10" data-agy-id="nav-next-month-button" className={styles.navBtn} onClick={() => changeMonth(1)} title="חודש הבא">
              <ChevronLeft data-element-name="רכיב_page_11" size={20} />
            </button>
          </div>
        </div>

        <div className={styles.headerBottom}>
          <div className={styles.searchWrapper}>
            <div style={{ display: 'flex', gap: '1rem', width: '100%', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flexGrow: 1, minWidth: '300px' }}>
                <AISearchBar data-element-name="רכיב_page_12" 
                  placeholder="חיפוש הזמנה (מספר הזמנה, שם לקוח)..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onSearch={handleSearch}
                  onClear={handleClearSearch}
                  onAiSearch={handleAiSearch}
                  onStatistics={(e) => setShowStatistics({ x: e.clientX, y: e.clientY })}
                  loading={aiLoading}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button data-element-name="כפתור_page_13" 
                  data-agy-id="global-search-button"
                  onClick={handleGlobalSearch}
                  className="btn-header-icon"
                  title="חיפוש בכל החודשים (גלובלי)"
                >
                  <Search data-element-name="רכיב_page_14" size={20} />
                </button>
                <button data-element-name="כפתור_page_15" 
                  data-agy-id="adv-search-button"
                  onClick={() => setShowAdvSearch(true)}
                  className="btn-header-icon"
                  title="חיפוש מתקדם"
                >
                  <Filter data-element-name="רכיב_page_16" size={20} />
                </button>
              </div>
            </div>
          </div>

          <div className={styles.legendCompact}>
            <strong style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>מקרא:</strong>
            {['repairs', 'unpaid', 'rented', 'returned', 'completed', 'other'].map(cat => {
              const style = getColorStyles(cat);
              return (
                <div key={cat} className={styles.legendItem} style={{ fontSize: '0.85rem' }}>
                  <span className={styles.legendDot} style={{ background: style.background, border: `1px solid ${style.border}` }}></span>
                  <span>{getCategoryLabel(cat)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingOverlay}>טוען נתונים...</div>
      ) : (
        renderCalendar()
      )}

      {hoveredOrder && typeof document !== 'undefined' && createPortal(
        <div 
          className="global-popover" 
          style={{ top: popoverPos.top, left: popoverPos.left, zIndex: 10000 }}
        >
          <div className="global-popoverHeader">
            <Info data-element-name="רכיב_page_17" size={18} />
            פרטים על הזמנה #{hoveredOrder.order.orderId}
          </div>
          <div className="global-popoverRow">
            <span>לקוח:</span>
            <span><Phone data-element-name="רכיב_page_18" size={14} /> טלפון:</span>
            <span dir="ltr">{hoveredOrder.order.customerPhone || 'לא הוזן'}</span>
          </div>
          <div className={styles.popoverRow}>
            <span><CalendarIcon2 data-element-name="רכיב_page_19" size={14} /> תאריך עברי:</span>
            <span>{hoveredOrder.order.eventDateHebrew || 'לא צוין'}</span>
          </div>
          <div className={styles.popoverRow}>
            <span><CalendarIcon2 data-element-name="רכיב_page_20" size={14} /> תאריך לועזי:</span>
            <span>{hoveredOrder.order.eventDate ? new Date(hoveredOrder.order.eventDate).toLocaleDateString('he-IL') : 'לא צוין'}</span>
          </div>

          {/* ציפוף ימים מיוחד — מוצג רק כשהוגדר ערך מותאם להזמנה */}
          {hoveredOrder.order.customSpacing !== null && hoveredOrder.order.customSpacing !== undefined && (
            <div className={styles.popoverRow}>
              <span><AlertTriangle data-element-name="רכיב_page_67" size={14} /> ציפוף ימים:</span>
              <span style={{ color: '#854d0e', background: '#fef9c3', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                {hoveredOrder.order.customSpacing} {hoveredOrder.order.customSpacing === 1 ? 'יום' : 'ימים'}
              </span>
            </div>
          )}
          <div className={styles.popoverRow}>
            <span><Shirt data-element-name="רכיב_page_21" size={14} /> פריטים בהזמנה:</span>
            <span>{hoveredOrder.order.items?.filter(i => !i.isDeleted).length || 0}</span>
          </div>
          <div className={styles.popoverRow}>
            <span><Shirt data-element-name="רכיב_page_22" size={14} /> הושכר:</span>
            <span>{hoveredOrder.order.items?.filter(i => !i.isDeleted && i.isTaken).length || 0}</span>
          </div>
          <div className={styles.popoverRow}>
            <span><Shirt data-element-name="רכיב_page_23" size={14} /> הוחזר:</span>
            <span>{hoveredOrder.order.items?.filter(i => !i.isDeleted && i.isReturned).length || 0}</span>
          </div>
          <div className={styles.popoverRow}>
            <span><CreditCard data-element-name="רכיב_page_24" size={14} /> סה"כ לתשלום:</span>
            <span>₪{hoveredOrder.order.totalAmount || 0}</span>
          </div>
          <div className={styles.popoverRow}>
            <span><CheckCircle2 data-element-name="רכיב_page_25" size={14} /> שולם:</span>
            <span style={{ color: hoveredOrder.order.totalPaid >= hoveredOrder.order.totalAmount && hoveredOrder.order.totalAmount > 0 ? 'var(--success-color, #10b981)' : (hoveredOrder.order.totalPaid > 0 ? 'var(--warning-color, #f59e0b)' : 'var(--danger-color, #ef4444)'), fontWeight: 'bold' }}>
              ₪{hoveredOrder.order.totalPaid || 0}
            </span>
          </div>
          <div className={styles.popoverRow}>
            <span>סטטוס:</span>
            <span style={{ color: getColorStyles(hoveredOrder.category).color }}>{getCategoryLabel(hoveredOrder.category)}</span>
          </div>
        </div>,
        document.body
      )}

      {showAdvSearch && typeof document !== 'undefined' && createPortal(
        <div data-element-name="לחיץ_page_26" className="modal-overlay" onClick={() => setShowAdvSearch(false)} style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div data-element-name="לחיץ_page_27" className="modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '100%', background: 'var(--card-bg)', borderRadius: '16px', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--divider)', paddingBottom: '1rem' }}>
              <h2 style={{ color: 'var(--primary-color)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Filter data-element-name="רכיב_page_28" size={24} /> חיפוש מתקדם
              </h2>
              <button data-element-name="כפתור_page_29" onClick={() => setShowAdvSearch(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X data-element-name="רכיב_page_30" size={24} />
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>מתאריך אירוע</label>
                <HebrewDatePicker data-element-name="רכיב_page_31" value={advFilters.eventDateFrom} onChange={d => setAdvFilters(p => ({...p, eventDateFrom: d}))} placeholder="מתאריך..." />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>עד תאריך אירוע</label>
                <HebrewDatePicker data-element-name="רכיב_page_32" value={advFilters.eventDateTo} onChange={d => setAdvFilters(p => ({...p, eventDateTo: d}))} placeholder="עד תאריך..." />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>מספר הזמנה</label>
                <div style={{ position: 'relative' }}>
                  <Search data-element-name="רכיב_page_33" size={16} style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input data-element-name="שדה_page_34" data-agy-id="input-adv-order-id" type="text" className="form-control" style={{ width: '100%', padding: '0.6rem 2.5rem 0.6rem 0.6rem', borderRadius: '8px', border: '1px solid var(--element-border)', background: 'var(--input-bg)', color: 'var(--text-main)' }} value={advFilters.advOrderId} onChange={e => setAdvFilters(p => ({...p, advOrderId: e.target.value}))} placeholder="חפש לפי מספר..." />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>ברקוד/פרטי פריט</label>
                <div style={{ position: 'relative' }}>
                  <Shirt data-element-name="רכיב_page_35" size={16} style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input data-element-name="שדה_page_36" type="text" className="form-control" style={{ width: '100%', padding: '0.6rem 2.5rem 0.6rem 0.6rem', borderRadius: '8px', border: '1px solid var(--element-border)', background: 'var(--input-bg)', color: 'var(--text-main)' }} value={advFilters.itemDetails} onChange={e => setAdvFilters(p => ({...p, itemDetails: e.target.value}))} placeholder="ברקוד או תיאור..." />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>שם לקוח</label>
                <input data-element-name="שדה_page_37" type="text" className="form-control" style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--element-border)', background: 'var(--input-bg)', color: 'var(--text-main)' }} value={advFilters.customerName} onChange={e => setAdvFilters(p => ({...p, customerName: e.target.value}))} placeholder="שם הלקוח..." />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>טלפון לקוח</label>
                <input data-element-name="שדה_page_38" type="text" className="form-control" style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--element-border)', background: 'var(--input-bg)', color: 'var(--text-main)' }} value={advFilters.customerPhone} onChange={e => setAdvFilters(p => ({...p, customerPhone: e.target.value}))} placeholder="מספר טלפון..." />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>עיר מגורים</label>
                <input data-element-name="שדה_page_39" type="text" className="form-control" style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--element-border)', background: 'var(--input-bg)', color: 'var(--text-main)' }} value={advFilters.customerCity} onChange={e => setAdvFilters(p => ({...p, customerCity: e.target.value}))} placeholder="עיר..." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid var(--divider)', paddingTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button data-element-name="כפתור_page_40" className="btn btn-outline" style={{ padding: '0.6rem 1.5rem', borderRadius: '8px' }} onClick={() => {
                setAdvFilters({ customerName: '', customerPhone: '', customerCity: '', advOrderId: '', itemDetails: '', eventDateFrom: '', eventDateTo: '' });
              }}>נקה הכל</button>
              <button data-element-name="כפתור_page_41" className="btn btn-primary" style={{ padding: '0.6rem 2.5rem', borderRadius: '8px' }} onClick={() => setShowAdvSearch(false)}>החל סינון</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showGlobalSearchModal && typeof document !== 'undefined' && createPortal(
        <div data-element-name="לחיץ_page_42" className="modal-overlay" onClick={() => setShowGlobalSearchModal(false)} style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div data-element-name="לחיץ_page_43" className="modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '100%', background: 'var(--card-bg)', borderRadius: '16px', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--divider)', paddingBottom: '1rem' }}>
              <h2 style={{ color: 'var(--primary-color)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Search data-element-name="רכיב_page_44" size={24} /> תוצאות חיפוש גלובלי
              </h2>
              <button data-element-name="כפתור_page_45" onClick={() => setShowGlobalSearchModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X data-element-name="רכיב_page_46" size={24} />
              </button>
            </div>
            
            <div style={{ overflowY: 'auto', flexGrow: 1, paddingRight: '5px' }}>
              {globalSearchLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  טוען תוצאות...
                </div>
              ) : globalSearchResults && globalSearchResults.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {globalSearchResults.map(order => (
                    <div key={order.orderId} style={{ padding: '1rem', border: '1px solid var(--element-border)', borderRadius: '8px', background: 'var(--input-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s' }}
                         onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary-color)'}
                         onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--element-border)'}>
                      <div>
                        <div style={{ fontWeight: 'bold', marginBottom: '0.25rem', color: 'var(--text-main)' }}>הזמנה #{order.orderId} - {order.customer?.firstName || ''} {order.customer?.lastName || order.customerName || ''}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{order.eventDateHebrew || (order.eventDate ? new Date(order.eventDate).toLocaleDateString('he-IL') : '')}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button data-element-name="כפתור_page_47" 
                          onClick={() => {
                            if (order.eventDate) {
                              setJumpDate(new Date(order.eventDate));
                              setShowGlobalSearchModal(false);
                            }
                          }}
                          style={{ background: 'var(--element-bg)', border: 'none', color: 'var(--text-main)', padding: '0.4rem 0.8rem', borderRadius: '24px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          קפוץ לחודש
                        </button>
                        <Link data-element-name="רכיב_page_48" href={`/orders/${order.orderId}`} target="_blank" style={{ textDecoration: 'none' }}>
                          <div style={{ background: 'var(--primary-color)', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '24px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}>
                            צפה בהזמנה
                          </div>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  לא נמצאו תוצאות לחיפוש: "{searchInput}"
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <StatisticsModal data-element-name="רכיב_page_49" 
        isOpen={!!showStatistics} 
        onClose={() => setShowStatistics(false)} 
        pageContext="board"
        position={typeof showStatistics === 'object' ? showStatistics : null}
        contextQuery={aiQueryUsed}
      />

      
      {selectedDayOrders && typeof document !== 'undefined' && createPortal(
        <>
          <div data-element-name="לחיץ_page_50"
            style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9998, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => { setSelectedDayOrders(null); setDayOrdersFilter(''); }}
          >
          <div data-element-name="לחיץ_page_51"
            className="animate-fade-in"
            onClick={e => e.stopPropagation()}
            style={{
              width: '90%',
              maxWidth: '500px', 
              maxHeight: '80vh', 
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--card-bg, white)', 
              borderRadius: '16px', 
              padding: '1.5rem', 
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--element-border, #e2e8f0)'
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--divider, #f1f5f9)', paddingBottom: '0.5rem', flexShrink: 0 }}>
              <h3 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '1.2rem' }}>הזמנות ליום {selectedDayOrders.date.toLocaleDateString('he-IL')} ({selectedDayOrders.hebrewDate})</h3>
              <button data-element-name="כפתור_page_52" onClick={() => { setSelectedDayOrders(null); setDayOrdersFilter(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #64748b)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRadius: '50%' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--element-bg, #f1f5f9)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="סגור">
                <X data-element-name="רכיב_page_53" size={20} strokeWidth={2.5} />
              </button>
            </div>
            
            <div style={{ position: 'relative', width: '100%', marginBottom: '1rem', flexShrink: 0 }}>
               <input data-element-name="שדה_page_54"
                  type="text"
                  placeholder="חיפוש הזמנה ביום זה (שם, טלפון, מספר)..."
                  value={dayOrdersFilter}
                  onChange={(e) => setDayOrdersFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 35px 10px 15px',
                    borderRadius: '20px',
                    border: '1px solid var(--element-border, #e2e8f0)',
                    outline: 'none',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                    transition: 'all 0.3s ease',
                    background: 'var(--input-bg, #f8fafc)'
                  }}
                  onFocus={(e) => { e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)'; e.target.style.borderColor = 'var(--primary-color, #3b82f6)'; e.target.style.background = 'var(--input-focus-bg, #ffffff)'; }}
                  onBlur={(e) => { e.target.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)'; e.target.style.borderColor = 'var(--element-border, #e2e8f0)'; e.target.style.background = 'var(--input-bg, #f8fafc)'; }}
                />
                <Search data-element-name="רכיב_page_55" size={16} color="var(--text-muted, #94a3b8)" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                {dayOrdersFilter && (
                  <button data-element-name="כפתור_page_56"
                    onClick={() => setDayOrdersFilter('')}
                    style={{
                      position: 'absolute',
                      left: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'var(--element-bg, #e2e8f0)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'var(--text-muted, #64748b)',
                      padding: 0
                    }}
                    title="נקה סינון"
                  >
                    <X data-element-name="רכיב_page_57" size={14} strokeWidth={3} />
                  </button>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', paddingRight: '4px' }}>
              {selectedDayOrders.orders.filter(order => {
                  if(!dayOrdersFilter) return true;
                  const lower = dayOrdersFilter.toLowerCase();
                  const name = (order.customerName || `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`).toLowerCase();
                  const phone = (order.customerPhone || '').toLowerCase();
                  const idStr = String(order.orderId);
                  return name.includes(lower) || phone.includes(lower) || idStr.includes(lower);
              }).map(order => renderOrderCard(order))}
            </div>
          </div>
          </div>
        </>,
        document.body
      )}

      {selectedRentalOrderId && (
        <RentalReturnModal data-element-name="רכיב_page_58"
          orderId={selectedRentalOrderId}
          onClose={() => setSelectedRentalOrderId(null)}
          onUpdate={fetchOrdersForMonth}
        />
      )}


      {/* Action Menu Popover */}
      {actionOrder && typeof document !== 'undefined' && createPortal(
        <>
          <div data-element-name="לחיץ_page_59" 
            style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9998 }}
            onClick={() => setActionOrder(null)}
          />
          <div data-element-name="לחיץ_page_60" 
            style={{
              position: 'absolute',
              top: actionPos.top,
              left: actionPos.left,
              zIndex: 9999,
              background: 'var(--card-bg, white)',
              border: '1px solid var(--element-border, #e2e8f0)',
              borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              minWidth: '200px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '0 8px 8px', fontSize: '0.9rem', color: 'var(--text-muted, #64748b)', borderBottom: '1px solid var(--divider, #f1f5f9)', marginBottom: '4px', fontWeight: 'bold' }}>
              הזמנה #{actionOrder.orderId}
            </div>
            <Link data-element-name="רכיב_page_61" 
              href={`/orders/${actionOrder.orderId}`}
              style={{ padding: '10px 12px', textDecoration: 'none', color: 'var(--text-main, #1e293b)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.2s', fontWeight: '500' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--element-bg, #f1f5f9)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <FileText data-element-name="רכיב_page_62" size={18} color="var(--primary-color, #3b82f6)" /> כרטיס הזמנה
            </Link>
            {(actionOrder.customerId || actionOrder.customer?.id) && (
              <Link data-element-name="רכיב_page_63" 
                href={`/customers/${actionOrder.customerId || actionOrder.customer?.id}`}
                style={{ padding: '10px 12px', textDecoration: 'none', color: 'var(--text-main, #1e293b)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.2s', fontWeight: '500' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--element-bg, #f1f5f9)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <User data-element-name="רכיב_page_64" size={18} color="var(--success-color, #10b981)" /> כרטיס לקוח
              </Link>
            )}
            <button data-element-name="כפתור_page_65" 
              onClick={() => {
                setSelectedRentalOrderId(actionOrder.orderId);
                setActionOrder(null);
                if (selectedDayOrders) setSelectedDayOrders(null);
              }}
              style={{ padding: '10px 12px', textDecoration: 'none', color: 'var(--text-main, #1e293b)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.2s', fontWeight: '500', background: 'transparent', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'right', fontSize: '1rem', fontFamily: 'inherit' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--element-bg, #f1f5f9)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Shirt data-element-name="רכיב_page_66" size={18} color="var(--warning-color, #f59e0b)" /> כרטיס השכרה
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
