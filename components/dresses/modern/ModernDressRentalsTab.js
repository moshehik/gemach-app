'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Check, AlertTriangle, Clock, Search, X } from 'lucide-react';
import { getHebrewDateString } from '../../../lib/hebrewDate';

/**
 * טאב "השכרות" — כל ההשכרות של כל פריטי הדגם, עם אריחי סיכום למעלה
 * (אותה שיטה כמו סיכום התשלומים בכרטיס ההזמנה).
 */
export default function ModernDressRentalsTab({ dressId, active }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [sizeFilter, setSizeFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [page, setPage] = useState(1);
  const limit = 50;

  // נטען רק כשנכנסים לטאב בפעם הראשונה — לא מעכב את פתיחת הכרטיס
  useEffect(() => {
    if (!active || loaded || !dressId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/dresses/${dressId}/rentals`)
      .then(res => {
        if (!res.ok) throw new Error('שגיאה בטעינת ההשכרות');
        return res.json();
      })
      .then(d => { if (!cancelled) { setData(d); setLoaded(true); } })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [active, loaded, dressId]);

  const rentals = data?.rentals || [];
  const stats = data?.stats || { total: 0, lastYear: 0, outNow: 0, overdue: 0 };

  const sizes = useMemo(() => {
    const set = new Set(rentals.map(r => r.sizeText).filter(Boolean));
    return Array.from(set).sort((a, b) => (isNaN(a) || isNaN(b)) ? String(a).localeCompare(String(b), 'he') : a - b);
  }, [rentals]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rentals
      .filter(r => sizeFilter === 'all' || r.sizeText === sizeFilter)
      .filter(r => !term || [r.orderId, r.customerName, r.dressBarcode].some(v => v != null && String(v).toLowerCase().includes(term)));
  }, [rentals, sizeFilter, search]);

  useEffect(() => {
    setPage(1);
  }, [sizeFilter, search]);

  const totalPages = Math.ceil(visible.length / limit) || 1;
  const paginatedRentals = useMemo(() => {
    const start = (page - 1) * limit;
    return visible.slice(start, start + limit);
  }, [visible, page]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <span className="moc-spinner lg" style={{ margin: '0 auto' }} />
        <p className="moc-hint" style={{ marginTop: '12px' }}>טוען היסטוריית השכרות...</p>
      </div>
    );
  }

  if (error) {
    return <div style={{ color: 'var(--moc-danger-text)', textAlign: 'center', padding: '24px 0', fontWeight: 700 }}>{error}</div>;
  }

  return (
    <>
      <div className="moc-stat-tiles">
        <div className="moc-stat-tile total">
          <div className="moc-st-label">סה"כ השכרות לדגם</div>
          <div className="moc-st-value">{stats.total}</div>
        </div>
        <div className="moc-stat-tile info">
          <div className="moc-st-label">השכרות בשנה האחרונה</div>
          <div className="moc-st-value">{stats.lastYear}</div>
        </div>
        <div className="moc-stat-tile warn">
          <div className="moc-st-label">מושכר כרגע</div>
          <div className="moc-st-value">{stats.outNow}</div>
        </div>
        <div className="moc-stat-tile danger">
          <div className="moc-st-label">ממתין להחזרה (עבר תאריך)</div>
          <div className="moc-st-value">{stats.overdue}</div>
        </div>
      </div>

      <div className="moc-table-toolbar">
        <div className="moc-filter-chips">
          <button className={`moc-pill-toggle ${sizeFilter === 'all' ? 'on blue' : ''}`} onClick={() => setSizeFilter('all')}>
            כל המידות
          </button>
          {sizes.map(s => (
            <button key={s} className={`moc-pill-toggle ${sizeFilter === s ? 'on blue' : ''}`} onClick={() => setSizeFilter(s)}>
              {s}
            </button>
          ))}
        </div>

        <div className="moc-toolbar-search">
          <span className="moc-ts-icon"><Search size={15} /></span>
          <input
            type="text"
            placeholder="חיפוש: מס' הזמנה, לקוח, ברקוד..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="moc-icon-btn-plain moc-ts-clear" title="נקה חיפוש" onClick={() => setSearch('')}>
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="moc-empty-state">לא נמצאו השכרות לדגם זה.</div>
      ) : (
        <div className="moc-table-scroll">
          <table className="moc-data-table">
            <thead>
              <tr>
                <th>מס' הזמנה</th>
                <th>לקוח</th>
                <th>פריט</th>
                <th>תאריך אירוע</th>
                <th>לקיחה</th>
                <th>סטטוס החזרה</th>
                <th style={{ textAlign: 'center' }}>כרטיס הזמנה</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRentals.map((r, idx) => (
                <tr key={idx}>
                  <td className="moc-mono">{r.orderId}</td>
                  <td>{r.customerName}</td>
                  <td>
                    <span className="moc-size-pill">{r.sizeText || '—'}</span>{' '}
                    <span className="moc-mono" style={{ color: 'var(--moc-text-muted)' }}>· {r.dressBarcode || '—'}</span>
                  </td>
                  <td>{r.eventDateHebrew || (r.eventDate ? getHebrewDateString(r.eventDate) : '—')}</td>
                  <td>{r.takenDate ? new Date(r.takenDate).toLocaleDateString('he-IL') : '—'}</td>
                  <td>
                    {!r.isReturned ? (
                      <span className="moc-badge on-white warning"><Clock size={12} /> טרם הוחזר</span>
                    ) : r.returnedOk === false ? (
                      <span className="moc-badge on-white danger"><AlertTriangle size={12} /> הוחזר עם בעיה</span>
                    ) : (
                      <span className="moc-badge on-white success"><Check size={12} /> הוחזר תקין</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <a
                      href={`/orders/${r.orderId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="moc-icon-btn-plain"
                      style={{ textDecoration: 'none' }}
                      title="פתח כרטיס הזמנה"
                    >
                      <ExternalLink size={16} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {visible.length > 0 && (
        <div className="page-footer-bar" style={{ position: 'sticky', bottom: 0, zIndex: 10, background: 'var(--card-bg)', borderTop: '1px solid var(--border-color)', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 -4px 10px rgba(0,0,0,0.05)' }}>
          <div className="page-footer-summary">סה"כ השכרות מוצגות: {visible.length}</div>
          
          {totalPages > 1 && (
            <div className="page-footer-pager" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-outline" style={{ padding: '0.4rem 1rem' }}>&lt; הקודם</button>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                עמוד 
                <input type="number" min={1} max={totalPages} value={page} onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) setPage(v); }} style={{ width: '60px', padding: '0.3rem', textAlign: 'center', borderRadius: '6px', border: '1px solid var(--element-border)', background: 'var(--input-bg)', color: 'var(--text-main)' }} /> 
                מתוך {totalPages}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-outline" style={{ padding: '0.4rem 1rem' }}>הבא &gt;</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
