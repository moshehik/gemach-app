'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ExportButtons from '../../components/ExportButtons';
import AISearchBar from '../components/AISearchBar';
import StatisticsModal from '../components/StatisticsModal';
import { UserPlus } from 'lucide-react';

import { useLabels } from '@/app/components/LabelsContext';

const customersCache = new Map();

export default function CustomersPage() {
  const router = useRouter();
  const { getLabel } = useLabels();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [limit] = useState(50); // Show 50 per page
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState('legacyId');
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

  const fetchCustomers = useCallback(async (isPrefetch = false, targetPage = page) => {
    if (!isPrefetch) setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: targetPage.toString(),
        limit: limit.toString(),
        search,
        sort,
        order
      });
      Object.entries(advFilters).forEach(([k, v]) => {
        if (v) queryParams.append(k, v);
      });
      
      const cacheKey = queryParams.toString();
      
      // SWR: Instant Cache Hit
      if (!isPrefetch && customersCache.has(cacheKey)) {
        const cachedData = customersCache.get(cacheKey);
        setCustomers(cachedData.data || []);
        setTotalPages(cachedData.totalPages || 1);
        setTotalCount(cachedData.total || 0);
        setLoading(false); // UI becomes interactive instantly
      }

      const timestamp = new Date().getTime();
      queryParams.append('_t', timestamp);

      const res = await fetch(`/api/customers?${queryParams.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      
      // Update Cache silently
      customersCache.set(cacheKey, data);

      if (!isPrefetch && targetPage === page) {
        setCustomers(data.data || []);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.total || 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!isPrefetch) setLoading(false);
    }
  }, [page, limit, search, sort, order, advFilters]);

  useEffect(() => {
    fetchCustomers(false, page);
    
    // Background Prefetching for the next page
    const timer = setTimeout(() => {
      if (page < totalPages) {
        fetchCustomers(true, page + 1);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [fetchCustomers, page, totalPages]);

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
    <>
    <main data-agy-id="customers_main_container" className="container animate-fade-in" style={{ paddingTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--primary-color)', margin: 0 }}>ניהול לקוחות</h1>
      </div>
      
      {/* Search and Filters */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '600px' }}>
          <AISearchBar data-element-name="רכיב_page_1" 
            placeholder="חיפוש לקוח (שם, טלפון, עיר)..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={handleSearch}
            onClear={handleClearSearch}
            onAiSearch={handleAiSearch}
            onStatistics={(e) => setShowStatistics({ x: e.clientX, y: e.clientY })}
            loading={aiLoading}
          />
          <button data-element-name="כפתור_page_2" 
            data-agy-id="advanced_search_btn"
            onClick={() => setShowAdvSearch(true)}
            className="btn btn-outline"
            style={{ borderRadius: '50%', width: '45px', height: '45px', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            title="חיפוש מתקדם"
          >
            🔍
          </button>
        </div>
        <div style={{ color: 'var(--text-muted)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button data-element-name="כפתור_page_3" 
            data-agy-id="new_customer_btn"
            onClick={() => router.push('/customers/new')} 
            className="btn btn-primary" 
            style={{ borderRadius: '50%', width: '45px', height: '45px', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            title="לקוח חדש"
          >
            <UserPlus data-element-name="רכיב_page_4" size={20} />
          </button>
          <ExportButtons data-element-name="רכיב_page_5" 
            data={customers} 
            filename="לקוחות" 
            columns={[
              { key: 'id', label: 'קוד לקוח' },
              { key: 'firstName', label: getLabel('customer_firstName', 'שם פרטי') },
              { key: 'lastName', label: getLabel('customer_lastName', 'שם משפחה') },
              { key: 'phone1', label: getLabel('customer_phone1', 'טלפון') },
              { key: 'city', label: getLabel('customer_city', 'עיר') },
              { key: 'email', label: getLabel('customer_email', 'דוא"ל') }
            ]} 
            onFetchData={fetchCustomersForExport}
          />
          <span>סה"כ רשומות: {totalCount}</span>
        </div>
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1rem', boxShadow: 'var(--shadow-sm)' }}>
        {loading && customers.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>טוען נתונים...</div>
        ) : (
          <>
            <div style={{ overflowX: 'auto', minHeight: '50vh' }}>
              <table data-agy-id="customers_table" style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #ddd', color: 'var(--text-muted)' }}>
                  <th data-element-name="לחיץ_page_6" style={thStyle} onClick={() => handleSort('id')}>קוד לקוח <SortIcon data-element-name="רכיב_page_7" column="id" /></th>
                  <th data-element-name="לחיץ_page_8" style={thStyle} onClick={() => handleSort('firstName')}>{getLabel('customer_firstName', 'שם פרטי')} <SortIcon data-element-name="רכיב_page_9" column="firstName" /></th>
                  <th data-element-name="לחיץ_page_10" style={thStyle} onClick={() => handleSort('lastName')}>{getLabel('customer_lastName', 'שם משפחה')} <SortIcon data-element-name="רכיב_page_11" column="lastName" /></th>
                  <th data-element-name="לחיץ_page_12" style={thStyle} onClick={() => handleSort('phone1')}>{getLabel('customer_phone1', 'טלפון')} <SortIcon data-element-name="רכיב_page_13" column="phone1" /></th>
                  <th data-element-name="לחיץ_page_14" style={thStyle} onClick={() => handleSort('city')}>{getLabel('customer_city', 'עיר')} <SortIcon data-element-name="רכיב_page_15" column="city" /></th>
                  <th data-element-name="לחיץ_page_16" style={thStyle} onClick={() => handleSort('email')}>{getLabel('customer_email', 'דוא"ל')} <SortIcon data-element-name="רכיב_page_17" column="email" /></th>
                </tr>
              </thead>
              <tbody>

                {customers.map(customer => (
                  <tr data-element-name="לחיץ_page_18" data-agy-id="customer_row_tr" key={customer.id} style={{ borderBottom: '1px solid #eee', cursor: 'pointer', transition: 'background 0.2s' }} onClick={() => router.push(`/customers/${customer.id}`)} onMouseEnter={e => e.currentTarget.style.background = 'var(--element-bg)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '1rem' }}>{customer.legacyId || 'חדש'}</td>
                    <td style={{ padding: '1rem', fontWeight: '500' }}>{customer.firstName}</td>
                    <td style={{ padding: '1rem', fontWeight: '500' }}>{customer.lastName}</td>
                    <td style={{ padding: '1rem' }}>{customer.phone1}</td>
                    <td style={{ padding: '1rem' }}>{customer.city}</td>
                    <td style={{ padding: '1rem' }}>{customer.email || '-'}</td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>

            {/* Sticky Bottom Bar */}
            <div style={{ position: 'sticky', bottom: '-1rem', background: 'var(--card-bg)', padding: '1rem', borderTop: '1px solid var(--element-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10, margin: '0 -1rem -1rem -1rem', borderRadius: '0 0 12px 12px', boxShadow: '0 -4px 10px rgba(0,0,0,0.05)', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ fontWeight: 'bold' }}>סה"כ שורות מוצגות: {customers.length}</div>
              
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
                  <button data-element-name="כפתור_page_19" 
                    data-agy-id="prev_page_btn"
                    className="btn btn-outline"
                    disabled={page <= 1 || isAiModeActive} 
                    onClick={() => setPage(p => p - 1)}
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    הקודם &gt;
                  </button>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    עמוד 
                    <input data-element-name="שדה_page_20" 
                      data-agy-id="current_page_input"
                      type="number" 
                      min={1} 
                      max={totalPages || 1} 
                      value={page} 
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        if (v >= 1 && v <= totalPages) setPage(v);
                      }} 
                      style={{ width: '60px', padding: '0.3rem', textAlign: 'center', borderRadius: '6px', border: '1px solid var(--element-border)', background: 'var(--input-bg)', color: 'var(--text-main)' }} 
                      disabled={isAiModeActive}
                    /> 
                    מתוך {totalPages}
                  </span>
                  <button data-element-name="כפתור_page_21" 
                    data-agy-id="next_page_btn"
                    className="btn btn-outline"
                    disabled={page >= totalPages || isAiModeActive} 
                    onClick={() => setPage(p => p + 1)}
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    &lt; הבא
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <StatisticsModal data-element-name="רכיב_page_22" 
        isOpen={!!showStatistics} 
        onClose={() => setShowStatistics(false)} 
        pageContext="customers"
        contextQuery={aiQueryUsed}
        position={typeof showStatistics === 'object' ? showStatistics : null}
      />
    </main>
      {showAdvSearch && (
        <div data-element-name="לחיץ_page_23" data-agy-id="adv_search_modal_overlay" className="modal-overlay" onClick={() => setShowAdvSearch(false)} style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div data-element-name="לחיץ_page_24" data-agy-id="adv_search_modal_content" className="modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '100%', background: 'var(--card-bg)', borderRadius: '16px', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <h2 style={{ color: 'var(--primary-color)', marginBottom: '1.5rem' }}>חיפוש מתקדם (לקוחות)</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>{getLabel('customer_firstName', 'שם פרטי')}</label>
                <input data-element-name="שדה_page_25" data-agy-id="adv_search_firstname_input" type="text" className="form-control" value={advFilters.firstName} onChange={e => setAdvFilters(p => ({...p, firstName: e.target.value}))} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>{getLabel('customer_lastName', 'שם משפחה')}</label>
                <input data-element-name="שדה_page_26" data-agy-id="adv_search_lastname_input" type="text" className="form-control" value={advFilters.lastName} onChange={e => setAdvFilters(p => ({...p, lastName: e.target.value}))} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>{getLabel('customer_phone1', 'טלפון')}</label>
                <input data-element-name="שדה_page_27" data-agy-id="adv_search_phone_input" type="text" className="form-control" value={advFilters.phone} onChange={e => setAdvFilters(p => ({...p, phone: e.target.value}))} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>{getLabel('customer_city', 'עיר מגורים')}</label>
                <input data-element-name="שדה_page_28" data-agy-id="adv_search_city_input" type="text" className="form-control" value={advFilters.city} onChange={e => setAdvFilters(p => ({...p, city: e.target.value}))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>{getLabel('customer_email', 'דוא"ל')}</label>
                <input data-element-name="שדה_page_29" data-agy-id="adv_search_email_input" type="text" className="form-control" value={advFilters.email} onChange={e => setAdvFilters(p => ({...p, email: e.target.value}))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
              <button data-element-name="כפתור_page_30" data-agy-id="apply_adv_search_btn" className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowAdvSearch(false)}>סגור והחל סינון</button>
              <button data-element-name="כפתור_page_31" data-agy-id="clear_adv_search_btn" className="btn btn-outline" style={{ flex: 1 }} onClick={() => {
                setAdvFilters({ firstName: '', lastName: '', phone: '', city: '', email: '' });
              }}>נקה הכל</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
