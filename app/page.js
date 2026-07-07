'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [limit] = useState(50); // Show 50 per page
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState('id');
  const [order, setOrder] = useState('desc');
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&sort=${sort}&order=${order}`);
      const data = await res.json();
      setCustomers(data.data || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, sort, order]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

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
        <h1 style={{ color: 'var(--primary-color)', margin: 0 }}>ניהול לקוחות</h1>
        <button 
          onClick={() => router.push('/customers/new')} 
          className="btn btn-primary" 
          style={{ borderRadius: '24px', padding: '0.75rem 1.5rem', fontWeight: 'bold' }}
        >
          + לקוח חדש
        </button>
      </div>
      
      {/* Search and Filters */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '400px' }}>
          <input 
            type="text" 
            placeholder="חיפוש לקוח (שם, טלפון, עיר)..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ 
              flex: 1, 
              padding: '0.75rem 1rem', 
              borderRadius: '24px', 
              border: '1px solid #ddd',
              boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
              outline: 'none',
              fontSize: '1rem'
            }}
          />
          <button type="submit" className="btn btn-primary" style={{ borderRadius: '24px', padding: '0.75rem 1.5rem' }}>
            חיפוש
          </button>
        </form>
        <div style={{ color: 'var(--text-muted)' }}>
          סה"כ רשומות: {totalCount}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', padding: '1rem', boxShadow: 'var(--shadow-sm)', overflowX: 'auto' }}>
        {loading && customers.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>טוען נתונים...</div>
        ) : (
          <>
            <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #ddd', color: 'var(--text-muted)' }}>
                  <th style={thStyle} onClick={() => handleSort('id')}>קוד לקוח <SortIcon column="id" /></th>
                  <th style={thStyle} onClick={() => handleSort('firstName')}>שם פרטי <SortIcon column="firstName" /></th>
                  <th style={thStyle} onClick={() => handleSort('lastName')}>שם משפחה <SortIcon column="lastName" /></th>
                  <th style={thStyle} onClick={() => handleSort('phone1')}>טלפון <SortIcon column="phone1" /></th>
                  <th style={thStyle} onClick={() => handleSort('city')}>עיר <SortIcon column="city" /></th>
                  <th style={thStyle} onClick={() => handleSort('email')}>דוא"ל <SortIcon column="email" /></th>
                </tr>
              </thead>
              <tbody>
                {customers.map(customer => (
                  <tr key={customer.id} style={{ borderBottom: '1px solid #eee', cursor: 'pointer', transition: 'background 0.2s' }} onClick={() => router.push(`/customers/${customer.id}`)} onMouseEnter={e => e.currentTarget.style.background = '#f9f9f9'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '1rem' }}>{customer.id}</td>
                    <td style={{ padding: '1rem', fontWeight: '500' }}>{customer.firstName}</td>
                    <td style={{ padding: '1rem', fontWeight: '500' }}>{customer.lastName}</td>
                    <td style={{ padding: '1rem' }}>{customer.phone1}</td>
                    <td style={{ padding: '1rem' }}>{customer.city}</td>
                    <td style={{ padding: '1rem' }}>{customer.email || '-'}</td>
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
    </main>
  );
}
