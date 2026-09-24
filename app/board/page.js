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
import PrintWizardModal from '../components/PrintWizardModal';
import { cacheNamespace } from '@/app/lib/pageCache';
import { buildBoardMonthParams } from '@/app/lib/prefetchRoutes';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import { V3Page, Btn, Chip, Tag, Tabs, Tip, Dialog, Field, Switch, Icon } from '@/app/v3/ui/components';
import { cx } from '@/app/v3/ui/cx';
import { TipBtn, SearchBar, useOpsDialogs, dlgMode } from '@/components/ops-v3/OpsKit';

// מטמון SWR משותף — ראה app/lib/pageCache.js
const boardCache = cacheNamespace('board');

// בונה משפט חיפוש טבעי מתוך שדות הסינון המתקדם שמולאו בפועל, לשימוש כשמסמנים
// "חפש עם AI על השדות שמולאו" ולוחצים "החל סינון" — נשלח ל-handleAiSearch
// הקיים במקום סינון מילולי (ראה item 32 בפאנץ'-ליסט).
const buildBoardAiPrompt = (f) => {
  const parts = [];
  if (f.advOrderId) parts.push(`מספר הזמנה ${f.advOrderId}`);
  if (f.customerName) parts.push(`של לקוח בשם ${f.customerName}`);
  if (f.customerPhone) parts.push(`עם טלפון ${f.customerPhone}`);
  if (f.customerCity) parts.push(`בעיר ${f.customerCity}`);
  if (f.itemDetails) parts.push(`עם פריט/ברקוד ${f.itemDetails}`);
  if (f.eventDateFrom && f.eventDateTo) parts.push(`בטווח תאריכי אירוע מ-${f.eventDateFrom} עד ${f.eventDateTo}`);
  else if (f.eventDateFrom) parts.push(`מתאריך אירוע ${f.eventDateFrom}`);
  else if (f.eventDateTo) parts.push(`עד תאריך אירוע ${f.eventDateTo}`);
  if (parts.length === 0) return '';
  return `הזמנות ${parts.join(', ')}`;
};

// מיפוי קטגוריית סטטוס הזמנה (getOrderCategory למטה) אל chip (variant) + אייקון + מחלקת פס צבע (ops.css).
// לא נוגעים בלוגיקת הקטגוריזציה עצמה, רק בייצוג הוויזואלי שלה.
const CATEGORY_STYLE = {
  empty: { chip: 'attn', icon: 'alert-tri', cls: 'empty' },
  repairs: { chip: 'info', icon: 'scissors', cls: 'repairs' },
  unpaid: { chip: 'attn', icon: 'alert-circle', cls: 'unpaid' },
  returned: { chip: 'done', icon: 'check-circle', cls: 'returned' },
  rented: { chip: 'gold', icon: 'truck', cls: 'rented' },
  completed: { chip: undefined, icon: 'wallet', cls: 'completed' },
  other: { chip: undefined, icon: 'more', cls: 'other' },
};

export default function BoardPage() {
  const router = useRouter();
  // v3: הודעות במקום alert() (חלונית עם הבנתי)
  const { tell, node: dialogsNode } = useOpsDialogs();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [orders, setOrders] = useState([]);
  // מתחיל כ-true כדי שהרינדור הראשון בכניסה לאתר יציג "טוען נתונים..."
  // במקום לוח ריק שנראה כאילו אין הזמנות, עד שה-fetch הראשון מסתיים.
  const [loading, setLoading] = useState(true);
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
  // לשוניות מודל הסינון המתקדם (item 33) + מצב חיפוש AI על השדות שמולאו (item 32)
  const [advTab, setAdvTab] = useState('basic');
  const [advAiMode, setAdvAiMode] = useState(false);
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
  // הדפסת הזמנות להכנה (בקשה ed6c69bc - המשך לבקשה c5032b47 שדווחה מ-/orders) -
  // אותו PrintWizardModal המשותף, עם defaultReportType שפותח ישר על "פירוט הזמנות
  // להכנה" (ר' app/components/PrintWizardModal.js).
  const [showPrintWizard, setShowPrintWizard] = useState(false);

  const [jumpDate, setJumpDate] = useState(null);
  const [enableAlterations, setEnableAlterations] = useState(true);
  const [hideCustomSpacing, setHideCustomSpacing] = useState(false); // 1 - הסתרת ציפוף ימים (hide_custom_spacing)
  // דיווח לקוח (הגמח הראשי): ר' ההערה הזהה ב-app/orders/page.js - "כריכה" מיותרת
  // שהודלפה מהפיצ'ר שנוסף עבור נווה יעקב, ללא הגדרה שמפרידה בין הגמחים.
  const [enableBatchPrintPrep, setEnableBatchPrintPrep] = useState(false);

  // כשהתיקונים כבויים בהגדרות, קטגוריית "יש תיקונים" לא רלוונטית ללוח הזה - כולל למקרה
  // של הזמנות ישנות שיובאו מ-Access עם ערכי תיקון היסטוריים על אף שהתכונה כבויה כעת
  // (תואם את גיבוי מגדרת_ראשי קוד 24 בגמ"ח הישן - ר' getOrderCategory/מקרא הצבעים למטה).
  useEffect(() => {
    fetchSharedJson('/api/settings', { ttl: TTL.STATIC })
      .then(data => {
        const altSetting = Array.isArray(data) ? data.find(s => s.key === 'enable_alterations') : null;
        if (altSetting && altSetting.value === 'false') {
          setEnableAlterations(false);
        }
        const hideSetting = Array.isArray(data) ? data.find(s => s.key === 'hide_custom_spacing') : null;
        if (hideSetting?.value === 'true') setHideCustomSpacing(true);
        const batchPrintSetting = Array.isArray(data) ? data.find(s => s.key === 'enable_batch_print_prep') : null;
        if (batchPrintSetting?.value === 'true') setEnableBatchPrintPrep(true);
      })
      .catch(console.error);
  }, []);

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
      tell({ title: 'אין מה לחפש', text: 'הקלידו מספר הזמנה או שם לקוח בשורת החיפוש.', icon: 'search' });
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
        body: JSON.stringify({ prompt: query, pageContext: 'board' })
      });
      const result = await res.json();
      if (res.ok) {
        setOrders(result.data || []);
        setIsAiModeActive(true);
        setAiQueryUsed(result.query || '');
      } else {
        tell({ title: 'החיפוש החכם לא הצליח', text: result.error || undefined, icon: 'alert-circle' });
      }
    } catch (e) {
      console.error(e);
      tell({ title: 'אין תקשורת עם השרת', text: 'נסו שוב בעוד רגע.', icon: 'alert-circle' });
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

  // בקשת המשך של ed6c69bc: הדפסה ישירה של פרוט ההזמנות ליום ספציפי בלוח, ליד
  // אייקון התצוגה המורחבת של אותו יום - במקום רק דרך אשף ההדפסה בראש העמוד.
  // אותו נתיב /print/order (עמוד נפרד לכל הזמנה) שכבר משמש את "פירוט הזמנות
  // להכנה" באשף - כאן משתמשים ישירות ברשימת ההזמנות של התא (dayOrders), בלי
  // צורך לפנות שוב ל-API לפי תאריך.
  const printDayOrders = (dayOrders) => {
    if (!dayOrders || dayOrders.length === 0) return;
    const ids = dayOrders.map(o => o.orderId).join(',');
    // f4b54afc (2026-09-14): אותו batch=1 שנוסף ב-PrintWizardModal.handlePrepPrint -
    // בלעדיו, יום עם הזמנה בודדת (למשל יום עם רק הזמנת משלוח אחת) נופל בטעות
    // לעיצוב המלא/הישן במקום עיצוב ה"הדפסה מרוכזת" הקבוע והחסין מפני גלישה לעמוד נוסף.
    window.open(`/print/order?orderId=${ids}&type=order&batch=1`, '_blank');
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
    if (enableAlterations && hasRepairs) return 'repairs';
    if (isUnpaid) return 'unpaid';
    if (isPaidInFull) return 'completed';
    return 'other';
  };

  const getCategoryLabel = (category) => {
    switch (category) {
      case 'empty': return 'הזמנה ריקה';
      case 'repairs': return 'בתיקון';
      case 'unpaid': return 'לא שולמה';
      case 'returned': return 'הוחזרה';
      case 'rented': return 'בהשכרה';
      case 'completed': return 'שולמה במלואה';
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
        className={cx('ops-ord', `ops-ord--${meta.cls}`, isOrderLate && 'ops-ord--late')}
        title={`מצב: ${getCategoryLabel(category)}\nלתשלום: ₪${order.totalAmount}\nשולם: ₪${order.totalPaid}`}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setActionPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
          setActionOrder(order);
        }}
      >
        <span className="ops-ord__name">
          {order.customerName || `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`}
        </span>
        <span className="ops-ord__id">
          {isOrderLate && <Icon name="alert-circle" size="xs" title="באיחור" />}
          <bdi>#{order.orderId}</bdi>
        </span>
        <div className="ops-ord__foot">
          {category !== 'other' ? (
            <Chip variant={meta.chip} icon={meta.icon}>{getCategoryLabel(category)}</Chip>
          ) : <span></span>}

          <button
            type="button"
            className="v3-btn v3-btn--quiet v3-btn--icon v3-btn--sm"
            aria-label="פרטים נוספים"
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setPopoverPos({ top: rect.top - 12, left: rect.left + (rect.width / 2) });
              setHoveredOrder({ order, category });
            }}
            onMouseLeave={() => setHoveredOrder(null)}
            onClick={(e) => { e.stopPropagation(); }}
          >
            <Icon name="info" />
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
        <div className="ops-dow">
          {["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"].map(d => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="ops-grid">
          {weeks.map((week, i) => (
            week.map((day, j) => {
              if (!day) return <div key={`empty-${i}-${j}`} className="ops-day ops-day--empty"></div>;

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
                <div key={j} className={cx('ops-day', isToday && 'ops-day--today', isLate && 'ops-day--late', isHighlighted && 'ops-day--hl')}>
                  {isLate && <span className="ops-day__late" role="img" aria-label="יש בתא הזמנות באיחור">!</span>}
                  <div className="ops-day__head">
                    <strong className="ops-day__num">{hebrewDayStr}</strong>
                    <span className="ops-muted ops-day__greg"><bdi>{cellGreg.getDate()}/{cellGreg.getMonth() + 1}</bdi></span>
                  </div>
                  {(dayOrders.length > 0) && (
                    <div className="ops-day__tools">
                      <span className="ops-day__count" title="מספר הזמנות ליום זה"><bdi>{dayOrders.length}</bdi> הזמנות</span>
                      {dayOrders.length > 2 && (
                        <button
                          type="button"
                          className="v3-btn v3-btn--quiet v3-btn--icon v3-btn--sm"
                          aria-label="תצוגה מורחבת של היום"
                          title="תצוגה מורחבת של היום"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDayOrders({
                              date: cellGreg,
                              hebrewDate: hebrewDayStr,
                              orders: dayOrders
                            });
                          }}
                        >
                          <Icon name="expand" />
                        </button>
                      )}
                      {enableBatchPrintPrep && (
                        <button
                          type="button"
                          className="v3-btn v3-btn--quiet v3-btn--icon v3-btn--sm"
                          aria-label="הדפסת הזמנות היום"
                          title="הדפסת הזמנות היום"
                          onClick={(e) => {
                            e.stopPropagation();
                            printDayOrders(dayOrders);
                          }}
                        >
                          <Icon name="printer" />
                        </button>
                      )}
                    </div>
                  )}

                  {(parashaText || holidays.length > 0) && (
                    <div className="ops-day__tags">
                      {parashaText && <Chip>{parashaText}</Chip>}
                      {holidays.map((h, idx) => (
                        <Chip key={idx}>{h}</Chip>
                      ))}
                    </div>
                  )}

                  <div className="ops-day__list">
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

  const paidClass = (o) => (o.totalPaid >= o.totalAmount && o.totalAmount > 0 ? 'ops-paid--full' : (o.totalPaid > 0 ? 'ops-paid--part' : 'ops-paid--none'));
  const advTabs = [
    { key: 'basic', label: 'תאריך והזמנה', icon: 'calendar' },
    { key: 'details', label: 'פרטי לקוח', icon: 'user' },
  ];
  const legendCats = enableAlterations ? ['repairs', 'unpaid', 'rented', 'returned', 'completed', 'other'] : ['unpaid', 'rented', 'returned', 'completed', 'other'];
  const closeDayOrders = () => { setSelectedDayOrders(null); setDayOrdersFilter(''); };

  return (
    <V3Page>
      {dialogsNode}

      <div className="v3-pagehead ops-head">
        <div className="v3-pagehead__title ops-head__title">
          <h1 className="v3-h1"><Icon name="calendar" />לוח שנה</h1>
        </div>
        <div className="v3-pagehead__tools">
          <TipBtn icon="chevron-end" label="החודש הקודם" onClick={() => changeMonth(-1)} />
          <span className="ops-month">
            <bdi>{currentMonthYear}</bdi>
            <HebrewDatePicker value={jumpDate} onChange={setJumpDate} placeholder="קפיצה לתאריך" iconOnly={true} />
          </span>
          <TipBtn icon="chevron-start" label="החודש הבא" onClick={() => changeMonth(1)} />
          {enableBatchPrintPrep && (
            <TipBtn icon="printer" label="הדפסת הזמנות להכנה" onClick={() => setShowPrintWizard(true)} />
          )}
        </div>
      </div>

      {/* סרגל חיפוש: חיפוש רגיל + מעבר לחיפוש חכם (AI) + שאלות סטטיסטיקה + חיפוש גלובלי (כל החודשים) + חיפוש מתקדם */}
      <div className="ops-toolbar ops-toolbar--center">
        <SearchBar
          className="ops-search--max"
          aiInputMode={aiInputMode}
          aiLoading={aiLoading}
          aiInputText={aiInputText}
          setAiInputText={setAiInputText}
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          onSubmit={handleSearch}
          onSubmitAi={handleAiInputSubmit}
          onClear={handleClearSearch}
          onToggleAi={toggleAiInputMode}
          onStats={(e) => setShowStatistics({ x: e.clientX, y: e.clientY })}
          placeholder="מספר הזמנה או שם לקוח"
          placeholderAi="למשל: הזמנות של משפחת שיינועטר"
        />
        <TipBtn icon="search" label="חיפוש בכל החודשים" onClick={handleGlobalSearch} />
        <TipBtn icon="list" label="חיפוש מתקדם" onClick={() => setShowAdvSearch(true)} />
      </div>

      {/* מקרא: כל מצב הזמנה בלוח */}
      <div className="ops-toolbar ops-toolbar--center ops-legend">
        <span className="ops-strong">מצבי הזמנה <Tip>הפס בצד כל הזמנה מסמן את מצבה. הזמנה באיחור מקבלת מסגרת מודגשת, וביום שלה מופיע סימן קריאה. &quot;בהשכרה&quot; כולל גם השכרה חלקית.</Tip></span>
        {legendCats.map(cat => {
          const meta = CATEGORY_STYLE[cat];
          return (
            <Chip key={cat} variant={meta.chip} icon={meta.icon}>{getCategoryLabel(cat)}</Chip>
          );
        })}
      </div>

      {loading ? (
        <div className="v3-empty" role="status">
          <span className="v3-spin" aria-hidden="true" />
          <span>טוען…</span>
        </div>
      ) : (
        renderCalendar()
      )}

      {hoveredOrder && typeof document !== 'undefined' && createPortal(
        <div data-v3="" dir="rtl" className="ops-pop" style={{ top: popoverPos.top, left: popoverPos.left }}>
          <div className="ops-pop__h">
            <Icon name="info" anim={false} />
            הזמנה <bdi>#{hoveredOrder.order.orderId}</bdi>
          </div>
          <div className="ops-kv">
            <span className="ops-kv__l">לקוח</span>
          </div>
          <div className="ops-kv">
            <span className="ops-kv__l"><Icon name="phone" size="xs" anim={false} />טלפון</span>
            <span className="ops-ltr">{hoveredOrder.order.customerPhone || 'לא הוזן'}</span>
          </div>
          <div className="ops-kv">
            <span className="ops-kv__l"><Icon name="calendar" size="xs" anim={false} />תאריך עברי</span>
            <span>{hoveredOrder.order.eventDateHebrew || 'לא צוין'}</span>
          </div>
          <div className="ops-kv">
            <span className="ops-kv__l"><Icon name="calendar" size="xs" anim={false} />תאריך לועזי</span>
            <bdi>{hoveredOrder.order.eventDate ? new Date(hoveredOrder.order.eventDate).toLocaleDateString('he-IL') : 'לא צוין'}</bdi>
          </div>

          {/* ציפוף ימים מיוחד — מוצג רק כשהוגדר ערך מותאם להזמנה, ומוסתר כש-hide_custom_spacing מופעל (בקשה 1) */}
          {!hideCustomSpacing && hoveredOrder.order.customSpacing !== null && hoveredOrder.order.customSpacing !== undefined && (
            <div className="ops-kv">
              <span className="ops-kv__l"><Icon name="clock" size="xs" anim={false} />ציפוף</span>
              <Tag variant="attn">
                <bdi>{hoveredOrder.order.customSpacing}</bdi> {hoveredOrder.order.customSpacing === 1 ? 'יום' : 'ימים'}
              </Tag>
            </div>
          )}
          <div className="ops-kv">
            <span className="ops-kv__l"><Icon name="bag" size="xs" anim={false} />פריטים</span>
            <bdi>{hoveredOrder.order.items?.filter(i => !i.isDeleted).length || 0}</bdi>
          </div>
          <div className="ops-kv">
            <span className="ops-kv__l"><Icon name="bag" size="xs" anim={false} />הושכרו</span>
            <bdi>{hoveredOrder.order.items?.filter(i => !i.isDeleted && i.isTaken).length || 0}</bdi>
          </div>
          <div className="ops-kv">
            <span className="ops-kv__l"><Icon name="bag" size="xs" anim={false} />הוחזרו</span>
            <bdi>{hoveredOrder.order.items?.filter(i => !i.isDeleted && i.isReturned).length || 0}</bdi>
          </div>
          <div className="ops-kv">
            <span className="ops-kv__l"><Icon name="card" size="xs" anim={false} />לתשלום</span>
            <bdi>₪{hoveredOrder.order.totalAmount || 0}</bdi>
          </div>
          <div className="ops-kv">
            <span className="ops-kv__l"><Icon name="check-circle" size="xs" anim={false} />שולם</span>
            <bdi className={cx('ops-paid', paidClass(hoveredOrder.order))}>₪{hoveredOrder.order.totalPaid || 0}</bdi>
          </div>
          <div className="ops-kv">
            <span className="ops-kv__l">מצב</span>
            <span className="ops-strong">{getCategoryLabel(hoveredOrder.category)}</span>
          </div>
        </div>,
        document.body
      )}

      {/* חיפוש מתקדם — חלונית עם שדות הזנה ← בהיר בלבד */}
      <Dialog
        open={showAdvSearch}
        onClose={() => setShowAdvSearch(false)}
        variant="form"
        icon="list"
        title="חיפוש מתקדם"
        actions={
          <>
            <Btn variant="primary" icon="check" onClick={() => {
              if (advAiMode) {
                const prompt = buildBoardAiPrompt(advFilters);
                setShowAdvSearch(false);
                if (prompt) handleAiSearch(prompt);
              } else {
                setShowAdvSearch(false);
              }
            }}>
              החלת הסינון
            </Btn>
            <Btn variant="secondary" onClick={() => {
              setAdvFilters({ customerName: '', customerPhone: '', customerCity: '', advOrderId: '', itemDetails: '', eventDateFrom: '', eventDateTo: '' });
            }}>ניקוי כל השדות</Btn>
          </>
        }
      >
        {/* פיצול השדות הקיימים לשתי לשוניות (item 33): תאריך אירוע + זיהוי הזמנה/פריט מול פרטי לקוח */}
        <Tabs label="קבוצות שדות" items={advTabs} value={advTab} onChange={setAdvTab} />

        <div className="ops-form-grid">
          {advTab === 'basic' && (
            <>
              <div className="v3-field">
                <span className="v3-label">מתאריך אירוע</span>
                <HebrewDatePicker value={advFilters.eventDateFrom} onChange={d => setAdvFilters(p => ({...p, eventDateFrom: d}))} placeholder="מתאריך" />
              </div>
              <div className="v3-field">
                <span className="v3-label">עד תאריך אירוע</span>
                <HebrewDatePicker value={advFilters.eventDateTo} onChange={d => setAdvFilters(p => ({...p, eventDateTo: d}))} placeholder="עד תאריך" />
              </div>
              <Field label="מספר הזמנה" type="text" value={advFilters.advOrderId} onChange={e => setAdvFilters(p => ({...p, advOrderId: e.target.value}))} placeholder="למשל 1042" />
              <Field label="ברקוד או פרטי פריט" type="text" value={advFilters.itemDetails} onChange={e => setAdvFilters(p => ({...p, itemDetails: e.target.value}))} placeholder="ברקוד או תיאור" />
            </>
          )}

          {advTab === 'details' && (
            <>
              <Field label="שם הלקוח" type="text" value={advFilters.customerName} onChange={e => setAdvFilters(p => ({...p, customerName: e.target.value}))} placeholder="שם פרטי או משפחה" />
              <Field label="טלפון" type="text" value={advFilters.customerPhone} onChange={e => setAdvFilters(p => ({...p, customerPhone: e.target.value}))} placeholder="מספר טלפון" />
              <Field label="עיר" type="text" value={advFilters.customerCity} onChange={e => setAdvFilters(p => ({...p, customerCity: e.target.value}))} placeholder="עיר מגורים" />
            </>
          )}

          {/* AI על השדות שמולאו (item 32) — מוצג משתי הלשוניות, מוסתר לגמרי כשה-AI כבוי ברמת המערכת */}
          <div className="ai-feature-element">
            <Switch
              id="board-adv-ai-mode"
              checked={advAiMode}
              onChange={(v) => setAdvAiMode(v)}
              label="חיפוש חכם לפי השדות שמולאו"
            />
            <Tip>במקום לסנן ישירות, המערכת תנסח שאלה מהשדות שמילאתם ותחפש לפיה.</Tip>
          </div>
        </div>
      </Dialog>

      {/* תוצאות חיפוש גלובלי — צפייה בלבד (ללא קלט): כהה/בהיר לפי ערכת הנושא */}
      <Dialog
        open={showGlobalSearchModal}
        onClose={() => setShowGlobalSearchModal(false)}
        variant="sheet"
        mode={dlgMode()}
        icon="search"
        title="תוצאות בכל החודשים"
        actions={<Btn variant="quiet" onClick={() => setShowGlobalSearchModal(false)}>סגירה</Btn>}
      >
        <div className="v3-dlg-rows ops-modal-list">
          {globalSearchLoading ? (
            <div className="v3-dlg-row" role="status">
              <span className="v3-dlg-row__ico"><Icon name="loader" loop /></span>
              <div className="v3-dlg-row__t">טוען תוצאות…</div>
            </div>
          ) : globalSearchResults && globalSearchResults.length > 0 ? (
            globalSearchResults.map(order => (
              <div key={order.orderId} className="v3-dlg-row ops-res">
                <span className="v3-dlg-row__ico"><Icon name="file" /></span>
                <div className="v3-dlg-row__t">
                  <b>הזמנה <bdi>#{order.orderId}</bdi></b>
                  <div>{order.customer?.firstName || ''} {order.customer?.lastName || order.customerName || ''}</div>
                  <div className="v3-faint">{order.eventDateHebrew || (order.eventDate ? new Date(order.eventDate).toLocaleDateString('he-IL') : '')}</div>
                  <div className="ops-res__acts">
                    <Btn
                      variant="secondary"
                      size="sm"
                      icon="calendar"
                      onClick={() => {
                        if (order.eventDate) {
                          setJumpDate(new Date(order.eventDate));
                          setShowGlobalSearchModal(false);
                        }
                      }}
                    >
                      מעבר לחודש
                    </Btn>
                    <Link href={`/orders/${order.orderId}`} target="_blank" className="v3-btn v3-btn--primary v3-btn--sm">
                      <Icon name="external-link" />
                      <span>פתיחת ההזמנה</span>
                    </Link>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="v3-dlg-row">
              <span className="v3-dlg-row__ico"><Icon name="search" /></span>
              <div className="v3-dlg-row__t">לא נמצאו תוצאות עבור &quot;{searchInput}&quot;</div>
            </div>
          )}
        </div>
      </Dialog>

      <StatisticsModal
        isOpen={!!showStatistics}
        onClose={() => setShowStatistics(false)}
        pageContext="board"
        position={typeof showStatistics === 'object' ? showStatistics : null}
        contextQuery={aiQueryUsed}
      />

      {/* הזמנות ליום — יש בה שדה סינון ← בהיר בלבד */}
      <Dialog
        open={!!selectedDayOrders}
        onClose={closeDayOrders}
        variant="form"
        icon="calendar"
        title={selectedDayOrders ? `הזמנות ליום ${selectedDayOrders.date.toLocaleDateString('he-IL')}` : undefined}
        sub={selectedDayOrders ? selectedDayOrders.hebrewDate : undefined}
        actions={
          <>
            {enableBatchPrintPrep && selectedDayOrders && (
              <Btn variant="secondary" icon="printer" onClick={() => printDayOrders(selectedDayOrders.orders)}>הדפסת ההזמנות</Btn>
            )}
            <Btn variant="quiet" onClick={closeDayOrders}>סגירה</Btn>
          </>
        }
      >
        <div className="v3-search">
          <Icon name="search" />
          <input
            type="text"
            aria-label="חיפוש בתוך היום"
            placeholder="שם, טלפון או מספר הזמנה"
            value={dayOrdersFilter}
            onChange={(e) => setDayOrdersFilter(e.target.value)}
          />
          <button
            type="button"
            className={cx('v3-search__clear', dayOrdersFilter && 'is-on')}
            aria-label="ניקוי הסינון"
            tabIndex={dayOrdersFilter ? 0 : -1}
            onClick={() => setDayOrdersFilter('')}
          >
            <Icon name="x" size="sm" />
          </button>
        </div>

        <div className="ops-modal-list">
          {selectedDayOrders && selectedDayOrders.orders.filter(order => {
              if(!dayOrdersFilter) return true;
              const lower = dayOrdersFilter.toLowerCase();
              const name = (order.customerName || `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`).toLowerCase();
              const phone = (order.customerPhone || '').toLowerCase();
              const idStr = String(order.orderId);
              return name.includes(lower) || phone.includes(lower) || idStr.includes(lower);
          }).map(order => renderOrderCard(order))}
        </div>
      </Dialog>

      {selectedRentalOrderId && (
        <RentalReturnModal
          orderId={selectedRentalOrderId}
          onClose={() => setSelectedRentalOrderId(null)}
          onUpdate={fetchOrdersForMonth}
        />
      )}

      {showPrintWizard && (
        <PrintWizardModal
          onClose={() => setShowPrintWizard(false)}
          defaultReportType={enableBatchPrintPrep ? 'order_prep_by_date' : undefined}
          enableBatchPrintPrep={enableBatchPrintPrep}
        />
      )}

      {/* תפריט פעולות להזמנה — מעוגן ליד הכרטיס (מיקום לפי הכרטיס שנלחץ), נסגר בלחיצה בחוץ */}
      {actionOrder && typeof document !== 'undefined' && createPortal(
        <>
          <div data-v3="" className="ops-overlay" onClick={() => setActionOrder(null)} />
          <div
            data-v3=""
            dir="rtl"
            className="v3-menu is-open ops-menu"
            style={{ top: actionPos.top, left: actionPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ops-menu__h">הזמנה <bdi>#{actionOrder.orderId}</bdi></div>
            <Link href={`/orders/${actionOrder.orderId}`} className="v3-menu__item">
              <Icon name="file" />
              כרטיס הזמנה
            </Link>
            {(actionOrder.customerId || actionOrder.customer?.id) && (
              <Link href={`/customers/${actionOrder.customerId || actionOrder.customer?.id}`} className="v3-menu__item">
                <Icon name="user" />
                כרטיס לקוח
              </Link>
            )}
            <button
              type="button"
              className="v3-menu__item"
              onClick={() => {
                setSelectedRentalOrderId(actionOrder.orderId);
                setActionOrder(null);
                if (selectedDayOrders) setSelectedDayOrders(null);
              }}
            >
              <Icon name="box" />
              כרטיס השכרה
            </button>
          </div>
        </>,
        document.body
      )}
    </V3Page>
  );
}
