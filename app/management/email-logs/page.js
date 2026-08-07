'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

export default function EmailLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Data state
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/email-logs?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data || []);
        setTotalCount(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleString('he-IL');
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ניהול לוגים של שליחת מיילים</h1>
          <div className="page-desc">נמצאו {totalCount} רשומות (מציג {limit} לעמוד)</div>
        </div>
        <div className="page-actions">
          <Link href="/management" className="btn btn-secondary">
            <svg className="icon"><use href="#i-arrow-end" /></svg>
            חזרה
          </Link>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="toolbar">
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '300px' }}>
          <div className="input-icon-wrap" style={{ flex: 1 }}>
            <svg className="icon"><use href="#i-search" /></svg>
            <input
              type="text"
              className="input"
              placeholder="חיפוש נמען, נושא או תוכן..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary">חיפוש</button>
        </form>
      </div>

      {/* Data Table */}
      <div className="table-wrap">
        {loading && logs.length === 0 ? (
          <div className="page-loading">
            <span className="spinner lg" />
            טוען נתונים...
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <svg className="icon"><use href="#i-mail" /></svg>
            <p>לא נמצאו מיילים במערכת.</p>
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>זמן נשלח</th>
                <th>נמען (To)</th>
                <th>נושא</th>
                <th>קובץ מצורף</th>
                <th>סטטוס</th>
                <th>שגיאות</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td className="cell-muted" dir="ltr">{formatDate(log.sentAt)}</td>
                  <td>
                    <span dir="ltr">{log.to}</span>
                    {log.cc && <div className="cell-muted" style={{ fontSize: '12.5px' }} dir="ltr">CC: {log.cc}</div>}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{log.subject || '-'}</div>
                    <div className="cell-muted" style={{ fontSize: '12.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '280px' }}>
                      {log.body}
                    </div>
                  </td>
                  <td>
                    {log.fileName ? (
                      <span className="badge badge-neutral">
                        <svg className="icon"><use href="#i-file" /></svg>
                        {log.fileName}
                      </span>
                    ) : '-'}
                  </td>
                  <td>
                    {log.status === 'success' ? (
                      <span className="badge badge-success">
                        <svg className="icon"><use href="#i-check-circle" /></svg>
                        הצלחה
                      </span>
                    ) : (
                      <span className="badge badge-danger">
                        <svg className="icon"><use href="#i-x-circle" /></svg>
                        שגיאה
                      </span>
                    )}
                  </td>
                  <td style={{ color: log.errorMessage ? 'var(--danger)' : undefined, maxWidth: '200px' }}>
                    {log.errorMessage || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* סיכום הרשומות ועימוד */}
        <div className="table-foot">
          <span>סה&quot;כ שורות מוצגות: {logs.length} מתוך {totalCount}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} title="עמוד קודם">
              <svg className="icon"><use href="#i-chevron-end" /></svg>
              הקודם
            </button>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="emailLogsPageNum">עמוד</label>
              <input
                id="emailLogsPageNum"
                type="number"
                className="input"
                min={1}
                max={totalPages || 1}
                value={page}
                onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) setPage(v); }}
                style={{ width: '52px', padding: '4px 6px', textAlign: 'center', display: 'inline-block' }}
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
    </>
  );
}
