'use client';

import { useEffect, useRef } from 'react';
import ScheduleIcon from './ScheduleIcon';
import { MARK_TIPS, subText } from './scheduleMeta';

// חלון "בטוח?" (S03/S04) והטוסט של סימון "בוצע" - המראה הוא בדיוק של העיצוב המאושר (תצוגות-עיצוב/לוז-יומי.html):
// L.confirm (שורה 1872: scrim > dlg.lz-cf > dbadge / h2 / .sub / lz-det / dbtns [btn primary lg block, btn ghost block])
// ו-L.say (שורה 1853: #toast.info.on > .tb / b+small / button.tclose). רכיבי הפלטה (חלון 24/26, טוסט 1/2), בלי CSS
// משלהם מעבר ל-schedule.css. הטקסטים (כותרת/כפתור לפי שלב) = confirmMark / confirmAll בעיצוב (שורות 2011-2026).

function fmtWhen(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

const VIA_TEXT = { alterationDone: 'לפי מסך התיקונים', isTaken: 'לפי ההשכרה (הפריטים נלקחו)', isReturned: 'לפי החזרת הפריטים' };

// הטולטיפ של "בוצע" דלוק (B18, מאושר: "סומן ע״י … ב-…") + טקסט העיצוב לביטול
export function doneTip(state) {
  const base = MARK_TIPS.unmark;
  if (!state || state.done !== true) return base;
  if (state.doneVia === 'mark' || state.doneBy) {
    return 'סומן ע״י ' + (state.doneBy || 'עובדת') + (state.doneAt ? ' ב-' + fmtWhen(state.doneAt) : '') + ' · ' + base;
  }
  if (state.doneVia && VIA_TEXT[state.doneVia]) return 'בוצע ' + VIA_TEXT[state.doneVia] + ' · ' + base;
  return base;
}

// מה הסימון/הביטול עושה בפועל בשלב הזה (בלי הפתעות: בשלבים 2/8 נוגעים בפריטים)
export function confirmEffect(stageKey, { done, outcome, all }) {
  if (stageKey === 'manret') {
    if (!done) return 'יבטל את ההחזרה של הפריטים בהזמנה (רק פריטים שהוחזרו מהלו״ז)';
    return all ? 'הפריטים יירשמו כהוחזרו תקין' : (outcome === 'not_ok' ? 'הפריטים יירשמו כהוחזרו - לא תקין' : 'הפריטים יירשמו כהוחזרו תקין');
  }
  if (stageKey === 'repair') return done ? 'יסמן "תיקון בוצע" בפריטי ההזמנה' : 'יבטל "תיקון בוצע" בפריטים';
  return '';
}

// שורות הפירוט בחלון (detailRows בעיצוב, שורה 2009): לקוחה + טלפון, השלב + היום + שורת הפרטים
export function DetailRows({ stage, row, dayLabel }) {
  const name = (row.customer && row.customer.name) || 'לא ידוע';
  const phone = (row.customer && row.customer.phone1) || '';
  return (
    <div className="lz-det">
      <div className="li"><div className="ic-b"><ScheduleIcon name="user" /></div><div className="t"><b>{name}</b><small><bdi dir="ltr">{phone}</bdi></small></div></div>
      <div className="li"><div className="ic-b"><ScheduleIcon name={stage.icon} /></div><div className="t"><b>{stage.label}{dayLabel ? ' · ' + dayLabel : ''}</b><small>{subText(stage.key, row, { tbl: true })}</small></div></div>
    </div>
  );
}

// חלון "בטוח?": Enter = כן (הפוקוס על "כן"), Esc = ביטול, Tab נלכד בין שני הלחצנים, והפוקוס חוזר ללחצן שפתח.
export function ConfirmDialog({ open, icon = 'check', title, sub, effect, body, yes, onYes, onNo }) {
  const yesRef = useRef(null);
  const noRef = useRef(null);
  const returnTo = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    returnTo.current = typeof document !== 'undefined' ? document.activeElement : null;
    const t = setTimeout(() => yesRef.current && yesRef.current.focus(), 80);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onNo(); return; }
      if (e.key === 'Tab') {
        const a = yesRef.current;
        const b = noRef.current;
        if (!a || !b) return;
        e.preventDefault();
        (document.activeElement === a ? b : a).focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey, true);
      const el = returnTo.current;
      if (el && typeof el.focus === 'function' && document.contains(el)) el.focus();
    };
  }, [open, onNo]);
  if (!open) return null;
  return (
    <div className="scrim on lz-cf-scrim" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onNo(); }}>
      <div className="dlg lz-cf" role="dialog" aria-modal="true" aria-labelledby="lz-cf-title">
        <div className="dbadge" aria-hidden="true"><ScheduleIcon name={icon} /></div>
        <h2 id="lz-cf-title">{title}</h2>
        <div className="sub">{sub}{effect ? <span className="lz-cf-effect">{effect}</span> : null}</div>
        {body}
        <div className="dbtns">
          <button ref={yesRef} type="button" className="btn primary lg block" onClick={onYes}><ScheduleIcon name={icon} />{yes}</button>
          <button ref={noRef} type="button" className="btn ghost block" onClick={onNo}><ScheduleIcon name="x" />ביטול</button>
        </div>
      </div>
    </div>
  );
}

// הטוסט (L.say בעיצוב): #toast.info.on של הפלטה, אייקון לפי סוג ההודעה
const TOAST_ICON = { ok: 'check', undo: 'undo', warn: 'alert', error: 'alert' };
export function MarkToast({ toast, onClose }) {
  if (!toast) return null;
  const kind = toast.kind || 'ok';
  return (
    <div id="toast" className={'info on lz-toast lz-toast-' + kind} role="status" aria-live="polite" key={toast.n}>
      <span className="tb"><ScheduleIcon name={TOAST_ICON[kind] || 'check'} /></span>
      <div><b>{toast.title}</b><small>{toast.text}</small></div>
      <button type="button" className="tclose" aria-label="סגירה" onClick={onClose}><ScheduleIcon name="x" /></button>
    </div>
  );
}
