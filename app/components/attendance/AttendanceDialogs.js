'use client';

// החלונות של "סיכום נוכחות": אישור (dlgConfirm בעיצוב - מחיקה / שחזור), היסטוריית השינויים (AT-12 / AT-16) והטוסט (#toast.info).
// כולם רכיבי הפלטה: scrim > dlg#dlg כהה (שורש הדף נושא dlg-dark), dbadge / h2 / .sub / .dbtns.
import { useEffect, useRef, useState } from 'react';
import { Ic } from './parts';
import { hDayShort, israelDayKey, israelTime, FIELD_LABEL } from '@/lib/attendance/summary';

// Escape סוגר, Tab נשאר בתוך החלון, והפוקוס חוזר בסגירה ללחצן שפתח
function useDialogKeys(open, dlgRef, onClose, focusSel = '.btn.primary, .btn') {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return undefined;
    const opener = typeof document !== 'undefined' ? document.activeElement : null;
    const t = setTimeout(() => { const b = dlgRef.current && dlgRef.current.querySelector(focusSel); if (b) b.focus(); }, 60);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== 'Tab' || !dlgRef.current) return;
      const els = [...dlgRef.current.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent !== null);
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (!dlgRef.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey, true);
      try { if (opener && opener.focus && document.contains(opener)) opener.focus(); } catch { /* */ }
    };
  }, [open, dlgRef, focusSel]);
}

/** dlgConfirm בעיצוב: כותרת, שורת משנה, "אישור" (אייקון לפי הפעולה) ו"ביטול" */
export function ConfirmDialog({ open, title, sub, okLabel = 'אישור', icon = 'check', onYes, onNo }) {
  const dlgRef = useRef(null);
  useDialogKeys(open, dlgRef, onNo);
  if (!open) return null;
  return (
    <div className="scrim on" onMouseDown={(e) => { if (e.target === e.currentTarget) onNo(); }}>
      <div className="dlg" id="dlg" role="dialog" aria-modal="true" aria-labelledby="at-cf-t" ref={dlgRef}>
        {/* האייקון בראש החלון: בעיצוב decorate() מוסיף אותו לכל חלון לפי אייקון הלחצן הראשי (מכסה - פח, נשימה - וי, ריחוף - אחר) */}
        <div className="dbadge" aria-hidden="true" data-k={icon === 'trash' ? 'lid' : icon === 'check' ? 'breathe' : 'float'}><Ic id={icon} /></div>
        <h2 id="at-cf-t">{title}</h2>
        {sub ? <div className="sub">{sub}</div> : null}
        <div className="dbtns">
          <button type="button" className="btn primary lg block" onClick={onYes}><Ic id={icon} />{okLabel}</button>
          <button type="button" className="btn ghost block" onClick={onNo}><Ic id="x" size="sm" />ביטול</button>
        </div>
      </div>
    </div>
  );
}

function whenText(iso) {
  if (!iso) return '';
  const k = israelDayKey(iso);
  return (k ? hDayShort(k) + ' ' : '') + (israelTime(iso) || '');
}
const ACTION_ICON = { added: 'plus', edited: 'pencil', deleted: 'trash', restored: 'refresh' };
// "כניסה 08:00 → 08:15" - הערכים בכיוון שמאל-לימין (at-hchg) כדי שהחץ יצביע מהישן לחדש, כמו בעיצוב
function Change({ c, kind }) {
  const val = kind === 'edited' && c.from !== c.to ? (c.from || '-') + ' → ' + (c.to || '-') : (c.to || c.from || '-');
  return <>{FIELD_LABEL[c.field]} <span className="at-hchg">{val}</span></>;
}

/**
 * היסטוריית השינויים במשמרות של עובד (או של משמרת אחת): לפני → אחרי, מי ומתי - מה-AuditLog הקיים (GET /api/attendance-sheet?scope=history).
 * להנהלה גם קישור ללשונית ההיסטוריה בכרטיס העובד (AT-16). ה-markup: histHTML בעיצוב (חלון כהה, רשימת .li.lz-wr).
 */
export function HistoryDialog({ open, employee, shiftId, shiftLabel, cardHref, onClose }) {
  const dlgRef = useRef(null);
  const [state, setState] = useState({ loading: true, entries: [], error: null });
  useDialogKeys(open, dlgRef, onClose, '.btn.ghost'); // כמו openHist בעיצוב: הפוקוס על "סגירה"
  useEffect(() => {
    if (!open || !employee) return undefined;
    const ctrl = new AbortController();
    setState({ loading: true, entries: [], error: null });
    const qs = new URLSearchParams({ scope: 'history', emp: employee.id });
    if (shiftId) qs.set('shift', shiftId);
    fetch('/api/attendance-sheet?' + qs.toString(), { signal: ctrl.signal, credentials: 'same-origin', cache: 'no-store' })
      .then(async (r) => { const d = await r.json().catch(() => null); if (!r.ok) throw new Error((d && d.error) || 'שגיאה בטעינת ההיסטוריה'); return d; })
      .then((d) => setState({ loading: false, entries: d.entries || [], error: null }))
      .catch((e) => { if (e && e.name === 'AbortError') return; setState({ loading: false, entries: [], error: e.message }); });
    return () => ctrl.abort();
  }, [open, employee, shiftId]);
  if (!open || !employee) return null;
  const empty = !state.loading && (state.error || !state.entries.length);
  return (
    <div className="scrim on" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dlg lz-wiz lz-quick at-hist" id="dlg" role="dialog" aria-modal="true" aria-labelledby="hsT" ref={dlgRef}>
        <div className="dbadge" aria-hidden="true"><Ic id="sn-history" /></div>
        <h2 id="hsT">היסטוריית שינויים · {employee.name}</h2>
        <div className="sub">{shiftLabel ? 'משמרת ' + shiftLabel : 'כל השינויים ברשומות המשמרות, מהחדש לישן'}</div>
        <div className="lz-wl at-hl" id="hsList">
          {state.loading ? <div className="at-empty" style={{ padding: '24px 8px' }} role="status">טוען נתונים...</div> : null}
          {empty ? <div className="at-empty" style={{ padding: '24px 8px' }}><Ic id="sn-history" /><div>{state.error || 'אין שינויים רשומים'}</div></div> : null}
          {state.entries.map((h) => (
            <div key={h.id} className="li lz-wr at-hli">
              <div className="ic-b" aria-hidden="true"><Ic id={ACTION_ICON[h.kind] || 'pencil'} size="sm" /></div>
              <div className="t">
                <b>{h.label}{h.dayKey ? ' · ' + hDayShort(h.dayKey) : ''}</b>
                <small>
                  {h.changes.map((c, i) => <span key={c.field}>{i ? ' · ' : ''}<Change c={c} kind={h.kind} /></span>)}
                  {h.changes.length ? ' · ' : ''}{h.by ? 'ע״י ' + h.by + ' · ' : ''}{whenText(h.at)}
                </small>
              </div>
            </div>
          ))}
        </div>
        <div className="dbtns mact lz-wf">
          {cardHref ? <button type="button" className="btn" onClick={() => { window.location.href = cardHref; }}><Ic id="user" size="sm" />לכרטיס העובד · היסטוריה</button> : null}
          <button type="button" className="btn ghost" onClick={onClose}>סגירה<Ic id="x" size="sm" /></button>
        </div>
      </div>
    </div>
  );
}

export const TOAST_MS = 2600; // כמו say() בעיצוב (kind info)
/** הטוסט של הפלטה (#toast.info.pulse.on, say() בעיצוב): כותרת + שורה קטנה + אייקון לפי הסוג */
export function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div id="toast" className="info on pulse" data-kind="info" role="status" aria-live="polite" key={toast.n} style={{ '--tdur': TOAST_MS + 'ms' }}>
      <button type="button" className="tclose" aria-label="סגירה" data-tip="סגור" onClick={onClose}><Ic id="x" size="sm" /></button>
      <div className="tb"><Ic id={toast.icon || 'check'} size="lg" /></div>
      <div><b>{toast.title}</b><small>{toast.text || ''}</small></div>
    </div>
  );
}
