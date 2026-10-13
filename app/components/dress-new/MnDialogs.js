'use client';

// החלונות של אשף "דגם חדש" (A5): #dlg של הפלטה בתוך .scrim, כהים (השורש נושא dlg-dark), ב-portal לשורש הדף - markup כמו dateDlg / urlDlg / exitDlg /
// discardDlg / "יוצר את הדגם" בעיצוב המאושר (model-new.js), עם העיגול העליון (dbadge, DLG-MODERN decorate). אף חלון לא משתמש ב-window.alert / confirm / prompt.
import { useState } from 'react';
import { useNoFill } from '@/lib/autofillGuard';
import { DialogFrame } from '../new-order/NoDialogs';
import { addDays } from '../schedule/hebrewCalendar';
import { DlgBadge, Ic } from './MnUi';
import { hDateFull } from './useModelNewController';

const Btns = ({ children, style }) => <div className="dbtns" style={style}>{children}</div>;

// הזזת תאריך הכניסה בצעדים (העיצוב: -30 / -7 / -1 / +1 / +7 / +30 + "היום"). העיצוב חוסם עתיד; האשף הישן איפשר כל תאריך - נשמרת היכולת (ר' model-new-notes.md)
export function DateDialog({ date, today, close }) {
  const [cur, setCur] = useState(date);
  const steps = [[-30, '30 יום אחורה'], [-7, 'שבוע אחורה'], [-1, 'יום אחורה'], [1, 'יום קדימה'], [7, 'שבוע קדימה'], [30, '30 יום קדימה']];
  return (
    <>
      <DlgBadge icon="check" />
      <h2>תאריך כניסה למאגר</h2>
      <div className="mn-dlg-val"><Ic n="cal" /><span id="mnDV">{hDateFull(cur)}</span></div>
      <div className="mn-dlg-dates">
        {steps.map(([n, t]) => <button key={n} type="button" className="btn sm" onClick={() => setCur(addDays(cur, n))}>{t}</button>)}
        <button type="button" className="btn sm" onClick={() => setCur(today)}><Ic n="cal" c="sm" />היום</button>
      </div>
      <Btns style={{ marginTop: 20 }}>
        <button type="button" className="btn primary lg block" data-act="date-ok" onClick={() => close(cur)}><Ic n="check" />אישור</button>
        <button type="button" className="btn ghost block" data-act="close" onClick={() => close(null)}><Ic n="back" c="sm" />ביטול</button>
      </Btns>
    </>
  );
}

export function UrlDialog({ value, code, close }) {
  const nf = useNoFill();
  const [v, setV] = useState(value || '');
  const [err, setErr] = useState('');
  const ok = () => {
    const t = v.trim();
    if (!t) { setErr('חובה להזין כתובת'); return; }
    close(t);
  };
  return (
    <>
      <DlgBadge icon="check" />
      <h2>כתובת תמונה</h2>
      <div className="field">
        <label className="lbl" htmlFor="mnUrl">כתובת</label>
        <div className="inpw">
          <Ic n="clip" c="sm" />
          <input className="inp" id="mnUrl" {...nf('url')} dir="ltr" style={{ direction: 'ltr', textAlign: 'right' }} value={v} data-autofocus="true"
            placeholder={`/images/dresses/${code}.jpg`}
            onChange={(e) => { setV(e.target.value); setErr(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); ok(); } }} />
        </div>
      </div>
      <div className="mc-err" id="mnUrlE" style={{ minHeight: 24, marginTop: 6 }}>{err ? <><Ic n="alert" c="sm" />{err}</> : null}</div>
      <Btns style={{ marginTop: 12 }}>
        <button type="button" className="btn primary lg block" data-act="url-ok" onClick={ok}><Ic n="check" />אישור</button>
        <button type="button" className="btn ghost block" data-act="close" onClick={() => close(null)}><Ic n="back" c="sm" />ביטול</button>
      </Btns>
    </>
  );
}

export function ExitDialog({ close }) {
  return (
    <>
      <DlgBadge icon="pencil" />
      <h2>לצאת בלי ליצור את הדגם?</h2>
      <div className="sub">מה שהוזן יימחק</div>
      <Btns>
        <button type="button" className="btn primary lg block" data-act="close" onClick={() => close(false)}><Ic n="pencil" />המשך בעריכה</button>
        <button type="button" className="btn block" data-act="leave" onClick={() => close(true)}><Ic n="x" c="sm" />צא בלי ליצור</button>
      </Btns>
    </>
  );
}

export function DiscardDialog({ close }) {
  return (
    <>
      <DlgBadge icon="trash" />
      <h2>לבטל את כל מה שהוזן?</h2>
      <div className="sub">הטופס יתאפס</div>
      <Btns>
        <button type="button" className="btn primary lg block" data-act="discard-go" onClick={() => close(true)}><Ic n="trash" />בטל הכול</button>
        <button type="button" className="btn ghost block" data-act="close" onClick={() => close(false)}><Ic n="back" c="sm" />חזרה לעריכה</button>
      </Btns>
    </>
  );
}

// חלון ההתקדמות: אי אפשר לסגור אותו (בלי Escape / לחיצה על הרקע) עד שהיצירה מסתיימת
export function BusyDialog({ progress }) {
  return (
    <div className="success" role="alert" aria-busy="true">
      <div className="big-ck mn-spin" style={{ animation: 'none' }}><Ic n="refresh" /></div>
      <h2>יוצר את הדגם</h2>
      <div className="sub" id="mnProg">{progress || ' '}</div>
    </div>
  );
}

export default function MnDialog({ ctl }) {
  const d = ctl.dlg;
  if (!d) return null;
  const close = (r) => ctl.answer(r, d.id);
  const p = d.props || {};
  let body = null;
  let backdrop = () => close(null);
  switch (d.type) {
    case 'date': body = <DateDialog date={p.date} today={p.today} close={close} />; break;
    case 'url': body = <UrlDialog value={p.value} code={p.code} close={close} />; break;
    case 'exit': body = <ExitDialog close={close} />; backdrop = () => close(false); break;
    case 'discard': body = <DiscardDialog close={close} />; backdrop = () => close(false); break;
    case 'busy': body = <BusyDialog progress={ctl.progress} />; backdrop = null; break;
    default: return null;
  }
  return <DialogFrame key={d.id} layer={1} cls="" onBackdrop={backdrop}>{body}</DialogFrame>;
}
