'use client';

import { useState, useEffect, Fragment } from 'react';
import { createPortal } from 'react-dom';
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

export default function RentalsPage() {
  const { getLabel } = useLabels();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [viewMode, setViewMode] = useState('all'); // 'all', 'rented', 'rented_partial', 'returned', 'returned_partial'

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
  const [sort, setSort] = useState('eventDateSmart');
  const [order, setOrder] = useState('desc');

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
      return <svg className="icon" style={{ opacity: 1, color: 'var(--primary-solid)' }}><use href="#i-chevron-down" /></svg>;
    }
    if (sort !== column) {
      return <svg className="icon"><use href="#i-sort" /></svg>;
    }
    return (
      <svg className="icon" style={{ opacity: 1, color: 'var(--primary-solid)', transform: order === 'desc' ? 'rotate(180deg)' : 'none' }}>
        <use href="#i-chevron-down" />
      </svg>
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
        setOrders(result.data || []);
        setTotalCount(result.data?.length || 0);
        setTotalPages(1);
        setPage(1);
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
      const res = await fetch('/api/returns/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: cleanBarcode })
      });
      const data = await res.json();

      if (res.ok) {
        setQuickStatus('success');
        setQuickBarcode('');
        // Open the order that was just returned
        setSelectedOrderId(data.orderId);
      } else {
        setQuickStatus('error');
        alert(data.error);
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

  return (
    <>
      <div className="page-head">
        <div>
          <h1>השכרות והחזרות</h1>
          <div className="page-desc">סה&quot;כ רשומות: {loading ? '...' : totalCount}</div>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-secondary btn-icon-only" title="חיפוש מתקדם" onClick={() => setShowAdvSearch(true)}>
            <svg className="icon"><use href="#i-list" /></svg>
          </button>
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

      {/* סרגל חיפוש: חיפוש חופשי (הזמנה/לקוח/דגם) + מעבר לחיפוש חכם (AI) + שאלות סטטיסטיקה, במסגרת אחת */}
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
          <form
            onSubmit={(e) => { e.preventDefault(); if (isAiModeActive) setIsAiModeActive(false); }}
            className="search-toolbar"
          >
            <svg className="icon"><use href="#i-search" /></svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש חופשי (הזמנה, לקוח, דגם)..."
            />
            <div className="search-toolbar-actions">
              {search && (
                <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="נקה חיפוש" onClick={handleClearSearch}>
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

      {/* סינון סטטוס: הכפתור הפעיל קובע אילו הזמנות מוצגות בטבלה (viewMode) */}
      <div className="pill-tabs" style={{ marginBottom: '20px' }}>
        <button type="button" onClick={() => setViewMode('all')} className={viewMode === 'all' ? 'pill-tab active' : 'pill-tab'} title="הצג הכל">
          <svg className="icon"><use href="#i-list" /></svg> הכל
        </button>
        <button type="button" onClick={() => setViewMode('rented')} className={viewMode === 'rented' ? 'pill-tab active' : 'pill-tab'} title="הושכר">
          <svg className="icon"><use href="#i-bag" /></svg> הושכר
        </button>
        <button type="button" onClick={() => setViewMode('rented_partial')} className={viewMode === 'rented_partial' ? 'pill-tab active' : 'pill-tab'} title="הושכר חלקי">
          <svg className="icon"><use href="#i-clock" /></svg> הושכר חלקי
        </button>
        <button type="button" onClick={() => setViewMode('returned')} className={viewMode === 'returned' ? 'pill-tab active' : 'pill-tab'} title="הוחזר">
          <svg className="icon"><use href="#i-check" /></svg> הוחזר
        </button>
        <button type="button" onClick={() => setViewMode('returned_partial')} className={viewMode === 'returned_partial' ? 'pill-tab active' : 'pill-tab'} title="הוחזר חלקי">
          <svg className="icon"><use href="#i-refresh" /></svg> הוחזר חלקי
        </button>
      </div>

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

            {/* פיצול השדות הקיימים לשתי לשוניות (item 33): זיהוי הזמנה/פריט/דגם מול פרטי לקוח.
               סגנון הלשוניות מבוסס על app/components/ErrorReportButton.js */}
            <div className="tabs" style={{ margin: '0 22px' }}>
              <button type="button" className={`tab${advTab === 'basic' ? ' active' : ''}`} style={{ background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' }} onClick={() => setAdvTab('basic')}>
                הזמנה ופריט
              </button>
              <button type="button" className={`tab${advTab === 'details' ? ' active' : ''}`} style={{ background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' }} onClick={() => setAdvTab('details')}>
                פרטי לקוח
              </button>
            </div>

            <div className="modal-body">
              {advTab === 'basic' && (
                <div className="form-grid">
                  <div className="field">
                    <label>{getLabel('order_id', 'מספר הזמנה')}</label>
                    <input type="text" className="input" value={advFilters.advOrderId} onChange={e => setAdvFilters(p => ({ ...p, advOrderId: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>ברקוד/פרטי פריט</label>
                    <div className="input-icon-wrap">
                      <svg className="icon"><use href="#i-tag" /></svg>
                      <input type="text" className="input" value={advFilters.itemDetails} onChange={e => setAdvFilters(p => ({ ...p, itemDetails: e.target.value }))} />
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
                </div>
              )}

              {advTab === 'details' && (
                <div className="form-grid">
                  <div className="field">
                    <label>{getLabel('order_customerName', 'שם לקוח')}</label>
                    <input type="text" className="input" value={advFilters.customerName} onChange={e => setAdvFilters(p => ({ ...p, customerName: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>טלפון לקוח</label>
                    <div className="input-icon-wrap">
                      <svg className="icon"><use href="#i-phone" /></svg>
                      <input type="text" className="input" value={advFilters.customerPhone} onChange={e => setAdvFilters(p => ({ ...p, customerPhone: e.target.value }))} />
                    </div>
                  </div>
                  <div className="field">
                    <label>עיר מגורים</label>
                    <div className="input-icon-wrap">
                      <svg className="icon"><use href="#i-pin" /></svg>
                      <input type="text" className="input" value={advFilters.customerCity} onChange={e => setAdvFilters(p => ({ ...p, customerCity: e.target.value }))} />
                    </div>
                  </div>
                </div>
              )}

              {/* AI על השדות שמולאו (item 32) — מוצג משתי הלשוניות, מוסתר לגמרי כשה-AI כבוי ברמת המערכת */}
              <div className="checkbox-row ai-feature-element" style={{ marginTop: '16px' }}>
                <input type="checkbox" id="rentals-adv-ai-mode" checked={advAiMode} onChange={e => setAdvAiMode(e.target.checked)} />
                <label htmlFor="rentals-adv-ai-mode">חפש עם AI על השדות שמולאו</label>
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setAdvFilters(defaultRentalsAdvFilters())}>נקה הכל</button>
              <button type="button" className="btn btn-primary" onClick={() => {
                if (advAiMode) {
                  const prompt = buildRentalsAiPrompt(advFilters);
                  setShowAdvSearch(false);
                  if (prompt) handleAiSearch(prompt);
                } else {
                  setShowAdvSearch(false);
                }
              }}>
                <svg className="icon"><use href="#i-check" /></svg>
                סגור והחל סינון
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th className={sort === 'orderId' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('orderId')}>מספר הזמנה {renderSortIcon('orderId')}</th>
              <th className={sort === 'customerName' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('customerName')}>לקוח {renderSortIcon('customerName')}</th>
              <th className={(sort === 'eventDate' || sort === 'eventDateSmart') ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('eventDate')}>תאריך אירוע {renderSortIcon('eventDate')}</th>
              <th className={sort === 'status' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('status')}>סטטוס {renderSortIcon('status')}</th>
              <th>פריטים (מתוך סה&quot;כ)</th>
              <th>הערות</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6"><div className="loading-inline"><span className="spinner" />טוען נתונים...</div></td>
              </tr>
            ) : orders.map(ord => {
              const statusLabel = calculateOrderStatus(ord);
              const statusColor = STATUS_DOT_COLORS[statusLabel] || 'var(--text-3)';
              const totalItems = ord.items?.filter(i => !i.isDeleted).length || 0;
              const rentedItems = ord.items?.filter(i => i.isTaken && !i.isReturned && !i.isDeleted).length || 0;
              const returnedItems = ord.items?.filter(i => i.isReturned && !i.isDeleted).length || 0;
              const hasCustomSpacing = ord.customSpacing !== null && ord.customSpacing !== undefined;

              let rowStyle = {};
              if (hasCustomSpacing) {
                // כל הפריטים הושכרו
                rowStyle = { background: 'var(--warning-tint)', borderRight: '4px solid var(--warning)' };
              } else if (totalItems > 0) {
                if (rentedItems === totalItems) {
                  rowStyle = { background: 'var(--info-tint)', borderRight: '4px solid var(--info)' };
                } else if (rentedItems > 0) {
                  // חלק מהפריטים הושכרו
                  rowStyle = { background: 'var(--accent-tint)', borderRight: '4px solid var(--accent)' };
                } else if (returnedItems === totalItems) {
                  // כל הפריטים הוחזרו
                  rowStyle = { background: 'var(--success-tint)', borderRight: '4px solid var(--success)' };
                } else if (returnedItems > 0) {
                  // חלק מהפריטים הוחזרו
                  rowStyle = { background: 'var(--danger-tint)', borderRight: '4px solid var(--danger)' };
                }
              }

              return (
                <Fragment key={ord.orderId}>
                  <tr onClick={() => openOrder(ord.orderId)} style={{ cursor: 'pointer', ...rowStyle }}>
                    <td className="cell-primary">
                      #{ord.orderId}
                      {hasCustomSpacing && (
                        <svg className="icon" style={{ color: 'var(--warning)', marginInlineStart: '4px' }} title="מרווח החזרה מותאם אישית להזמנה זו"><use href="#i-alert-tri" /></svg>
                      )}
                    </td>
                    <td>{ord.customerName}</td>
                    <td><strong>{ord.eventDateHebrew || (ord.eventDate ? getHebrewDateString(ord.eventDate) : 'לא צוין תאריך')}</strong></td>
                    <td><span className="dot-badge" style={{ color: statusColor }}>{statusLabel}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <strong>סה&quot;כ: {totalItems}</strong>
                        {rentedItems > 0 && <span className="dot-badge" style={{ color: 'var(--warning)' }}>מושכרים: {rentedItems}</span>}
                        {returnedItems > 0 && <span className="dot-badge" style={{ color: 'var(--success)' }}>הוחזרו: {returnedItems}</span>}
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedOrders(prev => ({ ...prev, [ord.orderId]: !prev[ord.orderId] }));
                          }}
                          title={expandedOrders[ord.orderId] ? 'הסתר רשימה' : 'הצג רשימה'}
                        >
                          <svg className="icon" style={{ transform: expandedOrders[ord.orderId] ? 'rotate(180deg)' : 'none' }}><use href="#i-chevron-down" /></svg>
                          פירוט
                        </button>
                      </div>
                    </td>
                    <td className="cell-muted" style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ord.notes}>
                      {ord.notes || '-'}
                    </td>
                  </tr>
                  {expandedOrders[ord.orderId] && (
                    <tr>
                      <td colSpan="6" style={{ padding: '14px 24px', background: 'var(--surface-alt)' }}>
                        {ord.items && ord.items.filter(i => !i.isDeleted).length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 28px' }}>
                            {ord.items.filter(i => !i.isDeleted).map(item => (
                              <div key={item.id}>
                                <strong style={{ color: 'var(--primary-solid)' }}>{item.description}</strong>
                                {item.barcode && <span className="cell-muted"> ({item.barcode})</span>}
                                <div style={{ marginTop: '4px' }}>
                                  {item.isReturned ? (
                                    <span className="dot-badge" style={{ color: 'var(--success)' }}>הוחזר</span>
                                  ) : item.isTaken ? (
                                    <span className="dot-badge" style={{ color: 'var(--warning)' }}>מושכר</span>
                                  ) : (
                                    <span className="dot-badge" style={{ color: 'var(--text-3)' }}>טרם נלקח</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="cell-muted">אין פריטים פעילים</span>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>

        {/* סיכום הרשומות ועימוד — מוצמד לתחתית הטבלה */}
        <div className="table-foot">
          <span>סה&quot;כ רשומות: {loading ? '...' : totalCount}</span>
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => goToPage(page - 1)} title="עמוד קודם">
                <svg className="icon"><use href="#i-chevron-end" /></svg>
                הקודם
              </button>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label htmlFor="rentalsListPageNum">עמוד</label>
                <input
                  id="rentalsListPageNum"
                  type="number"
                  className="input"
                  min={1}
                  max={totalPages || 1}
                  value={page}
                  onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) goToPage(v); }}
                  style={{ width: '52px', padding: '4px 6px', textAlign: 'center', display: 'inline-block' }}
                />
                מתוך {totalPages}
              </span>
              <button type="button" className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => goToPage(page + 1)} title="עמוד הבא">
                הבא
                <svg className="icon"><use href="#i-chevron-start" /></svg>
              </button>
            </div>
          )}
        </div>
      </div>

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
    </>
  );
}
