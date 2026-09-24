'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ExportButtons from '../../components/ExportButtons';
import StatisticsModal from '../components/StatisticsModal';

import { useLabels } from '@/app/components/LabelsContext';
import { cacheNamespace } from '@/app/lib/pageCache';
import { buildCustomersListParams } from '@/app/lib/prefetchRoutes';
import { V3Page, Card, Btn, IconBtn, Chip, Field, Tabs, Switch, Tip, Dialog, Empty, Icon } from '@/app/v3/ui/components';
import { useAlertDialog } from '@/components/customers/modern/customerDialogs';

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
  const [showAlert, alertNode] = useAlertDialog();
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
  const [aiPromptUsed, setAiPromptUsed] = useState('');
  const [aiWhereClause, setAiWhereClause] = useState(null);
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
    // במצב חיפוש AI התוצאות מגיעות מ-handleAiSearch ולא מ-fetchCustomers הרגיל;
    // בלי ה-guard הזה, שינוי totalPages/page שנעשה על ידי handleAiSearch (כדי להציג
    // עימוד לתוצאות ה-AI) היה מפעיל מחדש את ה-effect הזה ומחליף את תוצאות ה-AI
    // ברשימת הלקוחות הרגילה (הבאג: "כתבתי אביגיל ולא הציג לי כלום" - בפועל ה-AI
    // כן מצא תוצאות, אך הן נדרסו כמעט מיידית).
    if (isAiModeActive) return;

    fetchCustomers(false, page);

    // Background Prefetching for the next page
    const timer = setTimeout(() => {
      if (page < totalPages) {
        fetchCustomers(true, page + 1);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [fetchCustomers, page, totalPages, isAiModeActive]);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    setSearch(searchInput);
    setPage(1);
    setIsAiModeActive(false);
  };

  const handleAiSearch = async (query, targetPage = 1, reuseWhereClause = null) => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/smart-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query, pageContext: 'customers', page: targetPage, whereClause: reuseWhereClause })
      });
      const result = await res.json();
      if (res.ok) {
        setCustomers(result.data || []);
        setTotalCount(result.total ?? (result.data?.length || 0));
        setTotalPages(result.totalPages || 1);
        setPage(result.page || targetPage);
        setIsAiModeActive(true);
        setAiQueryUsed(result.query || '');
        setAiPromptUsed(query);
        setAiWhereClause(result.whereClause || null);
      } else {
        showAlert(result.error || 'שגיאה בחיפוש החכם');
      }
    } catch (e) {
      console.error(e);
      showAlert('שגיאת תקשורת');
    } finally {
      setAiLoading(false);
    }
  };

  // מעבר עמוד בזמן שתוצאות AI מוצגות - משתמש שוב באותו whereClause שכבר נוצר
  // (בלי לפנות שוב ל-Gemini), רק עם OFFSET אחר בשרת.
  const handleAiPageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    handleAiSearch(aiPromptUsed, newPage, aiWhereClause);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearch('');
    setPage(1);
    if (isAiModeActive) {
      setIsAiModeActive(false);
      setAiWhereClause(null);
      setAiPromptUsed('');
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
      return <Icon name="sort" size="sm" anim={false} />;
    }
    return <Icon name="chevron-down" size="sm" anim={false} className="is-on" style={{ transform: order === 'desc' ? "rotate(180deg)" : 'none' }} />;
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

  // עמודות הטבלה: המפתח = שדה המיון בשרת (handleSort), התווית דרך getLabel כמו קודם
  const columns = [
    { key: 'legacyId', label: 'קוד לקוח' },
    { key: 'firstName', label: getLabel('customer_firstName', 'שם פרטי') },
    { key: 'lastName', label: getLabel('customer_lastName', 'שם משפחה') },
    { key: 'phone1', label: getLabel('customer_phone1', 'טלפון') },
    { key: 'city', label: getLabel('customer_city', 'עיר') },
    { key: 'email', label: getLabel('customer_email', 'דוא"ל') }
  ];

  const openCustomer = (customer) => router.push(`/customers/${customer.id}`);

  return (
    <V3Page>
      <header className="v3-pagehead">
        <div className="v3-pagehead__title">
          <h1 className="v3-h1">לקוחות</h1>
          <Chip variant="info" icon="users"><bdi>{totalCount}</bdi> במערכת</Chip>
          <Tip>לחיצה על שורה פותחת את כרטיס הלקוח. בחיפוש החכם אפשר לכתוב משפט חופשי.</Tip>
        </div>
        <div className="v3-pagehead__tools">
          <IconBtn icon="list" label="חיפוש מתקדם" title="חיפוש מתקדם" onClick={() => setShowAdvSearch(true)} />

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

          <Btn variant="primary" icon="plus" onClick={() => router.push('/customers/new')}>לקוח חדש</Btn>
        </div>
      </header>

      {/* סרגל חיפוש: רגיל / חכם (AI) + שאלות סטטיסטיקה */}
      {aiInputMode ? (
        <form onSubmit={handleAiInputSubmit} className="v3-filter-bar" role="search">
          <div className="v3-search">
            {aiLoading ? <Icon name="loader" loop /> : <Icon name="sparkles" />}
            <input
              type="text"
              value={aiInputText}
              onChange={(e) => setAiInputText(e.target.value)}
              placeholder="תארו את מי לחפש, למשל: לקוחות מירושלים"
              aria-label="חיפוש חכם"
              disabled={aiLoading}
            />
            {aiInputText && !aiLoading && (
              <button type="button" className="v3-search__clear is-on" aria-label="ניקוי הטקסט" onClick={() => setAiInputText('')}>
                <Icon name="x" size="sm" />
              </button>
            )}
          </div>
          <IconBtn icon="sparkles" variant="primary" label="חזרה לחיפוש רגיל" title="חיפוש חכם (AI)" onClick={toggleAiInputMode} />
          <IconBtn icon="stats" label="שאלות סטטיסטיקה" title="שאלות סטטיסטיקה" onClick={(e) => setShowStatistics({ x: e.clientX, y: e.clientY })} />
          <Btn type="submit" variant="primary" loading={aiLoading}>{aiLoading ? 'בונה שאילתה...' : 'חיפוש חכם'}</Btn>
        </form>
      ) : (
        <form onSubmit={handleSearch} className="v3-filter-bar" role="search">
          <div className="v3-search">
            <Icon name="search" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="שם, טלפון או עיר"
              aria-label="חיפוש לקוח"
            />
            {searchInput && (
              <button type="button" className="v3-search__clear is-on" aria-label="ניקוי החיפוש" onClick={handleClearSearch}>
                <Icon name="x" size="sm" />
              </button>
            )}
          </div>
          <IconBtn icon="sparkles" label="חיפוש חכם (AI)" title="חיפוש חכם (AI)" onClick={toggleAiInputMode} />
          <IconBtn icon="stats" label="שאלות סטטיסטיקה" title="שאלות סטטיסטיקה" onClick={(e) => setShowStatistics({ x: e.clientX, y: e.clientY })} />
          <Btn type="submit" variant="primary">חיפוש</Btn>
        </form>
      )}

      {loading && customers.length === 0 ? (
        <div className="v3-empty" role="status">
          <Icon name="loader" size="xl" loop />
          <span>טוענים לקוחות...</span>
        </div>
      ) : (
        <Card>
          <div className="v3-table__wrap">
            <table className="v3-table">
              <caption className="v3-sr">רשימת לקוחות</caption>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} scope="col" aria-sort={sort === col.key ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" className="v3-th-btn" onClick={() => handleSort(col.key)}>
                        {col.label}{renderSortIcon(col.key)}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map(customer => (
                  <tr
                    key={customer.id}
                    tabIndex={0}
                    onClick={() => openCustomer(customer)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) openCustomer(customer); }}
                  >
                    <td>{customer.legacyId ? <bdi>{customer.legacyId}</bdi> : <Chip variant="info">חדש</Chip>}</td>
                    <td>{customer.firstName}</td>
                    <td>{customer.lastName}</td>
                    <td><bdi>{customer.phone1}</bdi></td>
                    <td>{customer.city}</td>
                    <td>{customer.email ? <bdi>{customer.email}</bdi> : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {customers.length === 0 && (
            <Empty icon="search" title="לא נמצאו לקוחות" text="נסו חיפוש אחר או נקו את הסינון." />
          )}
          <div className="v3-cluster">
            <span className="v3-faint">מוצגים <bdi>{customers.length}</bdi> לקוחות</span>
            {totalPages > 1 && (
              <div className="v3-cluster" style={{ marginInlineStart: 'auto' }}>
                <Btn
                  size="sm"
                  icon="chevron-end"
                  disabled={page <= 1 || aiLoading}
                  onClick={() => isAiModeActive ? handleAiPageChange(page - 1) : setPage(p => p - 1)}
                  title="עמוד קודם"
                >
                  הקודם
                </Btn>
                <span className="v3-cluster">
                  <label htmlFor="customers-page-num">עמוד</label>
                  <input
                    id="customers-page-num"
                    type="number"
                    className="v3-input"
                    min={1}
                    max={totalPages || 1}
                    value={page}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (v >= 1 && v <= totalPages) {
                        if (isAiModeActive) handleAiPageChange(v); else setPage(v);
                      }
                    }}
                    style={{ width: 'var(--v3-sp-9)', textAlign: 'center' }}
                    disabled={aiLoading}
                  />
                  <span>מתוך <bdi>{totalPages}</bdi></span>
                </span>
                <Btn
                  size="sm"
                  iconEnd="chevron-start"
                  disabled={page >= totalPages || aiLoading}
                  onClick={() => isAiModeActive ? handleAiPageChange(page + 1) : setPage(p => p + 1)}
                  title="עמוד הבא"
                >
                  הבא
                </Btn>
              </div>
            )}
          </div>
        </Card>
      )}

      <StatisticsModal
        isOpen={!!showStatistics}
        onClose={() => setShowStatistics(false)}
        pageContext="customers"
        contextQuery={aiQueryUsed}
        position={typeof showStatistics === 'object' ? showStatistics : null}
      />

      {/* חלונית: חיפוש מתקדם (הזנת נתונים = חלונית טופס, בהירה בלבד) */}
      <Dialog
        open={showAdvSearch}
        onClose={() => setShowAdvSearch(false)}
        variant="form"
        icon="list"
        title="חיפוש מתקדם"
        sub="הסינון חל מיד תוך כדי הקלדה."
        actions={(
          <>
            <Btn variant="primary" icon="check" onClick={() => {
              if (advAiMode) {
                const prompt = buildCustomersAiPrompt(advFilters);
                setShowAdvSearch(false);
                if (prompt) handleAiSearch(prompt);
              } else {
                setShowAdvSearch(false);
              }
            }}>
              סיום
            </Btn>
            <Btn variant="quiet" onClick={() => {
              setAdvFilters({ firstName: '', lastName: '', phone: '', city: '', email: '' });
            }}>
              ניקוי הכול
            </Btn>
          </>
        )}
      >
        <div className="v3-stack">
          <Tabs
            label="קבוצות סינון"
            value={advTab}
            onChange={setAdvTab}
            items={[
              { key: 'basic', label: 'שם', icon: 'user' },
              { key: 'details', label: 'פרטי קשר', icon: 'phone' }
            ]}
          />

          {advTab === 'basic' && (
            <div className="v3-stack">
              <Field
                id="adv-search-firstname"
                label={getLabel('customer_firstName', 'שם פרטי')}
                type="text"
                value={advFilters.firstName}
                onChange={e => setAdvFilters(p => ({ ...p, firstName: e.target.value }))}
              />
              <Field
                id="adv-search-lastname"
                label={getLabel('customer_lastName', 'שם משפחה')}
                type="text"
                value={advFilters.lastName}
                onChange={e => setAdvFilters(p => ({ ...p, lastName: e.target.value }))}
              />
            </div>
          )}

          {advTab === 'details' && (
            <div className="v3-stack">
              <Field
                id="adv-search-phone"
                label={getLabel('customer_phone1', 'טלפון')}
                type="text"
                value={advFilters.phone}
                onChange={e => setAdvFilters(p => ({ ...p, phone: e.target.value }))}
              />
              <Field
                id="adv-search-city"
                label={getLabel('customer_city', 'עיר מגורים')}
                type="text"
                value={advFilters.city}
                onChange={e => setAdvFilters(p => ({ ...p, city: e.target.value }))}
              />
              <Field
                id="adv-search-email"
                label={getLabel('customer_email', 'דוא"ל')}
                type="text"
                value={advFilters.email}
                onChange={e => setAdvFilters(p => ({ ...p, email: e.target.value }))}
              />
            </div>
          )}

          {/* AI על השדות שמולאו - מוסתר לגמרי כש-AI כבוי במערכת (.ai-feature-element) */}
          <div className="ai-feature-element">
            <Switch
              id="customers-adv-ai-mode"
              checked={advAiMode}
              onChange={setAdvAiMode}
              label="חיפוש חכם לפי מה שמילאתי"
            />
          </div>
        </div>
      </Dialog>
      {alertNode}
    </V3Page>
  );
}
