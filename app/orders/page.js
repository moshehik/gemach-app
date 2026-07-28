'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileText, Shirt, CalendarSearch, Plus, X, List, Trash2, Archive, CalendarDays, AlertCircle, Info, Phone, Calendar as CalendarIcon2, CreditCard, CheckCircle2, Filter, Search, Printer } from 'lucide-react';
import { calculateOrderStatus, getStatusColor } from '../../lib/orderStatus';
import CapacitySearchModal from '../../components/CapacitySearchModal';
import ExportButtons from '../../components/ExportButtons';
import AISearchBar from '../components/AISearchBar';
import StatisticsModal from '../components/StatisticsModal';
import { useLabels } from '@/app/components/LabelsContext';
import HebrewDatePicker from '../../components/HebrewDatePicker';
import RentalReturnModal from '../../components/orders/RentalReturnModal';
import OrderModelSelector from '../../components/orders/OrderModelSelector';
import PrintWizardModal from '../components/PrintWizardModal';

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
  const [sort, setSort] = useState('eventDate');
  const [order, setOrder] = useState('desc');
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filterStatus, setFilterStatus] = useState('all');

  const [advFilters, setAdvFilters] = useState({
    customerName: '', customerPhone: '', customerCity: '', 
    advOrderId: '', itemDetails: '', advModelName: '', eventDateFrom: '', eventDateTo: ''
  });
  const [showAdvSearch, setShowAdvSearch] = useState(false);
  const [showCapacitySearch, setShowCapacitySearch] = useState(false);
  const [showPrintWizard, setShowPrintWizard] = useState(false);
  const [rentalModalOrderId, setRentalModalOrderId] = useState(null);

  const [showStatistics, setShowStatistics] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQueryUsed, setAiQueryUsed] = useState('');
  const [isAiModeActive, setIsAiModeActive] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search,
        sort,
        order,
        filterStatus
      });
      Object.entries(advFilters).forEach(([k, v]) => {
        if (v) queryParams.append(k, v);
      });
      const timestamp = new Date().getTime();
      queryParams.append('_t', timestamp);

      const res = await fetch(`/api/orders?${queryParams.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      setOrders(data.data || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.total || 0);
      if (data.data && data.data.length > 0 && !selectedOrder) {
        // Optionally select first order
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, sort, order, selectedOrder, advFilters, filterStatus]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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
    if (status === 'הוחזר' || status === 'מושכר' || status === 'חלקית') {
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
        if (v) queryParams.append(k, v);
      });
      const res = await fetch(`/api/orders?${queryParams.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      return (data.data || []).map(o => ({
        ...o,
        status: calculateOrderStatus(o)
      }));
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const thStyle = { padding: '1rem', cursor: 'pointer', userSelect: 'none' };

  return (
    <main data-agy-id="orders_page_main_1" className="container animate-fade-in" style={{ paddingTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, color: 'var(--primary-color)' }}>ניהול הזמנות</h1>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          
          {/* Status Filter Banner */}
          <div style={{ display: 'flex', gap: '0.3rem', background: 'var(--element-bg)', padding: '0.2rem', borderRadius: '8px' }}>
            <button data-agy-id="orders_page_button_2" onClick={() => { setFilterStatus('soon'); setPage(1); }} style={{ padding: '0.4rem', border: 'none', background: filterStatus === 'soon' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: filterStatus === 'soon' ? '#f57c00' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="בקרוב (החל מהיום ואילך)">
              <CalendarDays size={20} />
              <span style={{ fontWeight: filterStatus === 'soon' ? 'bold' : 'normal' }}>בקרוב</span>
            </button>
            <button data-agy-id="orders_page_button_3" onClick={() => { setFilterStatus('archive'); setPage(1); }} style={{ padding: '0.4rem', border: 'none', background: filterStatus === 'archive' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: filterStatus === 'archive' ? '#1565c0' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="ארכיון / עבר">
              <Archive size={20} />
              <span style={{ fontWeight: filterStatus === 'archive' ? 'bold' : 'normal' }}>ארכיון/עבר</span>
            </button>
            <button data-agy-id="orders_page_button_4" onClick={() => { setFilterStatus('deleted'); setPage(1); }} style={{ padding: '0.4rem', border: 'none', background: filterStatus === 'deleted' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: filterStatus === 'deleted' ? '#e53935' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="מחוקים">
              <Trash2 size={20} />
              <span style={{ fontWeight: filterStatus === 'deleted' ? 'bold' : 'normal' }}>מחוק</span>
            </button>
            <button data-agy-id="orders_page_button_5" onClick={() => { setFilterStatus('unpaid'); setPage(1); }} style={{ padding: '0.4rem', border: 'none', background: filterStatus === 'unpaid' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: filterStatus === 'unpaid' ? '#e11d48' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="לא שולם (חודשים אחרונים)">
              <AlertCircle size={20} />
              <span style={{ fontWeight: filterStatus === 'unpaid' ? 'bold' : 'normal' }}>לא שולם</span>
            </button>
            <button data-agy-id="orders_page_button_6" onClick={() => { setFilterStatus('unpaid_all'); setPage(1); }} style={{ padding: '0.4rem', border: 'none', background: filterStatus === 'unpaid_all' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: filterStatus === 'unpaid_all' ? '#e11d48' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="לא שולם (כולל ישנים)">
              <AlertCircle size={20} />
              <span style={{ fontWeight: filterStatus === 'unpaid_all' ? 'bold' : 'normal' }}>לא שולם (הכל)</span>
            </button>
            <button data-agy-id="orders_page_button_7" onClick={() => { setFilterStatus('all'); setPage(1); }} style={{ padding: '0.4rem', border: 'none', background: filterStatus === 'all' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: filterStatus === 'all' ? '#1976d2' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="הצג הכל">
              <List size={20} />
              <span style={{ fontWeight: filterStatus === 'all' ? 'bold' : 'normal' }}>הכל</span>
            </button>
          </div>

          <button data-agy-id="orders_page_button_8" 
             onClick={() => setShowAdvSearch(true)} 
             className="btn btn-outline" 
             style={{ padding: '0.6rem', borderRadius: '8px', width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--element-border)', color: 'var(--primary-color, #8b5cf6)', backgroundColor: 'var(--element-bg)', cursor: 'pointer' }}
             title="חיפוש מתקדם"
          >
            <Filter size={22} />
          </button>

          <button data-agy-id="orders_page_button_9" 
             onClick={() => setShowCapacitySearch(true)} 
             className="btn btn-outline" 
             style={{ padding: '0.6rem', borderRadius: '8px', width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--element-border)', color: 'var(--success-color, #10b981)', backgroundColor: 'var(--element-bg)', cursor: 'pointer' }}
             title="חיפוש תפוסה"
          >
            <CalendarSearch size={22} />
          </button>

          <button 
             onClick={() => setShowPrintWizard(true)} 
             className="btn btn-outline" 
             style={{ padding: '0.6rem', borderRadius: '8px', width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--element-border)', color: 'var(--primary-color, #8b5cf6)', backgroundColor: 'var(--element-bg)', cursor: 'pointer' }}
             title="הדפסת דוחות"
          >
            <Printer size={22} />
          </button>

          <ExportButtons 
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
              { key: 'status', label: getLabel('order_status', 'סטטוס') }
            ]}
            iconOnly={true}
            onFetchData={fetchOrdersForExport}
          />

          <Link 
            href="/orders/new" 
            className="btn btn-primary" 
            style={{ padding: '0.6rem', borderRadius: '8px', width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--primary-color, #3b82f6)', color: '#fff' }}
            title="הזמנה חדשה"
          >
            <Plus size={22} />
          </Link>
        </div>
      </div>
      
      {/* Search and Filters */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '800px', alignItems: 'center' }}>
          <AISearchBar 
            placeholder="חיפוש הזמנה (מספר הזמנה, שם לקוח)..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={handleSearch}
            onClear={handleClearSearch}
            onAiSearch={handleAiSearch}
            onStatistics={(e) => setShowStatistics({ x: e.clientX, y: e.clientY })}
            loading={aiLoading}
          />
          <div style={{ width: '150px' }}>
          </div>
        </div>
        <div style={{ color: 'var(--text-muted)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span>סה"כ רשומות: {totalCount}</span>
        </div>
      </div>

      {showAdvSearch && typeof document !== 'undefined' && createPortal(
        <div className="modal-overlay" onClick={() => setShowAdvSearch(false)} style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal-content animate-slide-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', width: '100%', background: 'var(--card-bg)', borderRadius: '16px', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--divider)', paddingBottom: '1rem' }}>
              <h2 style={{ color: 'var(--primary-color)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Filter size={24} /> חיפוש מתקדם
              </h2>
              <button data-agy-id="orders_page_button_10" onClick={() => setShowAdvSearch(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={24} />
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>מתאריך אירוע</label>
                <HebrewDatePicker value={advFilters.eventDateFrom} onChange={d => setAdvFilters(p => ({...p, eventDateFrom: d}))} placeholder="מתאריך..." />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>עד תאריך אירוע</label>
                <HebrewDatePicker value={advFilters.eventDateTo} onChange={d => setAdvFilters(p => ({...p, eventDateTo: d}))} placeholder="עד תאריך..." />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>{getLabel('order_id', 'מספר הזמנה')}</label>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input data-agy-id="orders_page_input_11" type="text" className="form-control" style={{ width: '100%', padding: '0.6rem 2.5rem 0.6rem 0.6rem', borderRadius: '8px', border: '1px solid var(--element-border)', background: 'var(--input-bg)', color: 'var(--text-main)' }} value={advFilters.advOrderId} onChange={e => setAdvFilters(p => ({...p, advOrderId: e.target.value}))} placeholder="חפש לפי מספר..." />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>ברקוד/פרטי פריט</label>
                <div style={{ position: 'relative' }}>
                  <Shirt size={16} style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input data-agy-id="orders_page_input_12" type="text" className="form-control" style={{ width: '100%', padding: '0.6rem 2.5rem 0.6rem 0.6rem', borderRadius: '8px', border: '1px solid var(--element-border)', background: 'var(--input-bg)', color: 'var(--text-main)' }} value={advFilters.itemDetails} onChange={e => setAdvFilters(p => ({...p, itemDetails: e.target.value}))} placeholder="ברקוד או תיאור..." />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>דגם</label>
                <div style={{ position: 'relative' }}>
                  <OrderModelSelector 
                    value={{ name: advFilters.advModelName }} 
                    onChange={m => setAdvFilters(p => ({...p, advModelName: m ? m.name : ''}))} 
                    placeholder="בחר דגם..."
                  />
                  {advFilters.advModelName && (
                    <button 
                      onClick={() => setAdvFilters(p => ({...p, advModelName: ''}))}
                      style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error-color)' }}
                      title="נקה בחירה"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>{getLabel('order_customerName', 'שם לקוח')}</label>
                <input data-agy-id="orders_page_input_13" type="text" className="form-control" style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--element-border)', background: 'var(--input-bg)', color: 'var(--text-main)' }} value={advFilters.customerName} onChange={e => setAdvFilters(p => ({...p, customerName: e.target.value}))} placeholder="שם הלקוח..." />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>טלפון לקוח</label>
                <input data-agy-id="orders_page_input_14" type="text" className="form-control" style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--element-border)', background: 'var(--input-bg)', color: 'var(--text-main)' }} value={advFilters.customerPhone} onChange={e => setAdvFilters(p => ({...p, customerPhone: e.target.value}))} placeholder="מספר טלפון..." />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>עיר מגורים</label>
                <input data-agy-id="orders_page_input_15" type="text" className="form-control" style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--element-border)', background: 'var(--input-bg)', color: 'var(--text-main)' }} value={advFilters.customerCity} onChange={e => setAdvFilters(p => ({...p, customerCity: e.target.value}))} placeholder="עיר..." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid var(--divider)', paddingTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button data-agy-id="orders_page_button_16" className="btn btn-outline" style={{ padding: '0.6rem 1.5rem', borderRadius: '8px' }} onClick={() => {
                setAdvFilters({ customerName: '', customerPhone: '', customerCity: '', advOrderId: '', itemDetails: '', advModelName: '', eventDateFrom: '', eventDateTo: '' });
              }}>נקה הכל</button>
              <button data-agy-id="orders_page_button_17" className="btn btn-primary" style={{ padding: '0.6rem 2.5rem', borderRadius: '8px' }} onClick={() => setShowAdvSearch(false)}>החל סינון</button>
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
                <div style={{ overflowX: 'auto', minHeight: '50vh' }}>
                  <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--element-border)', color: 'var(--text-muted)' }}>
                      <th style={thStyle} onClick={() => handleSort('orderId')}>{getLabel('order_id', 'קוד הזמנה')} <SortIcon column="orderId" /></th>
                      <th style={thStyle} onClick={() => handleSort('customerName')}>{getLabel('order_customerName', 'לקוח')} <SortIcon column="customerName" /></th>
                      <th style={thStyle}>כמות פריטים</th>
                      <th style={thStyle} onClick={() => handleSort('eventDate')}>תאריך אירוע <SortIcon column="eventDate" /></th>
                      <th style={thStyle} onClick={() => handleSort('totalAmount')}>{getLabel('order_totalAmount', 'סכום לחיוב')} <SortIcon column="totalAmount" /></th>
                      <th style={thStyle} onClick={() => handleSort('totalPaid')}>שולם <SortIcon column="totalPaid" /></th>
                      <th style={thStyle} onClick={() => handleSort('status')}>{getLabel('order_status', 'סטטוס')} <SortIcon column="status" /></th>
                      <th style={{ padding: '1rem' }}>פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => {
                      const isUnpaid = order.totalPaid < order.totalAmount && order.totalAmount > 0;
                      const hasCustomSpacing = order.customSpacing !== null && order.customSpacing !== undefined;
                      return (
                      <tr key={order.orderId} style={{ 
                        borderBottom: '1px solid var(--element-border)', 
                        transition: 'background 0.2s', 
                        cursor: 'pointer', 
                        background: selectedOrder?.orderId === order.orderId ? 'var(--element-bg)' : (isUnpaid ? 'var(--error-bg, rgba(239, 68, 68, 0.1))' : (hasCustomSpacing ? '#fef9c3' : 'transparent')),
                        borderRight: isUnpaid ? '4px solid var(--error-color, #ef4444)' : (hasCustomSpacing ? '4px solid #facc15' : 'none')
                      }} onClick={() => router.push(`/orders/${order.orderId}`)}>
                        <td style={{ padding: '1rem', fontWeight: isUnpaid ? 'bold' : 'normal', color: isUnpaid ? 'var(--error-color, #b91c1c)' : 'inherit' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>#{order.orderId}</span>
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
                              <Info size={16} strokeWidth={2.5} />
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '1rem', fontWeight: '500' }}>{order.customerName}</td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>{order.items ? order.items.filter(i => !i.isDeleted).length : 0}</td>
                        <td style={{ padding: '1rem' }}>{order.eventDateHebrew || ''}</td>
                        <td style={{ padding: '1rem' }}>₪{order.totalAmount}</td>
                        <td style={{ padding: '1rem', color: order.totalPaid >= order.totalAmount && order.totalAmount > 0 ? 'var(--success-color, #10b981)' : (isUnpaid ? 'var(--error-color, #dc2626)' : 'inherit'), fontWeight: isUnpaid ? 'bold' : 'normal' }}>₪{order.totalPaid}</td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{ 
                            padding: '0.3rem 0.8rem', 
                            borderRadius: '20px', 
                            fontSize: '0.85rem',
                            background: getStatusColor(calculateOrderStatus(order)).bg,
                            color: getStatusColor(calculateOrderStatus(order)).text
                          }}>
                            {calculateOrderStatus(order)}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
                          <Link 
                            href={`/orders/${order.orderId}`} 
                            className="btn btn-outline" 
                            style={{ padding: '0.5rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', width: '38px', height: '38px' }}
                            onClick={(e) => e.stopPropagation()}
                            title="כרטיס הזמנה"
                          >
                            <FileText size={18} />
                          </Link>
                          <button data-agy-id="orders_page_button_18" 
                            className="btn btn-primary" 
                            style={{ padding: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', width: '38px', height: '38px', border: 'none', cursor: 'pointer', backgroundColor: 'var(--success-bg, rgba(16, 185, 129, 0.1))', color: 'var(--success-color, #10b981)' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRentalModalOrderId(order.orderId);
                            }}
                            title="מעבר להשכרה/החזרה"
                          >
                            <Shirt size={18} />
                          </button>
                          <button data-agy-id="orders_page_button_19" 
                            className="btn btn-outline" 
                            style={{ padding: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', width: '38px', height: '38px', border: '1px solid var(--error-border, #fee2e2)', cursor: 'pointer', backgroundColor: 'var(--error-bg, rgba(239, 68, 68, 0.1))', color: 'var(--error-color, #ef4444)' }}
                            onClick={(e) => handleDeleteOrder(order, e)}
                            title="מחיקת הזמנה"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                  </table>
                </div>
                
                {/* Sticky Bottom Bar */}
                <div style={{ position: 'sticky', bottom: '-1rem', background: 'var(--card-bg)', padding: '1rem', borderTop: '1px solid var(--element-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10, margin: '0 -1rem -1rem -1rem', borderRadius: '0 0 12px 12px', boxShadow: '0 -4px 10px rgba(0,0,0,0.05)', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ fontWeight: 'bold' }}>סה"כ שורות מוצגות: {orders.length}</div>
                  
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
                      <button data-agy-id="orders_page_button_20" className="btn btn-outline" disabled={page >= totalPages || isAiModeActive} onClick={() => setPage(p => p + 1)} style={{ padding: '0.5rem 1rem' }}>הבא &gt;</button>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>עמוד <input data-agy-id="orders_page_input_21" type="number" min={1} max={totalPages || 1} value={page} onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) setPage(v); }} style={{ width: '60px', padding: '0.3rem', textAlign: 'center', borderRadius: '6px', border: '1px solid var(--element-border)', background: 'var(--input-bg)', color: 'var(--text-main)' }} disabled={isAiModeActive} /> מתוך {totalPages}</span>
                      <button data-agy-id="orders_page_button_22" className="btn btn-outline" disabled={page <= 1 || isAiModeActive} onClick={() => setPage(p => p - 1)} style={{ padding: '0.5rem 1rem' }}>&lt; הקודם</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Modals */}
      <CapacitySearchModal 
        isOpen={showCapacitySearch} 
        onClose={() => setShowCapacitySearch(false)} 
      />

      {showPrintWizard && (
        <PrintWizardModal 
          onClose={() => setShowPrintWizard(false)}
          defaultReportType="orders_all" 
        />
      )}

      {/* Rental Modal */}
      {rentalModalOrderId && (
        <RentalReturnModal 
          orderId={rentalModalOrderId} 
          onClose={() => setRentalModalOrderId(null)} 
          onUpdate={fetchOrders}
        />
      )}

      <StatisticsModal 
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
            <Info size={18} />
            הזמנה #{hoveredOrder.orderId}
          </div>
          <div className="global-popoverRow">
            <span>לקוח:</span>
            <span>{hoveredOrder.customerName}</span>
          </div>
          <div className="global-popoverRow">
            <span><Phone size={14} /> טלפון:</span>
            <span dir="ltr">{hoveredOrder.customerPhone || 'לא הוזן'}</span>
          </div>
          <div className="global-popoverRow">
            <span><CalendarIcon2 size={14} /> תאריך עברי:</span>
            <span>{hoveredOrder.eventDateHebrew || 'לא צוין'}</span>
          </div>
          <div className="global-popoverRow">
            <span><CalendarIcon2 size={14} /> תאריך לועזי:</span>
            <span>{hoveredOrder.eventDate ? new Date(hoveredOrder.eventDate).toLocaleDateString('he-IL') : 'לא צוין'}</span>
          </div>
          <div className="global-popoverRow">
            <span><Shirt size={14} /> הושכר:</span>
            <span>{hoveredOrder.items ? hoveredOrder.items.filter(i => !i.isDeleted && i.isTaken).length : 0}</span>
          </div>
          <div className="global-popoverRow">
            <span><Shirt size={14} /> הוחזר:</span>
            <span>{hoveredOrder.items ? hoveredOrder.items.filter(i => !i.isDeleted && i.isReturned).length : 0}</span>
          </div>
          <div className="global-popoverRow">
            <span><CreditCard size={14} /> סה"כ לתשלום:</span>
            <span>₪{hoveredOrder.totalAmount || 0}</span>
          </div>
          <div className="global-popoverRow">
            <span><CheckCircle2 size={14} /> שולם:</span>
            <span style={{ color: hoveredOrder.totalPaid >= hoveredOrder.totalAmount && hoveredOrder.totalAmount > 0 ? 'var(--success-color, #10b981)' : (hoveredOrder.totalPaid > 0 ? 'var(--warning-color, #f59e0b)' : 'var(--error-color, #ef4444)'), fontWeight: 'bold' }}>
              ₪{hoveredOrder.totalPaid || 0}
            </span>
          </div>
          <div className="global-popoverRow">
            <span>סטטוס:</span>
            <span style={{ color: getStatusColor(calculateOrderStatus(hoveredOrder)).text, background: getStatusColor(calculateOrderStatus(hoveredOrder)).bg, padding: '2px 6px', borderRadius: '4px' }}>
              {calculateOrderStatus(hoveredOrder)}
            </span>
          </div>
        </div>,
        document.body
      )}
    </main>
  );
}
