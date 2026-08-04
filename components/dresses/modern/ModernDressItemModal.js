'use client';

import React, { useEffect, useState } from 'react';
import { X, Calendar, ExternalLink, Check, AlertTriangle, Clock } from 'lucide-react';
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
 * ההשכרות של אותו פריט פיזי (אותה שיטת מודלים כמו בכרטיס ההזמנה).
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

  if (!item) return null;

  const rentals = data?.rentals || [];

  return (
    <div className="moc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="moc moc-modal-box wide" style={{ maxWidth: '720px' }}>
        <div className="moc-modal-head">
          <h3>פרטי פריט — <span className="moc-mono">{item.dressBarcode || 'ללא ברקוד'}</span></h3>
          <button className="moc-close-x" onClick={onClose}><X size={15} /></button>
        </div>

        <div className="moc-modal-body">
          <div className="moc-stat-tiles">
            <div className="moc-stat-tile total">
              <div className="moc-st-label">מידה</div>
              <div className="moc-st-value">{item.sizeText || '—'}</div>
            </div>
            <div className="moc-stat-tile info">
              <div className="moc-st-label">מס' סידורי</div>
              <div className="moc-st-value">{item.serialNumber ?? '—'}</div>
            </div>
            <div className="moc-stat-tile ok">
              <div className="moc-st-label">סה"כ השכרות</div>
              <div className="moc-st-value">{rentals.length}</div>
            </div>
          </div>

          <div className="moc-compact-row" style={{ paddingTop: 0 }}>
            <div className="moc-avatar-chip"><Calendar size={16} /></div>
            <div className="moc-cr-main">
              <div className="moc-cr-sub" style={{ whiteSpace: 'normal' }}>
                תאריך כניסה למאגר: <strong style={{ color: 'var(--moc-text-main)' }}>{fmtDate(data?.entryDateToRepo || item.entryDateToRepo)}</strong>
                {' · '}מיקום: <strong style={{ color: 'var(--moc-text-main)' }}>{item.location || '—'}</strong>
              </div>
            </div>
          </div>

          <h3 style={{ margin: '18px 0 10px', fontSize: '1.05rem' }}>היסטוריית השכרות לפריט</h3>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '26px 0' }}>
              <span className="moc-spinner lg" style={{ margin: '0 auto' }} />
              <p className="moc-hint" style={{ marginTop: '12px' }}>טוען היסטוריה...</p>
            </div>
          ) : error ? (
            <div style={{ color: 'var(--moc-danger-text)', textAlign: 'center', padding: '18px 0', fontWeight: 700 }}>{error}</div>
          ) : rentals.length === 0 ? (
            <div className="moc-empty-state">אין היסטוריית השכרות לפריט זה.</div>
          ) : (
            <div className="moc-table-scroll">
              <table className="moc-data-table">
                <thead>
                  <tr>
                    <th>מס' הזמנה</th>
                    <th>לקוח</th>
                    <th>תאריך אירוע</th>
                    <th>סטטוס</th>
                    <th style={{ textAlign: 'center' }}>הזמנה</th>
                  </tr>
                </thead>
                <tbody>
                  {rentals.map((r, idx) => (
                    <tr key={idx}>
                      <td className="moc-mono">{r.orderId}</td>
                      <td>{r.customerName}</td>
                      <td>{r.eventDateHebrew || (r.eventDate ? getHebrewDateString(r.eventDate) : '—')}</td>
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
        </div>

        <div className="moc-modal-foot">
          <button className="moc-btn moc-btn-outline" onClick={onClose}>סגור</button>
        </div>
      </div>
    </div>
  );
}
