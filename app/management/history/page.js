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
  
  // Sorting
  const [sort, setSort] = useState('timestamp');
  const [order, setOrder] = useState('desc');

  // Deletion
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ open: false, isDeleteAll: false, username: '', password: '', error: '' });

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/history?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&employeeId=${employeeId}&sort=${sort}&order=${order}`);
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
  }, [page, limit, search, employeeId, sort, order]);

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

  const promptDelete = (deleteAll = false) => {
    if (!deleteAll && selectedIds.size === 0) return;
    setDeleteModal({ open: true, isDeleteAll: deleteAll, username: '', password: '', error: '' });
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
          ids: Array.from(selectedIds),
          deleteAll: deleteModal.isDeleteAll,
          username: deleteModal.username,
          password: deleteModal.password
        })
      });
      const data = await res.json();
      if (data.success) {
        setSelectedIds(new Set());
        setDeleteModal({ open: false, isDeleteAll: false, username: '', password: '', error: '' });
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

  const SortIcon = ({ column }) => {
    if (sort !== column) return <span style={{ opacity: 0.3, marginRight: '4px' }}>⇅</span>;
    return <span style={{ marginRight: '4px' }}>{order === 'asc' ? '↑' : '↓'}</span>;
  };

  const formatPageName = (url) => {
    if (!url) return url;
    if (url === '/' || url === '/desktop') return 'דלפק';
    if (url.startsWith('/management/history')) return 'היסטורית מערכת';
    if (url.startsWith('/management')) return 'ניהול';
    if (url.startsWith('/customers')) return 'לקוחות';
    if (url.startsWith('/orders')) return 'הזמנות';
    if (url.startsWith('/rentals')) return 'השכרות';
    if (url.startsWith('/admin')) return 'הגדרות מתקדמות';
    if (url.startsWith('/employees') || url.startsWith('/punch-clock')) return 'שעון נוכחות / עובדים';
    if (url.startsWith('/dashboard')) return 'ניהול מלאי ודגמים';
    if (url.startsWith('/api')) return 'בקשת שרת (API)';
    return url;
  };

  const thStyle = { padding: '1rem', cursor: 'pointer', userSelect: 'none', textAlign: 'right' };

  return (
    <main className="container animate-fade-in" style={{ paddingTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ color: 'var(--primary-color)', margin: 0 }}>ניהול היסטוריית מערכת</h1>
      </div>

      {totalOverall > 10000 && (
        <div style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #ffeeba' }}>
          <strong>התראה:</strong> ישנן מעל 10,000 רשומות בהיסטוריה ({totalOverall.toLocaleString()}). מומלץ למחוק רשומות ישנות כדי לשמור על ביצועי המערכת.
        </div>
      )}

      {/* Filters and Search */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '300px' }}>
          <input 
            type="text" 
            placeholder="חיפוש נתיב או שגיאה..."
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
          <button type="submit" className="btn btn-primary" style={{ borderRadius: '24px', padding: '0.5rem 1.5rem' }}>
            חיפוש
          </button>
        </form>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select 
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', background: 'white', padding: '1rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ color: 'var(--text-muted)' }}>
          נמצאו {totalCount} רשומות (מציג 60 לעמוד)
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={() => promptDelete(false)}
            disabled={selectedIds.size === 0 || isDeleting}
            style={{ 
              background: selectedIds.size > 0 ? '#dc3545' : '#e9ecef', 
              color: selectedIds.size > 0 ? 'white' : '#6c757d',
              border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed'
            }}
          >
            מחק נבחרים ({selectedIds.size})
          </button>
          
          <button 
            onClick={() => promptDelete(true)}
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
      <div style={{ background: 'white', borderRadius: '12px', padding: '1rem', boxShadow: 'var(--shadow-sm)', overflowX: 'auto' }}>
        {loading && logs.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>טוען נתונים...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>לא נמצאו רשומות תואמות.</div>
        ) : (
          <>
            <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #eee', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '1rem', width: '40px' }}>
                    <input 
                      type="checkbox" 
                      checked={logs.length > 0 && selectedIds.size === logs.length}
                      onChange={toggleAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th style={thStyle} onClick={() => handleSort('timestamp')}>זמן <SortIcon column="timestamp" /></th>
                  <th style={thStyle}>יום בשבוע</th>
                  <th style={thStyle} onClick={() => handleSort('employeeName')}>שם עובד <SortIcon column="employeeName" /></th>
                  <th style={thStyle} onClick={() => handleSort('pageUrl')}>נתיב <SortIcon column="pageUrl" /></th>
                  <th style={thStyle} onClick={() => handleSort('loadingError')}>שגיאות <SortIcon column="loadingError" /></th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #eee', transition: 'background 0.2s', background: selectedIds.has(log.id) ? '#f8f9fa' : 'transparent' }}>
                    <td style={{ padding: '1rem' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(log.id)}
                        onChange={() => toggleSelection(log.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '1rem', whiteSpace: 'nowrap' }} dir="ltr">{formatDate(log.timestamp)}</td>
                    <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>{formatDayOfWeek(log.timestamp)}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        background: log.isGuest ? '#f1f3f5' : '#e7f5ff', 
                        color: log.isGuest ? '#495057' : '#0056b3',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.85rem'
                      }}>
                        {log.employeeName}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.pageUrl} dir="rtl">
                      <span style={{ fontWeight: '500', marginLeft: '0.5rem' }}>{formatPageName(log.pageUrl)}</span>
                      <span style={{ fontSize: '0.85em', color: '#888' }} dir="ltr">{log.pageUrl}</span>
                    </td>
                    <td style={{ padding: '1rem', color: log.loadingError ? '#dc3545' : 'inherit' }}>
                      {log.loadingError || '-'}
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
                onClick={() => { setPage(p => p + 1); setSelectedIds(new Set()); }}
                style={{ padding: '0.5rem 1rem' }}
              >
                הבא &gt;
              </button>
              <span style={{ fontWeight: '500' }}>עמוד {page} מתוך {totalPages}</span>
              <button 
                className="btn btn-outline"
                disabled={page <= 1} 
                onClick={() => { setPage(p => p - 1); setSelectedIds(new Set()); }}
                style={{ padding: '0.5rem 1rem' }}
              >
                &lt; קודם
              </button>
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.open && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} dir="rtl">
          <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--primary-color)' }}>אישור מחיקה</h3>
            <p style={{ marginBottom: '1.5rem', color: '#555' }}>
              {deleteModal.isDeleteAll 
                ? 'האם אתה בטוח שברצונך למחוק את כל ההיסטוריה לחלוטין?' 
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#555' }}>שם משתמש (או קוד עובד)</label>
                <input 
                  type="text" 
                  value={deleteModal.username}
                  onChange={e => setDeleteModal(prev => ({ ...prev, username: e.target.value }))}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd', outline: 'none' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#555' }}>סיסמה</label>
                <input 
                  type="password" 
                  value={deleteModal.password}
                  onChange={e => setDeleteModal(prev => ({ ...prev, password: e.target.value }))}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd', outline: 'none' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" disabled={isDeleting} className="btn btn-primary" style={{ flex: 1, padding: '0.75rem', background: '#dc3545', borderColor: '#dc3545' }}>
                  {isDeleting ? 'מוחק...' : 'אשר מחיקה'}
                </button>
                <button type="button" onClick={() => setDeleteModal({ open: false, isDeleteAll: false, username: '', password: '', error: '' })} disabled={isDeleting} className="btn btn-outline" style={{ flex: 1, padding: '0.75rem' }}>
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
