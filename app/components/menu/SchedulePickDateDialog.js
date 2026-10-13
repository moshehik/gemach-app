'use client';

// "בחירת תאריך" בלשונית הלוז - חלון קטן עם לוח חודשי עברי (אותו markup של .hc כמו בבורר היום של הלוז, HebrewDayPicker).
// לחיצה על יום קוראת ל-onPick(YYYY-MM-DD); המעטפת מנווטת ל-/schedule?date=<תאריך>. עברית בלבד: מספרי הימים בגימטריה.

import { useEffect, useRef, useState } from 'react';
import { Ic } from './menuParts';
import {
  addDays, dow, hebrewLong, hebrewMonthTitle, hebrewParts, israelTodayKey, monthLength, monthStart,
  nextMonthStart, prevMonthStart, WEEKDAYS_SHORT,
} from '../schedule/hebrewCalendar';

export default function SchedulePickDateDialog({ open, onClose, onPick }) {
  const [today, setToday] = useState('');
  const [month, setMonth] = useState('');
  const scrimRef = useRef(null);
  const backRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    backRef.current = document.activeElement;
    const t = israelTodayKey();
    setToday(t);
    setMonth(monthStart(t));
    const f = setTimeout(() => {
      const el = scrimRef.current && scrimRef.current.querySelector('.hc-d.today');
      if (el) el.focus();
    }, 30);
    return () => {
      clearTimeout(f);
      const b = backRef.current;
      if (b && b.focus && document.contains(b)) b.focus();
    };
  }, [open]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab') return;
    const f = [...scrimRef.current.querySelectorAll('button:not([disabled])')].filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const cells = [];
  if (open && month) {
    const first = dow(month);
    for (let i = 0; i < first; i++) cells.push(<span key={'e' + i} className="hc-e" />);
    const len = monthLength(month);
    for (let i = 0; i < len; i++) {
      const d = addDays(month, i);
      const cls = 'hc-d' + (dow(d) === 6 ? ' sh' : '') + (d === today ? ' today' : '');
      cells.push(
        <button key={d} type="button" className={cls} aria-label={hebrewLong(d)} onClick={() => onPick(d)}>
          {hebrewParts(d).dl}
        </button>,
      );
    }
  }

  return (
    <div
      ref={scrimRef}
      className={`scrim${open ? ' on' : ''}`}
      id="schedPickScrim"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={onKeyDown}
      aria-hidden={open ? undefined : 'true'}
    >
      <div className="dlg" id="schedPickDlg" role="dialog" aria-modal="true" aria-labelledby="schedPickT">
        <h2 id="schedPickT">לוז - בחירת תאריך</h2>
        {open && month ? (
          <div className="hc">
            <div className="hc-h">
              <button type="button" className="hc-n" aria-label="החודש הקודם" onClick={() => setMonth(prevMonthStart(month))}>
                <Ic n="chev" />
              </button>
              <b className="hc-t" aria-live="polite">{hebrewMonthTitle(month)}</b>
              <button type="button" className="hc-n hc-nn" aria-label="החודש הבא" onClick={() => setMonth(nextMonthStart(month))}>
                <Ic n="chev" />
              </button>
            </div>
            <div className="hc-w" aria-hidden="true">
              {WEEKDAYS_SHORT.map((w) => <span key={w}>{w}</span>)}
            </div>
            <div className="hc-g" role="group" aria-label="ימי החודש">{cells}</div>
          </div>
        ) : null}
        <div className="dbtns">
          <button type="button" className="btn ghost block" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}
