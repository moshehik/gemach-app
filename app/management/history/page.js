'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

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

  // mode: 'selected' | 'all' | 'old' — which delete action is being confirmed
  const promptDelete = async (mode = 'selected') => {
    if (mode === 'selected' && selectedIds.size === 0) return;

    const messages = {
      selected: `האם למחוק ${selectedIds.size} רשומות שנבחרו?`,
      old: `האם למחוק את כל הרשומות שגילן מעל ${OLD_RECORDS_DAYS} יום? רשומות מ-${OLD_RECORDS_DAYS} הימים האחרונים לא יימחקו.`,
      all: 'האם אתה בטוח שברצונך למחוק את כל ההיסטוריה לחלוטין?'
    };

    const auth = await window.customAuthPrompt(messages[mode], 'מנהל');
    if (!auth || !auth.pin) return;

    setIsDeleting(true);
    try {
      const res = await fetch('/api/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: mode === 'selected' ? Array.from(selectedIds) : [],
          deleteAll: mode === 'all',
          olderThanDays: mode === 'old' ? OLD_RECORDS_DAYS : undefined,
          username: auth.employeeId,
          password: auth.pin
        })
      });
      const data = await res.json();
      if (data.success) {
        setSelectedIds(new Set());
        fetchHistory();
      } else {
        alert(data.message || 'שגיאה במחיקה');
      }
    } catch (e) {
      console.error(e);
      alert('שגיאת תקשורת');
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

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ניהול היסטוריית שאילתות ו-API</h1>
          <div className="page-desc">מעקב אחר שאילתות API וביקורי מסכים</div>
        </div>
      </div>

      {totalOverall > 10000 && (
        <div className="callout callout-warning" style={{ marginBottom: '16px' }}>
          <svg className="icon"><use href="#i-alert-tri" /></svg>
          <div><strong>התראה:</strong> ישנן מעל 10,000 רשומות בהיסטוריה ({totalOverall.toLocaleString()}). מומלץ למחוק רשומות ישנות כדי לשמור על ביצועי המערכת.</div>
        </div>
      )}

      {/* Filter Mode Tabs */}
      <div className="toolbar">
        <div className="pill-tabs">
          <button
            type="button"
            onClick={() => { setFilterType('api'); setPage(1); }}
            className={filterType === 'api' ? 'pill-tab active' : 'pill-tab'}
          >
            <svg className="icon"><use href="#i-activity" /></svg>
            שאילתות API בלבד
          </button>
          <button
            type="button"
            onClick={() => { setFilterType('pages'); setPage(1); }}
            className={filterType === 'pages' ? 'pill-tab active' : 'pill-tab'}
          >
            <svg className="icon"><use href="#i-file" /></svg>
            ביקורי מסכים בלבד
          </button>
          <button
            type="button"
            onClick={() => { setFilterType(''); setPage(1); }}
            className={filterType === '' ? 'pill-tab active' : 'pill-tab'}
          >
            <svg className="icon"><use href="#i-list" /></svg>
            הכל
          </button>
        </div>
      </div>

      {/* Action Bar */}
      <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div style={{ color: 'var(--text-2)', fontSize: '13px' }}>
          נמצאו {totalCount} רשומות (מציג 60 לעמוד)
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => promptDelete('selected')}
            disabled={selectedIds.size === 0 || isDeleting}
          >
            <svg className="icon"><use href="#i-trash" /></svg>
            מחק נבחרים ({selectedIds.size})
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => promptDelete('old')}
            disabled={isDeleting || totalOverall === 0}
            title={`מחיקת כל הרשומות שגילן מעל ${OLD_RECORDS_DAYS} יום`}
          >
            <svg className="icon"><use href="#i-clock" /></svg>
            מחק ישן מ-{OLD_RECORDS_DAYS} יום
          </button>

          <button
            type="button"
            className="btn btn-danger-ghost"
            onClick={() => promptDelete('all')}
            disabled={isDeleting || totalOverall === 0}
          >
            <svg className="icon"><use href="#i-trash" /></svg>
            מחק הכל לחלוטין
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="table-wrap">
        <div className="table-head-toolbar">
          <form onSubmit={handleSearch} className="search-toolbar" style={{ flex: 1, minWidth: '260px', maxWidth: '480px' }}>
            <svg className="icon"><use href="#i-search" /></svg>
            <input
              type="text"
              placeholder="חיפוש נתיב, שאילתת API או שגיאה..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <div className="search-toolbar-actions">
              <button type="submit" className="btn btn-primary btn-sm">חיפוש</button>
            </div>
          </form>

          <div className="field" style={{ marginBottom: 0, minWidth: '200px' }}>
            <label htmlFor="mgmt-history-employee" className="sr-only">סינון לפי משתמש</label>
            <select
              id="mgmt-history-employee"
              className="select"
              value={employeeId}
              onChange={(e) => { setEmployeeId(e.target.value); setPage(1); }}
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
        <div className="table-scroll">
        {loading && logs.length === 0 ? (
          <div className="page-loading">
            <span className="spinner lg" />
            טוען נתונים...
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <svg className="icon"><use href="#i-search" /></svg>
            <p>לא נמצאו רשומות תואמות.</p>
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: '36px' }}>
                  <label htmlFor="mgmt-history-selectAll" className="sr-only">בחירת כל השורות</label>
                  <input
                    id="mgmt-history-selectAll"
                    type="checkbox"
                    checked={logs.length > 0 && selectedIds.size === logs.length}
                    onChange={toggleAll}
                  />
                </th>
                <th className={sort === 'timestamp' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('timestamp')}>זמן {renderSortIcon('timestamp')}</th>
                <th>יום בשבוע</th>
                <th className={sort === 'employeeName' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('employeeName')}>שם עובד {renderSortIcon('employeeName')}</th>
                <th className={sort === 'pageUrl' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('pageUrl')}>נתיב / שאילתת API {renderSortIcon('pageUrl')}</th>
                <th className={sort === 'responseSize' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('responseSize')}>נפח נתונים (Payload) {renderSortIcon('responseSize')}</th>
                <th className={sort === 'executionTime' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('executionTime')}>משך (ms) {renderSortIcon('executionTime')}</th>
                <th className={sort === 'loadingError' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('loadingError')}>סטטוס/שגיאות {renderSortIcon('loadingError')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} style={selectedIds.has(log.id) ? { background: 'var(--surface-alt)' } : undefined}>
                  <td>
                    <label htmlFor={`mgmt-history-row-${log.id}`} className="sr-only">בחירת שורה</label>
                    <input
                      id={`mgmt-history-row-${log.id}`}
                      type="checkbox"
                      checked={selectedIds.has(log.id)}
                      onChange={() => toggleSelection(log.id)}
                    />
                  </td>
                  <td dir="ltr" style={{ whiteSpace: 'nowrap' }}>{formatDate(log.timestamp)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDayOfWeek(log.timestamp)}</td>
                  <td>
                    <span className={`badge ${log.isGuest ? 'badge-neutral' : 'badge-primary'}`}>
                      {log.employeeName}
                    </span>
                  </td>
                  <td style={{ maxWidth: '340px' }} dir="rtl">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span className={`badge ${log.pageUrl.includes('/api/') ? 'badge-primary' : 'badge-info'}`}>
                        {formatPageName(log.pageUrl)}
                      </span>
                      <span dir="ltr" style={{ fontSize: '11.5px', color: 'var(--text-3)', wordBreak: 'break-all' }}>
                        {log.pageUrl}
                      </span>
                      {log.requestQuery && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ alignSelf: 'flex-start', paddingInline: '6px' }}
                          onClick={() => setActiveQueryModal(log)}
                        >
                          <svg className="icon"><use href="#i-search" /></svg>
                          הצג פרמטרי שאילתה
                        </button>
                      )}
                    </div>
                  </td>
                  <td dir="ltr">
                    {log.responseSize !== null && log.responseSize !== undefined ? (
                      <span className={`badge ${log.responseSize > 1048576 ? 'badge-danger' : log.responseSize > 102400 ? 'badge-warning' : 'badge-success'}`}>
                        <svg className="icon"><use href="#i-box" /></svg>
                        {formatSize(log.responseSize)}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-3)' }}>-</span>
                    )}
                  </td>
                  <td dir="ltr">
                    {log.executionTime ? `${log.executionTime} ms` : '-'}
                  </td>
                  <td>
                    <span className={`badge ${log.loadingError ? 'badge-danger' : 'badge-success'}`}>
                      {log.loadingError || 'תקין (200 OK)'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        </div>

        {/* סיכום הרשומות ועימוד */}
        <div className="table-foot">
          <span>סה&quot;כ שורות מוצגות: {logs.length}</span>
          <div className="pager" style={{ gap: '10px' }}>
            <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} title="עמוד קודם">
              <svg className="icon"><use href="#i-chevron-end" /></svg>
              הקודם
            </button>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="mgmt-history-pageNum">עמוד</label>
              <input
                id="mgmt-history-pageNum"
                type="number"
                className="input"
                min={1}
                max={totalPages || 1}
                value={page}
                onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) setPage(v); }}
                style={{ width: '56px', padding: '5px 6px', textAlign: 'center', display: 'inline-block' }}
              />
              מתוך {totalPages}
            </span>
            <button type="button" className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} title="עמוד הבא">
              הבא
              <svg className="icon"><use href="#i-chevron-start" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Query Detail Modal */}
      {activeQueryModal && typeof document !== 'undefined' && createPortal(
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setActiveQueryModal(null)}>
          <div className="modal" style={{ maxWidth: '550px', margin: 0 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <strong>
                <svg className="icon"><use href="#i-search" /></svg>
                פרמטרים ושאילתת API
              </strong>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="סגירה" onClick={() => setActiveQueryModal(null)}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                <div><strong>נתיב API:</strong> <span dir="ltr" style={{ color: 'var(--primary-solid)' }}>{activeQueryModal.pageUrl}</span></div>
                <div><strong>ביצוע ע&quot;י:</strong> {activeQueryModal.employeeName}</div>
                <div><strong>זמן קריאה:</strong> <span dir="ltr">{formatDate(activeQueryModal.timestamp)}</span></div>
                <div><strong>נפח נתונים:</strong> {formatSize(activeQueryModal.responseSize)}</div>
              </div>

              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="mgmt-history-queryBody">פרמטרי שאילתה / Body שנשלחו</label>
                <textarea
                  id="mgmt-history-queryBody"
                  className="textarea"
                  dir="ltr"
                  readOnly
                  value={activeQueryModal.requestQuery}
                  style={{ fontFamily: 'Consolas, "Courier New", monospace', minHeight: '140px' }}
                />
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setActiveQueryModal(null)}>
                סגור
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
