'use client';

import React, { useEffect, useState } from 'react';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { ACTION_TRANSLATIONS } from '../../HistoryViewer';
import { ChangesChips } from '../../modern/ChangesChips';

const fmtDateTime = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return `${date.toLocaleDateString('he-IL')} (${getHebrewDateString(date)}) · ${date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
};

// מיפוי מקומי (עיצוב "אריג" בלבד) מפעולת יומן ל-badge סמנטי — אותה קיבוץ סמנטי
// בדיוק כמו ACTION_TONES ב-components/modern/ChangesChips.js (משותף, מחוץ לאשכול
// הזה), רק שממופה ל-classNames של מערכת העיצוב במקום לצבעי moc- ישנים.
const ACTION_BADGE_CLASS = {
  CREATE: 'badge-success',
  DELETE: 'badge-danger',
  UPDATE: 'badge-primary',
  CANCEL_RENTAL: 'badge-danger',
  CANCEL_RETURN: 'badge-danger',
  CANCEL_SCAN: 'badge-danger',
  CANCEL_ITEM: 'badge-danger',
  CANCEL_OBLIGATION: 'badge-danger',
  CANCEL_PAYMENT: 'badge-danger',
  CANCEL_ORDER: 'badge-danger',
  CANCEL_CHANGES: 'badge-danger',
  RESTORE_ITEM: 'badge-success',
  RESTORE_OBLIGATION: 'badge-success',
  RESTORE_PAYMENT: 'badge-success',
  CONFIRM_RENTAL: 'badge-success',
  RETURN_RENTAL: 'badge-success',
  DEBT_APPROVED: 'badge-success',
  CANCEL_DEBT_APPROVAL: 'badge-danger'
};
const badgeClassFor = (action) => ACTION_BADGE_CLASS[action] || 'badge-neutral';

/**
 * טאב "מידע" — נתוני מערכת ויומן השינויים של הדגם ושל הפריטים שלו.
 * שורות היומן משתמשות ב-<details>/<summary> (רכיב faq-item) לפתיחה/סגירה.
 */
export default function ModernDressInfoTab({ dress, items, active }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!active || loaded || !dress?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const itemIds = (items || []).map(i => i.id).filter(Boolean);
    const requests = [
      fetch(`/api/audit?entityType=DressModel&entityId=${dress.id}&limit=100`).then(r => r.ok ? r.json() : { logs: [] })
    ];
    if (itemIds.length) {
      requests.push(
        fetch(`/api/audit?entityType=DressItem&entityIds=${itemIds.join(',')}&limit=200`).then(r => r.ok ? r.json() : { logs: [] })
      );
    }

    Promise.all(requests)
      .then(results => {
        if (cancelled) return;
        const barcodeById = {};
        (items || []).forEach(i => { barcodeById[i.id] = i.dressBarcode || i.sizeText || ''; });
        const merged = results.flatMap((res, idx) =>
          (res.logs || []).map(l => ({
            ...l,
            scope: idx === 0 ? 'model' : 'item',
            itemLabel: idx === 0 ? null : barcodeById[l.entityId]
          }))
        ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setLogs(merged);
        setLoaded(true);
      })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [active, loaded, dress?.id]);

  const activeItems = (items || []).filter(i => !i.isDeleted);
  const sizes = Array.from(new Set(activeItems.map(i => i.sizeText).filter(Boolean)));

  return (
    <>
      <div className="two-col" style={{ marginBottom: '18px' }}>
        <div className="card card-pad">
          <h3>נתוני מערכת</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div>
              <svg className="icon" style={{ color: 'var(--text-3)', verticalAlign: '-2px' }}><use href="#i-tag" /></svg>{' '}
              שם דגם: <strong>{dress.name || '—'}</strong>
            </div>
            <div>
              <svg className="icon" style={{ color: 'var(--text-3)', verticalAlign: '-2px' }}><use href="#i-box" /></svg>{' '}
              קידומת ברקוד: <strong>{dress.barcodePrefix ?? '—'}</strong>
            </div>
            <div>
              <svg className="icon" style={{ color: 'var(--text-3)', verticalAlign: '-2px' }}><use href="#i-calendar" /></svg>{' '}
              נכנס למאגר: <strong>{dress.entryDateToRepo ? fmtDateTime(dress.entryDateToRepo) : '—'}</strong>
            </div>
            <div>עודכן לאחרונה: <strong>{fmtDateTime(dress.updatedAt)}</strong></div>
            <div>מזהה במערכת הישנה (Access): <strong>{dress.legacyId ?? '—'}</strong></div>
          </div>
        </div>

        <div className="card card-pad">
          <h3>תמונת מלאי</h3>
          <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: '12px' }}>
            <div className="kpi-card">
              <div className="kpi-label">פריטים פעילים</div>
              <div className="kpi-value">{activeItems.length}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">זמינים</div>
              <div className="kpi-value" style={{ color: 'var(--success)' }}>{activeItems.filter(i => !i.inRepair && !i.notInUse).length}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">דורשים טיפול</div>
              <div className="kpi-value" style={{ color: 'var(--warning)' }}>{activeItems.filter(i => i.inRepair || i.notInUse).length}</div>
            </div>
          </div>
          <div style={{ fontSize: '13px' }}>מידות במלאי: <strong>{sizes.length ? sizes.join(', ') : 'אין'}</strong></div>
        </div>
      </div>

      <div className="card card-pad">
        <h3>יומן שינויים</h3>
        <div className="hint" style={{ color: 'var(--text-3)', marginBottom: '12px' }}>
          {logs.length} תיעודי פעולות · לחיצה על שורה חושפת את פירוט השינוי
        </div>

        {loading ? (
          <div className="loading-inline"><span className="spinner" /> טוען יומן שינויים...</div>
        ) : error ? (
          <div className="callout callout-danger">
            <svg className="icon"><use href="#i-alert-circle" /></svg>
            שגיאה בטעינת יומן השינויים: {error}
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <svg className="icon"><use href="#i-history" /></svg>
            <p>לא נמצאו תיעודי היסטוריה לדגם זה</p>
          </div>
        ) : (
          logs.map(log => {
            const actionLabel = ACTION_TRANSLATIONS[log.action] || log.action;
            const d = new Date(log.createdAt);
            return (
              <details key={log.id} className="faq-item">
                <summary>
                  <span className={`badge ${badgeClassFor(log.action)}`}>{actionLabel}</span>
                  <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {log.scope === 'item' ? `פריט ${log.itemLabel || ''}` : 'פרטי הדגם'}
                  </span>
                  <span className="hint" style={{ marginInlineStart: 'auto', color: 'var(--text-3)' }}>
                    {d.toLocaleDateString('he-IL')} · {d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <svg className="icon"><use href="#i-chevron-down" /></svg>
                </summary>
                <div className="faq-body">
                  <ChangesChips changesJson={log.changesJson} />
                </div>
              </details>
            );
          })
        )}
      </div>
    </>
  );
}
