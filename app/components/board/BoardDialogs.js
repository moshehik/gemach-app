'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ScheduleIcon from '../schedule/ScheduleIcon';
import { LzPortal } from '../schedule/LzPortal';

// חלונות "בטוח?" / הערה / הודעה של הלוח - החלון הכהה של הפלטה (חלון 24/26: scrim > #dlg.dlg > dbadge / h2 / .sub / dbtns),
// אותו markup בדיוק כמו ConfirmDialog של הלו״ז (app/components/schedule/MarkDialogs.js). מחליפים את window.customConfirm /
// window.customPrompt / alert בחלון ההשכרה של הלוח (useRentalReturn.js -> ui). כל פונקציה מחזירה Promise:
//   confirm(message, title?) -> true/false;  prompt(message, defaultValue) -> string | null (ביטול)
// Enter = אישור, Esc = ביטול, Tab נלכד בתוך החלון, הפוקוס חוזר למקום שפתח.

export function useBoardDialogs() {
  const [dlg, setDlg] = useState(null); // { kind:'confirm'|'prompt', message, title, value, resolve }
  const queue = useRef([]);
  const curRef = useRef(null);

  const open = useCallback((d) => new Promise((resolve) => {
    const item = { ...d, resolve, n: Date.now() + Math.random() };
    if (curRef.current) { queue.current.push(item); return; }
    curRef.current = item;
    setDlg(item);
  }), []);

  const close = useCallback((result) => {
    const cur = curRef.current;
    if (!cur) return;
    const next = queue.current.length ? queue.current.shift() : null;
    curRef.current = next;
    setDlg(next);
    cur.resolve(result);
  }, []);

  const confirm = useCallback((message, title) => open({ kind: 'confirm', message: String(message || ''), title: title || '' }), [open]);
  const prompt = useCallback((message, defaultValue = '') => open({ kind: 'prompt', message: String(message || ''), title: '', value: defaultValue || '' }), [open]);

  const node = dlg ? <BoardDialog key={dlg.n} dlg={dlg} onClose={close} /> : null;
  return { confirm, prompt, node, isOpen: !!dlg };
}

function BoardDialog({ dlg, onClose }) {
  const [value, setValue] = useState(dlg.value || '');
  const yesRef = useRef(null);
  const inputRef = useRef(null);
  const boxRef = useRef(null);
  const returnTo = useRef(null);
  const isPrompt = dlg.kind === 'prompt';
  const valueRef = useRef(value);
  valueRef.current = value;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    returnTo.current = typeof document !== 'undefined' ? document.activeElement : null;
    const t = setTimeout(() => { (isPrompt ? inputRef.current : yesRef.current)?.focus(); }, 60);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeRef.current(isPrompt ? null : false); return; }
      if (e.key === 'Tab' && boxRef.current) {
        const f = [...boxRef.current.querySelectorAll('button,input')].filter((x) => !x.disabled);
        if (!f.length) return;
        const i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey, true);
      const el = returnTo.current;
      if (el && typeof el.focus === 'function' && document.contains(el)) el.focus();
    };
  }, [isPrompt]);

  const yes = () => onClose(isPrompt ? valueRef.current : true);
  const no = () => onClose(isPrompt ? null : false);
  const stop = (e) => e.stopPropagation();
  const lines = dlg.message.split('\n');
  const heading = dlg.title || (isPrompt ? 'הוספת הערה' : 'בטוח?');
  return (
    <LzPortal>
      <div className="scrim on bd-scrim bd-cf-scrim" role="presentation" onClick={stop} onMouseDown={(e) => { stop(e); if (e.target === e.currentTarget) no(); }}>
        <div className="dlg lz-cf bd-cf" id="dlg" role="dialog" aria-modal="true" aria-labelledby="bd-cf-title" ref={boxRef}>
          <div className="dbadge" aria-hidden="true"><ScheduleIcon name={isPrompt ? 'note' : 'check'} /></div>
          <h2 id="bd-cf-title">{heading}</h2>
          <div className="sub">{lines.map((l, i) => <span key={i} className="bd-cf-l">{l}</span>)}</div>
          {isPrompt ? (
            <form className="bd-cf-form" onSubmit={(e) => { e.preventDefault(); yes(); }}>
              <input ref={inputRef} className="inp" type="text" value={value} onChange={(e) => setValue(e.target.value)} aria-label="הערה (אופציונלי)" autoComplete="off" data-lpignore="true" data-1p-ignore="" data-form-type="other" />
            </form>
          ) : null}
          <div className="dbtns">
            <button ref={yesRef} type="button" className="btn primary lg block" onClick={yes}><ScheduleIcon name="check" />אישור</button>
            <button type="button" className="btn ghost block" onClick={no}><ScheduleIcon name="x" />ביטול</button>
          </div>
        </div>
      </div>
    </LzPortal>
  );
}
