'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getHebrewDateString } from '../../../lib/hebrewDate';

const fmtDate = (d) => {
  if (!d) return '—';
  try {
    return `${new Date(d).toLocaleDateString('he-IL')} (${getHebrewDateString(d)})`;
  } catch (e) {
    return new Date(d).toLocaleDateString('he-IL');
  }
};

/**
 * מודל "פרטי פריט" — נפתח מאייקון המידע בשורת הפריט, ומציג את היסטוריית
 * ההשכרות של אותו פריט פיזי.
 */
export default function ModernDressItemModal({ item, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!item?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/dresses/items/${item.id}/history`)
      .then(res => {
        if (!res.ok) throw new Error('שגיאה בטעינת ההיסטוריה');
        return res.json();
      })
      .then(d => { if (!cancelled) setData(d); })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [item?.id]);

  if (!item || typeof document === 'undefined') return null;

  const rentals = data?.rentals || [];

  return createPortal(
    <div
      className="modal-backdrop"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" style={{ maxWidth: '720px', width: '100%', margin: 0 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong><svg className="icon"><use href="#i-info" /></svg> פרטי פריט — {item.dressBarcode || 'ללא ברקוד'}</strong>
          <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="סגירה" onClick={onClose}>
            <svg className="icon"><use href="#i-x" /></svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: '16px' }}>
            <div className="kpi-card">
              <div className="kpi-label">מידה</div>
              <div className="kpi-value">{item.sizeText || '—'}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">מס&apos; סידורי</div>
              <div className="kpi-value">{item.serialNumber ?? '—'}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">סה&quot;כ השכרות</div>
              <div className="kpi-value">{rentals.length}</div>
            </div>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: '0 0 18px' }}>
            תאריך כניסה למאגר: <strong style={{ color: 'var(--text)' }}>{fmtDate(data?.entryDateToRepo || item.entryDateToRepo)}</strong>
            {' · '}מיקום: <strong style={{ color: 'var(--text)' }}>{item.location || '—'}</strong>
          </p>

          <h3 style={{ fontSize: '15px', margin: '0 0 10px' }}>היסטוריית השכרות לפריט</h3>

          {loading ? (
            <div className="loading-inline"><span className="spinner" /> טוען היסטוריה...</div>
          ) : error ? (
            <div className="callout callout-danger">
              <svg className="icon"><use href="#i-alert-circle" /></svg>
              {error}
            </div>
          ) : rentals.length === 0 ? (
            <div className="empty-state">
              <svg className="icon"><use href="#i-history" /></svg>
              <p>אין היסטוריית השכרות לפריט זה.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>מס&apos; הזמנה</th>
                    <th>לקוח</th>
                    <th>תאריך אירוע</th>
                    <th>סטטוס</th>
                    <th style={{ textAlign: 'center' }}>הזמנה</th>
                  </tr>
                </thead>
                <tbody>
                  {rentals.map((r, idx) => (
                    <tr key={idx}>
                      <td className="cell-primary">{r.orderId}</td>
                      <td>{r.customerName}</td>
                      <td>{r.eventDateHebrew || (r.eventDate ? getHebrewDateString(r.eventDate) : '—')}</td>
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
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>סגור</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
