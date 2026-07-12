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
    <main className="container animate-fade-in" style={{ paddingTop: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Link href="/management" className="btn btn-outline" style={{ borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
          →
        </Link>
        <h1 style={{ color: 'var(--primary-color)', margin: 0 }}>ניהול לוגים של שליחת מיילים</h1>
      </div>

      {/* Filters and Search */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '300px' }}>
          <input 
            type="text" 
            placeholder="חיפוש נמען, נושא או תוכן..."
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
      </div>

      <div style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
        נמצאו {totalCount} רשומות (מציג {limit} לעמוד)
      </div>

      {/* Data Table */}
      <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1rem', boxShadow: 'var(--shadow-sm)', overflowX: 'auto' }}>
        {loading && logs.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>טוען נתונים...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>לא נמצאו מיילים במערכת.</div>
        ) : (
          <>
            <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #eee', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '1rem' }}>זמן נשלח</th>
                  <th style={{ padding: '1rem' }}>נמען (To)</th>
                  <th style={{ padding: '1rem' }}>נושא</th>
                  <th style={{ padding: '1rem' }}>קובץ מצורף</th>
                  <th style={{ padding: '1rem' }}>סטטוס</th>
                  <th style={{ padding: '1rem' }}>שגיאות</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '1rem', whiteSpace: 'nowrap' }} dir="ltr">{formatDate(log.sentAt)}</td>
                    <td style={{ padding: '1rem' }}>
                      <span dir="ltr">{log.to}</span>
                      {log.cc && <div style={{ fontSize: '0.85em', color: 'var(--text-muted)' }} dir="ltr">CC: {log.cc}</div>}
                    </td>
                    <td style={{ padding: '1rem', maxWidth: '300px' }}>
                      <div style={{ fontWeight: '500' }}>{log.subject || '-'}</div>
                      <div style={{ fontSize: '0.85em', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.body}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {log.fileName ? <span style={{ background: 'var(--element-bg)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.85em' }}>{log.fileName}</span> : '-'}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {log.status === 'success' ? (
                        <span style={{ color: '#155724', background: '#d4edda', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.85em', fontWeight: 'bold' }}>הצלחה</span>
                      ) : (
                        <span style={{ color: '#721c24', background: '#f8d7da', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.85em', fontWeight: 'bold' }}>שגיאה</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem', color: log.errorMessage ? '#dc3545' : 'inherit', maxWidth: '200px' }}>
                      {log.errorMessage || '-'}
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
    </main>
  );
}
