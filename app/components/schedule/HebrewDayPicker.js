'use client';

import { useEffect, useRef, useState } from 'react';
import ScheduleIcon from './ScheduleIcon';
import {
  addDays, dow, hebrewLong, hebrewMonthTitle, hebrewParts, monthLength, monthStart,
  nextMonthStart, prevMonthStart, WEEKDAYS_SHORT,
} from './hebrewCalendar';

// בורר היום (העיצוב המאושר, שורות 1505-1531): אייקון יומן אחד ליד הכותרת; ריחוף/מיקוד פותח לשמאלו את
// "יום קודם / התאריך העברי (לוח חודשי נפתח) / יום הבא / היום / מחר". בנייד לחיצה על האייקון פותחת.
export default function HebrewDayPicker({ date, today, tomorrow, onChange }) {
  const [open, setOpen] = useState(false);
  const [popOpen, setPopOpen] = useState(false);
  const [month, setMonth] = useState(() => monthStart(date));
  const wrapRef = useRef(null);

  useEffect(() => {
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setPopOpen(false);
        setOpen(false);
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        setPopOpen(false);
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  function togglePop() {
    if (!popOpen) setMonth(monthStart(date));
    setPopOpen((v) => !v);
  }
  function pick(key) {
    setPopOpen(false);
    setOpen(false);
    onChange(key);
  }

  const len = monthLength(month);
  const first = dow(month);
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(<span key={'e' + i} className="hc-e" />);
  for (let i = 0; i < len; i++) {
    const d = addDays(month, i);
    const h = hebrewParts(d);
    const cls = 'hc-d' + (dow(d) === 6 ? ' sh' : '') + (d === date ? ' on' : '') + (d === today ? ' today' : '');
    cells.push(
      <button key={d} type="button" className={cls} aria-label={hebrewLong(d)} aria-pressed={d === date} onClick={() => pick(d)}>
        {h.dl}
      </button>,
    );
  }

  return (
    <div className={'lz-dwrap' + (open ? ' open' : '')} ref={wrapRef}>
      <button
        type="button"
        className="ibtn lz-dicon"
        aria-label="בחירת תאריך"
        aria-expanded={open || popOpen}
        title="בחירת תאריך"
        onClick={() => setOpen((v) => !v)}
      >
        <ScheduleIcon name="cal" className="ia-cal" />
      </button>
      <div className="lz-dpanel">
        <div className="lz-dnav">
          <button type="button" className="ibtn" aria-label="היום הקודם" title="היום הקודם" onClick={() => pick(addDays(date, -1))}>
            <ScheduleIcon name="arrr" />
          </button>
          <div className="lz-pickw">
            <button type="button" className="btn lz-date" aria-haspopup="dialog" aria-expanded={popOpen} onClick={togglePop}>
              <ScheduleIcon name="cal" />
              <span>{hebrewLong(date)}</span>
              <ScheduleIcon name="chev" className="hf-chv" />
            </button>
            {popOpen ? (
              <div className="lz-pop" role="dialog" aria-label="בחירת יום בלוח עברי">
                <div className="hc">
                  <div className="hc-h">
                    <button type="button" className="hc-n" aria-label="החודש הקודם" onClick={() => setMonth(prevMonthStart(month))}>
                      <ScheduleIcon name="chev" className="sm" />
                    </button>
                    <b className="hc-t" aria-live="polite">{hebrewMonthTitle(month)}</b>
                    <button type="button" className="hc-n hc-nn" aria-label="החודש הבא" onClick={() => setMonth(nextMonthStart(month))}>
                      <ScheduleIcon name="chev" className="sm" />
                    </button>
                  </div>
                  <div className="hc-w" aria-hidden="true">
                    {WEEKDAYS_SHORT.map((w) => <span key={w}>{w}</span>)}
                  </div>
                  <div className="hc-g" role="grid">{cells}</div>
                </div>
              </div>
            ) : null}
          </div>
          <button type="button" className="ibtn" aria-label="היום הבא" title="היום הבא" onClick={() => pick(addDays(date, 1))}>
            <ScheduleIcon name="arrl" />
          </button>
        </div>
        <div className="lz-quick">
          <button type="button" className={'btn tgl' + (date === today ? ' on' : '')} aria-pressed={date === today} onClick={() => pick(today)}>היום</button>
          <button type="button" className={'btn tgl' + (date === tomorrow ? ' on' : '')} aria-pressed={date === tomorrow} onClick={() => pick(tomorrow)}>מחר</button>
        </div>
      </div>
    </div>
  );
}
