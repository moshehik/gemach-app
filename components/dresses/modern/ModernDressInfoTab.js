'use client';

import React, { useEffect, useState } from 'react';
import { Info, Package, Calendar, Barcode, Shirt, ChevronDown } from 'lucide-react';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { ACTION_TRANSLATIONS } from '../../HistoryViewer';
import { ChangesChips, ACTION_TONES } from '../../modern/ChangesChips';

const fmtDateTime = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return `${date.toLocaleDateString('he-IL')} (${getHebrewDateString(date)}) · ${date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
};

/**
 * טאב "מידע" — נתוני מערכת ויומן השינויים של הדגם ושל הפריטים שלו.
 * שורות היומן מכווצות ונפתחות בלחיצה, בדיוק כמו ב-ModernInfoTab של ההזמנה.
 */
export default function ModernDressInfoTab({ dress, items, active }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});

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
      <div className="moc-grid-2" style={{ marginBottom: '22px' }}>
        <div className="moc-card-panel">
          <div className="moc-panel-head" style={{ marginBottom: '12px' }}>
            <div className="moc-title-row">
              <div className="moc-avatar-chip"><Info size={17} /></div>
              <div>
                <span className="moc-lbl">נתוני מערכת</span>
                <div className="moc-sub-lbl">מזהים ותאריכים</div>
              </div>
            </div>
          </div>

          <div className="moc-compact-row" style={{ padding: '8px 0' }}>
            <div className="moc-cr-main"><div className="moc-cr-sub">
              <Shirt size={13} style={{ verticalAlign: '-2px' }} /> שם דגם: <strong style={{ color: 'var(--moc-text-main)' }}>{dress.name || '—'}</strong>
            </div></div>
          </div>
          <div className="moc-compact-row" style={{ padding: '8px 0' }}>
            <div className="moc-cr-main"><div className="moc-cr-sub">
              <Barcode size={13} style={{ verticalAlign: '-2px' }} /> קידומת ברקוד: <strong className="moc-mono" style={{ color: 'var(--moc-text-main)' }}>{dress.barcodePrefix ?? '—'}</strong>
            </div></div>
          </div>
          <div className="moc-compact-row" style={{ padding: '8px 0' }}>
            <div className="moc-cr-main"><div className="moc-cr-sub">
              <Calendar size={13} style={{ verticalAlign: '-2px' }} /> נכנס למאגר: <strong style={{ color: 'var(--moc-text-main)' }}>{dress.entryDateToRepo ? fmtDateTime(dress.entryDateToRepo) : '—'}</strong>
            </div></div>
          </div>
          <div className="moc-compact-row" style={{ padding: '8px 0' }}>
            <div className="moc-cr-main"><div className="moc-cr-sub">
              עודכן לאחרונה: <strong style={{ color: 'var(--moc-text-main)' }}>{fmtDateTime(dress.updatedAt)}</strong>
            </div></div>
          </div>
          <div className="moc-compact-row" style={{ padding: '8px 0' }}>
            <div className="moc-cr-main"><div className="moc-cr-sub">
              מזהה במערכת הישנה (Access): <strong className="moc-mono" style={{ color: 'var(--moc-text-main)' }}>{dress.legacyId ?? '—'}</strong>
            </div></div>
          </div>
        </div>

        <div className="moc-card-panel">
          <div className="moc-panel-head" style={{ marginBottom: '12px' }}>
            <div className="moc-title-row">
              <div className="moc-avatar-chip"><Package size={17} /></div>
              <div>
                <span className="moc-lbl">תמונת מלאי</span>
                <div className="moc-sub-lbl">פילוח הפריטים של הדגם</div>
              </div>
            </div>
          </div>

          <div className="moc-stat-tiles" style={{ marginBottom: '10px' }}>
            <div className="moc-stat-tile total">
              <div className="moc-st-label">פריטים פעילים</div>
              <div className="moc-st-value">{activeItems.length}</div>
            </div>
            <div className="moc-stat-tile ok">
              <div className="moc-st-label">זמינים</div>
              <div className="moc-st-value">{activeItems.filter(i => !i.inRepair && !i.notInUse).length}</div>
            </div>
            <div className="moc-stat-tile warn">
              <div className="moc-st-label">דורשים טיפול</div>
              <div className="moc-st-value">{activeItems.filter(i => i.inRepair || i.notInUse).length}</div>
            </div>
          </div>

          <div className="moc-cr-sub" style={{ whiteSpace: 'normal' }}>
            מידות במלאי: <strong style={{ color: 'var(--moc-text-main)' }}>{sizes.length ? sizes.join(', ') : 'אין'}</strong>
          </div>
        </div>
      </div>

      <div className="moc-card-panel">
        <div className="moc-section-head" style={{ marginBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>יומן שינויים</h3>
          <span className="moc-hint">{logs.length} תיעודי פעולות · לחיצה על שורה חושפת את פירוט השינוי</span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '28px 0' }}>
            <span className="moc-spinner lg" style={{ margin: '0 auto' }} />
            <p className="moc-hint" style={{ marginTop: '12px' }}>טוען יומן שינויים...</p>
          </div>
        ) : error ? (
          <div style={{ color: 'var(--moc-danger-text)', textAlign: 'center', padding: '20px 0', fontWeight: 700 }}>
            שגיאה בטעינת יומן השינויים: {error}
          </div>
        ) : logs.length === 0 ? (
          <div className="moc-empty-state">לא נמצאו תיעודי היסטוריה לדגם זה</div>
        ) : (
          logs.map(log => {
            const actionLabel = ACTION_TRANSLATIONS[log.action] || log.action;
            const tone = ACTION_TONES[log.action] || ACTION_TONES.UPDATE;
            const isOpen = !!expanded[log.id];
            const d = new Date(log.createdAt);
            return (
              <div key={log.id} className="moc-history-item">
                <button className="moc-history-row" onClick={() => setExpanded(prev => ({ ...prev, [log.id]: !prev[log.id] }))}>
                  <ChevronDown size={15} className={`moc-history-chevron ${isOpen ? 'expanded' : ''}`} />
                  <span className="moc-history-dot" style={{ background: tone.color }} />
                  <span className="moc-action-tag" style={{ background: tone.bg, color: tone.color }}>{actionLabel}</span>
                  <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {log.scope === 'item' ? `פריט ${log.itemLabel || ''}` : 'פרטי הדגם'}
                  </span>
                  <span className="moc-meta" style={{ marginRight: 'auto' }}>
                    {d.toLocaleDateString('he-IL')} · {d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </button>
                {isOpen && (
                  <div className="moc-history-details" style={{ display: 'block' }}>
                    <ChangesChips changesJson={log.changesJson} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
