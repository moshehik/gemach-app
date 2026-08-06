'use client';

import { useState, useEffect, useRef } from 'react';
import './rentals.css';
import { calculateOrderStatus } from '../../lib/orderStatus';
import { getHebrewDateString } from '../../lib/hebrewDate';
import ExportButtons from '../../components/ExportButtons';
import AISearchBar from '../components/AISearchBar';
import StatisticsModal from '../components/StatisticsModal';
import { useLabels } from '@/app/components/LabelsContext';
import RentalReturnModal from '../../components/orders/RentalReturnModal';
import OrderModelSelector from '../../components/orders/OrderModelSelector';
import { List, ShoppingBag, Clock, CheckCircle, RotateCcw, SlidersHorizontal } from 'lucide-react';
import useDebounce from '@/hooks/useDebounce';
import { cacheNamespace } from '@/app/lib/pageCache';
import { buildRentalsListParams, defaultRentalsAdvFilters } from '@/app/lib/prefetchRoutes';

// שמור על 50 רשומות בטעינה - עקבי עם app/orders/page.js ו-app/refunds/page.js.
const PAGE_SIZE = 50;

// מטמון SWR משותף — ראה app/lib/pageCache.js; בניית ה-query עברה ל-prefetchRoutes.js
// כדי שה-prefetch מדפים אחרים ייצר את אותו מפתח בדיוק.
const rentalsCache = cacheNamespace('rentals');

// צבעי נקודת-הסטטוס בטבלה — עקבי עם הצבעים של כפתורי הסינון (.status-filters) מעל הטבלה.
const STATUS_DOT_COLORS = {
  'הושכר': 'c-amber',
  'הושכר חלקי': 'c-purple',
  'הוחזר': 'c-green',
  'הוחזר חלקי': 'c-teal',
  'מחוק': 'c-red',
  'טיוטה': 'c-gray',
  'עבר': 'c-gray',
  'בקרוב': 'c-blue',
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

  const SortIcon = ({ column }) => {
    // 'eventDateSmart' (ברירת המחדל) מוצג ככיוון "עולה" על עמודת תאריך האירוע,
    // גם שאין ל-sort ערך 'eventDate' ממש - כדי שהעמודה לא תיראה לא-ממוינת.
    if (sort === 'eventDateSmart' && column === 'eventDate') return <span style={{ marginRight: '4px' }}>↑</span>;
    if (sort !== column) return <span style={{ opacity: 0.3, marginRight: '4px' }}>↕</span>;
    return <span style={{ marginRight: '4px' }}>{order === 'asc' ? '↑' : '↓'}</span>;
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

  // Removed old inline modal functions

  return (
    <main data-agy-id="rentals-page-main" className="container rentals-page page-shell">
      <div className="page-scroll">
      <div className="toolbar-row">
        <h1 className="toolbar-title">
          <strong>השכרות והחזרות</strong>
        </h1>

        <AISearchBar data-element-name="רכיב_page_14"
          placeholder="חיפוש חופשי (הזמנה, לקוח, דגם)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onSearch={(e) => { e.preventDefault(); if(isAiModeActive) setIsAiModeActive(false); }}
          onClear={handleClearSearch}
          onAiSearch={handleAiSearch}
          onStatistics={(e) => setShowStatistics({ x: e.clientX, y: e.clientY })}
          loading={aiLoading}
        />

        <div className="status-filters">
          <button data-element-name="כפתור_page_1" data-agy-id="rentals_page_button_1" onClick={() => setViewMode('all')} className={viewMode === 'all' ? 'status-filter active c-blue' : 'status-filter'} title="הצג הכל">
            <List size={16} /> <span>הכל</span>
          </button>

          <button data-element-name="כפתור_page_2" data-agy-id="rentals_page_button_2" onClick={() => setViewMode('rented')} className={viewMode === 'rented' ? 'status-filter active c-amber' : 'status-filter'} title="הושכר">
            <ShoppingBag size={16} /> <span>הושכר</span>
          </button>

          <button data-element-name="כפתור_page_3" data-agy-id="rentals_page_button_3" onClick={() => setViewMode('rented_partial')} className={viewMode === 'rented_partial' ? 'status-filter active c-purple' : 'status-filter'} title="הושכר חלקי">
            <Clock size={16} /> <span>הושכר חלקי</span>
          </button>

          <button data-element-name="כפתור_page_4" data-agy-id="rentals_page_button_4" onClick={() => setViewMode('returned')} className={viewMode === 'returned' ? 'status-filter active c-green' : 'status-filter'} title="הוחזר">
            <CheckCircle size={16} /> <span>הוחזר</span>
          </button>

          <button data-element-name="כפתור_page_5" data-agy-id="rentals_page_button_5" onClick={() => setViewMode('returned_partial')} className={viewMode === 'returned_partial' ? 'status-filter active c-teal' : 'status-filter'} title="הוחזר חלקי">
            <RotateCcw size={16} /> <span>הוחזר חלקי</span>
          </button>
        </div>

        <div className="icon-toolbar">
          <button data-element-name="כפתור_page_15"
            data-agy-id="adv-search-button"
            onClick={() => setShowAdvSearch(true)}
            className="icon-btn"
            title="חיפוש מתקדם"
          >
            <SlidersHorizontal size={19} />
          </button>

          <span className="icon-sep"></span>

          <ExportButtons data-element-name="רכיב_page_16"
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

      {showAdvSearch && (
        <div data-element-name="לחיץ_page_2" className="modal-overlay" onClick={() => setShowAdvSearch(false)} style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div data-element-name="לחיץ_page_3" className="modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '100%', background: 'var(--card-bg)', borderRadius: '16px', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <h2 style={{ color: 'var(--primary-color)', marginBottom: '1.5rem' }}>חיפוש מתקדם</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>{getLabel('order_id', 'מספר הזמנה')}</label>
                <input data-element-name="שדה_page_4" data-agy-id="input-adv-order-id" type="text" className="form-control" value={advFilters.advOrderId} onChange={e => setAdvFilters(p => ({...p, advOrderId: e.target.value}))} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>ברקוד/פרטי פריט</label>
                <input data-element-name="שדה_page_5" data-agy-id="input-adv-item-details" type="text" className="form-control" value={advFilters.itemDetails} onChange={e => setAdvFilters(p => ({...p, itemDetails: e.target.value}))} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>דגם</label>
                <div style={{ position: 'relative' }}>
                  <OrderModelSelector data-element-name="רכיב_page_6" 
                    value={{ name: advFilters.advModelName }} 
                    onChange={m => setAdvFilters(p => ({...p, advModelName: m ? m.name : ''}))} 
                    placeholder="בחר דגם..."
                  />
                  {advFilters.advModelName && (
                    <button data-element-name="כפתור_page_7" 
                      onClick={() => setAdvFilters(p => ({...p, advModelName: ''}))}
                      style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error-color)' }}
                      title="נקה בחירה"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>{getLabel('order_customerName', 'שם לקוח')}</label>
                <input data-element-name="שדה_page_8" data-agy-id="input-adv-customer-name" type="text" className="form-control" value={advFilters.customerName} onChange={e => setAdvFilters(p => ({...p, customerName: e.target.value}))} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>טלפון לקוח</label>
                <input data-element-name="שדה_page_9" data-agy-id="input-adv-customer-phone" type="text" className="form-control" value={advFilters.customerPhone} onChange={e => setAdvFilters(p => ({...p, customerPhone: e.target.value}))} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>עיר מגורים</label>
                <input data-element-name="שדה_page_10" data-agy-id="input-adv-customer-city" type="text" className="form-control" value={advFilters.customerCity} onChange={e => setAdvFilters(p => ({...p, customerCity: e.target.value}))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
              <button data-element-name="כפתור_page_11" className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowAdvSearch(false)}>סגור והחל סינון</button>
              <button data-element-name="כפתור_page_12" className="btn btn-outline" style={{ flex: 1 }} onClick={() => {
                setAdvFilters(defaultRentalsAdvFilters());
              }}>נקה הכל</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ overflow: 'visible', background: 'var(--card-bg)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)' }}>
        <table className="items-table" style={{ margin: 0, minWidth: '800px' }}>
          <thead>
            <tr>
              <th data-element-name="לחיץ_sort_1" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('orderId')}>מספר הזמנה <SortIcon column="orderId" /></th>
              <th data-element-name="לחיץ_sort_2" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('customerName')}>לקוח <SortIcon column="customerName" /></th>
              <th data-element-name="לחיץ_sort_3" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('eventDate')}>תאריך אירוע <SortIcon column="eventDate" /></th>
              <th data-element-name="לחיץ_sort_4" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('status')}>סטטוס <SortIcon column="status" /></th>
              <th>פריטים (מתוך סה"כ)</th>
              <th>הערות</th>
            </tr>
          </thead>
          {loading ? (
            <tbody>
              <tr>
                <td colSpan="6" style={{ padding: '3rem', textAlign: 'center' }}>טוען נתונים...</td>
              </tr>
            </tbody>
          ) : orders.map(order => {
            const statusLabel = calculateOrderStatus(order);
            const statusDotColor = STATUS_DOT_COLORS[statusLabel] || 'c-gray';
            const totalItems = order.items?.filter(i => !i.isDeleted).length || 0;
            const rentedItems = order.items?.filter(i => i.isTaken && !i.isReturned && !i.isDeleted).length || 0;
            const returnedItems = order.items?.filter(i => i.isReturned && !i.isDeleted).length || 0;
            const hasCustomSpacing = order.customSpacing !== null && order.customSpacing !== undefined;

            let rowBg = 'transparent';
            let rowBorder = 'none';
            
            if (hasCustomSpacing) {
              rowBg = '#fef9c3';
              rowBorder = '4px solid #facc15';
            } else if (totalItems > 0) {
              if (rentedItems === totalItems) {
                // כל הפריטים הושכרו
                rowBg = 'rgba(21, 101, 192, 0.08)';
                rowBorder = '4px solid #1565c0';
              } else if (rentedItems > 0) {
                // חלק מהפריטים הושכרו
                rowBg = 'rgba(245, 124, 0, 0.08)';
                rowBorder = '4px solid #f57c00';
              } else if (returnedItems === totalItems) {
                // כל הפריטים הוחזרו
                rowBg = 'rgba(46, 125, 50, 0.08)';
                rowBorder = '4px solid #2e7d32';
              } else if (returnedItems > 0) {
                // חלק מהפריטים הוחזרו
                rowBg = 'rgba(225, 29, 72, 0.08)';
                rowBorder = '4px solid #e11d48';
              }
            }

            return (
              <tbody key={order.orderId}>
                <tr data-element-name="לחיץ_page_17"
                  onClick={() => openOrder(order.orderId)}
                  style={{ cursor: 'pointer', transition: 'background 0.2s', background: rowBg, borderRight: rowBorder }}
                  onMouseEnter={(e) => e.currentTarget.style.background = rowBg !== 'transparent' ? rowBg : 'rgba(212, 175, 55, 0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = rowBg}
                >
                  <td style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>#{order.orderId}</td>
                  <td style={{ fontWeight: '500', fontSize: '1.1rem' }}>{order.customerName}</td>
                  <td>
                    <div><strong>{order.eventDateHebrew || (order.eventDate ? getHebrewDateString(order.eventDate) : 'לא צוין תאריך')}</strong></div>
                  </td>
                  <td>
                    <span className={`status-dot ${statusDotColor}`}>{statusLabel}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 'bold' }}>סה"כ: {totalItems}</span>
                      {rentedItems > 0 && <span className="status-dot c-amber" style={{ fontSize: '0.9em' }}>מושכרים: {rentedItems}</span>}
                      {returnedItems > 0 && <span className="status-dot c-green" style={{ fontSize: '0.9em' }}>הוחזרו: {returnedItems}</span>}
                      <button data-element-name="כפתור_page_18" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedOrders(prev => ({ ...prev, [order.orderId]: !prev[order.orderId] }));
                        }}
                        style={{ background: 'none', border: '1px solid var(--primary-color)', borderRadius: '4px', cursor: 'pointer', padding: '2px 8px', fontSize: '0.8rem', color: 'var(--primary-color)' }}
                        title={expandedOrders[order.orderId] ? 'הסתר רשימה' : 'הצג רשימה'}
                      >
                        {expandedOrders[order.orderId] ? '▲ פירוט' : '▼ פירוט'}
                      </button>
                    </div>
                  </td>
                  <td style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-muted)' }} title={order.notes}>
                    {order.notes || '-'}
                  </td>
                </tr>
                {expandedOrders[order.orderId] && (
                  <tr style={{ background: 'rgba(212, 175, 55, 0.02)' }}>
                    <td colSpan="6" style={{ padding: '1rem 2rem', borderBottom: '2px solid rgba(212, 175, 55, 0.2)' }}>
                      {order.items && order.items.filter(i => !i.isDeleted).length > 0 ? (
                        <ul style={{ margin: 0, paddingRight: '1.2rem', color: 'var(--text-main)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.5rem' }}>
                          {order.items.filter(i => !i.isDeleted).map(item => (
                            <li key={item.id} style={{ padding: '0.3rem 0' }}>
                              <strong style={{ color: 'var(--primary-color)' }}>{item.description}</strong> {item.barcode && <span style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>({item.barcode})</span>}
                              <div style={{ marginTop: '0.2rem' }}>
                                {item.isReturned ? (
                                  <span className="status-dot c-green" style={{ fontSize: '0.85em' }}>הוחזר</span>
                                ) : item.isTaken ? (
                                  <span className="status-dot c-amber" style={{ fontSize: '0.85em' }}>מושכר</span>
                                ) : (
                                  <span className="status-dot c-gray" style={{ fontSize: '0.85em' }}>טרם נלקח</span>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>אין פריטים פעילים</span>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
          </table>
        </div>
      </div>

      {/* סיכום הרשומות ועימוד — מוצמד תמיד לתחתית המסך */}
      <div className="page-footer-bar">
        <div className="page-footer-summary">סה"כ רשומות: {loading ? '...' : totalCount}</div>

        {totalPages > 1 && (
          <div className="page-footer-pager">
            <button data-element-name="כפתור_rentals_page_prev" className="btn btn-outline" disabled={page <= 1} onClick={() => goToPage(page - 1)} style={{ padding: '0.5rem 1rem' }}>&lt; הקודם</button>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              עמוד <input data-element-name="שדה_rentals_page_number" type="number" min={1} max={totalPages || 1} value={page} onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) goToPage(v); }} style={{ width: '60px', padding: '0.3rem', textAlign: 'center', borderRadius: '6px', border: '1px solid var(--element-border)', background: 'var(--input-bg)', color: 'var(--text-main)' }} /> מתוך {totalPages}
            </span>
            <button data-element-name="כפתור_rentals_page_next" className="btn btn-outline" disabled={page >= totalPages} onClick={() => goToPage(page + 1)} style={{ padding: '0.5rem 1rem' }}>הבא &gt;</button>
          </div>
        )}
      </div>

      {selectedOrderId && (
        <RentalReturnModal data-element-name="רכיב_page_19"
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onUpdate={() => fetchOrders(page)}
        />
      )}

      <StatisticsModal data-element-name="רכיב_page_20" 
        isOpen={!!showStatistics} 
        onClose={() => setShowStatistics(false)} 
        pageContext="rentals"
        contextQuery={aiQueryUsed}
        position={typeof showStatistics === 'object' ? showStatistics : null}
      />
    </main>
  );
}

