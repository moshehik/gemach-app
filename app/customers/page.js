'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ExportButtons from '../../components/ExportButtons';
import StatisticsModal from '../components/StatisticsModal';

import { useLabels } from '@/app/components/LabelsContext';
import { cacheNamespace } from '@/app/lib/pageCache';
import { buildCustomersListParams } from '@/app/lib/prefetchRoutes';

// מטמון SWR משותף — ראה app/lib/pageCache.js
const customersCache = cacheNamespace('customers');

// בונה משפט חיפוש טבעי מתוך שדות הסינון המתקדם שמולאו בפועל, לשימוש כשמסמנים
// "חפש עם AI על השדות שמולאו" ולוחצים "סגור והחל סינון" — נשלח ל-handleAiSearch
// הקיים במקום סינון מילולי (ראה item 32 בפאנץ'-ליסט).
const buildCustomersAiPrompt = (f) => {
  const parts = [];
  const fullName = [f.firstName, f.lastName].filter(Boolean).join(' ');
  if (fullName) parts.push(`בשם ${fullName}`);
  if (f.phone) parts.push(`עם טלפון ${f.phone}`);
  if (f.city) parts.push(`מהעיר ${f.city}`);
  if (f.email) parts.push(`עם דוא"ל ${f.email}`);
  if (parts.length === 0) return '';
  return `לקוחות ${parts.join(', ')}`;
};

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
  // לשוניות מודל הסינון המתקדם (item 33) + מצב חיפוש AI על השדות שמולאו (item 32)
  const [advTab, setAdvTab] = useState('basic');
  const [advAiMode, setAdvAiMode] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQueryUsed, setAiQueryUsed] = useState('');
  const [isAiModeActive, setIsAiModeActive] = useState(false);

  // מצב תצוגת סרגל החיפוש (חיפוש רגיל / חכם AI) — מחליף את המצב הפנימי שהיה
  // חבוי בתוך רכיב AISearchBar הישן; ההתנהגות זהה, רק המבנה/הסגנון עברו לעיצוב החדש.
  const [aiInputMode, setAiInputMode] = useState(false);
  const [aiInputText, setAiInputText] = useState('');

  const fetchCustomers = useCallback(async (isPrefetch = false, targetPage = page) => {
    if (!isPrefetch) setLoading(true);
    try {
      const queryParams = buildCustomersListParams({
        page: targetPage, limit, search, sort, order, advFilters
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
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const searchParam = params.get('search');
      if (searchParam) {
        setSearch(searchParam);
        setSearchInput(searchParam);
      }
    }
  }, []);

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

  const toggleAiInputMode = () => {
    if (!aiInputMode) {
      setAiInputText(searchInput || '');
    } else {
      setSearchInput(aiInputText || '');
    }
    setAiInputMode(v => !v);
  };

  const handleAiInputSubmit = (e) => {
    e.preventDefault();
    if (!aiInputText.trim()) return;
    handleAiSearch(aiInputText);
  };

  const handleSort = (column) => {
    if (sort === column) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(column);
      setOrder('asc');
    }
  };

  const renderSortIcon = (column) => {
    if (sort !== column) {
      return <svg className="icon"><use href="#i-sort" /></svg>;
    }
    return (
      <svg className="icon" style={{ opacity: 1, color: 'var(--primary-solid)', transform: order === 'desc' ? 'rotate(180deg)' : 'none' }}>
        <use href="#i-chevron-down" />
      </svg>
    );
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

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ניהול לקוחות</h1>
          <div className="page-desc">סה"כ רשומות: {totalCount}</div>
        </div>
        <div className="page-actions">
          <button
            onClick={() => setShowAdvSearch(true)}
            className="btn btn-secondary btn-icon-only"
            title="חיפוש מתקדם"
          >
            <svg className="icon"><use href="#i-list" /></svg>
          </button>

          <ExportButtons
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
            iconOnly={true}
          />

          <button
            onClick={() => router.push('/customers/new')}
            className="btn btn-primary"
          >
            <svg className="icon"><use href="#i-plus" /></svg>
            לקוח חדש
          </button>
        </div>
      </div>

      {/* סרגל חיפוש: חיפוש טקסטואלי רגיל + מעבר לחיפוש חכם (AI) + שאלות סטטיסטיקה, במסגרת אחת */}
      <div className="toolbar">
        {aiInputMode ? (
          <form onSubmit={handleAiInputSubmit} className="search-toolbar">
            {aiLoading
              ? <span className="spinner" style={{ width: '15px', height: '15px', borderWidth: '2px' }} />
              : <svg className="icon" style={{ color: 'var(--accent)' }}><use href="#i-star" /></svg>}
            <input
              type="text"
              value={aiInputText}
              onChange={(e) => setAiInputText(e.target.value)}
              placeholder="בקש מה-AI למצוא נתונים (למשל: 'לקוחות מירושלים')..."
              disabled={aiLoading}
            />
            <div className="search-toolbar-actions">
              {aiInputText && !aiLoading && (
                <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="נקה" onClick={() => setAiInputText('')}>
                  <svg className="icon"><use href="#i-x" /></svg>
                </button>
              )}
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="חיפוש חכם (AI)" style={{ color: 'var(--accent)', background: 'var(--accent-tint)' }} onClick={toggleAiInputMode}>
                <svg className="icon"><use href="#i-star" /></svg>
              </button>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="שאלות סטטיסטיקה" onClick={(e) => setShowStatistics({ x: e.clientX, y: e.clientY })}>
                <svg className="icon"><use href="#i-activity" /></svg>
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={aiLoading}>
                {aiLoading ? 'מייצר שאילתה...' : 'חפש בחכמה'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSearch} className="search-toolbar">
            <svg className="icon"><use href="#i-search" /></svg>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="חיפוש לקוח (שם, טלפון, עיר)..."
            />
            <div className="search-toolbar-actions">
              {searchInput && (
                <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="ניקוי חיפוש" onClick={handleClearSearch}>
                  <svg className="icon"><use href="#i-x" /></svg>
                </button>
              )}
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="חיפוש חכם (AI)" onClick={toggleAiInputMode}>
                <svg className="icon" style={{ color: 'var(--accent)' }}><use href="#i-star" /></svg>
              </button>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="שאלות סטטיסטיקה" onClick={(e) => setShowStatistics({ x: e.clientX, y: e.clientY })}>
                <svg className="icon"><use href="#i-activity" /></svg>
              </button>
              <button type="submit" className="btn btn-primary btn-sm">חיפוש</button>
            </div>
          </form>
        )}
      </div>

      {loading && customers.length === 0 ? (
        <div className="loading-inline"><span className="spinner" /> טוען נתונים...</div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th className={sort === 'legacyId' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('legacyId')}>
                  קוד לקוח {renderSortIcon('legacyId')}
                </th>
                <th className={sort === 'firstName' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('firstName')}>
                  {getLabel('customer_firstName', 'שם פרטי')} {renderSortIcon('firstName')}
                </th>
                <th className={sort === 'lastName' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('lastName')}>
                  {getLabel('customer_lastName', 'שם משפחה')} {renderSortIcon('lastName')}
                </th>
                <th className={sort === 'phone1' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('phone1')}>
                  {getLabel('customer_phone1', 'טלפון')} {renderSortIcon('phone1')}
                </th>
                <th className={sort === 'city' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('city')}>
                  {getLabel('customer_city', 'עיר')} {renderSortIcon('city')}
                </th>
                <th className={sort === 'email' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('email')}>
                  {getLabel('customer_email', 'דוא"ל')} {renderSortIcon('email')}
                </th>
              </tr>
            </thead>
            <tbody>
              {customers.map(customer => (
                <tr key={customer.id} onClick={() => router.push(`/customers/${customer.id}`)}>
                  <td className={customer.legacyId ? 'cell-primary' : 'cell-primary cell-muted'}>{customer.legacyId || 'חדש'}</td>
                  <td>{customer.firstName}</td>
                  <td>{customer.lastName}</td>
                  <td>{customer.phone1}</td>
                  <td>{customer.city}</td>
                  <td>{customer.email || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-foot">
            <span>סה"כ שורות מוצגות: {customers.length}</span>
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page <= 1 || isAiModeActive}
                  onClick={() => setPage(p => p - 1)}
                  title="עמוד קודם"
                >
                  <svg className="icon"><use href="#i-chevron-end" /></svg>הקודם
                </button>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label htmlFor="customers-page-num">עמוד</label>
                  <input
                    id="customers-page-num"
                    type="number"
                    className="input"
                    min={1}
                    max={totalPages || 1}
                    value={page}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (v >= 1 && v <= totalPages) setPage(v);
                    }}
                    style={{ width: '52px', padding: '4px 6px', textAlign: 'center', display: 'inline-block' }}
                    disabled={isAiModeActive}
                  />
                  מתוך {totalPages}
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page >= totalPages || isAiModeActive}
                  onClick={() => setPage(p => p + 1)}
                  title="עמוד הבא"
                >
                  הבא<svg className="icon"><use href="#i-chevron-start" /></svg>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <StatisticsModal
        isOpen={!!showStatistics}
        onClose={() => setShowStatistics(false)}
        pageContext="customers"
        contextQuery={aiQueryUsed}
        position={typeof showStatistics === 'object' ? showStatistics : null}
      />

      {/* מודל: חיפוש מתקדם (לקוחות) */}
      {showAdvSearch && (
        <div className="modal-backdrop" onClick={() => setShowAdvSearch(false)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <strong>
                <svg className="icon"><use href="#i-list" /></svg>
                חיפוש מתקדם (לקוחות)
              </strong>
              <button className="btn btn-ghost btn-icon-only btn-sm" title="סגירה" onClick={() => setShowAdvSearch(false)}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>

            {/* פיצול השדות הקיימים לשתי לשוניות (item 33): שם הלקוח מול פרטי הקשר שלו.
               סגנון הלשוניות מבוסס על app/components/ErrorReportButton.js */}
            <div className="tabs" style={{ margin: '0 22px' }}>
              <button type="button" className={`tab${advTab === 'basic' ? ' active' : ''}`} style={{ background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' }} onClick={() => setAdvTab('basic')}>
                שם
              </button>
              <button type="button" className={`tab${advTab === 'details' ? ' active' : ''}`} style={{ background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' }} onClick={() => setAdvTab('details')}>
                פרטי קשר
              </button>
            </div>

            <div className="modal-body">
              {advTab === 'basic' && (
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="adv-search-firstname">{getLabel('customer_firstName', 'שם פרטי')}</label>
                    <input
                      id="adv-search-firstname"
                      type="text"
                      className="input"
                      value={advFilters.firstName}
                      onChange={e => setAdvFilters(p => ({ ...p, firstName: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="adv-search-lastname">{getLabel('customer_lastName', 'שם משפחה')}</label>
                    <input
                      id="adv-search-lastname"
                      type="text"
                      className="input"
                      value={advFilters.lastName}
                      onChange={e => setAdvFilters(p => ({ ...p, lastName: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {advTab === 'details' && (
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="adv-search-phone">{getLabel('customer_phone1', 'טלפון')}</label>
                    <input
                      id="adv-search-phone"
                      type="text"
                      className="input"
                      value={advFilters.phone}
                      onChange={e => setAdvFilters(p => ({ ...p, phone: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="adv-search-city">{getLabel('customer_city', 'עיר מגורים')}</label>
                    <input
                      id="adv-search-city"
                      type="text"
                      className="input"
                      value={advFilters.city}
                      onChange={e => setAdvFilters(p => ({ ...p, city: e.target.value }))}
                    />
                  </div>
                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="adv-search-email">{getLabel('customer_email', 'דוא"ל')}</label>
                    <input
                      id="adv-search-email"
                      type="text"
                      className="input"
                      value={advFilters.email}
                      onChange={e => setAdvFilters(p => ({ ...p, email: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {/* AI על השדות שמולאו (item 32) — מוצג משתי הלשוניות, מוסתר לגמרי כשה-AI כבוי ברמת המערכת */}
              <div className="checkbox-row ai-feature-element" style={{ marginTop: '16px' }}>
                <input type="checkbox" id="customers-adv-ai-mode" checked={advAiMode} onChange={e => setAdvAiMode(e.target.checked)} />
                <label htmlFor="customers-adv-ai-mode">חפש עם AI על השדות שמולאו</label>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-secondary" onClick={() => {
                setAdvFilters({ firstName: '', lastName: '', phone: '', city: '', email: '' });
              }}>
                נקה הכל
              </button>
              <button className="btn btn-primary" onClick={() => {
                if (advAiMode) {
                  const prompt = buildCustomersAiPrompt(advFilters);
                  setShowAdvSearch(false);
                  if (prompt) handleAiSearch(prompt);
                } else {
                  setShowAdvSearch(false);
                }
              }}>
                <svg className="icon"><use href="#i-check" /></svg>
                סגור והחל סינון
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
