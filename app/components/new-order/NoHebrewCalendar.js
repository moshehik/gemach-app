'use client';

// הלוח העברי של האשף (.hc - G1 "כן": נבנה כרכיב מסודר בהיקף הדף). ה-markup כמו hebCalHTML בעיצוב:
// .hc > .hc-h (חודש קודם / שם החודש / חודש הבא) + .hc-w (ימי השבוע) + .hc-g (תאים .hc-d). בלי "החודש" ובלי בחירת חודש ושנה (R11 להסיר).
// S03 (להכניס): סימון חגים וצומות (.hasH + שם החג בתא), פרשת השבוע בתאי שבת (כמו בלוח הקיים באתר).
// בחירת טווח (חו"ל): לחיצה ראשונה = תחילת הטווח, שנייה = סופו (אם מוקדם יותר - מתחלפים); onRange נקרא רק כשיש שני קצוות,
// כמו HebrewDateRangePicker הישן (שקרא ל-onChange רק אחרי בחירת שני התאריכים). בלי "בחירה מהירה" (R10 להסיר).
import { useMemo, useState } from 'react';
import { HDate, HebrewCalendar, Sedra, Locale, flags } from '@hebcal/core';
import { Ic } from './NoUi';
import { addDays, dow, fromKey, hebrewLong, hebrewMonthTitle, hebrewParts, monthLength, monthStart, nextMonthStart, prevMonthStart, WEEKDAYS_SHORT } from '../schedule/hebrewCalendar';

// אילו אירועים מסומנים (S03 "חגים וצומות"): חג, חול המועד, ערב חג, צום גדול/קטן, חג קטן (חנוכה, פורים, ט"ו בשבט...) - רק מועדי ישראל
// המקובלים במגזר החרדי (בקשת הבעלים 9.10.2026, בכל הלוחות באתר): בלי ימי המדינה (עצמאות, זיכרון, שואה, ירושלים, הרצל, סיגד, רבין...)
// ובלי "חג הבנות", "ראש השנה למעשר בהמה", "סליחות" - אותו סינון כמו בלוח הדף הקודם והלוח החודשי.
// לא מסומנים: ראש חודש, שבתות מיוחדות, יום כיפור קטן, בה"ב, ספירת העומר.
const HOLIDAY_MASK = flags.CHAG | flags.CHOL_HAMOED | flags.EREV | flags.MAJOR_FAST | flags.MINOR_FAST | flags.MINOR_HOLIDAY;
const EXCLUDE_MASK = flags.YOM_KIPPUR_KATAN | flags.BEHAB | flags.ROSH_CHODESH | flags.SPECIAL_SHABBAT | flags.MODERN_HOLIDAY;
const EXCLUDE_NAMES = ['בנות', 'מעשר בהמה', 'סליחות'];

const holCache = {};
export function holidaysOn(key) {
  if (holCache[key]) return holCache[key];
  let out = [];
  try {
    const evs = HebrewCalendar.getHolidaysOnDate(new HDate(fromKey(key)), true) || [];
    out = evs.filter(e => (e.getFlags() & HOLIDAY_MASK) && !(e.getFlags() & EXCLUDE_MASK) && !EXCLUDE_NAMES.some(n => e.render('he-x-NoNikud').includes(n))).map(e => e.render('he-x-NoNikud'));
  } catch { out = []; }
  holCache[key] = out;
  return out;
}

const sedraCache = {};
export function parshaOn(key) {
  if (dow(key) !== 6) return '';
  try {
    const hd = new HDate(fromKey(key));
    const y = hd.getFullYear();
    if (!sedraCache[y]) sedraCache[y] = new Sedra(y, true);
    const lookup = sedraCache[y].lookup(hd);
    return lookup && lookup.parsha && !lookup.chag ? lookup.parsha.map(p => Locale.gettext(p, 'he-x-NoNikud')).join('-') : '';
  } catch { return ''; }
}

export default function NoHebrewCalendar({ mode = 'single', value, from, to, today, onPick, onRange, onPending }) {
  const anchor = (mode === 'range' ? from : value) || today;
  const [month, setMonth] = useState(() => monthStart(anchor));
  const [pending, setPending] = useState(null); // תחילת טווח שנבחרה ועוד אין סוף

  const cells = useMemo(() => {
    const len = monthLength(month);
    const first = dow(month);
    const out = [];
    for (let i = 0; i < first; i++) out.push({ empty: true, k: 'e' + i });
    for (let i = 0; i < len; i++) {
      const d = addDays(month, i);
      out.push({ k: d, d, h: hebrewParts(d), hol: holidaysOn(d), parsha: parshaOn(d) });
    }
    return out;
  }, [month]);

  const isOn = (d) => (mode === 'range' ? (pending ? d === pending : (d === from || d === to)) : d === value);
  const pick = (d) => {
    if (mode !== 'range') { onPick && onPick(d); return; }
    if (!pending) { setPending(d); onPending && onPending(d); return; }
    const a = d < pending ? d : pending;
    const b = d < pending ? pending : d;
    setPending(null);
    onPending && onPending(null);
    onRange && onRange(a, b);
  };

  return (
    <div className="hc" data-start={month}>
      <div className="hc-h">
        <button type="button" className="hc-n" aria-label="החודש הקודם" onClick={() => setMonth(prevMonthStart(month))}><Ic n="chev" c="sm" /></button>
        <b className="hc-t" aria-live="polite">{hebrewMonthTitle(month)}</b>
        <button type="button" className="hc-n hc-nn" aria-label="החודש הבא" onClick={() => setMonth(nextMonthStart(month))}><Ic n="chev" c="sm" /></button>
      </div>
      <div className="hc-w" aria-hidden="true">{WEEKDAYS_SHORT.map(w => <span key={w}>{w}</span>)}</div>
      <div className="hc-g" role="grid">
        {cells.map(c => (c.empty ? <span key={c.k} className="hc-e" /> : (
          <button
            key={c.k}
            type="button"
            className={`hc-d${dow(c.d) === 6 ? ' sh' : ''}${c.hol.length ? ' hasH' : ''}${isOn(c.d) ? ' on' : ''}${c.d === today ? ' today' : ''}`}
            data-hd={c.d}
            aria-label={hebrewLong(c.d)}
            aria-pressed={isOn(c.d)}
            onClick={() => pick(c.d)}
          >
            <span className="hc-n1">{c.h.dl}</span>
            {c.parsha ? <small className="hc-p">{c.parsha}</small> : null}
            {c.hol.map(h => <small key={h} className="hc-p hc-hol">{h}</small>)}
          </button>
        )))}
      </div>
    </div>
  );
}
