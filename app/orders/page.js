'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { calculateOrderStatus, getStatusColor } from '../../lib/orderStatus';
import CapacitySearchModal from '../../components/CapacitySearchModal';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState('orderId');
  const [order, setOrder] = useState('desc');
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [advFilters, setAdvFilters] = useState({
    customerName: '', customerPhone: '', customerCity: '', 
    advOrderId: '', itemDetails: '', eventDateFrom: '', eventDateTo: ''
  });
  const [showAdvSearch, setShowAdvSearch] = useState(false);
  const [showCapacitySearch, setShowCapacitySearch] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search,
        sort,
        order
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
  }, [page, limit, search, sort, order, selectedOrder, advFilters]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
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
    if (sort !== column) return <span style={{ opacity: 0.3, marginRight: '4px' }}>⇅</span>;
    return <span style={{ marginRight: '4px' }}>{order === 'asc' ? '↑' : '↓'}</span>;
  };

  const thStyle = { padding: '1rem', cursor: 'pointer', userSelect: 'none' };

  return (
    <main className="container animate-fade-in" style={{ paddingTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, color: 'var(--primary-color)' }}>ניהול הזמנות ותשלומים</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={() => setShowCapacitySearch(true)} className="btn btn-outline" style={{ padding: '0.8rem 1.5rem', borderRadius: '8px', fontWeight: 'bold' }}>
            חיפוש תפוסה
          </button>
          <Link href="/orders/new" className="btn btn-primary" style={{ padding: '0.8rem 1.5rem', borderRadius: '8px', fontWeight: 'bold' }}>
            + הזמנה חדשה
          </Link>
        </div>
      </div>
      
      {/* Search and Filters */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '500px' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input 
                type="text" 
                placeholder="חיפוש הזמנה (מספר הזמנה, שם לקוח)..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{ 
                  width: '100%',
                  padding: '0.75rem 2.5rem 0.75rem 1rem', 
                  borderRadius: '24px', 
                  border: '1px solid #ddd',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                  outline: 'none',
                  fontSize: '1rem'
                }}
              />
              {searchInput && (
                <button 
                  type="button"
                  onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: '1.2rem', padding: '0' }}
                  title="נקה חיפוש"
                >
                  &times;
                </button>
              )}
            </div>
            <button type="submit" className="btn btn-primary" style={{ borderRadius: '24px', padding: '0.75rem 1.5rem' }}>
              חיפוש
            </button>
          </form>
          <button 
            onClick={() => setShowAdvSearch(true)}
            className="btn btn-outline"
            style={{ borderRadius: '50%', width: '45px', height: '45px', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            title="חיפוש מתקדם"
          >
            🔍
          </button>
        </div>
        <div style={{ color: 'var(--text-muted)' }}>
          סה"כ רשומות: {totalCount}
        </div>
      </div>

      {showAdvSearch && (
        <div className="modal-overlay" onClick={() => setShowAdvSearch(false)} style={{ zIndex: 1000 }}>
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

      <div style={{ display: 'flex', gap: '2rem', flexDirection: 'row', flexWrap: 'wrap' }}>
        
        {/* Orders List */}
        <div style={{ flex: '1 1 600px' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '1rem', boxShadow: 'var(--shadow-sm)', overflowX: 'auto' }}>
            {loading && orders.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>טוען נתונים...</div>
            ) : (
              <>
                <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #ddd', color: 'var(--text-muted)' }}>
                      <th style={thStyle} onClick={() => handleSort('orderId')}>קוד הזמנה <SortIcon column="orderId" /></th>
                      <th style={thStyle} onClick={() => handleSort('customerName')}>לקוח <SortIcon column="customerName" /></th>
                      <th style={thStyle} onClick={() => handleSort('totalAmount')}>סכום לחיוב <SortIcon column="totalAmount" /></th>
                      <th style={thStyle} onClick={() => handleSort('totalPaid')}>סכום ששולם <SortIcon column="totalPaid" /></th>
                      <th style={thStyle} onClick={() => handleSort('status')}>סטטוס <SortIcon column="status" /></th>
                      <th style={{ padding: '1rem' }}>פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => (
                      <tr key={order.orderId} style={{ borderBottom: '1px solid #eee', transition: 'background 0.2s', cursor: 'pointer', background: selectedOrder?.orderId === order.orderId ? '#f5f5f5' : 'transparent' }} onClick={() => setSelectedOrder(order)}>
                        <td style={{ padding: '1rem' }}>#{order.orderId}</td>
                        <td style={{ padding: '1rem', fontWeight: '500' }}>{order.customerName}</td>
                        <td style={{ padding: '1rem' }}>₪{order.totalAmount}</td>
                        <td style={{ padding: '1rem', color: order.totalPaid >= order.totalAmount && order.totalAmount > 0 ? 'green' : 'inherit' }}>₪{order.totalPaid}</td>
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
                        <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <Link 
                            href={`/orders/${order.orderId}`} 
                            className="btn btn-outline" 
                            style={{ padding: '0.4rem 1rem', fontSize: '0.9rem', textDecoration: 'none', display: 'inline-block' }}
                            onClick={(e) => e.stopPropagation()}
                            title="כרטיס הזמנה"
                          >
                            פירוט
                          </Link>
                          <Link 
                            href={`/rentals?orderId=${order.orderId}`} 
                            className="btn btn-primary" 
                            style={{ padding: '0.4rem 0.6rem', fontSize: '1rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
                            onClick={(e) => e.stopPropagation()}
                            title="מעבר להשכרה/החזרה"
                          >
                            👗
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {/* Pagination Controls */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem', padding: '1rem 0' }}>
                  <button 
                    className="btn btn-outline"
                    disabled={page >= totalPages} 
                    onClick={() => setPage(p => p + 1)}
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    הבא &gt;
                  </button>
                  <span style={{ fontWeight: '500' }}>עמוד {page} מתוך {totalPages}</span>
                  <button 
                    className="btn btn-outline"
                    disabled={page <= 1} 
                    onClick={() => setPage(p => p - 1)}
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    &lt; קודם
                  </button>
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
    </main>
  );
}
