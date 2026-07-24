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

export default function RentalsPage() {
  const { getLabel } = useLabels();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('pending'); // 'pending', 'active', 'returned', 'all'
  
  const [advFilters, setAdvFilters] = useState({
    customerName: '', customerPhone: '', customerCity: '', 
    advOrderId: '', itemDetails: '', eventDateFrom: '', eventDateTo: ''
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
    <main className="container rentals-page">
      <div>
        <div className="quick-return-bar">
        <h2>החזרה מהירה</h2>
        <form onSubmit={handleQuickReturn} className="barcode-input-container" style={{ position: 'relative' }}>
          <input 
            type="text" 
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ color: 'var(--primary-color)' }}>ניהול השכרות והחזרות</h1>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', maxWidth: '600px' }}>
          <AISearchBar 
            placeholder="חיפוש חופשי (הזמנה, לקוח, תאריך)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={(e) => { e.preventDefault(); if(isAiModeActive) setIsAiModeActive(false); }}
            onClear={handleClearSearch}
            onAiSearch={handleAiSearch}
            onStatistics={() => setShowStatistics(true)}
            loading={aiLoading}
          />
          <button 
            onClick={() => setShowAdvSearch(true)}
            className="btn btn-outline"
            style={{ borderRadius: '50%', width: '45px', height: '45px', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            title="חיפוש מתקדם"
          >
            🔍
          </button>
        </div>
      </div>

      {showAdvSearch && (
        <div className="modal-overlay" onClick={() => setShowAdvSearch(false)} style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '100%', background: 'var(--card-bg)', borderRadius: '16px', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <h2 style={{ color: 'var(--primary-color)', marginBottom: '1.5rem' }}>חיפוש מתקדם</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>{getLabel('order_id', 'מספר הזמנה')}</label>
                <input type="text" className="form-control" value={advFilters.advOrderId} onChange={e => setAdvFilters(p => ({...p, advOrderId: e.target.value}))} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>ברקוד/פרטי פריט</label>
                <input type="text" className="form-control" value={advFilters.itemDetails} onChange={e => setAdvFilters(p => ({...p, itemDetails: e.target.value}))} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>{getLabel('order_customerName', 'שם לקוח')}</label>
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

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button 
          className={`btn ${viewMode === 'pending' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setViewMode('pending')}
          style={{ borderRadius: '20px', padding: '0.5rem 1.5rem' }}
        >
          השכרות (ממתינים)
        </button>
        <button 
          className={`btn ${viewMode === 'active' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setViewMode('active')}
          style={{ borderRadius: '20px', padding: '0.5rem 1.5rem' }}
        >
          פעילים (אצל לקוח)
        </button>
        <button 
          className={`btn ${viewMode === 'returned' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setViewMode('returned')}
          style={{ borderRadius: '20px', padding: '0.5rem 1.5rem' }}
        >
          הוחזרו (חלקי/מלא)
        </button>
        <button 
          className={`btn ${viewMode === 'all' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setViewMode('all')}
          style={{ borderRadius: '20px', padding: '0.5rem 1.5rem' }}
        >
          כל ההזמנות הפעילות
        </button>
        <button 
          className={`btn ${viewMode === 'archive' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setViewMode('archive')}
          style={{ borderRadius: '20px', padding: '0.5rem 1.5rem' }}
        >
          ארכיון / עבר
        </button>
        <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', paddingRight: '1rem' }}>
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
          />
        </div>
      </div>

      <div className="orders-grid">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', gridColumn: '1 / -1' }}>טוען נתונים...</div>
        ) : orders.map(order => {
          const statusLabel = calculateOrderStatus(order);
          const statusColors = getStatusColor(statusLabel);
          return (
            <div key={order.orderId} className="order-card" onClick={() => openOrder(order.orderId)}>
              <div className="order-header">
                <span className="order-id">#{order.orderId}</span>
                <span style={{ 
                  padding: '0.3rem 0.8rem', 
                  borderRadius: '20px', 
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  background: statusColors.bg,
                  color: statusColors.text
                }}>{statusLabel}</span>
              </div>
              <div style={{ fontWeight: '500', marginBottom: '0.5rem', fontSize: '1.1rem' }}>{order.customerName}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                <div><strong>תאריך אירוע עברי:</strong> {order.eventDateHebrew || (order.eventDate ? getHebrewDateString(order.eventDate) : 'לא צוין תאריך')}</div>
                <div><strong>תאריך אירוע לועזי:</strong> {order.eventDate ? new Date(order.eventDate).toLocaleDateString('he-IL') : 'לא צוין'}</div>
                {order.notes && <div style={{ marginTop: '0.2rem', color: 'var(--text-main)', fontStyle: 'italic' }}>הערות: {order.notes}</div>}
              </div>
              <div className="order-items-summary" style={{ borderTop: '1px solid #eee', paddingTop: '0.5rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', color: 'var(--primary-color)', fontWeight: 'bold', alignItems: 'center' }}>
                  <span>סה"כ פריטים: {order.items?.length || 0}</span>
                  <span style={{ color: '#e65100' }}>מושכרים: {order.items?.filter(i => i.isTaken && !i.isReturned && !i.isDeleted).length || 0}</span>
                  <span style={{ color: '#2e7d32' }}>מוחזרים: {order.items?.filter(i => i.isReturned && !i.isDeleted).length || 0}</span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedOrders(prev => ({ ...prev, [order.orderId]: !prev[order.orderId] }));
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 5px', fontSize: '0.8rem', color: 'var(--primary-color)' }}
                    title={expandedOrders[order.orderId] ? 'הסתר רשימה' : 'הצג רשימה'}
                  >
                    {expandedOrders[order.orderId] ? '▲' : '▼'}
                  </button>
                </div>
                {expandedOrders[order.orderId] && (
                  order.items && order.items.length > 0 ? (
                    <ul style={{ paddingRight: '1.2rem', margin: '0.5rem 0 0 0', color: '#444' }}>
                      {order.items.filter(i => !i.isDeleted).map(item => (
                        <li key={item.id}>{item.description}</li>
                      ))}
                    </ul>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.5rem' }}>אין פריטים</span>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
      </div>

      {selectedOrderId && (
        <RentalReturnModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onUpdate={fetchOrders}
        />
      )}

      <StatisticsModal 
        isOpen={showStatistics} 
        onClose={() => setShowStatistics(false)} 
        pageContext="rentals"
        contextQuery={aiQueryUsed}
      />
    </main>
  );
}

