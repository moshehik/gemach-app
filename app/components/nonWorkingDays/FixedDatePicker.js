'use client';

// בורר התאריך העברי הקבוע (תשובת הבעלים NW-I8: "בחירה מלוח שנה שיש כבר במערכת"): לוח עברי של הפלטה (.hc / .hc-h / .hc-g / .hc-d -
// אותו markup של הלוח העברי של הלו״ז ושל "הזמנה חדשה"), ננעל על שנה עברית אחת - תשפ״ז (5787, מעוברת ושלמה: חשוון ל׳, כסלו ל׳,
// אדר א׳ ל׳, אדר ב׳ כ״ט) - כדי שכל יום וכל חודש אפשר ללחוץ עליהם. השנה לא מוצגת ואין ימי שבוע (בשנה נעולה הם חסרי משמעות).
// נשמרים רק (יום, חודש): אדר ב׳ -> 'Adar' (הכלל הכללי), אדר א׳ -> 'Adar I'. חישובי החודשים/הימים מ-lib/nonWorkingDaysPage.js
// (fixedPickerMonths, אותם עזרי לוח עברי שמזינים את הלוח החודשי של הדף) - בלי קובץ מועתק מענף אחר.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Ic } from '../home/HomeParts';
import { fixedPickerMonths, gematria } from '@/lib/nonWorkingDaysPage';

export default function FixedDatePicker({ month, day, onPick }) {
  const months = useMemo(() => fixedPickerMonths(), []);
  const selIdx = months.findIndex((m) => m.month === month);
  const [shown, setShown] = useState(() => Math.max(0, selIdx));
  const cur = months[shown] || months[0];
  const last = months.length - 1;
  // נגישות: עצירת Tab אחת בלוח הימים (roving tabindex) וחיצים בתוכו; לחצני החודש הקודם / הבא לא מקבלים disabled (הפוקוס היה נופל ל-BODY) אלא aria-disabled
  const [focusDay, setFocusDay] = useState(() => (selIdx >= 0 ? day : 1) || 1);
  const gridRef = useRef(null);
  const moved = useRef(false);
  const tabDay = Math.min(focusDay, cur.len);
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    const b = gridRef.current && gridRef.current.querySelector('[data-d="' + tabDay + '"]');
    if (b) b.focus();
  }, [tabDay, shown]);
  const onGridKey = (e) => {
    // הלוח בכיוון RTL: יום א׳ מימין, לכן חץ ימינה = היום הקודם וחץ שמאלה = היום הבא
    const step = { ArrowRight: -1, ArrowLeft: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    let next = null;
    if (step !== undefined) next = Math.max(1, Math.min(cur.len, tabDay + step));
    else if (e.key === 'Home') next = 1;
    else if (e.key === 'End') next = cur.len;
    if (next === null) return;
    e.preventDefault();
    moved.current = true;
    setFocusDay(next);
  };
  const goMonth = (d) => { const n = shown + d; if (n < 0 || n > last) return; setShown(n); };
  return (
    <div className="hc cl-fxcal" id="nw-fx-cal">
      <div className="hc-h">
        <button type="button" className="hc-n" aria-label="החודש הקודם" data-tip="החודש הקודם" id="nw-fx-prev" aria-disabled={shown <= 0} onClick={() => goMonth(-1)}><Ic id="chev" size="sm" /></button>
        <b className="hc-t" id="nw-fx-title" aria-live="polite">{cur.name}</b>
        <button type="button" className="hc-n hc-nn" aria-label="החודש הבא" data-tip="החודש הבא" id="nw-fx-next" aria-disabled={shown >= last} onClick={() => goMonth(1)}><Ic id="chev" size="sm" /></button>
      </div>
      <div className="hc-g cl-fxg" role="group" aria-label={'ימי החודש ' + cur.name} ref={gridRef} onKeyDown={onGridKey}>
        {Array.from({ length: cur.len }, (_, i) => i + 1).map((d) => {
          const on = cur.month === month && d === day;
          return (
            <button
              key={d} type="button" className={'hc-d' + (on ? ' on' : '')} data-m={cur.month} data-d={d} aria-pressed={on} tabIndex={d === tabDay ? 0 : -1}
              aria-label={gematria(d) + ' ' + cur.name} onClick={() => { setFocusDay(d); onPick({ day: d, month: cur.month }); }}
            >{gematria(d)}</button>
          );
        })}
      </div>
    </div>
  );
}
