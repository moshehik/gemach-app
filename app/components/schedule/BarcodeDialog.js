'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ScheduleIcon from './ScheduleIcon';
import { LzPortal } from './LzPortal';

// חלונית ברקוד מהירה בלו״ז (docs/schedule-barcode-plan.md): נפתחת בלחיצת "בוצע" על הכנה / איסוף מקומי / משלוח כשחסר ברקוד לפריט, או בסריקת קוד
// השלב מהדף המודפס (PRP-40113 ...). שורת הברקוד בפוקוס; Enter שולח ועובר לברקוד הבא; שגיאה לא עוצרת את הרצף.
// השרת: GET/POST/DELETE /api/schedule/barcodes (lib/schedule/barcodeScan.js). המראה: חלון "בטוח?" של הלו״ז (lz-cf) ושורות lz-det - רכיבי הפלטה.
//
// gate 'register' (הכנה): הסריקה רושמת בלבד, וכשהכל ✓ לוחצים "סמן הכנה כבוצעה".
// gate 'handover' (איסוף / משלוח): כל סריקה נרשמת *ונלקחת*; הסריקה האחרונה סוגרת את המסירה אוטומטית (ההזמנה נרשמת "נמסרה").
//   אם הכל כבר רשום (למשל בהכנה) - "סמן כבוצע" לוקח את כל הפריטים.
// Props:
//   target { orderId, stageKey, stageLabel, customerName?, dayKey }   null = סגור
//   onClose(changed)        נסגר; changed=true כשנרשם / נלקח משהו (הדף טוען את היום מחדש)
//   onProgress(info)        אחרי כל פעולה: { orderId, stageKey, summary, gate, when } - לעדכון שבב הברקודים בשורה שמאחורי החלון
//   onMarkReady(target)     "סמן כבוצע" - הדף מריץ את אותו onMarkDone של הכפתור בשורה (Promise<boolean>)
//   scanQueue               מערך קודים שנסרקו בשורת הסריקה בציר בזמן שהחלון פתוח (נצרכים ברצף)

const ERROR_FALLBACK = 'הברקוד לא נשמר';

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'same-origin',
    cache: 'no-store',
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* לא JSON */ }
  return { ok: res.ok, status: res.status, json: json || {} };
}

function itemLabel(it) {
  const parts = [];
  if (it.model) parts.push('דגם ' + it.model);
  if (it.size) parts.push('מידה ' + it.size);
  return parts.join(' · ') || 'פריט ללא דגם';
}

export default function BarcodeDialog({ target, onClose, onProgress, onMarkReady, scanQueue = [], onScanConsumed }) {
  const open = !!target;
  const [state, setState] = useState(null); // תשובת GET / POST: { items, summary, gate, intent, customerName }
  const [loadError, setLoadError] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // { kind:'ok'|'error', text }
  const [options, setOptions] = useState(null); // ambiguous: { barcode, items:[...] }
  const [done, setDone] = useState(false);
  const inputRef = useRef(null);
  const yesRef = useRef(null);
  const changed = useRef(false);
  const busyRef = useRef(false);
  const stateRef = useRef(null);
  const returnTo = useRef(null);
  const closeTimer = useRef(null);
  const gen = useRef(0); // דור הבקשה: תשובה מאוחרת של הזמנה קודמת לא מצוירת בחלונית של ההזמנה הנוכחית
  useEffect(() => { stateRef.current = state; }, [state]);

  const focusInput = useCallback(() => { setTimeout(() => inputRef.current && inputRef.current.focus(), 30); }, []);

  const load = useCallback(async () => {
    if (!target) return;
    const g = gen.current;
    setLoadError('');
    const r = await api('GET', `/api/schedule/barcodes?orderId=${encodeURIComponent(target.orderId)}&stageKey=${encodeURIComponent(target.stageKey)}`);
    if (g !== gen.current) return;
    if (!r.ok) {
      setLoadError(r.json.error || 'לא ניתן לטעון את פריטי ההזמנה');
      return;
    }
    setState(r.json);
    if (onProgress) onProgress({ orderId: target.orderId, stageKey: target.stageKey, summary: r.json.summary, gate: r.json.gate, when: r.json.when });
  }, [target, onProgress]);

  // פתיחה / החלפת הזמנה: איפוס וטעינה
  useEffect(() => {
    if (!open) return undefined;
    gen.current += 1;
    clearTimeout(closeTimer.current);
    busyRef.current = false;
    setBusy(false);
    setState(null); setStatus(null); setOptions(null); setCode(''); setDone(false); setLoadError('');
    changed.current = false;
    returnTo.current = typeof document !== 'undefined' ? document.activeElement : null;
    load().then(focusInput);
    return () => {
      clearTimeout(closeTimer.current);
      const el = returnTo.current;
      if (el && typeof el.focus === 'function' && document.contains(el)) el.focus();
    };
  }, [open, target && target.orderId, target && target.stageKey]);

  const close = useCallback(() => { clearTimeout(closeTimer.current); if (onClose) onClose(changed.current); }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, close]);

  const submit = useCallback(async (raw, itemId = null) => {
    const barcode = String(raw || '').trim();
    if (!barcode || !target || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setOptions(null);
    const g = gen.current;
    try {
      const st = stateRef.current;
      const r = await api('POST', '/api/schedule/barcodes', {
        orderId: target.orderId, stageKey: target.stageKey, barcode, dayKey: target.dayKey, itemId: itemId || undefined,
        intent: st && st.intent ? st.intent : undefined, source: 'schedule_dialog',
      });
      if (g !== gen.current) return; // החלונית עברה להזמנה אחרת בזמן הבקשה - התשובה לא נוגעת בה
      if (!r.ok) {
        const j = r.json;
        setStatus({ kind: 'error', text: j.error || ERROR_FALLBACK });
        if (j.code === 'mode_changed' || j.code === 'race') await load();
        return;
      }
      const j = r.json;
      if (j.status === 'ambiguous') {
        setOptions({ barcode, items: j.options || [] });
        setStatus({ kind: 'error', text: 'כמה פריטים זהים בהזמנה - בחרו לאיזה לשייך את הברקוד' });
        return;
      }
      changed.current = changed.current || j.status === 'registered' || j.status === 'taken';
      setState((prev) => ({ ...(prev || {}), items: j.items, summary: j.summary }));
      const it = j.item;
      setStatus({
        kind: 'ok',
        text: j.status === 'already' ? `הברקוד ${barcode} כבר רשום בהזמנה` : `${barcode} נרשם${j.status === 'taken' ? ' ונלקח' : ''}${it ? ' · ' + itemLabel(it) : ''}`,
      });
      if (onProgress) onProgress({ orderId: target.orderId, stageKey: target.stageKey, summary: j.summary, gate: (stateRef.current || {}).gate, when: (stateRef.current || {}).when, handover: j.handover });
      if (j.handover && (j.handover.marked || j.handover.reason === 'exists')) {
        setDone(true);
        setStatus({ kind: 'ok', text: 'כל הפריטים נסרקו - ההזמנה נרשמה כנמסרה' });
        changed.current = true;
        clearTimeout(closeTimer.current);
        closeTimer.current = setTimeout(() => { if (onClose) onClose(true); }, 1100);
      }
    } catch {
      if (g === gen.current) setStatus({ kind: 'error', text: 'אין חיבור לשרת - הברקוד לא נשמר. נסו שוב.' });
    } finally {
      if (g === gen.current) {
        busyRef.current = false;
        setBusy(false);
        setCode('');
        focusInput();
      }
    }
  }, [target, load, onProgress, onClose, focusInput]);

  // קודים שנסרקו בשורת הסריקה בציר בזמן שהחלון פתוח
  useEffect(() => {
    if (!open || !state || !scanQueue.length || busyRef.current) return;
    const next = scanQueue[0];
    if (onScanConsumed) onScanConsumed();
    submit(next);
  }, [open, state, scanQueue, submit, onScanConsumed, busy]);

  const release = useCallback(async (it) => {
    if (!target || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const g = gen.current;
    try {
      const r = await api('DELETE', `/api/schedule/barcodes?orderId=${encodeURIComponent(target.orderId)}&itemId=${encodeURIComponent(it.orderItemId)}`);
      if (g !== gen.current) return;
      if (!r.ok) { setStatus({ kind: 'error', text: r.json.error || 'הרישום לא בוטל' }); return; }
      changed.current = true;
      setState((prev) => ({ ...(prev || {}), items: r.json.items, summary: r.json.summary }));
      setStatus({ kind: 'ok', text: 'הרישום בוטל · ' + itemLabel(it) });
      if (onProgress) onProgress({ orderId: target.orderId, stageKey: target.stageKey, summary: r.json.summary, gate: (stateRef.current || {}).gate, when: (stateRef.current || {}).when });
    } catch {
      if (g === gen.current) setStatus({ kind: 'error', text: 'אין חיבור לשרת - הרישום לא בוטל' });
    } finally {
      if (g === gen.current) {
        busyRef.current = false;
        setBusy(false);
        focusInput();
      }
    }
  }, [target, onProgress, focusInput]);

  const markReady = useCallback(async () => {
    if (!target || !onMarkReady || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    let ok = false;
    try { ok = await onMarkReady(target); } finally { busyRef.current = false; setBusy(false); }
    if (ok) { changed.current = true; if (onClose) onClose(true); } else { await load(); focusInput(); }
  }, [target, onMarkReady, onClose, load, focusInput]);

  if (!open) return null;
  const items = (state && state.items) || [];
  const summary = (state && state.summary) || null;
  const gate = state && state.gate;
  const complete = !!(summary && summary.complete);
  const stop = (e) => e.stopPropagation();
  const heading = (target.stageLabel || 'ברקודים') + ' · הזמנה #' + target.orderId;
  const name = (state && state.customerName) || target.customerName || '';
  const sub = gate === 'handover'
    ? 'סרקו כל שמלה במסירה - כל סריקה נרשמת כנלקחה, והסריקה האחרונה סוגרת את המסירה'
    : 'סרקו את הברקוד של כל שמלה - הרישום בלבד, ההכנה מסומנת בסוף';
  const yesLabel = gate === 'handover' ? 'סמן כבוצע (לקיחת כל הפריטים)' : 'סמן הכנה כבוצעה';

  return (
    <LzPortal>
      <div className="scrim on lz-cf-scrim" role="presentation" onClick={stop} onMouseDown={(e) => { stop(e); if (e.target === e.currentTarget) close(); }}>
        <div className="dlg lz-cf lz-bc" id="dlg" role="dialog" aria-modal="true" aria-labelledby="lz-bc-title">
          <div className="dbadge" aria-hidden="true"><ScheduleIcon name="scan" /></div>
          <h2 id="lz-bc-title">{heading}</h2>
          <div className="sub">{name ? name + ' · ' : ''}{sub}</div>

          <div className="lz-bc-inp">
            <ScheduleIcon name="scan" />
            <input
              ref={inputRef}
              className="inp"
              name="barcode-nofill"
              inputMode="numeric"
              dir="ltr"
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore=""
              data-form-type="other"
              aria-label="ברקוד השמלה: סרקו או הקלידו ולחצו Enter"
              placeholder="ברקוד"
              disabled={busy || done || !state}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); submit(code); }
              }}
            />
          </div>

          <div className="lz-bc-status" role="status" aria-live="polite">
            {loadError ? (
              <span className="lz-bc-err">{loadError} <button type="button" className="btn ghost" onClick={() => { load().then(focusInput); }}>נסו שוב</button></span>
            ) : null}
            {!loadError && status ? <span className={status.kind === 'error' ? 'lz-bc-err' : 'lz-bc-ok'}>{status.text}</span> : null}
            {!loadError && !status && !state ? <span className="lz-bc-hint">טוען...</span> : null}
          </div>

          {options ? (
            <div className="lz-det" aria-label="בחירת פריט">
              {options.items.map((o) => (
                <div className="li" key={o.orderItemId}>
                  <div className="t"><b>{itemLabel(o)}</b></div>
                  <button type="button" className="btn primary" disabled={busy} onClick={() => submit(options.barcode, o.orderItemId)}>שייך לפריט הזה</button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="lz-det lz-bc-list">
            {items.map((it) => (
              <div className={'li lz-bc-it' + (it.registered || it.taken || !it.needsBarcode ? ' ok' : ' miss')} key={it.orderItemId}>
                <div className="ic-b"><ScheduleIcon name={it.taken || it.registered ? 'check' : (it.needsBarcode ? 'scan' : 'dress')} /></div>
                <div className="t">
                  <b>{itemLabel(it)}</b>
                  <small>
                    {it.registered
                      ? <>ברקוד <bdi dir="ltr">{it.barcode}</bdi>{it.taken ? ' · נלקח' : ''}</>
                      : (it.invalid ? 'ברקוד לא תקין נרשם - יש לסרוק מחדש' : (it.needsBarcode ? (it.taken ? 'נלקח בלי ברקוד' : 'חסר ברקוד') : 'אין דרישת ברקוד לפריט הזה'))}
                  </small>
                </div>
                {it.registered && !it.taken ? (
                  <button type="button" className="ibtn" aria-label="ביטול הרישום של הפריט" data-tip="ביטול הרישום" disabled={busy} onClick={() => release(it)}>
                    <ScheduleIcon name="x" />
                  </button>
                ) : null}
              </div>
            ))}
            {state && !items.length ? <div className="lz-more">אין פריטים פעילים בהזמנה</div> : null}
          </div>

          <div className="dbtns">
            <button ref={yesRef} type="button" className="btn primary lg block" disabled={!complete || busy || done || !onMarkReady} onClick={markReady}>
              <ScheduleIcon name="check" />{yesLabel}{summary && summary.required ? ' (' + summary.registered + '/' + summary.required + ')' : ''}
            </button>
            <button type="button" className="btn ghost block" onClick={close}><ScheduleIcon name="x" />סגירה</button>
          </div>
        </div>
      </div>
    </LzPortal>
  );
}
