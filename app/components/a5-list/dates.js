// dates.js - תאריכים עבריים לתצוגה ברשימות (כלל קבוע: אף תאריך לועזי לא מוצג בממשק; שעות נשארות). הפורט של hDateFull / hDateShort /
// dayTitle / relDay מ-scratch/emp-models-build/shared.js, על עזרי הלוח העברי שכבר קיימים באתר (schedule/hebrewCalendar.js - אותה גימטריה
// עם גרשיים, אותו Intl) ו-lib/hebrewDate.js (היום הקלנדרי לפי שעון ישראל). קלט: ISO / Date / 'YYYY-MM-DD'; ריק -> ''.

import { getIsraelDateKey } from '@/lib/hebrewDate';
import { WEEKDAYS, addDays, dow, hebrewParts, israelTodayKey } from '../schedule/hebrewCalendar';

/** מפתח היום הקלנדרי בישראל (YYYY-MM-DD) של ISO / Date; מפתח 'YYYY-MM-DD' כמו שהוא; אחרת ''. */
export function dayKey(input) {
  if (input == null || input === '') return '';
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  return getIsraelDateKey(input instanceof Date ? input : new Date(input)) || '';
}

/** "ט׳ תשרי" */
export function hDateShort(input) {
  const k = dayKey(input);
  if (!k) return '';
  const h = hebrewParts(k);
  return `${h.dl} ${h.m}`;
}

/** "ט׳ תשרי תשפ״ז" */
export function hDateFull(input) {
  const k = dayKey(input);
  if (!k) return '';
  const h = hebrewParts(k);
  return `${h.dl} ${h.m} ${h.y}`;
}

/** "יום חמישי ט׳ תשרי תשפ״ז" */
export function dayTitle(input) {
  const k = dayKey(input);
  if (!k) return '';
  return `יום ${WEEKDAYS[dow(k)]} ${hDateFull(k)}`;
}

/** "היום" / "אתמול" / "ט׳ תשרי" (relDay בעיצוב). */
export function relDay(input, today = israelTodayKey()) {
  const k = dayKey(input);
  if (!k) return '';
  if (k === today) return 'היום';
  if (k === addDays(today, -1)) return 'אתמול';
  return hDateShort(k);
}

const TIME_FMT = typeof Intl !== 'undefined'
  ? new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false })
  : null;

/** 'HH:MM' בשעון ישראל של ISO / Date; ריק -> ''. */
export function timeHM(input) {
  if (input == null || input === '') return '';
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime()) || !TIME_FMT) return '';
  return TIME_FMT.format(d);
}
