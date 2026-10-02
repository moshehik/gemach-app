'use client';

import { useEffect, useRef } from 'react';
import ScheduleIcon from './ScheduleIcon';
import { MARK_TIPS, subText } from './scheduleMeta';
import { LzPortal } from './LzPortal';

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
export function ConfirmDialog({ open, icon = 'check', heading, sub, effect, body, yes, onYes, onNo }) {
  const yesRef = useRef(null);
  const noRef = useRef(null);
  const returnTo = useRef(null);
  // onNo מגיע כפונקציה חדשה בכל רינדור - דרך ref, כדי שה-effect ירוץ רק בפתיחה/סגירה (אחרת כל רינדור בזמן שהחלון פתוח
  // היה מחזיר את הפוקוס ל"כן" ושומר את "החזר לאן" כרכיב שבתוך החלון - והפוקוס לא היה חוזר ללחצן שפתח)
  const noRef2 = useRef(onNo);
  useEffect(() => { noRef2.current = onNo; }, [onNo]);
  useEffect(() => {
    if (!open) return undefined;
    returnTo.current = typeof document !== 'undefined' ? document.activeElement : null;
    const t = setTimeout(() => yesRef.current && yesRef.current.focus(), 80);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); noRef2.current(); return; }
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
  }, [open]);
  if (!open) return null;
  // ב-portal לשורש הדף (אח של .app, כמו בעיצוב); אירועי React עדיין עולים לשורה - עוצרים אותם כאן
  const stop = (e) => e.stopPropagation();
  return (
    <LzPortal>
      <div className="scrim on lz-cf-scrim" role="presentation" onClick={stop} onMouseDown={(e) => { stop(e); if (e.target === e.currentTarget) onNo(); }}>
        <div className="dlg lz-cf" id="dlg" role="dialog" aria-modal="true" aria-labelledby="lz-cf-title">
          <div className="dbadge" aria-hidden="true"><ScheduleIcon name={icon} /></div>
          <h2 id="lz-cf-title">{heading}</h2>
          <div className="sub">{sub}{effect ? <span className="lz-cf-effect">{effect}</span> : null}</div>
          {body}
          <div className="dbtns">
            <button ref={yesRef} type="button" className="btn primary lg block" onClick={onYes}><ScheduleIcon name={icon} />{yes}</button>
            <button ref={noRef} type="button" className="btn ghost block" onClick={onNo}><ScheduleIcon name="x" />ביטול</button>
          </div>
        </div>
      </div>
    </LzPortal>
  );
}

// הטוסט (L.say בעיצוב, שורה 1853): תמיד #toast.info.pulse.on של הפלטה - גם הודעת שגיאה (העיצוב לא מגדיר צבע אחר);
// רק האייקון משתנה לפי סוג ההודעה (check / undo / alert, כמו בעיצוב)
const TOAST_ICON = { ok: 'check', undo: 'undo', warn: 'alert', error: 'alert' };
export function MarkToast({ toast, onClose }) {
  if (!toast) return null;
  const kind = toast.kind || 'ok';
  return (
    <div id="toast" className="info pulse on" role="status" aria-live="polite" key={toast.n}>
      <span className="tb"><ScheduleIcon name={TOAST_ICON[kind] || 'check'} /></span>
      <div><b>{toast.title}</b><small>{toast.text}</small></div>
      <button type="button" className="tclose" aria-label="סגירה" onClick={onClose}><ScheduleIcon name="x" /></button>
    </div>
  );
}
