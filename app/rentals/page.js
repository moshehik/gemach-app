'use client';

import { useState, useEffect, useRef } from 'react';
import './rentals.css';
import { calculateOrderStatus, getStatusColor } from '../../lib/orderStatus';
import { getHebrewDateString } from '../../lib/hebrewDate';
import ExportButtons from '../../components/ExportButtons';
import AISearchBar from '../components/AISearchBar';
import StatisticsModal from '../components/StatisticsModal';
import { useLabels } from '@/app/components/LabelsContext';
import RentalReturnModal from '../../components/orders/RentalReturnModal';
import OrderModelSelector from '../../components/orders/OrderModelSelector';

export default function RentalsPage() {
  const { getLabel } = useLabels();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('pending'); // 'pending', 'active', 'returned', 'all'
  
  const [advFilters, setAdvFilters] = useState({
    customerName: '', customerPhone: '', customerCity: '', 
    advOrderId: '', itemDetails: '', advModelName: '', eventDateFrom: '', eventDateTo: ''
  });
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

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let activeParam = '';
      let archiveParam = '';
      const hasAdvFilters = Object.values(advFilters).some(v => v !== '');
      if (!search && !hasAdvFilters) {
        if (viewMode === 'pending') activeParam = '&pendingOnly=true&excludeArchiveAndPast=true';
        else if (viewMode === 'active') activeParam = '&activeOnly=true';
        else if (viewMode === 'returned') activeParam = '&returnedOnly=true';
        else if (viewMode === 'archive') activeParam = '&archiveAndPastOnly=true';
        else if (viewMode === 'all') activeParam = '&excludeArchiveAndPast=true';
      }
      
      const queryParams = new URLSearchParams({ search, sort: 'orderId', order: 'desc', limit: '200', forRentals: 'true' });
      if (activeParam.includes('pendingOnly')) queryParams.append('pendingOnly', 'true');
      if (activeParam.includes('activeOnly')) queryParams.append('activeOnly', 'true');
      if (activeParam.includes('returnedOnly')) queryParams.append('returnedOnly', 'true');
      if (activeParam.includes('excludeArchiveAndPast')) queryParams.append('excludeArchiveAndPast', 'true');
      if (activeParam.includes('archiveAndPastOnly')) queryParams.append('archiveAndPastOnly', 'true');
      
      Object.entries(advFilters).forEach(([k, v]) => {
        if (v) queryParams.append(k, v);
      });

      const timestamp = new Date().getTime();
      queryParams.append('_t', timestamp);

      const res = await fetch(`/api/orders?${queryParams.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      setOrders(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAiModeActive) {
      fetchOrders();
    }
  }, [search, viewMode, advFilters, isAiModeActive]);

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
        <div className="quick-return-bar">
        <h2><span style={{ fontSize: '1.2em', marginRight: '5px' }}>⚡</span> החזרה מהירה</h2>
        <form onSubmit={handleQuickReturn} className="barcode-input-container" style={{ position: 'relative' }}>
          <input data-element-name="שדה_page_1" 
            data-agy-id="input-barcode"
            type="text" 
            dir="auto"
            className={`barcode-input ${quickStatus === 'success' ? 'success-flash' : quickStatus === 'error' ? 'error-flash' : ''}`}
            placeholder="סרוק ברקוד כאן..." 
            value={quickBarcode}
            onChange={(e) => setQuickBarcode(e.target.value.replace(/\s+/g, ''))}
            disabled={isProcessing}
            autoFocus
          />
          {isProcessing && (
            <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
              <div className="spinner" style={{ width: '20px', height: '20px', border: '3px solid #f3f3f3', borderTop: '3px solid var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            </div>
          )}
        </form>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '2rem', fontWeight: 'bold' }}>ניהול השכרות והחזרות</h1>
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
                setAdvFilters({ customerName: '', customerPhone: '', customerCity: '', advOrderId: '', itemDetails: '', advModelName: '', eventDateFrom: '', eventDateTo: '' });
              }}>נקה הכל</button>
            </div>
          </div>
        </div>
      )}

      <div className="rentals-controls" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2rem',
        background: 'var(--card-bg)', 
        padding: '0.75rem 1.5rem', 
        borderRadius: '16px', 
        boxShadow: 'var(--shadow-sm)',
        gap: '1rem',
        flexWrap: 'wrap',
        border: '1px solid var(--border-color)'
      }}>
        {/* Right side: Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>תצוגה:</span>
          <select data-element-name="בחירה_page_13" 
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            className="form-control"
            style={{
              borderRadius: '20px',
              padding: '0.4rem 1rem',
              border: '2px solid var(--primary-color)',
              background: 'rgba(212,175,55,0.05)',
              color: 'var(--primary-color)',
              fontWeight: 'bold',
              cursor: 'pointer',
              outline: 'none',
              minWidth: '220px',
              fontSize: '1rem'
            }}
          >
            <option value="pending">השכרות (ממתינים)</option>
            <option value="active">פעילים (אצל לקוח)</option>
            <option value="returned">הוחזרו (חלקי/מלא)</option>
            <option value="all">כל ההזמנות הפעילות</option>
            <option value="archive">ארכיון / עבר</option>
          </select>
        </div>

        {/* Center/Left side: Search & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, maxWidth: '400px', minWidth: '250px' }}>
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
          </div>
          <button data-element-name="כפתור_page_15" 
            data-agy-id="adv-search-button"
            onClick={() => setShowAdvSearch(true)}
            className="btn-header-icon"
            title="חיפוש מתקדם"
          >
            🔍
          </button>
          
          <div style={{ width: '1px', height: '30px', background: 'var(--divider)', margin: '0 0.25rem' }}></div>
          
          <div style={{ flexShrink: 0 }}>
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
      </div>

      <div style={{ overflow: 'visible', background: 'var(--card-bg)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)' }}>
        <table className="items-table" style={{ margin: 0, minWidth: '800px' }}>
          <thead>
            <tr>
              <th>מספר הזמנה</th>
              <th>לקוח</th>
              <th>תאריך אירוע</th>
              <th>סטטוס</th>
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
            const statusColors = getStatusColor(statusLabel);
            const totalItems = order.items?.filter(i => !i.isDeleted).length || 0;
            const rentedItems = order.items?.filter(i => i.isTaken && !i.isReturned && !i.isDeleted).length || 0;
            const returnedItems = order.items?.filter(i => i.isReturned && !i.isDeleted).length || 0;

            return (
              <tbody key={order.orderId}>
                <tr data-element-name="לחיץ_page_17" 
                  onClick={() => openOrder(order.orderId)} 
                  style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(212, 175, 55, 0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>#{order.orderId}</td>
                  <td style={{ fontWeight: '500', fontSize: '1.1rem' }}>{order.customerName}</td>
                  <td>
                    <div><strong>{order.eventDateHebrew || (order.eventDate ? getHebrewDateString(order.eventDate) : 'לא צוין תאריך')}</strong></div>
                  </td>
                  <td>
                    <span style={{ 
                      padding: '0.3rem 0.8rem', 
                      borderRadius: '20px', 
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                      background: statusColors.bg,
                      color: statusColors.text,
                      display: 'inline-block'
                    }}>{statusLabel}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 'bold' }}>סה"כ: {totalItems}</span>
                      {rentedItems > 0 && <span style={{ color: '#e65100', fontSize: '0.9em', background: '#fff3e0', padding: '2px 6px', borderRadius: '4px' }}>מושכרים: {rentedItems}</span>}
                      {returnedItems > 0 && <span style={{ color: '#2e7d32', fontSize: '0.9em', background: '#e8f5e9', padding: '2px 6px', borderRadius: '4px' }}>הוחזרו: {returnedItems}</span>}
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
                                  <span style={{ color: '#2e7d32', fontSize: '0.85em', background: '#e8f5e9', padding: '2px 6px', borderRadius: '4px' }}>✓ הוחזר</span>
                                ) : item.isTaken ? (
                                  <span style={{ color: '#e65100', fontSize: '0.85em', background: '#fff3e0', padding: '2px 6px', borderRadius: '4px' }}>⚠ מושכר</span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85em', background: 'var(--element-bg)', padding: '2px 6px', borderRadius: '4px' }}>טרם נלקח</span>
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

      {/* סיכום הרשומות — מוצמד תמיד לתחתית המסך */}
      <div className="page-footer-bar">
        <div className="page-footer-summary" style={{ width: '100%', textAlign: 'center' }}>
          סה"כ שורות מוצגות: {loading ? '...' : orders.length}
        </div>
      </div>

      {selectedOrderId && (
        <RentalReturnModal data-element-name="רכיב_page_19"
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onUpdate={fetchOrders}
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

