'use client';

import { useState, useEffect, useRef } from 'react';
import './rentals.css';
import { calculateOrderStatus, getStatusColor } from '../../lib/orderStatus';
import { getHebrewDateString } from '../../lib/hebrewDate';
import { calculateOrderStatus, getStatusColor } from '../../lib/orderStatus';
import { getHebrewDateString } from '../../lib/hebrewDate';
import ExportButtons from '../../components/ExportButtons';
import AISearchBar from '../components/AISearchBar';
import StatisticsModal from '../components/StatisticsModal';

export default function RentalsPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('pending'); // 'pending', 'active', 'returned', 'all'
  const [isEmbed, setIsEmbed] = useState(false);
  
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
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activeTab, setActiveTab] = useState('rental'); // 'rental' or 'return'
  
  // Barcode input inside modal
  const [modalBarcode, setModalBarcode] = useState('');
  const modalBarcodeRef = useRef(null);

  // Duplicate alteration modal
  const [duplicates, setDuplicates] = useState(null);

  const [expandedOrders, setExpandedOrders] = useState({});

  const [showStatistics, setShowStatistics] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQueryUsed, setAiQueryUsed] = useState('');
  const [isAiModeActive, setIsAiModeActive] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('embed') === 'true') {
        setIsEmbed(true);
      }
      const orderIdParam = params.get('orderId');
      if (orderIdParam) {
        setSearch(orderIdParam);
        setViewMode('all');
        // Fetch and open order automatically
        fetch(`/api/orders?search=${orderIdParam}&sort=orderId&order=desc&limit=1`)
          .then(res => res.json())
          .then(data => {
            if (data.data && data.data.length > 0) {
              setSelectedOrder(data.data[0]);
            }
          })
          .catch(err => console.error(err));
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
      
      const queryParams = new URLSearchParams({ search, sort: 'orderId', order: 'desc', limit: '200' });
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

  // Refocus modal barcode input when tab changes
  useEffect(() => {
    if (selectedOrder && modalBarcodeRef.current) {
      modalBarcodeRef.current.focus();
    }
  }, [selectedOrder, activeTab, duplicates]);

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
        openOrder(data.orderId, 'return');
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

  const openOrder = async (orderId, tab = 'rental') => {
    try {
      const timestamp = new Date().getTime();
      const res = await fetch(`/api/orders/${orderId}?_t=${timestamp}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setSelectedOrder(data);
        setActiveTab(tab);
        setModalBarcode('');
      } else {
        alert('שגיאה בטעינת הזמנה');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const refreshSelectedOrder = async () => {
    if (!selectedOrder) return;
    try {
      const timestamp = new Date().getTime();
      const res = await fetch(`/api/orders/${selectedOrder.orderId}?_t=${timestamp}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setSelectedOrder(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleModalScan = async (e) => {
    e.preventDefault();
    if (!modalBarcode) return;
    
    setIsProcessing(true);
    const cleanBarcode = modalBarcode.replace(/\s+/g, '');
    
    try {
      if (activeTab === 'rental') {
        await handleRentalScan(cleanBarcode);
      } else {
        await handleReturnScan(cleanBarcode);
      }
      setModalBarcode('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRentalScan = async (barcodeToScan, itemIdToForce = null) => {
    try {
      const res = await fetch('/api/rentals/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orderId: selectedOrder.orderId, 
          barcode: barcodeToScan,
          ...(itemIdToForce && { itemIdToForce })
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        if (data.duplicateAlterations) {
          setDuplicates(data.options);
        } else {
          // Success
          await refreshSelectedOrder();
        }
      } else {
        if (data.unreturned) {
          if (await window.customConfirm(data.warning + '\nהאם ברצונך לסמן אותה כהוחזרה עכשיו?')) {
            // Force return
            const putRes = await fetch('/api/rentals/scan', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ unreturnedItemId: data.unreturnedItemId })
            });
            if (putRes.ok) {
              // try scanning again
              handleRentalScan(barcodeToScan);
            }
          }
        } else {
          alert(data.error);
        }
      }
    } catch (err) {
      console.error(err);
      alert('שגיאת רשת');
    }
  };

  const selectDuplicate = async (itemId) => {
    await handleRentalScan(modalBarcode, itemId);
    setDuplicates(null);
  };

  const handleReturnScan = async (barcode) => {
    try {
      const res = await fetch('/api/returns/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: selectedOrder.orderId, barcode })
      });
      const data = await res.json();
      
      if (res.ok) {
        await refreshSelectedOrder();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const confirmRental = async () => {
    try {
      const unscannedCount = selectedOrder.items.filter(i => !i.barcode && !i.isDeleted).length;
      if (unscannedCount > 0) {
        if (!await window.customConfirm(`לתשומת לב! לא נסרקו כל הפריטים (${unscannedCount} חסרים). להמשיך בכל זאת?`)) {
          return;
        }
      }

      const res = await fetch('/api/rentals/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: selectedOrder.orderId })
      });
      if (res.ok) {
        alert('השכרה אושרה בהצלחה!');
        setSelectedOrder(null);
        fetchOrders();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const undoReturn = async (itemId) => {
    try {
      const res = await fetch('/api/returns/scan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderItemId: itemId })
      });
      if (res.ok) {
        await refreshSelectedOrder();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const undoRental = async (itemId) => {
    if (!await window.customConfirm('האם אתה בטוח שברצונך לבטל את הלקיחה? (הפריט יחזור לממתינים)')) return;
    try {
      const res = await fetch('/api/rentals/cancel', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderItemId: itemId })
      });
      if (res.ok) {
        await refreshSelectedOrder();
      } else {
        const data = await res.json();
        alert(data.error || 'שגיאה בביטול לקיחה');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const [itemDetails, setItemDetails] = useState(null); // { item, history }

  const showItemDetails = async (item) => {
    try {
      const res = await fetch(`/api/audit/order-item/${item.id}`);
      let history = [];
      if (res.ok) {
        history = await res.json();
      }
      setItemDetails({ item, history });
    } catch (err) {
      console.error(err);
      setItemDetails({ item, history: [] });
    }
  };

  const reportIssue = async (itemId, issueType) => {
    if (!await window.customConfirm('האם אתה בטוח? תוסף הערה אוטומטית בכרטיס הלקוח.')) return;
    try {
      const res = await fetch('/api/returns/report-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderItemId: itemId, issueType })
      });
      if (res.ok) {
        alert('הערה נוספה בהצלחה.');
        await refreshSelectedOrder();
      } else {
        const data = await res.json();
        alert(data.error || 'שגיאה');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Removed getOrderStatusInfo as we use calculateOrderStatus instead

  return (
    <main className="container rentals-page">
      <div style={{ display: isEmbed ? 'none' : 'block' }}>
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
        <div className="modal-overlay" onClick={() => setShowAdvSearch(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
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
              { key: 'orderId', label: 'קוד הזמנה' },
              { key: 'customerName', label: 'לקוח' },
              { key: 'eventDateFormatted', label: 'תאריך אירוע' },
              { key: 'status', label: 'סטטוס' },
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
                {order.notes && <div style={{ marginTop: '0.2rem', color: '#666', fontStyle: 'italic' }}>הערות: {order.notes}</div>}
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
                    <span style={{ color: '#999', display: 'block', marginTop: '0.5rem' }}>אין פריטים</span>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
      </div>

      {isEmbed && loading && !selectedOrder && (
        <div style={{ padding: '3rem', textAlign: 'center', fontSize: '1.2rem', color: '#666' }}>
          טוען נתוני השכרה...
        </div>
      )}


      {selectedOrder && !duplicates && (
        <div className={isEmbed ? "" : "modal-overlay"} onClick={() => !isEmbed && setSelectedOrder(null)} style={isEmbed ? { padding: '1rem', background: 'transparent', minHeight: '100vh', width: '100%' } : {}}>
          <div className={isEmbed ? "" : "modal-content"} style={isEmbed ? { maxWidth: '100%', width: '100%', margin: '0 auto', boxShadow: 'none', padding: '0', background: 'transparent' } : { maxWidth: '900px' }} onClick={e => e.stopPropagation()}>
            {!isEmbed && <button className="modal-close" onClick={() => setSelectedOrder(null)}>&times;</button>}
            
            <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div><strong style={{ color: 'var(--primary-color)' }}>הזמנה:</strong> #{selectedOrder.orderId}</div>
              <div><strong>לקוח:</strong> {selectedOrder.customer ? `${selectedOrder.customer.firstName} ${selectedOrder.customer.lastName}` : ''}</div>
              <div style={{ flex: 1 }}><strong>הערות:</strong> {selectedOrder.orderNotes || selectedOrder.notes || '-'}</div>
              <button 
                className="btn btn-outline" 
                onClick={() => window.open(`/print/order?orderId=${selectedOrder.orderId}`, '_blank')}
                style={{ padding: '0.4rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}
                title="הדפס פרטי השכרה (מבוסס על 'השכרות פירוט')"
              >
                🖨️ הדפס
              </button>
            </div>

            <div className="modal-tabs">
              <div className={`modal-tab ${activeTab === 'rental' ? 'active' : ''}`} onClick={() => setActiveTab('rental')}>
                השכרה (ניפוק)
              </div>
              <div className={`modal-tab ${activeTab === 'return' ? 'active' : ''}`} onClick={() => setActiveTab('return')}>
                החזרה
              </div>
            </div>

            <form onSubmit={handleModalScan} style={{ marginBottom: '2rem', position: 'relative' }}>
              <input 
                ref={modalBarcodeRef}
                type="text" 
                className="barcode-input"
                placeholder={`סרוק ברקוד ל${activeTab === 'rental' ? 'השכרה' : 'החזרה'}...`}
                value={modalBarcode}
                onChange={(e) => setModalBarcode(e.target.value.replace(/\s+/g, ''))}
                disabled={isProcessing}
                style={{ maxWidth: '400px', margin: '0 auto', display: 'block' }}
              />
              {isProcessing && (
                <div style={{ position: 'absolute', right: 'calc(50% - 190px)', top: '50%', transform: 'translateY(-50%)' }}>
                  <div className="spinner" style={{ width: '20px', height: '20px', border: '3px solid #f3f3f3', borderTop: '3px solid var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                </div>
              )}
            </form>

            {activeTab === 'rental' && (
              <>
                <table className="items-table">
                  <thead>
                    <tr>
                      <th>דגם</th>
                      <th>מידה</th>
                      <th>תיקונים</th>
                      <th>ברקוד</th>
                      <th>סטטוס</th>
                      <th>פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.filter(i => !i.isDeleted).map(item => (
                      <tr key={item.id} className={item.isTaken ? 'taken' : (item.barcode ? 'pending' : '')}>
                        <td>{item.description}</td>
                        <td>{item.sizeText}</td>
                        <td style={{ fontSize: '0.85rem' }}>{item.repairs || '-'}</td>
                        <td style={{ fontWeight: 'bold' }}>{item.barcode || '-'}</td>
                        <td>
                          {item.isTaken ? 'נלקח' : (item.barcode ? 'ממתין לאישור' : 'טרם')}
                        </td>
                        <td>
                          <button type="button" className="btn btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.85rem', marginLeft: '0.5rem' }} onClick={() => showItemDetails(item)} title="פרטים נוספים">ℹ️</button>
                          {item.isTaken && (
                            <button type="button" className="btn btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.85rem' }} onClick={() => undoRental(item.id)}>בטל לקיחה</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="action-buttons">
                  <button className="btn btn-outline" onClick={() => setSelectedOrder(null)}>סגור</button>
                  <button className="btn btn-primary" onClick={confirmRental}>אישור השכרה</button>
                </div>
              </>
            )}

            {activeTab === 'return' && (
              <>
                <table className="items-table">
                  <thead>
                    <tr>
                      <th>דגם</th>
                      <th>מידה</th>
                      <th>ברקוד</th>
                      <th>סטטוס</th>
                      <th>פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.filter(i => i.isTaken && !i.isDeleted).map(item => (
                      <tr key={item.id} className={item.isReturned ? 'returned' : ''}>
                        <td>{item.description}</td>
                        <td>{item.sizeText}</td>
                        <td style={{ fontWeight: 'bold' }}>{item.barcode}</td>
                        <td>
                          {item.isReturned ? (
                            <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>✓ הוחזר</span>
                          ) : (
                            <span style={{ color: '#e65100' }}>אצל לקוח</span>
                          )}
                        </td>
                        <td>
                          <button type="button" className="btn btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.85rem', marginLeft: '0.5rem' }} onClick={() => showItemDetails(item)} title="פרטים נוספים">ℹ️</button>
                          {item.isReturned ? (
                            <>
                              <button type="button" className="btn btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.85rem', marginLeft: '0.5rem' }} onClick={() => undoReturn(item.id)}>בטל החזרה</button>
                              <button type="button" className="btn btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.85rem', borderColor: 'var(--danger)' }} onClick={() => reportIssue(item.id, 'returned-bad')}>חזר לא תקין</button>
                            </>
                          ) : (
                            <button type="button" className="btn btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.85rem', borderColor: 'var(--danger)' }} onClick={() => reportIssue(item.id, 'not-returned')}>דווח כחסר</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {selectedOrder.items.filter(i => i.isTaken && !i.isDeleted).length === 0 && (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    אין פריטים אצל הלקוח שניתן להחזיר
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Item Details Modal */}
      {itemDetails && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <h2 style={{ color: 'var(--primary-color)', marginBottom: '1rem' }}>פרטי פריט: {itemDetails.item.barcode || itemDetails.item.description}</h2>
            <div style={{ marginBottom: '1.5rem', lineHeight: '1.6' }}>
              <div><strong>תאריך אירוע (לועזי):</strong> {selectedOrder?.eventDate ? new Date(selectedOrder.eventDate).toLocaleDateString('he-IL') : '-'}</div>
              <div><strong>תאריך לקיחה:</strong> {itemDetails.item.takenDate ? new Date(itemDetails.item.takenDate).toLocaleDateString('he-IL') : '-'}</div>
              <div><strong>תאריך החזרה:</strong> {itemDetails.item.returnDate ? new Date(itemDetails.item.returnDate).toLocaleDateString('he-IL') : '-'}</div>
              <div><strong>מחרוזת תיקונים:</strong> {itemDetails.item.repairs || '-'}</div>
              <div><strong>חזר תקין:</strong> {itemDetails.item.isReturned ? (itemDetails.item.returnedOk ? 'כן' : 'לא') : '-'}</div>
            </div>
            
            <h3 style={{ marginBottom: '0.5rem' }}>היסטוריית פעולות:</h3>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ddd', padding: '1rem', borderRadius: '8px' }}>
              {itemDetails.history.length === 0 ? (
                <div style={{ color: '#888' }}>אין היסטוריה לפריט זה</div>
              ) : (
                <table className="items-table" style={{ fontSize: '0.9rem' }}>
                  <thead><tr><th>תאריך</th><th>פעולה</th><th>פרטים</th></tr></thead>
                  <tbody>
                    {itemDetails.history.map(log => (
                      <tr key={log.id}>
                        <td>{new Date(log.createdAt).toLocaleString('he-IL')}</td>
                        <td>{log.action}</td>
                        <td style={{ fontSize: '0.85rem', direction: 'ltr', textAlign: 'right' }}>{log.changesJson}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <button type="button" className="btn btn-primary" style={{ marginTop: '1.5rem', width: '100%' }} onClick={() => setItemDetails(null)}>סגור</button>
          </div>
        </div>
      )}

      {/* Duplicate Alterations Modal */}
      {duplicates && (
        <div className="modal-overlay alteration-modal">
          <div className="modal-content">
            <h2 style={{ color: 'var(--primary-color)', marginBottom: '1.5rem' }}>
              נמצאו מספר פריטים זהים - בחר לאיזה מהם לשייך את הברקוד
            </h2>
            <div className="duplicates-list">
              {duplicates.map((opt, idx) => (
                <div key={opt.id} className="alteration-option" onClick={() => selectDuplicate(opt.id)}>
                  <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>אפשרות {idx + 1}</div>
                  <div className="alteration-details">
                    <div className="alteration-stat">
                      <span className="alteration-stat-label">תיקון אורך</span>
                      <span className="alteration-stat-value">{opt.lengthAlteration || 'ללא'}</span>
                    </div>
                    <div className="alteration-stat">
                      <span className="alteration-stat-label">צוואר</span>
                      <span className="alteration-stat-value">{opt.neckAlteration || 'ללא'}</span>
                    </div>
                    <div className="alteration-stat">
                      <span className="alteration-stat-label">שרוול</span>
                      <span className="alteration-stat-value">{opt.sleeveAlteration || 'ללא'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn btn-outline" style={{ marginTop: '1rem', width: '100%' }} onClick={() => setDuplicates(null)}>ביטול</button>
          </div>
        </div>
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

