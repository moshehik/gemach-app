'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { HDate, Sedra, Locale, HebrewCalendar } from '@hebcal/core';
import { getHebrewMonthYear } from '@/lib/hebrewDate';
import HebrewDatePicker from '../../components/HebrewDatePicker';
import StatisticsModal from '../components/StatisticsModal';
import RentalReturnModal from '../../components/orders/RentalReturnModal';
import { cacheNamespace } from '@/app/lib/pageCache';
import { buildBoardMonthParams } from '@/app/lib/prefetchRoutes';

// מטמון SWR משותף — ראה app/lib/pageCache.js
const boardCache = cacheNamespace('board');

// מיפוי קטגוריית סטטוס הזמנה (getOrderCategory למטה) אל מחלקת badge + צבע מסגרת + אייקון
// של מערכת העיצוב "אריג" — לא נוגעים בלוגיקת הקטגוריזציה עצמה, רק בייצוג הוויזואלי שלה.
const CATEGORY_STYLE = {
  empty: { badge: 'badge-danger', border: 'var(--danger)', text: 'var(--danger)', icon: 'i-alert-tri' },
  repairs: { badge: 'badge-primary', border: 'var(--primary)', text: 'var(--primary)', icon: 'i-scissors' },
  unpaid: { badge: 'badge-warning', border: 'var(--warning)', text: 'var(--warning)', icon: 'i-alert-circle' },
  returned: { badge: 'badge-success', border: 'var(--success)', text: 'var(--success)', icon: 'i-check-circle' },
  rented: { badge: 'badge-info', border: 'var(--info)', text: 'var(--info)', icon: 'i-truck' },
  completed: { badge: 'badge-success', border: 'var(--success)', text: 'var(--success)', icon: 'i-wallet' },
  other: { badge: 'badge-neutral', border: 'var(--border-strong)', text: 'var(--text-2)', icon: 'i-more' },
};

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

  // מצב תצוגת סרגל החיפוש (חיפוש רגיל / חכם AI) — מחליף את המצב הפנימי שהיה
  // חבוי בתוך רכיב AISearchBar הישן; ההתנהגות זהה, רק המבנה/הסגנון עברו לעיצוב החדש.
  const [aiInputMode, setAiInputMode] = useState(false);
  const [aiInputText, setAiInputText] = useState('');

  // Tracks the AbortController for the in-flight fetchOrdersForMonth request, so clicking
  // through months quickly cancels the previous (slower) request instead of letting it
  // resolve later and overwrite the orders of the month currently being viewed.
  const activeOrdersRequestRef = useRef(null);

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

    // Cancel whatever request is still in flight before starting a new one.
    if (activeOrdersRequestRef.current) {
      activeOrdersRequestRef.current.abort();
    }
    const controller = new AbortController();
    activeOrdersRequestRef.current = controller;

    try {
      // טווח החודש העברי המוצג (עם באפר שבועיים לכל כיוון) נבנה במודול המשותף,
      // כדי שה-prefetch מדפים אחרים ייצר את אותו מפתח מטמון בדיוק.
      const queryParams = buildBoardMonthParams(selectedDate, { search, advFilters });

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

      const res = await fetch(`/api/orders?${queryParams.toString()}`, { signal: controller.signal });
      const data = await res.json();

      // Update cache
      boardCache.set(cacheKey, data);

      if (data.data) {
        setOrders(data.data);
      } else if (data.orders) {
        setOrders(data.orders);
      }
    } catch (err) {
      if (err.name === 'AbortError') return; // superseded by a newer month's request
      console.error('Failed to fetch orders:', err);
    } finally {
      // Only the still-current request gets to clear the loading flag / ref - a request
      // that was aborted and superseded must not stomp on the newer one's state.
      if (activeOrdersRequestRef.current === controller) {
        setLoading(false);
        activeOrdersRequestRef.current = null;
      }
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
    const meta = CATEGORY_STYLE[category];

    return (
      <div
        key={order.orderId}
        className="card"
        style={{
          padding: '8px 10px',
          cursor: 'pointer',
          position: 'relative',
          ...(isOrderLate ? { border: '2px solid var(--danger)' } : { borderInlineStart: `3px solid ${meta.border}` })
        }}
        title={`סטטוס: ${getCategoryLabel(category)}\nסה"כ: ₪${order.totalAmount}\nשולם: ₪${order.totalPaid}`}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setActionPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
          setActionOrder(order);
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
          <strong style={{ fontSize: '12.5px', color: isOrderLate ? 'var(--danger)' : undefined }}>
            {order.customerName || `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`}
          </strong>
          <span style={{ fontSize: '11px', color: isOrderLate ? 'var(--danger)' : 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: isOrderLate ? 700 : undefined }}>
            {isOrderLate && <svg className="icon" style={{ width: '12px', height: '12px' }}><use href="#i-alert-circle" /></svg>}
            #{order.orderId}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px', gap: '6px' }}>
          {category !== 'other' ? (
            <span className={`badge ${meta.badge}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
              <svg className="icon"><use href={`#${meta.icon}`} /></svg>
              {getCategoryLabel(category)}
            </span>
          ) : <span></span>}

          <button
            type="button"
            className="btn btn-ghost btn-icon-only btn-sm"
            title="פרטים נוספים"
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setPopoverPos({ top: rect.top - 12, left: rect.left + (rect.width / 2) });
              setHoveredOrder({ order, category });
            }}
            onMouseLeave={() => setHoveredOrder(null)}
            onClick={(e) => { e.stopPropagation(); }}
          >
            <svg className="icon" style={{ width: '13px', height: '13px' }}><use href="#i-info" /></svg>
          </button>
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
      <>
        <div className="card card-pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', textAlign: 'center', fontWeight: 700, fontSize: '12.5px', color: 'var(--text-2)', marginBottom: '8px' }}>
          {["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"].map(d => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '8px' }}>
          {weeks.map((week, i) => (
            week.map((day, j) => {
              if (!day) return <div key={`empty-${i}-${j}`} className="card" style={{ minHeight: '130px', background: 'var(--surface-alt)', borderStyle: 'dashed' }}></div>;

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

              let cellStyle = { minHeight: '130px', display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' };
              if (isToday) cellStyle = { ...cellStyle, borderColor: 'var(--primary-solid)', borderWidth: '2px', boxShadow: '0 0 0 1px var(--primary-solid)' };
              if (isLate) cellStyle = { ...cellStyle, borderColor: 'var(--danger)', borderWidth: '2px', boxShadow: '0 0 0 1px var(--danger)' };
              if (isHighlighted) cellStyle = { ...cellStyle, borderColor: 'var(--primary-solid)', borderWidth: '2px', boxShadow: '0 0 0 3px var(--primary-tint-2)' };

              return (
                <div key={j} className="card card-pad" style={cellStyle}>
                  {isLate && (
                    <div style={{
                      position: 'absolute', top: '-10px', insetInlineEnd: '-10px', width: '24px', height: '24px',
                      borderRadius: 'var(--radius-full)', background: 'var(--danger-solid)', color: 'var(--text-on-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px',
                      boxShadow: 'var(--shadow-md)', zIndex: 10
                    }}>!</div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '13px', color: isToday ? 'var(--primary-solid)' : undefined }}>{hebrewDayStr}</strong>
                      {dayOrders.length > 2 && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon-only btn-sm"
                          title="תצוגה מורחבת ליום זה"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDayOrders({
                              date: cellGreg,
                              hebrewDate: hebrewDayStr,
                              orders: dayOrders
                            });
                          }}
                        >
                          <svg className="icon"><use href="#i-expand" /></svg>
                        </button>
                      )}
                    </div>
                    <span className="cell-muted" style={{ fontSize: '11px' }}>{cellGreg.getDate()}/{cellGreg.getMonth() + 1}</span>
                  </div>

                  {(parashaText || holidays.length > 0) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {parashaText && <span className="badge badge-neutral" style={{ fontSize: '10px', alignSelf: 'flex-start' }}>{parashaText}</span>}
                      {holidays.map((h, idx) => (
                        <span key={idx} className="badge badge-neutral" style={{ fontSize: '10px', alignSelf: 'flex-start' }}>{h}</span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexGrow: 1, overflowY: 'auto', maxHeight: '150px', paddingInlineEnd: '4px' }}>
                    {dayOrders.map(order => renderOrderCard(order))}
                  </div>
                </div>
              );
            })
          ))}
        </div>
      </>
    );
  };

  const currentMonthYear = getHebrewMonthYear(selectedDate);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg className="icon"><use href="#i-calendar" /></svg>
            לוח שנה
          </h1>
        </div>
        <div className="page-actions" style={{ alignItems: 'center' }}>
          <button type="button" className="btn btn-secondary btn-icon-only" onClick={() => changeMonth(-1)} title="חודש קודם">
            <svg className="icon"><use href="#i-chevron-end" /></svg>
          </button>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '14.5px', padding: '0 6px' }}>
            {currentMonthYear}
            <HebrewDatePicker value={jumpDate} onChange={setJumpDate} placeholder="קפוץ לתאריך..." iconOnly={true} />
          </span>
          <button type="button" className="btn btn-secondary btn-icon-only" onClick={() => changeMonth(1)} title="חודש הבא">
            <svg className="icon"><use href="#i-chevron-start" /></svg>
          </button>
        </div>
      </div>

      {/* סרגל חיפוש: חיפוש רגיל + מעבר לחיפוש חכם (AI) + שאלות סטטיסטיקה + חיפוש גלובלי (כל החודשים) + חיפוש מתקדם */}
      <div className="toolbar">
        {aiInputMode ? (
          <form onSubmit={handleAiInputSubmit} className="search-toolbar" style={{ flex: 1, minWidth: '260px', maxWidth: '420px' }}>
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
          <form onSubmit={handleSearch} className="search-toolbar" style={{ flex: 1, minWidth: '260px', maxWidth: '420px' }}>
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
        <span className="spacer"></span>
        <button type="button" className="btn btn-secondary btn-icon-only" title="חיפוש בכל החודשים (גלובלי)" onClick={handleGlobalSearch}>
          <svg className="icon"><use href="#i-search" /></svg>
        </button>
        <button type="button" className="btn btn-secondary btn-icon-only" title="חיפוש מתקדם" onClick={() => setShowAdvSearch(true)}>
          <svg className="icon"><use href="#i-list" /></svg>
        </button>
      </div>

      {/* מקרא צבעים: כל קטגוריית סטטוס של הזמנה בתא היום */}
      <div className="toolbar" style={{ marginBottom: '20px', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '13px', color: 'var(--text)' }}>מקרא:</strong>
        {['repairs', 'unpaid', 'rented', 'returned', 'completed', 'other'].map(cat => {
          const meta = CATEGORY_STYLE[cat];
          return (
            <span key={cat} className={`badge ${meta.badge}`}>
              <svg className="icon"><use href={`#${meta.icon}`} /></svg>
              {getCategoryLabel(cat)}
            </span>
          );
        })}
      </div>

      {loading ? (
        <div className="page-loading">
          <span className="spinner lg" />
          טוען נתונים...
        </div>
      ) : (
        renderCalendar()
      )}

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
            zIndex: 10000,
            pointerEvents: 'none'
          }}
        >
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '12.5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '14px', color: 'var(--primary-solid)', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '2px' }}>
              <svg className="icon"><use href="#i-info" /></svg>
              פרטים על הזמנה #{hoveredOrder.order.orderId}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
              <span style={{ color: 'var(--text-2)' }}>לקוח:</span>
              <span style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <svg className="icon" style={{ width: '12px', height: '12px' }}><use href="#i-phone" /></svg>
                טלפון:
              </span>
              <span dir="ltr">{hoveredOrder.order.customerPhone || 'לא הוזן'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
              <span style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <svg className="icon" style={{ width: '12px', height: '12px' }}><use href="#i-calendar" /></svg>
                תאריך עברי:
              </span>
              <span>{hoveredOrder.order.eventDateHebrew || 'לא צוין'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
              <span style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <svg className="icon" style={{ width: '12px', height: '12px' }}><use href="#i-calendar" /></svg>
                תאריך לועזי:
              </span>
              <span>{hoveredOrder.order.eventDate ? new Date(hoveredOrder.order.eventDate).toLocaleDateString('he-IL') : 'לא צוין'}</span>
            </div>

            {/* ציפוף ימים מיוחד — מוצג רק כשהוגדר ערך מותאם להזמנה */}
            {hoveredOrder.order.customSpacing !== null && hoveredOrder.order.customSpacing !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                <span style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg className="icon" style={{ width: '12px', height: '12px' }}><use href="#i-clock" /></svg>
                  ציפוף ימים:
                </span>
                <span className="badge badge-warning">
                  {hoveredOrder.order.customSpacing} {hoveredOrder.order.customSpacing === 1 ? 'יום' : 'ימים'}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
              <span style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <svg className="icon" style={{ width: '12px', height: '12px' }}><use href="#i-bag" /></svg>
                פריטים בהזמנה:
              </span>
              <span>{hoveredOrder.order.items?.filter(i => !i.isDeleted).length || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
              <span style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <svg className="icon" style={{ width: '12px', height: '12px' }}><use href="#i-bag" /></svg>
                הושכר:
              </span>
              <span>{hoveredOrder.order.items?.filter(i => !i.isDeleted && i.isTaken).length || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
              <span style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <svg className="icon" style={{ width: '12px', height: '12px' }}><use href="#i-bag" /></svg>
                הוחזר:
              </span>
              <span>{hoveredOrder.order.items?.filter(i => !i.isDeleted && i.isReturned).length || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
              <span style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <svg className="icon" style={{ width: '12px', height: '12px' }}><use href="#i-card" /></svg>
                סה&quot;כ לתשלום:
              </span>
              <span>₪{hoveredOrder.order.totalAmount || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
              <span style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <svg className="icon" style={{ width: '12px', height: '12px' }}><use href="#i-check-circle" /></svg>
                שולם:
              </span>
              <span style={{ color: hoveredOrder.order.totalPaid >= hoveredOrder.order.totalAmount && hoveredOrder.order.totalAmount > 0 ? 'var(--success)' : (hoveredOrder.order.totalPaid > 0 ? 'var(--warning)' : 'var(--danger)'), fontWeight: 'bold' }}>
                ₪{hoveredOrder.order.totalPaid || 0}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
              <span style={{ color: 'var(--text-2)' }}>סטטוס:</span>
              <span style={{ color: CATEGORY_STYLE[hoveredOrder.category]?.text }}>{getCategoryLabel(hoveredOrder.category)}</span>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showAdvSearch && typeof document !== 'undefined' && createPortal(
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowAdvSearch(false)}>
          <div className="modal" style={{ maxWidth: '640px', width: '100%', margin: 0 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <strong>
                <svg className="icon"><use href="#i-list" /></svg>
                חיפוש מתקדם
              </strong>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="סגירה" onClick={() => setShowAdvSearch(false)}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="field">
                  <label>מתאריך אירוע</label>
                  <HebrewDatePicker value={advFilters.eventDateFrom} onChange={d => setAdvFilters(p => ({...p, eventDateFrom: d}))} placeholder="מתאריך..." />
                </div>
                <div className="field">
                  <label>עד תאריך אירוע</label>
                  <HebrewDatePicker value={advFilters.eventDateTo} onChange={d => setAdvFilters(p => ({...p, eventDateTo: d}))} placeholder="עד תאריך..." />
                </div>
                <div className="field">
                  <label>מספר הזמנה</label>
                  <div className="input-icon-wrap">
                    <svg className="icon"><use href="#i-search" /></svg>
                    <input type="text" className="input" value={advFilters.advOrderId} onChange={e => setAdvFilters(p => ({...p, advOrderId: e.target.value}))} placeholder="חפש לפי מספר..." />
                  </div>
                </div>
                <div className="field">
                  <label>ברקוד/פרטי פריט</label>
                  <div className="input-icon-wrap">
                    <svg className="icon"><use href="#i-bag" /></svg>
                    <input type="text" className="input" value={advFilters.itemDetails} onChange={e => setAdvFilters(p => ({...p, itemDetails: e.target.value}))} placeholder="ברקוד או תיאור..." />
                  </div>
                </div>
                <div className="field">
                  <label>שם לקוח</label>
                  <input type="text" className="input" value={advFilters.customerName} onChange={e => setAdvFilters(p => ({...p, customerName: e.target.value}))} placeholder="שם הלקוח..." />
                </div>
                <div className="field">
                  <label>טלפון לקוח</label>
                  <input type="text" className="input" value={advFilters.customerPhone} onChange={e => setAdvFilters(p => ({...p, customerPhone: e.target.value}))} placeholder="מספר טלפון..." />
                </div>
                <div className="field">
                  <label>עיר מגורים</label>
                  <div className="input-icon-wrap">
                    <svg className="icon"><use href="#i-pin" /></svg>
                    <input type="text" className="input" value={advFilters.customerCity} onChange={e => setAdvFilters(p => ({...p, customerCity: e.target.value}))} placeholder="עיר..." />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => {
                setAdvFilters({ customerName: '', customerPhone: '', customerCity: '', advOrderId: '', itemDetails: '', eventDateFrom: '', eventDateTo: '' });
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

      {showGlobalSearchModal && typeof document !== 'undefined' && createPortal(
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowGlobalSearchModal(false)}>
          <div className="modal" style={{ maxWidth: '640px', width: '100%', margin: 0, display: 'flex', flexDirection: 'column', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <strong>
                <svg className="icon"><use href="#i-search" /></svg>
                תוצאות חיפוש גלובלי
              </strong>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="סגירה" onClick={() => setShowGlobalSearchModal(false)}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', flexGrow: 1 }}>
              {globalSearchLoading ? (
                <div className="page-loading">
                  <span className="spinner lg" />
                  טוען תוצאות...
                </div>
              ) : globalSearchResults && globalSearchResults.length > 0 ? (
                <div>
                  {globalSearchResults.map(order => (
                    <div key={order.orderId} className="list-card">
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700 }}>הזמנה #{order.orderId} - {order.customer?.firstName || ''} {order.customer?.lastName || order.customerName || ''}</div>
                        <div className="cell-muted" style={{ fontSize: '12px' }}>{order.eventDateHebrew || (order.eventDate ? new Date(order.eventDate).toLocaleDateString('he-IL') : '')}</div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          if (order.eventDate) {
                            setJumpDate(new Date(order.eventDate));
                            setShowGlobalSearchModal(false);
                          }
                        }}
                      >
                        קפוץ לחודש
                      </button>
                      <Link href={`/orders/${order.orderId}`} target="_blank" className="btn btn-primary btn-sm">
                        צפה בהזמנה
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <svg className="icon"><use href="#i-search" /></svg>
                  <p>לא נמצאו תוצאות לחיפוש: &quot;{searchInput}&quot;</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <StatisticsModal
        isOpen={!!showStatistics}
        onClose={() => setShowStatistics(false)}
        pageContext="board"
        position={typeof showStatistics === 'object' ? showStatistics : null}
        contextQuery={aiQueryUsed}
      />

      {selectedDayOrders && typeof document !== 'undefined' && createPortal(
        <div
          className="modal-backdrop"
          style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { setSelectedDayOrders(null); setDayOrdersFilter(''); }}
        >
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '520px', width: '90%', margin: 0, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
          >
            <div className="modal-head">
              <strong>
                <svg className="icon"><use href="#i-calendar" /></svg>
                הזמנות ליום {selectedDayOrders.date.toLocaleDateString('he-IL')} ({selectedDayOrders.hebrewDate})
              </strong>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="סגור" onClick={() => { setSelectedDayOrders(null); setDayOrdersFilter(''); }}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto' }}>
              <div className="input-icon-wrap" style={{ marginBottom: '14px', position: 'relative' }}>
                <svg className="icon"><use href="#i-search" /></svg>
                <input
                  type="text"
                  className="input"
                  placeholder="חיפוש הזמנה ביום זה (שם, טלפון, מספר)..."
                  value={dayOrdersFilter}
                  onChange={(e) => setDayOrdersFilter(e.target.value)}
                  style={dayOrdersFilter ? { paddingInlineEnd: '34px' } : undefined}
                />
                {dayOrdersFilter && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon-only btn-sm"
                    title="נקה סינון"
                    onClick={() => setDayOrdersFilter('')}
                    style={{ position: 'absolute', insetInlineEnd: '2px', top: '50%', transform: 'translateY(-50%)' }}
                  >
                    <svg className="icon"><use href="#i-x" /></svg>
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
        </div>,
        document.body
      )}

      {selectedRentalOrderId && (
        <RentalReturnModal
          orderId={selectedRentalOrderId}
          onClose={() => setSelectedRentalOrderId(null)}
          onUpdate={fetchOrdersForMonth}
        />
      )}

      {/* Action Menu Popover */}
      {actionOrder && typeof document !== 'undefined' && createPortal(
        <>
          <div
            style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9998 }}
            onClick={() => setActionOrder(null)}
          />
          <div
            className="card card-pad"
            style={{
              position: 'absolute',
              top: actionPos.top,
              left: actionPos.left,
              zIndex: 9999,
              boxShadow: 'var(--shadow-lg)',
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              minWidth: '200px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-2)', padding: '0 6px 6px', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
              הזמנה #{actionOrder.orderId}
            </div>
            <Link
              href={`/orders/${actionOrder.orderId}`}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 6px', borderRadius: 'var(--radius-sm)', color: 'var(--text)', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}
            >
              <svg className="icon" style={{ color: 'var(--primary)' }}><use href="#i-file" /></svg>
              כרטיס הזמנה
            </Link>
            {(actionOrder.customerId || actionOrder.customer?.id) && (
              <Link
                href={`/customers/${actionOrder.customerId || actionOrder.customer?.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 6px', borderRadius: 'var(--radius-sm)', color: 'var(--text)', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}
              >
                <svg className="icon" style={{ color: 'var(--success)' }}><use href="#i-user" /></svg>
                כרטיס לקוח
              </Link>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              style={{ justifyContent: 'flex-start', gap: '8px', padding: '8px 6px', fontSize: '13px' }}
              onClick={() => {
                setSelectedRentalOrderId(actionOrder.orderId);
                setActionOrder(null);
                if (selectedDayOrders) setSelectedDayOrders(null);
              }}
            >
              <svg className="icon" style={{ color: 'var(--warning)' }}><use href="#i-box" /></svg>
              כרטיס השכרה
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
