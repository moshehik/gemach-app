'use client';

// EcHistory - לשונית "היסטוריה" של כרטיס העובד החדש (העיצוב המאושר: כרטיס "היסטוריית שינויים", שורות .hrow נפתחות, פירוט .hdet).
// הנתונים: GET /api/employees/<id>/history?extended=1 (EC-06: מוסיף שינויי הרשאות אישיות ותקציר קריא ל"שליחת מייל"; אותה הרשאה כמו
// הדף - הנהלה ראשית). הנרמול לשורות תצוגה: lib/employeeCardHistory.js (buildHistoryRows). תאריכים: עברי בלבד (EC-07: "רק בנוכחות
// ובתאריכים צריך את שניהם") - גם ערכי תאריך בתוך פירוט שינוי מוצגים עבריים.
import { useEffect, useMemo, useState } from 'react';
import { buildHistoryRows } from '@/lib/employeeCardHistory';
import { getCatalogItem } from '@/lib/permissionsMetadata';
import { israelDayKey, israelTime, hDayYear } from '@/lib/attendance/summary';
import { Ic } from './EcUi';

const ISO_DAY = /^(\d{4}-\d{2}-\d{2})(?:$|T)/;
const DATE_KEYS = new Set(['date', 'joinDate']);

function fmtChangeValue(key, v) {
  if (typeof v === 'string' && DATE_KEYS.has(key)) {
    const m = ISO_DAY.exec(v);
    if (m) return hDayYear(DATE_KEYS.has(key) && v.length > 10 ? (israelDayKey(v) || m[1]) : m[1]);
  }
  return v === null || v === undefined || v === '' ? '-' : String(v);
}

function Row({ row, index, open, onToggle }) {
  const dayKey = israelDayKey(row.createdAt);
  const time = israelTime(row.createdAt);
  return (
    <article className={`hrow${open ? ' open' : ''}`} data-hv={row.id} style={{ '--i': Math.min(index, 12) }}>
      <div className="li rlink lrow" role="button" tabIndex={0} aria-expanded={open} onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}>
        <div className="ic-b"><Ic id={row.icon} /><span className="rlbl">{row.entityLabel}</span></div>
        <div className="t">
          <b><span className={`chip ${row.chipTone}`}>{row.actionLabel}</span> {row.entityLabel} · {row.actorName} ביצע/ה {row.actionLabel}</b>
          <span className="ln">{dayKey ? hDayYear(dayKey) : ''} · <bdi>{time}</bdi>{row.firstChangeLabel ? ` · ${row.firstChangeLabel}` : ''}</span>
        </div>
        <span className="go" aria-hidden="true"><Ic id="chev" size="sm" /></span>
      </div>
      <div className="hdet"><div className="hdet-in">
        {row.changes.length ? row.changes.map((c) => {
          const hasFrom = c.from !== null && c.from !== undefined && c.from !== '' && c.from !== '-';
          return (
            <div key={c.key} className={`hv-r${c.long ? ' long' : ''}`}>
              <small>{c.label}</small>
              <b>{c.kind === 'change' ? <>{hasFrom ? <><bdi><s>{fmtChangeValue(c.key, c.from)}</s></bdi> ← </> : null}<bdi>{fmtChangeValue(c.key, c.to)}</bdi></> : <bdi>{fmtChangeValue(c.key, c.to)}</bdi>}</b>
            </div>
          );
        }) : <div className="hv-r"><small>שינויים</small><b>לא בוצעו שינויים מהותיים בשדות.</b></div>}
      </div></div>
    </article>
  );
}

export default function EcHistory({ employeeId, refreshKey = 0 }) {
  const [logs, setLogs] = useState(null);
  const [error, setError] = useState(null);
  const [openIds, setOpenIds] = useState(() => new Set()); // כמה שורות יכולות להיות פתוחות יחד (כמו בעיצוב)
  const [openInit, setOpenInit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const res = await fetch(`/api/employees/${employeeId}/history?extended=1`);
        if (!res.ok) throw new Error('Failed to fetch history');
        const data = await res.json();
        if (!cancelled) setLogs(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) { setError(e.message); setLogs([]); }
      }
    })();
    return () => { cancelled = true; };
  }, [employeeId, refreshKey]);

  const rows = useMemo(() => buildHistoryRows(logs || [], { catalogLabel: (key) => (getCatalogItem(key) || {}).label || key }), [logs]);
  // השורה הראשונה פתוחה בטעינה הראשונה (כמו בעיצוב)
  useEffect(() => { if (!openInit && rows.length) { setOpenIds(new Set([rows[0].id])); setOpenInit(true); } }, [rows, openInit]);

  return (
    <section className="card ec-hist" aria-labelledby="h-hist">
      <div className="card-h">
        <div className="ico rose"><Ic id="sn-history" size="lg" /></div><h2 id="h-hist">היסטוריית שינויים</h2>
        <span className="chip gray">{rows.length} תיעודי פעולות</span>
      </div>
      <div className="hres">
        {logs === null ? <div className="empty" role="status"><span className="spin" /><p>טוען היסטוריית שינויים...</p></div>
          : error ? <div className="empty" role="alert"><Ic id="alert" /><p>שגיאה בטעינת היסטוריה: {error}</p></div>
            : rows.length ? <div className="hgrp">{rows.map((r, i) => <Row key={r.id} row={r} index={i} open={openIds.has(r.id)} onToggle={() => setOpenIds((cur) => { const n = new Set(cur); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} />)}</div>
              : <div className="empty"><Ic id="sn-history" /><p>אין תיעוד היסטוריה לעובד זה</p></div>}
      </div>
    </section>
  );
}
