'use client';

import { useEffect, useRef, useState } from 'react';
import ScheduleIcon, { CheckCircleIcon, DoubleCheckIcon } from './ScheduleIcon';
import './marks.css';

// פקדי "בוצע" של הלו״ז: לחצן בשורה (+ "הוחזר לא תקין" שצף בריחוף בשלבי ההחזרה - החלטה A4), לחצן "הכל בוצע"
// לשלב (וי כפול, i-checks - החלטה J09), חלון "בטוח?" (S03) וטוסט רגוע. העיצוב מינימלי ועל רכיבי הפלטה
// (btn.tgl, chip, scrim/dlg, #toast) - הסוכן שאחראי על נאמנות העיצוב רשאי להחליף את המראה; הלוגיקה
// (useStageMarks.js) לא תלויה בו. כל הפעולות עוברות דרך onMarkDone / onMarkAll שהדף מעביר.

function fmtWhen(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

const VIA_TEXT = { alterationDone: 'לפי מסך התיקונים', isTaken: 'לפי ההשכרה (הפריטים נלקחו)', isReturned: 'לפי החזרת הפריטים' };

export function doneTip(state) {
  if (!state || state.done !== true) return 'סמן כבוצע';
  if (state.doneVia === 'mark' || state.doneBy) {
    return 'סומן ע״י ' + (state.doneBy || 'עובדת') + (state.doneAt ? ' ב-' + fmtWhen(state.doneAt) : '') + ' · לחיצה לביטול הסימון';
  }
  return 'בוצע ' + (VIA_TEXT[state.doneVia] || '') + ' · לחיצה לביטול';
}

// מה הסימון/הביטול עושה בפועל בשלב הזה - מוצג בחלון "בטוח?" (בלי הפתעות: בשלבים 2/8 נוגעים בפריטים)
export function confirmEffect(stageKey, { done, outcome, all }) {
  if (stageKey === 'manret') {
    if (!done) return 'יבטל את ההחזרה של הפריטים בהזמנה (רק פריטים שהוחזרו מהלו״ז)';
    return all ? 'הפריטים יירשמו כהוחזרו תקין' : (outcome === 'not_ok' ? 'הפריטים יירשמו כהוחזרו - לא תקין' : 'הפריטים יירשמו כהוחזרו תקין');
  }
  if (stageKey === 'repair') return done ? 'יסמן "תיקון בוצע" בפריטי ההזמנה' : 'יבטל "תיקון בוצע" בפריטים';
  return '';
}

// חלון "בטוח?" - חלון קטן על רכיבי הפלטה (scrim + dlg + dbadge). Enter = כן, Esc = ביטול. הפוקוס נלכד
// בתוך החלון (Tab בין שני הלחצנים) וחוזר ללחצן שפתח אותו בסגירה.
export function ConfirmDialog({ open, title, sub, effect, yes, kind = 'check', onYes, onNo }) {
  const yesRef = useRef(null);
  const noRef = useRef(null);
  const returnTo = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    returnTo.current = typeof document !== 'undefined' ? document.activeElement : null;
    const t = setTimeout(() => yesRef.current && yesRef.current.focus(), 30);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onNo(); return; }
      if (e.key === 'Tab') {
        const a = yesRef.current;
        const b = noRef.current;
        if (!a || !b) return;
        e.preventDefault();
        (document.activeElement === a ? b : a).focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      const el = returnTo.current;
      if (el && typeof el.focus === 'function' && document.contains(el)) el.focus();
    };
  }, [open, onNo]);
  if (!open) return null;
  const icon = kind === 'undo' ? 'undo' : kind === 'alert' ? 'alert' : 'check';
  return (
    <div className="scrim on lz-mk-scrim" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onNo(); }}>
      <div className="dlg lz-mk-dlg" role="dialog" aria-modal="true" aria-labelledby="lz-mk-title">
        <div className={'dbadge lz-mk-badge' + (kind === 'alert' ? ' bad' : '')}><ScheduleIcon name={icon} /></div>
        <h2 id="lz-mk-title">{title}</h2>
        {sub ? <div className="sub">{sub}</div> : null}
        {effect ? <div className="sub lz-mk-effect">{effect}</div> : null}
        <div className="dbtns lz-mk-btns">
          <button ref={yesRef} type="button" className={'btn ' + (kind === 'alert' ? 'ghost lz-mk-yes-bad' : 'primary')} onClick={onYes}>
            <ScheduleIcon name={icon} className="sm" />{yes}
          </button>
          <button ref={noRef} type="button" className="btn ghost" onClick={onNo}>לא, חזרה</button>
        </div>
      </div>
    </div>
  );
}

// לחצן "בוצע" בשורה. שלבי ההחזרה (8/9): בריחוף/פוקוס צף מימין לו "הוחזר לא תקין" (A4).
export function MarkButton({ stage, row, doneState, onMarkDone }) {
  const [ask, setAsk] = useState(null); // { done, outcome }
  if (!stage || stage.infoOnly || !doneState || !doneState.available) return null;
  const state = doneState;
  const name = (row.customer && row.customer.name) || '';
  const sub = 'הזמנה #' + row.orderId + (name ? ' · ' + name : '');
  const retStage = stage.key === 'manret' || stage.key === 'dback';
  const disabled = !state.canMark || state.busy;

  const confirm = (done, outcome) => setAsk({ done, outcome });
  const run = () => {
    const a = ask;
    setAsk(null);
    if (a && onMarkDone) onMarkDone(stage, row, a);
  };

  const dialog = ask ? (
    <ConfirmDialog
      open
      kind={ask.done ? (ask.outcome === 'not_ok' ? 'alert' : 'check') : 'undo'}
      title={ask.done
        ? (ask.outcome === 'not_ok' ? 'בטוח שהשמלה הוחזרה לא תקינה?' : 'בטוח שהשלב "' + stage.label + '" בוצע' + (retStage ? ' (הוחזר תקין)' : '') + '?')
        : 'לבטל את סימון הביצוע?'}
      sub={sub}
      effect={confirmEffect(stage.key, ask)}
      yes={ask.done ? (ask.outcome === 'not_ok' ? 'כן, סמן כלא תקין' : 'כן, סמן כבוצע') : 'כן, בטל סימון'}
      onYes={run}
      onNo={() => setAsk(null)}
    />
  ) : null;

  if (state.done === true) {
    return (
      <>
        <button
          type="button"
          className={'btn tgl lz-mark on' + (state.busy ? ' lz-busy' : '')}
          aria-pressed="true"
          disabled={disabled}
          title={doneTip(state)}
          aria-label={'בוצע - ' + doneTip(state)}
          onClick={() => confirm(false)}
        >
          <ScheduleIcon name="check" className="sm evck" />בוצע
        </button>
        {dialog}
      </>
    );
  }

  const mainBtn = (
    <button
      type="button"
      className={'btn tgl lz-mark' + (state.busy ? ' lz-busy' : '')}
      aria-pressed="false"
      disabled={disabled}
      title={retStage ? 'סמן כבוצע (הוחזר תקין)' : 'סמן כבוצע'}
      onClick={() => confirm(true, retStage ? 'ok' : undefined)}
    >
      <CheckCircleIcon className="sm" />בוצע
    </button>
  );
  if (!retStage) return <>{mainBtn}{dialog}</>;
  return (
    <>
      <span className="lz-retw">
        <button
          type="button"
          className="btn tgl lz-mark lz-bad"
          aria-pressed="false"
          disabled={disabled}
          title="סמן כהוחזר לא תקין"
          onClick={() => confirm(true, 'not_ok')}
        >
          <ScheduleIcon name="alert" className="sm" />הוחזר לא תקין
        </button>
        {mainBtn}
      </span>
      {dialog}
    </>
  );
}

// "הכל בוצע" לשלב (לחצן עגול עם וי כפול בכותרת המקטע). מוצג רק עם הרשאה (canMarkAll) וכשיש מה לסמן.
export function MarkAllButton({ stage, pending, canMarkAll, busy, onMarkAll }) {
  const [ask, setAsk] = useState(false);
  if (!canMarkAll || !stage || stage.infoOnly || !pending) return null;
  return (
    <>
      <button
        type="button"
        className={'ibtn lz-all' + (busy ? ' lz-busy' : '')}
        aria-label={'הכל בוצע - ' + stage.label}
        title={'הכל בוצע (' + pending + ')'}
        disabled={busy}
        onClick={() => setAsk(true)}
      >
        <DoubleCheckIcon />
      </button>
      <ConfirmDialog
        open={ask}
        kind="check"
        title={'בטוח שכל "' + stage.label + '" בוצע?'}
        sub={pending + ' שורות יסומנו כבוצעו'}
        effect={confirmEffect(stage.key, { done: true, outcome: 'ok', all: true })}
        yes="כן, סמן הכל"
        onYes={() => { setAsk(false); onMarkAll && onMarkAll(stage); }}
        onNo={() => setAsk(false)}
      />
    </>
  );
}

// טוסט רגוע (רכיב #toast מהפלטה), כמו בדף הבית (HomeA5.js).
export function MarkToast({ toast, onClose }) {
  if (!toast) return null;
  const icon = toast.kind === 'error' ? 'alert' : toast.kind === 'warn' ? 'alert' : toast.kind === 'undo' ? 'undo' : 'check';
  return (
    <div id="toast" className={'info on lz-toast lz-toast-' + (toast.kind || 'ok')} role="status" aria-live="polite" key={toast.n}>
      <button type="button" className="tclose" aria-label="סגירה" onClick={onClose}><ScheduleIcon name="x" className="sm" /></button>
      <div className="tb"><ScheduleIcon name={icon} /></div>
      <div><b>{toast.title}</b><small>{toast.text}</small></div>
    </div>
  );
}
