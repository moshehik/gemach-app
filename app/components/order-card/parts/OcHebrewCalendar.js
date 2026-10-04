'use client';

// OcHebrewCalendar — לוח חודשי עברי פנימי בכרטיס האירוע (A9), מחליף את חלון HebrewDatePicker / HebrewDateRangePicker בכרטיס החדש.
// markup = hebCalHTML() בעיצוב המאושר (כרטיס-הזמנה.html): .hc > .hc-h (‹ חודש שנה ›) + .hc-w (א׳…ש׳) + .hc-g (ימים, .hc-e ריקים
// לפני היום הראשון; .sh שבת; .today היום בישראל; .on נבחר). עברית בלבד: מספרי הימים בגימטריה, כותרת חודש עברי.
// mode='single': onPick(key) לכל לחיצה. mode='range' (אירוע חו"ל / אמצע שבוע, R16): לחיצה ראשונה = לקיחה (ממתין), שנייה = החזרה
// (מוקדם יותר → מתהפך, כמו HebrewDateRangePicker:116-125) → onRange(start, end). הלוגיקה הטהורה ב-ocDetailsLogic.js.
import { useState } from 'react';
import OcIcon from '../OcIcon';
import { getIsraelTodayKey } from '../../../../lib/hebrewDate';
import { calendarCells, dayTitle, hebDayLabel, hebMonthStartKey, monthTitle, navMonth, weekdayOf, WEEKDAY_SHORT } from './ocDetailsLogic';

export default function OcHebrewCalendar({ mode = 'single', value = '', from = '', to = '', onPick, onRange, labelledBy }) {
  const anchor = mode === 'range' ? (from || to) : value;
  const [start, setStart] = useState(() => hebMonthStartKey(anchor));
  const [pending, setPending] = useState(''); // range: לקיחה שנבחרה ועדיין אין החזרה
  const today = getIsraelTodayKey();
  const { blanks, days } = calendarCells(start);
  const lo = pending || from;
  const hi = pending ? '' : to;

  const pick = (key) => {
    if (mode !== 'range') { onPick && onPick(key); return; }
    if (!pending) { setPending(key); return; }
    const [a, b] = key < pending ? [key, pending] : [pending, key];
    setPending('');
    onRange && onRange(a, b);
  };
  const go = (dir) => setStart(s => navMonth(s, dir));

  return (
    <div className={`hc${mode === 'range' ? ' oc-hc-range' : ''}`} data-pending={pending ? 'true' : undefined}>
      <div className="hc-h">
        <button type="button" className="hc-n" data-hnav="-1" aria-label="החודש הקודם" onClick={() => go(-1)}><OcIcon name="chev" size="sm" /></button>
        <b className="hc-t" aria-live="polite" id={labelledBy ? `${labelledBy}-m` : undefined}>{monthTitle(start)}</b>
        <button type="button" className="hc-n hc-nn" data-hnav="1" aria-label="החודש הבא" onClick={() => go(1)}><OcIcon name="chev" size="sm" /></button>
      </div>
      <div className="hc-w" aria-hidden="true">{WEEKDAY_SHORT.map(x => <span key={x}>{x}</span>)}</div>
      <div className="hc-g" role="group" aria-labelledby={labelledBy ? `${labelledBy} ${labelledBy}-m` : undefined}>
        {Array.from({ length: blanks }, (_, i) => <span key={`e${i}`} className="hc-e" />)}
        {days.map(key => {
          const on = mode === 'range' ? (key === lo || key === hi) : key === value;
          const inRange = mode === 'range' && lo && hi && key > lo && key < hi;
          const cls = ['hc-d', weekdayOf(key) === 6 ? 'sh' : '', on ? 'on' : '', key === today ? 'today' : '', inRange ? 'oc-rng' : ''].filter(Boolean).join(' ');
          return (
            <button key={key} type="button" className={cls} data-hd={key} aria-label={dayTitle(key)} aria-pressed={on} onClick={() => pick(key)}>
              {hebDayLabel(key)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
