'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ExportButtons from '../../components/ExportButtons';
import AISearchBar from '../components/AISearchBar';
import StatisticsModal from '../components/StatisticsModal';

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

  const [advFilters, setAdvFilters] = useState({
    firstName: '', lastName: '', phone: '', city: '', email: ''
  });
  const [showAdvSearch, setShowAdvSearch] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQueryUsed, setAiQueryUsed] = useState('');
  const [isAiModeActive, setIsAiModeActive] = useState(false);

  const fetchCustomers = useCallback(async () => {
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

      const res = await fetch(`/api/customers?${queryParams.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      setCustomers(data.data || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, sort, order, advFilters]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

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
        body: JSON.stringify({ prompt: query, pageContext: 'customers' })
      });
      const result = await res.json();
      if (res.ok) {
        setCustomers(result.data || []);
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
      fetchCustomers();
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
    if (sort !== column) return <span style={{ opacity: 0.3, marginRight: '4px' }}>⇅</span>;
    return <span style={{ marginRight: '4px' }}>{order === 'asc' ? '↑' : '↓'}</span>;
  };

  const fetchCustomersForExport = async (exportLimit) => {
    try {
      const queryParams = new URLSearchParams({
        page: '1',
        limit: exportLimit.toString(),
        search,
        sort,
        order
      });
      Object.entries(advFilters).forEach(([k, v]) => {
        if (v) queryParams.append(k, v);
      });
      const res = await fetch(`/api/customers?${queryParams.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      return data.data || [];
    } catch (e) {
      console.error(e);
      return [];
    }
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
        <div style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '600px' }}>
          <AISearchBar 
            placeholder="חיפוש לקוח (שם, טלפון, עיר)..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={handleSearch}
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
        <div style={{ color: 'var(--text-muted)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <ExportButtons 
            data={customers} 
            filename="לקוחות" 
            columns={[
              { key: 'id', label: 'קוד לקוח' },
              { key: 'firstName', label: 'שם פרטי' },
              { key: 'lastName', label: 'שם משפחה' },
              { key: 'phone1', label: 'טלפון' },
              { key: 'city', label: 'עיר' },
              { key: 'email', label: 'דוא"ל' }
            ]} 
            onFetchData={fetchCustomersForExport}
          />
          <span>סה"כ רשומות: {totalCount}</span>
        </div>
      </div>

      {showAdvSearch && (
        <div className="modal-overlay" onClick={() => setShowAdvSearch(false)} style={{ zIndex: 1000 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h2 style={{ color: 'var(--primary-color)', marginBottom: '1.5rem' }}>חיפוש מתקדם (לקוחות)</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>שם פרטי</label>
                <input type="text" className="form-control" value={advFilters.firstName} onChange={e => setAdvFilters(p => ({...p, firstName: e.target.value}))} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>שם משפחה</label>
                <input type="text" className="form-control" value={advFilters.lastName} onChange={e => setAdvFilters(p => ({...p, lastName: e.target.value}))} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>טלפון</label>
                <input type="text" className="form-control" value={advFilters.phone} onChange={e => setAdvFilters(p => ({...p, phone: e.target.value}))} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>עיר מגורים</label>
                <input type="text" className="form-control" value={advFilters.city} onChange={e => setAdvFilters(p => ({...p, city: e.target.value}))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>דוא"ל</label>
                <input type="text" className="form-control" value={advFilters.email} onChange={e => setAdvFilters(p => ({...p, email: e.target.value}))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowAdvSearch(false)}>סגור והחל סינון</button>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => {
                setAdvFilters({ firstName: '', lastName: '', phone: '', city: '', email: '' });
              }}>נקה הכל</button>
            </div>
          </div>
        </div>
      )}

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

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem', padding: '1rem 0' }}>
              <button 
                className="btn btn-outline"
                disabled={page >= totalPages || isAiModeActive} 
                onClick={() => setPage(p => p + 1)}
                style={{ padding: '0.5rem 1rem' }}
              >
                הבא
              </button>
              <span>עמוד {page} מתוך {totalPages}</span>
              <button 
                className="btn btn-outline"
                disabled={page <= 1 || isAiModeActive} 
                onClick={() => setPage(p => p - 1)}
                style={{ padding: '0.5rem 1rem' }}
              >
                הקודם
              </button>
            </div>
          </>
        )}
      </div>

      <StatisticsModal 
        isOpen={showStatistics} 
        onClose={() => setShowStatistics(false)} 
        pageContext="customers"
        contextQuery={aiQueryUsed}
      />
    </main>
  );
}
