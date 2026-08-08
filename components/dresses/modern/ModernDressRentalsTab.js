'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getHebrewDateString } from '../../../lib/hebrewDate';

/**
 * טאב "השכרות" — כל ההשכרות של כל פריטי הדגם, עם אריחי סיכום למעלה.
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
    return <div className="loading-inline"><span className="spinner" /> טוען היסטוריית השכרות...</div>;
  }

  if (error) {
    return (
      <div className="callout callout-danger">
        <svg className="icon"><use href="#i-alert-circle" /></svg>
        {error}
      </div>
    );
  }

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">סה&quot;כ השכרות לדגם</div>
          <div className="kpi-value">{stats.total}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">השכרות בשנה האחרונה</div>
          <div className="kpi-value">{stats.lastYear}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">מושכר כרגע</div>
          <div className="kpi-value" style={{ color: 'var(--warning)' }}>{stats.outNow}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">ממתין להחזרה (עבר תאריך)</div>
          <div className="kpi-value" style={{ color: 'var(--danger)' }}>{stats.overdue}</div>
        </div>
      </div>

      <div className="toolbar">
        <div className="pill-tabs">
          <button type="button" className={`pill-tab${sizeFilter === 'all' ? ' active' : ''}`} onClick={() => setSizeFilter('all')}>
            כל המידות
          </button>
          {sizes.map(s => (
            <button key={s} type="button" className={`pill-tab${sizeFilter === s ? ' active' : ''}`} onClick={() => setSizeFilter(s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <div className="input-icon-wrap" style={{ maxWidth: '260px' }}>
          <svg className="icon"><use href="#i-search" /></svg>
          <label htmlFor="dress-rentals-search" className="sr-only">חיפוש השכרות</label>
          <input
            id="dress-rentals-search"
            className="input"
            type="text"
            placeholder="חיפוש: מס' הזמנה, לקוח, ברקוד..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">
          <svg className="icon"><use href="#i-refresh" /></svg>
          <p>לא נמצאו השכרות לדגם זה.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>מס&apos; הזמנה</th>
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
                  <td className="cell-primary">{r.orderId}</td>
                  <td>{r.customerName}</td>
                  <td>
                    {r.sizeText || '—'} <span className="cell-muted">· {r.dressBarcode || '—'}</span>
                  </td>
                  <td>{r.eventDateHebrew || (r.eventDate ? getHebrewDateString(r.eventDate) : '—')}</td>
                  <td>
                    {r.takenDate ? (
                      <span title={new Date(r.takenDate).toLocaleDateString('he-IL')}>
                        {getHebrewDateString(r.takenDate) || new Date(r.takenDate).toLocaleDateString('he-IL')}
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    {!r.isReturned ? (
                      <span className="badge badge-warning"><svg className="icon"><use href="#i-clock" /></svg>טרם הוחזר</span>
                    ) : r.returnedOk === false ? (
                      <span className="badge badge-danger"><svg className="icon"><use href="#i-alert-tri" /></svg>הוחזר עם בעיה</span>
                    ) : (
                      <span className="badge badge-success"><svg className="icon"><use href="#i-check" /></svg>הוחזר תקין</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <a
                      href={`/orders/${r.orderId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-icon-only btn-sm"
                      title="פתח כרטיס הזמנה"
                    >
                      <svg className="icon"><use href="#i-link" /></svg>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="table-foot">
            <span>סה&quot;כ השכרות מוצגות: {visible.length}</span>
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} title="עמוד קודם">
                  <svg className="icon"><use href="#i-chevron-end" /></svg>הקודם
                </button>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label htmlFor="dress-rentals-page-num">עמוד</label>
                  <input
                    id="dress-rentals-page-num"
                    type="number"
                    className="input"
                    min={1}
                    max={totalPages}
                    value={page}
                    onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) setPage(v); }}
                    style={{ width: '60px', padding: '4px 6px', textAlign: 'center', display: 'inline-block' }}
                  />
                  מתוך {totalPages}
                </span>
                <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} title="עמוד הבא">
                  הבא<svg className="icon"><use href="#i-chevron-start" /></svg>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
