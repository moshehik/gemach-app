'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { HDate, Sedra, Locale, HebrewCalendar } from '@hebcal/core';
import { getHebrewMonthYear } from '@/lib/hebrewDate';
import { ChevronRight, ChevronLeft, Calendar as CalendarIcon, FileText, MapPin, Search, AlertCircle, RefreshCw, Smartphone, List, CheckCircle2, Phone, Calendar as CalendarIcon2, Shirt, CreditCard, Info } from 'lucide-react';
import AISearchBar from '../components/AISearchBar';
import StatisticsModal from '../components/StatisticsModal';
import styles from './board.module.css';

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

  // Search & Filters
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [advFilters, setAdvFilters] = useState({
    customerName: '', customerPhone: '', customerCity: '', 
    advOrderId: '', itemDetails: '', eventDateFrom: '', eventDateTo: ''
  });
  const [showAdvSearch, setShowAdvSearch] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQueryUsed, setAiQueryUsed] = useState('');
  const [isAiModeActive, setIsAiModeActive] = useState(false);

  // Fetch orders for the currently viewed month
  const fetchOrdersForMonth = useCallback(async () => {
    if (isAiModeActive) return;
    
    setLoading(true);
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

      const res = await fetch(`/api/orders?${queryParams.toString()}`);
      const data = await res.json();
      
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
        return { background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b' }; // Red
      case 'repairs':
        return { background: '#fce7f3', border: '1px solid #fbcfe8', color: '#9d174d' }; // Pink/Purple
      case 'unpaid':
        return { background: '#ffedd5', border: '1px solid #fed7aa', color: '#c2410c' }; // Orange
      case 'returned':
        return { background: '#e8f5e9', border: '1px solid #a5d6a7', color: '#2e7d32' }; // Green
      case 'rented':
        return { background: '#e3f2fd', border: '1px solid #90caf9', color: '#1565c0' }; // Blue
      case 'completed':
        return { background: '#dcfce7', border: '1px solid #bbf7d0', color: '#15803d' }; // Green
      default:
        return { background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569' }; // Gray
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
              <div key={j} className={`${styles.dayCell} ${isToday ? styles.today : ''} ${isLate ? styles.lateDay : ''}`}>
                {isLate && <div className={styles.lateIcon}>!</div>}
                <div className={styles.dateHeader}>
                  <div className={styles.hebrewDate}>{hebrewDayStr}</div>
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
                  {dayOrders.map(order => {
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
                      colorStyle.background = '#fee2e2';
                      colorStyle.border = '2px solid #ef4444';
                      colorStyle.color = '#991b1b';
                    }
                    
                    return (
                      <div
                        key={order.orderId} 
                        className={styles.orderCard}
                        style={{ background: colorStyle.background, borderColor: colorStyle.border, color: colorStyle.color, cursor: 'pointer' }}
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
                            {isOrderLate && <AlertCircle size={14} color="#ef4444" />}
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
                              e.stopPropagation(); // prevent opening action menu if they click exactly here
                            }}
                          >
                            <Info size={16} strokeWidth={2.5} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CalendarIcon size={28} />
            לוח שנה
          </h1>
          <div className={styles.navControls}>
            <button className={styles.navBtn} onClick={() => changeMonth(-1)} title="חודש קודם">
              <ChevronRight size={24} />
            </button>
            <div className={styles.monthDisplay}>{currentMonthYear}</div>
            <button className={styles.navBtn} onClick={() => changeMonth(1)} title="חודש הבא">
              <ChevronLeft size={24} />
            </button>
          </div>
        </div>

        <div className={styles.headerBottom}>
          <div className={styles.searchWrapper}>
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
              <AISearchBar 
                placeholder="חיפוש הזמנה (מספר הזמנה, שם לקוח)..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onSearch={handleSearch}
                onClear={handleClearSearch}
                onAiSearch={handleAiSearch}
                onStatistics={() => setShowStatistics(true)}
                loading={aiLoading}
              />
              <button 
                onClick={() => setShowAdvSearch(true)}
                className="btn btn-outline"
                style={{ borderRadius: '50%', width: '45px', height: '45px', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}
                title="חיפוש מתקדם"
              >
                🔍
              </button>
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
            <Info size={18} />
            פרטים על הזמנה #{hoveredOrder.order.orderId}
          </div>
          <div className="global-popoverRow">
            <span>לקוח:</span>
            <span><Phone size={14} /> טלפון:</span>
            <span dir="ltr">{hoveredOrder.order.customerPhone || 'לא הוזן'}</span>
          </div>
          <div className={styles.popoverRow}>
            <span><CalendarIcon2 size={14} /> תאריך עברי:</span>
            <span>{hoveredOrder.order.eventDateHebrew || 'לא צוין'}</span>
          </div>
          <div className={styles.popoverRow}>
            <span><CalendarIcon2 size={14} /> תאריך לועזי:</span>
            <span>{hoveredOrder.order.eventDate ? new Date(hoveredOrder.order.eventDate).toLocaleDateString('he-IL') : 'לא צוין'}</span>
          </div>
          <div className={styles.popoverRow}>
            <span><Shirt size={14} /> הושכר:</span>
            <span>{hoveredOrder.order.items?.filter(i => !i.isDeleted && i.isTaken).length || 0}</span>
          </div>
          <div className={styles.popoverRow}>
            <span><Shirt size={14} /> הוחזר:</span>
            <span>{hoveredOrder.order.items?.filter(i => !i.isDeleted && i.isReturned).length || 0}</span>
          </div>
          <div className={styles.popoverRow}>
            <span><CreditCard size={14} /> סה"כ לתשלום:</span>
            <span>₪{hoveredOrder.order.totalAmount || 0}</span>
          </div>
          <div className={styles.popoverRow}>
            <span><CheckCircle2 size={14} /> שולם:</span>
            <span style={{ color: hoveredOrder.order.totalPaid >= hoveredOrder.order.totalAmount && hoveredOrder.order.totalAmount > 0 ? '#10b981' : (hoveredOrder.order.totalPaid > 0 ? '#f59e0b' : '#ef4444'), fontWeight: 'bold' }}>
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

      {showAdvSearch && (
        <div className="modal-overlay" onClick={() => setShowAdvSearch(false)} style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '100%', background: 'var(--card-bg)', borderRadius: '16px', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <h2 style={{ color: 'var(--primary-color)', marginBottom: '1.5rem' }}>חיפוש מתקדם</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>מספר הזמנה</label>
                <input type="text" className="form-control" value={advFilters.advOrderId} onChange={e => setAdvFilters(p => ({...p, advOrderId: e.target.value}))} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>ברקוד/פרטי פריט</label>
                <input type="text" className="form-control" value={advFilters.itemDetails} onChange={e => setAdvFilters(p => ({...p, itemDetails: e.target.value}))} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>שם לקוח</label>
                <input type="text" className="form-control" value={advFilters.customerName} onChange={e => setAdvFilters(p => ({...p, customerName: e.target.value}))} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>טלפון לקוח</label>
                <input type="text" className="form-control" value={advFilters.customerPhone} onChange={e => setAdvFilters(p => ({...p, customerPhone: e.target.value}))} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>עיר מגורים</label>
                <input type="text" className="form-control" value={advFilters.customerCity} onChange={e => setAdvFilters(p => ({...p, customerCity: e.target.value}))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowAdvSearch(false)}>סגור והחל סינון</button>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => {
                setAdvFilters({ customerName: '', customerPhone: '', customerCity: '', advOrderId: '', itemDetails: '', eventDateFrom: '', eventDateTo: '' });
              }}>נקה הכל</button>
            </div>
          </div>
        </div>
      )}

      <StatisticsModal 
        isOpen={showStatistics} 
        onClose={() => setShowStatistics(false)} 
        pageContext="orders"
        contextQuery={aiQueryUsed}
      />

      {/* Action Menu Popover */}
      {actionOrder && typeof document !== 'undefined' && createPortal(
        <>
          <div 
            style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9998 }}
            onClick={() => setActionOrder(null)}
          />
          <div 
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
            <div style={{ padding: '0 8px 8px', fontSize: '0.9rem', color: '#64748b', borderBottom: '1px solid #f1f5f9', marginBottom: '4px', fontWeight: 'bold' }}>
              הזמנה #{actionOrder.orderId}
            </div>
            <Link 
              href={`/orders/${actionOrder.orderId}`}
              style={{ padding: '10px 12px', textDecoration: 'none', color: '#1e293b', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.2s', fontWeight: '500' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <FileText size={18} color="#3b82f6" /> כרטיס הזמנה
            </Link>
            <Link 
              href={`/rentals?orderId=${actionOrder.orderId}`}
              style={{ padding: '10px 12px', textDecoration: 'none', color: '#1e293b', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.2s', fontWeight: '500' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Shirt size={18} color="#f59e0b" /> כרטיס השכרה
            </Link>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
