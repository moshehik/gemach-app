'use client';

import { useEffect, useRef, useState } from 'react';
import ScheduleIcon, { CheckCircleIcon } from './ScheduleIcon';
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

// חלון "בטוח?" - חלון קטן על רכיבי הפלטה (scrim + dlg + dbadge). Enter = כן, Esc = ביטול.
export function ConfirmDialog({ open, title, sub, yes, kind = 'check', onYes, onNo }) {
  const yesRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => yesRef.current && yesRef.current.focus(), 30);
    const onKey = (e) => { if (e.key === 'Escape') onNo(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [open, onNo]);
  if (!open) return null;
  const icon = kind === 'undo' ? 'undo' : kind === 'alert' ? 'alert' : 'check';
  return (
    <div className="scrim on lz-mk-scrim" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onNo(); }}>
      <div className="dlg lz-mk-dlg" role="dialog" aria-modal="true" aria-labelledby="lz-mk-title">
        <div className={'dbadge lz-mk-badge' + (kind === 'alert' ? ' bad' : '')}><ScheduleIcon name={icon} /></div>
        <h2 id="lz-mk-title">{title}</h2>
        {sub ? <div className="sub">{sub}</div> : null}
        <div className="dbtns lz-mk-btns">
          <button ref={yesRef} type="button" className={'btn ' + (kind === 'alert' ? 'ghost lz-mk-yes-bad' : 'primary')} onClick={onYes}>
            <ScheduleIcon name={icon} className="sm" />{yes}
          </button>
          <button type="button" className="btn ghost" onClick={onNo}>לא, חזרה</button>
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
        <svg className="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m2.5 12.5 4 4L13 10M9.5 16.5l2 2L21.5 8" /></svg>
      </button>
      <ConfirmDialog
        open={ask}
        kind="check"
        title={'בטוח שכל "' + stage.label + '" בוצע?'}
        sub={pending + ' שורות יסומנו כבוצעו'}
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
