'use client';

// בורר התאריך העברי הקבוע (תשובת הבעלים NW-I8: "בחירה מלוח שנה שיש כבר במערכת"): לוח עברי של הפלטה (.hc / .hc-h / .hc-g / .hc-d -
// אותו markup של הלוח העברי של הלו״ז ושל "הזמנה חדשה"), ננעל על שנה עברית אחת - תשפ״ז (5787, מעוברת ושלמה: חשוון ל׳, כסלו ל׳,
// אדר א׳ ל׳, אדר ב׳ כ״ט) - כדי שכל יום וכל חודש אפשר ללחוץ עליהם. השנה לא מוצגת ואין ימי שבוע (בשנה נעולה הם חסרי משמעות).
// נשמרים רק (יום, חודש): אדר ב׳ -> 'Adar' (הכלל הכללי), אדר א׳ -> 'Adar I'. חישובי החודשים/הימים מ-lib/nonWorkingDaysPage.js
// (fixedPickerMonths, אותם עזרי לוח עברי שמזינים את הלוח החודשי של הדף) - בלי קובץ מועתק מענף אחר.
import { useMemo, useState } from 'react';
import { Ic } from '../home/HomeParts';
import { fixedPickerMonths, gematria } from '@/lib/nonWorkingDaysPage';

export default function FixedDatePicker({ month, day, onPick }) {
  const months = useMemo(() => fixedPickerMonths(), []);
  const selIdx = months.findIndex((m) => m.month === month);
  const [shown, setShown] = useState(() => Math.max(0, selIdx));
  const cur = months[shown] || months[0];
  const last = months.length - 1;
  return (
    <div className="hc cl-fxcal" id="nw-fx-cal">
      <div className="hc-h">
        <button type="button" className="hc-n" aria-label="החודש הקודם" data-tip="החודש הקודם" id="nw-fx-prev" disabled={shown <= 0} onClick={() => setShown((i) => Math.max(0, i - 1))}><Ic id="chev" size="sm" /></button>
        <b className="hc-t" id="nw-fx-title" aria-live="polite">{cur.name}</b>
        <button type="button" className="hc-n hc-nn" aria-label="החודש הבא" data-tip="החודש הבא" id="nw-fx-next" disabled={shown >= last} onClick={() => setShown((i) => Math.min(last, i + 1))}><Ic id="chev" size="sm" /></button>
      </div>
      <div className="hc-g cl-fxg" role="group" aria-label={'ימי החודש ' + cur.name}>
        {Array.from({ length: cur.len }, (_, i) => i + 1).map((d) => {
          const on = cur.month === month && d === day;
          return (
            <button
              key={d} type="button" className={'hc-d' + (on ? ' on' : '')} data-m={cur.month} data-d={d} aria-pressed={on}
              aria-label={gematria(d) + ' ' + cur.name} onClick={() => onPick({ day: d, month: cur.month })}
            >{gematria(d)}</button>
          );
        })}
      </div>
    </div>
  );
}
