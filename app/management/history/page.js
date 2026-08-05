'use client';

import { useState, useEffect, useCallback } from 'react';

export default function HistoryPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Data state
  const [totalCount, setTotalCount] = useState(0);
  const [totalOverall, setTotalOverall] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [employees, setEmployees] = useState([]);
  
  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(60);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [filterType, setFilterType] = useState('api'); // default to 'api' queries history as requested
  const [activeQueryModal, setActiveQueryModal] = useState(null);
  
  // Sorting
  const [sort, setSort] = useState('timestamp');
  const [order, setOrder] = useState('desc');

  // Deletion
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  // mode: 'selected' | 'all' | 'old' — which delete action the confirmation modal is gating
  const [deleteModal, setDeleteModal] = useState({ open: false, mode: 'selected', username: '', password: '', error: '' });
  const OLD_RECORDS_DAYS = 90;

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/history?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&employeeId=${employeeId}&filterType=${filterType}&sort=${sort}&order=${order}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data || []);
        setTotalCount(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setTotalOverall(data.totalOverall || 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, employeeId, filterType, sort, order]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    // Fetch employees for filter
    fetch('/api/employees')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setEmployees(data);
        }
      })
      .catch(err => console.error('Failed to load employees:', err));
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
    setSelectedIds(new Set());
  };

  const handleSort = (column) => {
    if (sort === column) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(column);
      setOrder('asc');
    }
    setSelectedIds(new Set());
  };

  const toggleSelection = (id) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const toggleAll = () => {
    if (selectedIds.size === logs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(logs.map(log => log.id)));
    }
  };

  const promptDelete = (mode = 'selected') => {
    if (mode === 'selected' && selectedIds.size === 0) return;
    setDeleteModal({ open: true, mode, username: '', password: '', error: '' });
  };

  const confirmDelete = async (e) => {
    e.preventDefault();
    if (!deleteModal.username || !deleteModal.password) {
      setDeleteModal(prev => ({ ...prev, error: 'נא להזין שם משתמש וסיסמה' }));
      return;
    }

    setIsDeleting(true);
    setDeleteModal(prev => ({ ...prev, error: '' }));
    try {
      const res = await fetch('/api/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: deleteModal.mode === 'selected' ? Array.from(selectedIds) : [],
          deleteAll: deleteModal.mode === 'all',
          olderThanDays: deleteModal.mode === 'old' ? OLD_RECORDS_DAYS : undefined,
          username: deleteModal.username,
          password: deleteModal.password
        })
      });
      const data = await res.json();
      if (data.success) {
        setSelectedIds(new Set());
        setDeleteModal({ open: false, mode: 'selected', username: '', password: '', error: '' });
        fetchHistory();
      } else {
        setDeleteModal(prev => ({ ...prev, error: data.message || 'שגיאה במחיקה' }));
      }
    } catch (e) {
      console.error(e);
      setDeleteModal(prev => ({ ...prev, error: 'שגיאת תקשורת' }));
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleString('he-IL');
  };

  const formatDayOfWeek = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('he-IL', { weekday: 'long' });
  };

  const formatSize = (bytes) => {
    if (bytes === null || bytes === undefined) return '-';
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const SortIcon = ({ column }) => {
    if (sort !== column) return <span style={{ opacity: 0.3, marginRight: '4px' }}>⇅</span>;
    return <span style={{ marginRight: '4px' }}>{order === 'asc' ? '↑' : '↓'}</span>;
  };

  const formatPageName = (url) => {
    if (!url) return url;
    if (url.startsWith('/api')) return 'שאילתת שרת (API)';
    if (url === '/' || url === '/desktop') return 'דלפק';
    if (url.startsWith('/management/history')) return 'היסטורית מערכת';
    if (url.startsWith('/management')) return 'ניהול';
    if (url.startsWith('/customers')) return 'לקוחות';
    if (url.startsWith('/orders')) return 'הזמנות';
    if (url.startsWith('/rentals')) return 'השכרות';
    if (url.startsWith('/admin')) return 'הגדרות מתקדמות';
    if (url.startsWith('/employees') || url.startsWith('/punch-clock')) return 'שעון נוכחות / עובדים';
    if (url.startsWith('/dashboard')) return 'ניהול מלאי ודגמים';
    return url;
  };

  const thStyle = { 
    padding: '0.6rem 0.75rem', 
    cursor: 'pointer', 
    userSelect: 'none', 
    textAlign: 'right',
    position: 'sticky',
    top: 0,
    zIndex: 35,
    backgroundColor: 'var(--sticky-header-bg, #ffffff)',
    boxShadow: '0 4px 10px -2px rgba(0,0,0,0.08)',
    borderBottom: '2px solid var(--border-color)'
  };

  return (
    <main className="container animate-fade-in page-shell">
      <div className="page-scroll">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ color: 'var(--primary-color)', margin: 0 }}>ניהול היסטוריית שאילתות ו-API</h1>
      </div>

      {totalOverall > 10000 && (
        <div style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #ffeeba' }}>
          <strong>התראה:</strong> ישנן מעל 10,000 רשומות בהיסטוריה ({totalOverall.toLocaleString()}). מומלץ למחוק רשומות ישנות כדי לשמור על ביצועי המערכת.
        </div>
      )}

      {/* Filter Mode Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem' }}>
        <button
          onClick={() => { setFilterType('api'); setPage(1); }}
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: '20px',
            border: filterType === 'api' ? '2px solid #4f46e5' : '1px solid #cbd5e1',
            background: filterType === 'api' ? '#4f46e5' : '#f8fafc',
            color: filterType === 'api' ? 'white' : '#475569',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          ⚡ שאילתות API בלבד
        </button>
        <button
          onClick={() => { setFilterType('pages'); setPage(1); }}
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: '20px',
            border: filterType === 'pages' ? '2px solid #4f46e5' : '1px solid #cbd5e1',
            background: filterType === 'pages' ? '#4f46e5' : '#f8fafc',
            color: filterType === 'pages' ? 'white' : '#475569',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          📄 ביקורי מסכים בלבד
        </button>
        <button
          onClick={() => { setFilterType(''); setPage(1); }}
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: '20px',
            border: filterType === '' ? '2px solid #4f46e5' : '1px solid #cbd5e1',
            background: filterType === '' ? '#4f46e5' : '#f8fafc',
            color: filterType === '' ? 'white' : '#475569',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🌐 הכל
        </button>
      </div>

      {/* Filters and Search */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '300px' }}>
          <input data-element-name="שדה_page_1" 
            type="text" 
            placeholder="חיפוש נתיב, שאילתת API או שגיאה..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ 
              flex: 1, 
              padding: '0.5rem 1rem', 
              borderRadius: '24px', 
              border: '1px solid #ddd',
              outline: 'none',
            }}
          />
          <button data-element-name="כפתור_page_2" type="submit" className="btn btn-primary" style={{ borderRadius: '24px', padding: '0.5rem 1.5rem' }}>
            חיפוש
          </button>
        </form>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select data-element-name="בחירה_page_3" 
            value={employeeId} 
            onChange={(e) => { setEmployeeId(e.target.value); setPage(1); }}
            style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #ddd' }}
          >
            <option value="">-- כל המשתמשים --</option>
            <option value="guest">אורחים בלבד</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.firstName} {emp.lastName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', background: 'var(--card-bg)', padding: '1rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ color: 'var(--text-muted)' }}>
          נמצאו {totalCount} רשומות (מציג 60 לעמוד)
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button data-element-name="כפתור_page_4"
            onClick={() => promptDelete('selected')}
            disabled={selectedIds.size === 0 || isDeleting}
            style={{
              background: selectedIds.size > 0 ? '#dc3545' : '#e9ecef',
              color: selectedIds.size > 0 ? 'white' : '#6c757d',
              border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed'
            }}
          >
            מחק נבחרים ({selectedIds.size})
          </button>

          <button data-element-name="כפתור_page_old"
            onClick={() => promptDelete('old')}
            disabled={isDeleting || totalOverall === 0}
            title={`מחיקת כל הרשומות שגילן מעל ${OLD_RECORDS_DAYS} יום`}
            style={{
              background: 'transparent',
              color: '#d97706',
              border: '1px solid #d97706', padding: '0.5rem 1rem', borderRadius: '4px', cursor: totalOverall > 0 ? 'pointer' : 'not-allowed'
            }}
          >
            🕒 מחק ישן מ-{OLD_RECORDS_DAYS} יום
          </button>

          <button data-element-name="כפתור_page_5"
            onClick={() => promptDelete('all')}
            disabled={isDeleting || totalOverall === 0}
            style={{
              background: 'transparent',
              color: '#dc3545',
              border: '1px solid #dc3545', padding: '0.5rem 1rem', borderRadius: '4px', cursor: totalOverall > 0 ? 'pointer' : 'not-allowed'
            }}
          >
            מחק הכל לחלוטין
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1rem', boxShadow: 'var(--shadow-sm)', overflow: 'visible' }}>
        {loading && logs.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>טוען נתונים...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>לא נמצאו רשומות תואמות.</div>
        ) : (
          <>
            <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #eee', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.4rem 0.5rem', width: '40px' }}>
                    <input data-element-name="שדה_page_6" 
                      type="checkbox" 
                      checked={logs.length > 0 && selectedIds.size === logs.length}
                      onChange={toggleAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th data-element-name="לחיץ_page_7" style={thStyle} onClick={() => handleSort('timestamp')}>זמן <SortIcon data-element-name="רכיב_page_8" column="timestamp" /></th>
                  <th style={thStyle}>יום בשבוע</th>
                  <th data-element-name="לחיץ_page_9" style={thStyle} onClick={() => handleSort('employeeName')}>שם עובד <SortIcon data-element-name="רכיב_page_10" column="employeeName" /></th>
                  <th data-element-name="לחיץ_page_11" style={thStyle} onClick={() => handleSort('pageUrl')}>נתיב / שאילתת API <SortIcon data-element-name="רכיב_page_12" column="pageUrl" /></th>
                  <th data-element-name="לחיץ_page_size" style={thStyle} onClick={() => handleSort('responseSize')}>נפח נתונים (Payload) <SortIcon data-element-name="רכיב_page_size_icon" column="responseSize" /></th>
                  <th data-element-name="לחיץ_page_time" style={thStyle} onClick={() => handleSort('executionTime')}>משך (ms) <SortIcon data-element-name="רכיב_page_time_icon" column="executionTime" /></th>
                  <th data-element-name="לחיץ_page_13" style={thStyle} onClick={() => handleSort('loadingError')}>סטטוס/שגיאות <SortIcon data-element-name="רכיב_page_14" column="loadingError" /></th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #eee', transition: 'background 0.2s', background: selectedIds.has(log.id) ? '#f8f9fa' : 'transparent' }}>
                    <td style={{ padding: '0.4rem 0.5rem' }}>
                      <input data-element-name="שדה_page_15" 
                        type="checkbox" 
                        checked={selectedIds.has(log.id)}
                        onChange={() => toggleSelection(log.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem', whiteSpace: 'nowrap' }} dir="ltr">{formatDate(log.timestamp)}</td>
                    <td style={{ padding: '0.4rem 0.5rem', whiteSpace: 'nowrap' }}>{formatDayOfWeek(log.timestamp)}</td>
                    <td style={{ padding: '0.4rem 0.5rem' }}>
                      <span style={{ 
                        background: log.isGuest ? 'var(--element-bg)' : '#e7f5ff', 
                        color: log.isGuest ? '#495057' : '#0056b3',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.85rem'
                      }}>
                        {log.employeeName}
                      </span>
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem', maxWidth: '340px' }} dir="rtl">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ fontWeight: '600', color: log.pageUrl.includes('/api/') ? '#4f46e5' : 'inherit' }}>
                          {formatPageName(log.pageUrl)}
                        </span>
                        <span style={{ fontSize: '0.8em', color: 'var(--text-muted)', wordBreak: 'break-all' }} dir="ltr">
                          {log.pageUrl}
                        </span>
                        {log.requestQuery && (
                          <button
                            type="button"
                            onClick={() => setActiveQueryModal(log)}
                            style={{
                              alignSelf: 'flex-start',
                              marginTop: '2px',
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              color: '#1d4ed8',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              fontWeight: '600'
                            }}
                          >
                            🔍 הצג פרמטרי שאילתה
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem', whiteSpace: 'nowrap' }} dir="ltr">
                      {log.responseSize !== null && log.responseSize !== undefined ? (
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          fontSize: '0.82rem',
                          background: log.responseSize > 1048576 ? '#fef2f2' : log.responseSize > 102400 ? '#fffbeb' : '#f0fdf4',
                          color: log.responseSize > 1048576 ? '#dc2626' : log.responseSize > 102400 ? '#d97706' : '#16a34a',
                          border: `1px solid ${log.responseSize > 1048576 ? '#fecaca' : log.responseSize > 102400 ? '#fef3c7' : '#dcfce7'}`
                        }}>
                          📦 {formatSize(log.responseSize)}
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem', whiteSpace: 'nowrap' }} dir="ltr">
                      {log.executionTime ? `${log.executionTime} ms` : '-'}
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem', color: log.loadingError ? '#dc3545' : 'inherit' }}>
                      {log.loadingError || 'תקין (200 OK)'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
      </div>

      {/* סיכום הרשומות ועימוד — מוצמד תמיד לתחתית המסך */}
      <div className="page-footer-bar">
        <div className="page-footer-summary">סה"כ שורות מוצגות: {logs.length}</div>

        <div className="page-footer-pager">
          <button data-element-name="כפתור_page_16"
            className="btn btn-outline"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            style={{ padding: '0.5rem 1rem' }}
          >
            הבא
          </button>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            עמוד <input data-element-name="שדה_page_17" type="number" min={1} max={totalPages || 1} value={page} onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) setPage(v); }} style={{ width: '60px', padding: '0.3rem', textAlign: 'center', borderRadius: '6px', border: '1px solid var(--element-border)' }}  /> מתוך {totalPages}
          </span>
          <button data-element-name="כפתור_page_18"
            className="btn btn-outline"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            style={{ padding: '0.5rem 1rem' }}
          >
            הקודם
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.open && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} dir="rtl">
          <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--primary-color)' }}>אישור מחיקה</h3>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
              {deleteModal.mode === 'all'
                ? 'האם אתה בטוח שברצונך למחוק את כל ההיסטוריה לחלוטין?'
                : deleteModal.mode === 'old'
                ? `האם למחוק את כל הרשומות שגילן מעל ${OLD_RECORDS_DAYS} יום? רשומות מ-${OLD_RECORDS_DAYS} הימים האחרונים לא יימחקו.`
                : `האם למחוק ${selectedIds.size} רשומות שנבחרו?`}
              <br/><br/>
              <strong>למחיקה דרוש שם משתמש וסיסמא בדרגת ניהול.</strong>
            </p>

            <form onSubmit={confirmDelete} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {deleteModal.error && (
                <div style={{ color: '#dc3545', background: '#f8d7da', padding: '0.5rem', borderRadius: '4px', fontSize: '0.9rem' }}>
                  {deleteModal.error}
                </div>
              )}
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>שם משתמש (או קוד עובד)</label>
                <input data-element-name="שדה_page_19" 
                  type="text" 
                  value={deleteModal.username}
                  onChange={e => setDeleteModal(prev => ({ ...prev, username: e.target.value }))}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd', outline: 'none' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>סיסמה</label>
                <input data-element-name="שדה_page_20" 
                  type="password" 
                  value={deleteModal.password}
                  onChange={e => setDeleteModal(prev => ({ ...prev, password: e.target.value }))}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd', outline: 'none' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button data-element-name="כפתור_page_21" type="submit" disabled={isDeleting} className="btn btn-primary" style={{ flex: 1, padding: '0.75rem', background: '#dc3545', borderColor: '#dc3545' }}>
                  {isDeleting ? 'מוחק...' : 'אשר מחיקה'}
                </button>
                <button data-element-name="כפתור_page_22" type="button" onClick={() => setDeleteModal({ open: false, mode: 'selected', username: '', password: '', error: '' })} disabled={isDeleting} className="btn btn-outline" style={{ flex: 1, padding: '0.75rem' }}>
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Query Detail Modal */}
      {activeQueryModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} dir="rtl">
          <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '12px', width: '100%', maxWidth: '550px', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#4f46e5' }}>🔍 פרמטרים ושאילתת API</h3>
              <button
                onClick={() => setActiveQueryModal(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#9ca3af' }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div><strong>נתיב API:</strong> <code dir="ltr" style={{ color: '#4f46e5' }}>{activeQueryModal.pageUrl}</code></div>
              <div><strong>ביצוע ע"י:</strong> {activeQueryModal.employeeName}</div>
              <div><strong>זמן קריאה:</strong> {formatDate(activeQueryModal.timestamp)}</div>
              <div><strong>נפח נתונים:</strong> {formatSize(activeQueryModal.responseSize)}</div>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', fontSize: '0.85rem' }}>פרמטרי שאילתה / Body שנשלחו:</label>
              <pre dir="ltr" style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.75rem',
                fontSize: '0.8rem',
                maxHeight: '200px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }}>
                {activeQueryModal.requestQuery}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setActiveQueryModal(null)}
                className="btn btn-outline"
                style={{ padding: '0.4rem 1.2rem' }}
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
