'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileText, Shirt, CalendarSearch, Plus, X, List, Trash2, Archive, CalendarDays, AlertCircle, Info, Phone, Calendar as CalendarIcon2, CreditCard, CheckCircle2 } from 'lucide-react';
import { calculateOrderStatus, getStatusColor } from '../../lib/orderStatus';
import CapacitySearchModal from '../../components/CapacitySearchModal';
import ExportButtons from '../../components/ExportButtons';
import AISearchBar from '../components/AISearchBar';
import StatisticsModal from '../components/StatisticsModal';
import { useLabels } from '@/app/components/LabelsContext';
import HebrewDatePicker from '../../components/HebrewDatePicker';
import RentalReturnModal from '../../components/orders/RentalReturnModal';

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
  const [jumpDate, setJumpDate] = useState('');

  useEffect(() => {
    setAdvFilters(p => ({ ...p, eventDateFrom: jumpDate, eventDateTo: jumpDate }));
    setPage(1);
  }, [jumpDate]);

  const [advFilters, setAdvFilters] = useState({
    customerName: '', customerPhone: '', customerCity: '', 
    advOrderId: '', itemDetails: '', eventDateFrom: '', eventDateTo: ''
  });
  const [showAdvSearch, setShowAdvSearch] = useState(false);
  const [showCapacitySearch, setShowCapacitySearch] = useState(false);
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
        alert(result.error || '׳©׳’׳™׳׳” ׳‘׳—׳™׳₪׳•׳© ׳”׳—׳›׳');
      }
    } catch (e) {
      console.error(e);
      alert('׳©׳’׳™׳׳× ׳×׳§׳©׳•׳¨׳×');
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
    if (sort !== column) return <span style={{ opacity: 0.3, marginRight: '4px' }}>ג‡…</span>;
    return <span style={{ marginRight: '4px' }}>{order === 'asc' ? 'ג†‘' : 'ג†“'}</span>;
  };

  const handleDeleteOrder = async (order, e) => {
    e.stopPropagation();
    const status = calculateOrderStatus(order);
    if (status === '׳”׳•׳—׳–׳¨' || status === '׳׳•׳©׳›׳¨' || status === '׳—׳׳§׳™׳×') {
      alert('׳׳ ׳ ׳™׳×׳ ׳׳׳—׳•׳§ ׳”׳–׳׳ ׳” ׳׳׳—׳¨ ׳”׳©׳›׳¨׳” ׳—׳׳§׳™׳×/׳׳׳׳” ׳׳• ׳׳׳—׳¨ ׳©׳ ׳׳§׳— ׳•׳”׳•׳—׳–׳¨');
      return;
    }
    
    if (await window.customConfirm('׳”׳׳ ׳׳×׳” ׳‘׳˜׳•׳— ׳©׳‘׳¨׳¦׳•׳ ׳ ׳׳׳—׳•׳§ ׳”׳–׳׳ ׳” ׳–׳•?')) {
      try {
        const res = await fetch(`/api/orders/${order.orderId}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          fetchOrders();
        } else {
          const data = await res.json();
          alert(data.error || '׳©׳’׳™׳׳” ׳‘׳׳—׳™׳§׳× ׳”׳–׳׳ ׳”');
        }
      } catch (err) {
        console.error(err);
        alert('׳©׳’׳™׳׳” ׳‘׳׳—׳™׳§׳× ׳”׳–׳׳ ׳”');
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
    <main className="container animate-fade-in" style={{ paddingTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, color: 'var(--primary-color)' }}>׳ ׳™׳”׳•׳ ׳×׳©׳׳•׳׳™׳</h1>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          
          {/* Status Filter Banner */}
          <div style={{ display: 'flex', gap: '0.3rem', background: 'var(--element-bg)', padding: '0.2rem', borderRadius: '8px' }}>
            <button onClick={() => { setFilterStatus('soon'); setPage(1); }} style={{ padding: '0.4rem', border: 'none', background: filterStatus === 'soon' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: filterStatus === 'soon' ? '#f57c00' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="׳‘׳§׳¨׳•׳‘ (׳”׳—׳ ׳׳”׳™׳•׳ ׳•׳׳™׳׳)">
              <CalendarDays size={20} />
              <span style={{ fontWeight: filterStatus === 'soon' ? 'bold' : 'normal' }}>׳‘׳§׳¨׳•׳‘</span>
            </button>
            <button onClick={() => { setFilterStatus('archive'); setPage(1); }} style={{ padding: '0.4rem', border: 'none', background: filterStatus === 'archive' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: filterStatus === 'archive' ? '#1565c0' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="׳׳¨׳›׳™׳•׳ / ׳¢׳‘׳¨">
              <Archive size={20} />
              <span style={{ fontWeight: filterStatus === 'archive' ? 'bold' : 'normal' }}>׳׳¨׳›׳™׳•׳/׳¢׳‘׳¨</span>
            </button>
            <button onClick={() => { setFilterStatus('deleted'); setPage(1); }} style={{ padding: '0.4rem', border: 'none', background: filterStatus === 'deleted' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: filterStatus === 'deleted' ? '#e53935' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="׳׳—׳•׳§׳™׳">
              <Trash2 size={20} />
              <span style={{ fontWeight: filterStatus === 'deleted' ? 'bold' : 'normal' }}>׳׳—׳•׳§</span>
            </button>
            <button onClick={() => { setFilterStatus('unpaid'); setPage(1); }} style={{ padding: '0.4rem', border: 'none', background: filterStatus === 'unpaid' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: filterStatus === 'unpaid' ? '#e11d48' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="׳׳ ׳©׳•׳׳ (׳—׳•׳“׳©׳™׳ ׳׳—׳¨׳•׳ ׳™׳)">
              <AlertCircle size={20} />
              <span style={{ fontWeight: filterStatus === 'unpaid' ? 'bold' : 'normal' }}>׳׳ ׳©׳•׳׳</span>
            </button>
            <button onClick={() => { setFilterStatus('unpaid_all'); setPage(1); }} style={{ padding: '0.4rem', border: 'none', background: filterStatus === 'unpaid_all' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: filterStatus === 'unpaid_all' ? '#e11d48' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="׳׳ ׳©׳•׳׳ (׳›׳•׳׳ ׳™׳©׳ ׳™׳)">
              <AlertCircle size={20} />
              <span style={{ fontWeight: filterStatus === 'unpaid_all' ? 'bold' : 'normal' }}>׳׳ ׳©׳•׳׳ (׳”׳›׳)</span>
            </button>
            <button onClick={() => { setFilterStatus('all'); setPage(1); }} style={{ padding: '0.4rem', border: 'none', background: filterStatus === 'all' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: filterStatus === 'all' ? '#1976d2' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="׳”׳¦׳’ ׳”׳›׳">
              <List size={20} />
              <span style={{ fontWeight: filterStatus === 'all' ? 'bold' : 'normal' }}>׳”׳›׳</span>
            </button>
          </div>

          <button 
             onClick={() => setShowCapacitySearch(true)} 
             className="btn btn-outline" 
             style={{ padding: '0.6rem', borderRadius: '8px', width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #ddd', color: '#10b981', backgroundColor: '#ecfdf5', cursor: 'pointer' }}
             title="׳—׳™׳₪׳•׳© ׳×׳₪׳•׳¡׳”"
          >
            <CalendarSearch size={22} />
          </button>

          <ExportButtons 
            data={orders.map(o => ({
              ...o,
              status: calculateOrderStatus(o)
            }))} 
            filename="׳”׳–׳׳ ׳•׳×" 
            columns={[
              { key: 'orderId', label: getLabel('order_id', '׳§׳•׳“ ׳”׳–׳׳ ׳”') },
              { key: 'customerName', label: getLabel('order_customerName', '׳׳§׳•׳—') },
              { key: 'totalAmount', label: getLabel('order_totalAmount', '׳¡׳›׳•׳ ׳׳—׳™׳•׳‘') },
              { key: 'totalPaid', label: '׳©׳•׳׳' },
              { key: 'status', label: getLabel('order_status', '׳¡׳˜׳˜׳•׳¡') }
            ]}
            iconOnly={true}
            onFetchData={fetchOrdersForExport}
          />

          <Link 
            href="/orders/new" 
            className="btn btn-primary" 
            style={{ padding: '0.6rem', borderRadius: '8px', width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#3b82f6', color: 'white' }}
            title="׳”׳–׳׳ ׳” ׳—׳“׳©׳”"
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
            <HebrewDatePicker value={jumpDate} onChange={setJumpDate} placeholder="קפיצה לתאריך..." />
          </div>
          <button 
            onClick={() => setShowAdvSearch(true)}
            className="btn btn-outline"
            style={{ borderRadius: '50%', width: '45px', height: '45px', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            title="׳—׳™׳₪׳•׳© ׳׳×׳§׳“׳"
          >
            נ”
          </button>
        </div>
        <div style={{ color: 'var(--text-muted)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span>׳¡׳”"׳› ׳¨׳©׳•׳׳•׳×: {totalCount}</span>
        </div>
      </div>

      {showAdvSearch && (
        <div className="modal-overlay" onClick={() => setShowAdvSearch(false)} style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '100%', background: 'var(--card-bg)', borderRadius: '16px', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <h2 style={{ color: 'var(--primary-color)', marginBottom: '1.5rem' }}>׳—׳™׳₪׳•׳© ׳׳×׳§׳“׳</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>{getLabel('order_id', '׳׳¡׳₪׳¨ ׳”׳–׳׳ ׳”')}</label>
                <input type="text" className="form-control" value={advFilters.advOrderId} onChange={e => setAdvFilters(p => ({...p, advOrderId: e.target.value}))} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>׳‘׳¨׳§׳•׳“/׳₪׳¨׳˜׳™ ׳₪׳¨׳™׳˜</label>
                <input type="text" className="form-control" value={advFilters.itemDetails} onChange={e => setAdvFilters(p => ({...p, itemDetails: e.target.value}))} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>{getLabel('order_customerName', '׳©׳ ׳׳§׳•׳—')}</label>
                <input type="text" className="form-control" value={advFilters.customerName} onChange={e => setAdvFilters(p => ({...p, customerName: e.target.value}))} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>׳˜׳׳₪׳•׳ ׳׳§׳•׳—</label>
                <input type="text" className="form-control" value={advFilters.customerPhone} onChange={e => setAdvFilters(p => ({...p, customerPhone: e.target.value}))} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>׳¢׳™׳¨ ׳׳’׳•׳¨׳™׳</label>
                <input type="text" className="form-control" value={advFilters.customerCity} onChange={e => setAdvFilters(p => ({...p, customerCity: e.target.value}))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowAdvSearch(false)}>׳¡׳’׳•׳¨ ׳•׳”׳—׳ ׳¡׳™׳ ׳•׳</button>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => {
                setAdvFilters({ customerName: '', customerPhone: '', customerCity: '', advOrderId: '', itemDetails: '', eventDateFrom: '', eventDateTo: '' });
              }}>׳ ׳§׳” ׳”׳›׳</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '2rem', flexDirection: 'row', flexWrap: 'wrap' }}>
        
        {/* Orders List */}
        <div style={{ flex: '1 1 600px' }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1rem', boxShadow: 'var(--shadow-sm)', overflowX: 'auto' }}>
            {loading && orders.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>׳˜׳•׳¢׳ ׳ ׳×׳•׳ ׳™׳...</div>
            ) : (
              <>
                <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #ddd', color: 'var(--text-muted)' }}>
                      <th style={thStyle} onClick={() => handleSort('orderId')}>{getLabel('order_id', '׳§׳•׳“ ׳”׳–׳׳ ׳”')} <SortIcon column="orderId" /></th>
                      <th style={thStyle} onClick={() => handleSort('customerName')}>{getLabel('order_customerName', '׳׳§׳•׳—')} <SortIcon column="customerName" /></th>
                      <th style={thStyle}>׳›׳׳•׳× ׳₪׳¨׳™׳˜׳™׳</th>
                      <th style={thStyle} onClick={() => handleSort('eventDateHebrew')}>׳×׳׳¨׳™׳ ׳¢׳‘׳¨׳™ <SortIcon column="eventDateHebrew" /></th>
                      <th style={thStyle} onClick={() => handleSort('totalAmount')}>{getLabel('order_totalAmount', '׳¡׳›׳•׳ ׳׳—׳™׳•׳‘')} <SortIcon column="totalAmount" /></th>
                      <th style={thStyle} onClick={() => handleSort('totalPaid')}>׳©׳•׳׳ <SortIcon column="totalPaid" /></th>
                      <th style={thStyle} onClick={() => handleSort('status')}>{getLabel('order_status', '׳¡׳˜׳˜׳•׳¡')} <SortIcon column="status" /></th>
                      <th style={{ padding: '1rem' }}>׳₪׳¢׳•׳׳•׳×</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => {
                      const isUnpaid = order.totalPaid < order.totalAmount && order.totalAmount > 0;
                      return (
                      <tr key={order.orderId} style={{ 
                        borderBottom: '1px solid #eee', 
                        transition: 'background 0.2s', 
                        cursor: 'pointer', 
                        background: selectedOrder?.orderId === order.orderId ? '#f5f5f5' : (isUnpaid ? '#fff4f4' : 'transparent'),
                        borderRight: isUnpaid ? '4px solid #ef4444' : 'none'
                      }} onClick={() => router.push(`/orders/${order.orderId}`)}>
                        <td style={{ padding: '1rem', fontWeight: isUnpaid ? 'bold' : 'normal', color: isUnpaid ? '#b91c1c' : 'inherit' }}>
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
                        <td style={{ padding: '1rem' }}>ג‚×{order.totalAmount}</td>
                        <td style={{ padding: '1rem', color: order.totalPaid >= order.totalAmount && order.totalAmount > 0 ? 'green' : (isUnpaid ? '#dc2626' : 'inherit'), fontWeight: isUnpaid ? 'bold' : 'normal' }}>ג‚×{order.totalPaid}</td>
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
                            title="׳›׳¨׳˜׳™׳¡ ׳”׳–׳׳ ׳”"
                          >
                            <FileText size={18} />
                          </Link>
                          <button 
                            className="btn btn-primary" 
                            style={{ padding: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', width: '38px', height: '38px', border: 'none', cursor: 'pointer', backgroundColor: '#ecfdf5', color: '#10b981' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRentalModalOrderId(order.orderId);
                            }}
                            title="׳׳¢׳‘׳¨ ׳׳”׳©׳›׳¨׳”/׳”׳—׳–׳¨׳”"
                          >
                            <Shirt size={18} />
                          </button>
                          <button 
                            className="btn btn-outline" 
                            style={{ padding: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', width: '38px', height: '38px', border: '1px solid #fee2e2', cursor: 'pointer', backgroundColor: '#fef2f2', color: '#ef4444' }}
                            onClick={(e) => handleDeleteOrder(order, e)}
                            title="׳׳—׳™׳§׳× ׳”׳–׳׳ ׳”"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
                
                {/* Pagination Controls */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem', padding: '1rem 0' }}>
                  <button className="btn btn-outline" disabled={page >= totalPages || isAiModeActive} onClick={() => setPage(p => p + 1)} style={{ padding: '0.5rem 1rem' }}>הבא &gt;</button>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>עמוד <input type="number" min={1} max={totalPages || 1} value={page} onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) setPage(v); }} style={{ width: '60px', padding: '0.3rem', textAlign: 'center', borderRadius: '6px', border: '1px solid var(--element-border)' }} disabled={isAiModeActive} /> מתוך {totalPages}</span>
                  <button className="btn btn-outline" disabled={page <= 1 || isAiModeActive} onClick={() => setPage(p => p - 1)} style={{ padding: '0.5rem 1rem' }}>&lt; הקודם</button>
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
            ׳”׳–׳׳ ׳” #{hoveredOrder.orderId}
          </div>
          <div className="global-popoverRow">
            <span>׳׳§׳•׳—:</span>
            <span>{hoveredOrder.customerName}</span>
          </div>
          <div className="global-popoverRow">
            <span><Phone size={14} /> ׳˜׳׳₪׳•׳:</span>
            <span dir="ltr">{hoveredOrder.customerPhone || '׳׳ ׳”׳•׳–׳'}</span>
          </div>
          <div className="global-popoverRow">
            <span><CalendarIcon2 size={14} /> ׳×׳׳¨׳™׳ ׳¢׳‘׳¨׳™:</span>
            <span>{hoveredOrder.eventDateHebrew || '׳׳ ׳¦׳•׳™׳'}</span>
          </div>
          <div className="global-popoverRow">
            <span><CalendarIcon2 size={14} /> ׳×׳׳¨׳™׳ ׳׳•׳¢׳–׳™:</span>
            <span>{hoveredOrder.eventDate ? new Date(hoveredOrder.eventDate).toLocaleDateString('he-IL') : '׳׳ ׳¦׳•׳™׳'}</span>
          </div>
          <div className="global-popoverRow">
            <span><Shirt size={14} /> ׳”׳•׳©׳›׳¨:</span>
            <span>{hoveredOrder.items ? hoveredOrder.items.filter(i => !i.isDeleted && i.isTaken).length : 0}</span>
          </div>
          <div className="global-popoverRow">
            <span><Shirt size={14} /> ׳”׳•׳—׳–׳¨:</span>
            <span>{hoveredOrder.items ? hoveredOrder.items.filter(i => !i.isDeleted && i.isReturned).length : 0}</span>
          </div>
          <div className="global-popoverRow">
            <span><CreditCard size={14} /> ׳¡׳”"׳› ׳׳×׳©׳׳•׳:</span>
            <span>ג‚×{hoveredOrder.totalAmount || 0}</span>
          </div>
          <div className="global-popoverRow">
            <span><CheckCircle2 size={14} /> ׳©׳•׳׳:</span>
            <span style={{ color: hoveredOrder.totalPaid >= hoveredOrder.totalAmount && hoveredOrder.totalAmount > 0 ? '#10b981' : (hoveredOrder.totalPaid > 0 ? '#f59e0b' : '#ef4444'), fontWeight: 'bold' }}>
              ג‚×{hoveredOrder.totalPaid || 0}
            </span>
          </div>
          <div className="global-popoverRow">
            <span>׳¡׳˜׳˜׳•׳¡:</span>
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
