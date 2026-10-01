// lib/schedule/dates.js — תאריכים ללו״ז היומי, בלי שום תלות באזור הזמן של השרת.
//
// כל "יום" בלו״ז מיוצג כמפתח 'YYYY-MM-DD' של היום הקלנדרי בישראל (Asia/Jerusalem).
// חשבון ימים נעשה על המפתח בלבד (Date.UTC + getUTC*), כך ש-Vercel (UTC), מחשב בישראל
// ומחשב באזור זמן שלילי נותנים אותה תוצאה. חלונות DB = getIsraelDayRange (lib/hebrewDate.js),
// המרת instant ליום = toLocaleDateString('en-CA', Asia/Jerusalem) - אותו דפוס כמו
// toIsraelCalendarDate/ilKey ב-app/api/a5/adv/route.js. ר' CLAUDE.md, Standing rules → Dates & time.
//
// ימי עסקים: שישי ושבת תמיד מדולגים; חג (יום טוב, לא חול המועד) מדולג לפי אפשרות skipChag.
// הפונקציה addBusinessDays עובדת לשני הכיוונים - ב-lib/hebrewDate.js יש רק
// subtractSkippingWeekendsAndChag (אחורה בלבד) ו-addDaysSkippingWeekends (בלי חג), ולכן
// "קדימה כולל חג" (החלטה B04) ממומש כאן.
//
// בדיקת החג עצמה ממשיכה להשתמש ב-isChagDay הקיים (כדי שתאריך ההכנה בלו״ז יהיה זהה
// ל-getPrintPrepDate של דף ההדפסה). שימו לב: isChagDay מקבל Date מקומי ומריץ setHours(0),
// לכן מעבירים לו Date שנבנה מרכיבי המפתח (new Date(y, m-1, d) = חצות מקומית של אותו יום) -
// כך התוצאה לא תלויה באזור הזמן. isChagDay מסמן גם את ערב החג כיום חג (HebrewCalendar.calendar
// ({start: day, end: next}) כולל את שני הקצוות) - וזה מכוון: החלטת הבעלים (1.10.2026) "הגמ"ח לא
// עובד בערב חג", ולכן ערב חג הוא יום לא עובד בכל השלבים. לא לשנות. ר' docs/schedule-page-logic-spec.md.

// טווח תאריכים סביר לבקשה (שנים קדימה/אחורה מהיום הישראלי). מעבר לזה - 400 ולא 500: addCalendarDays
// על שנת 9999 חורג מטווח Date (RangeError) - סקירת WP1, ממצא 4.
export const MAX_YEARS_FROM_TODAY = 3;

import { isChagDay, getIsraelDayRange, getHebrewDateString, getHebrewWeekdayFullName } from '@/lib/hebrewDate';

export const ISO_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const IL_TZ = 'Asia/Jerusalem';
const DAY_MS = 24 * 60 * 60 * 1000;

export function isValidKey(key) {
  if (typeof key !== 'string' || !ISO_KEY_RE.test(key)) return false;
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// האם המפתח (תקין) נמצא בטווח של ±MAX_YEARS_FROM_TODAY שנים קלנדריות מהיום הישראלי.
export function isWithinReasonableRange(key, today, years = MAX_YEARS_FROM_TODAY) {
  if (!isValidKey(key) || !isValidKey(today)) return false;
  const { y: ty, m: tm, d: td } = parts(today);
  const lo = new Date(Date.UTC(ty - years, tm - 1, td)).toISOString().slice(0, 10);
  const hi = new Date(Date.UTC(ty + years, tm - 1, td)).toISOString().slice(0, 10);
  return key >= lo && key <= hi;
}

function parts(key) {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

function utcOf(key) {
  const { y, m, d } = parts(key);
  return Date.UTC(y, m - 1, d);
}

function keyOfUtcMs(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

// Date "מקומי" בחצות של היום שבמפתח - לפונקציות קיימות שקוראות getDay()/getDate() (isChagDay,
// getHebrewDateString, getDeliveriesForDate). בכל אזור זמן זה אותו יום קלנדרי.
export function keyToLocalMidnight(key) {
  const { y, m, d } = parts(key);
  return new Date(y, m - 1, d);
}

export function addCalendarDays(key, n) {
  return keyOfUtcMs(utcOf(key) + n * DAY_MS);
}

// ההפרש בימים קלנדריים: laterKey - earlierKey (שלילי אם laterKey מוקדם יותר).
export function daysBetween(earlierKey, laterKey) {
  return Math.round((utcOf(laterKey) - utcOf(earlierKey)) / DAY_MS);
}

// 0 = ראשון ... 5 = שישי, 6 = שבת
export function weekdayOf(key) {
  return new Date(utcOf(key)).getUTCDay();
}

export function isFridayOrShabbat(key) {
  const w = weekdayOf(key);
  return w === 5 || w === 6;
}

export function isChagKey(key, chagFn = isChagDay) {
  return !!chagFn(keyToLocalMidnight(key));
}

export function isBusinessDay(key, { skipChag = true, chagFn } = {}) {
  if (isFridayOrShabbat(key)) return false;
  if (skipChag && isChagKey(key, chagFn)) return false;
  return true;
}

// n ימי עסקים קדימה (n>0) או אחורה (n<0) מהמפתח. n=0 מחזיר את המפתח עצמו גם אם אינו יום עסקים
// (אירוע יכול ליפול בשבת - זה תאריך של הלקוחה, לא תאריך עבודה).
export function addBusinessDays(key, n, opts = {}) {
  if (!n) return key;
  const step = n > 0 ? 1 : -1;
  let remaining = Math.abs(n);
  let cur = key;
  while (remaining > 0) {
    cur = addCalendarDays(cur, step);
    if (!isBusinessDay(cur, opts)) continue;
    remaining--;
  }
  return cur;
}

// כל המפתחות שהזזה של `offset` ימי עסקים מהם נוחתת בדיוק על `day`. offset שלילי = שלבים
// "לפני האירוע" (המועמדים אחרי day), חיובי = "אחרי האירוע" (המועמדים לפני day). כמה תאריכי אירוע
// יכולים למפות לאותו יום (אירועים בשישי, שבת וראשון -> הכנה בחמישי), ולכן זו רשימה. הגבול מרווח
// בכוונה: n ימי עסקים יכולים "להימתח" בגלל סופי שבוע ורצף חגים (ר' LOOKAHEAD_DAYS ב-
// app/api/orders/print-prep/route.js).
export function sourceKeysForDay(day, offset, opts = {}) {
  if (!offset) return [day];
  const bound = Math.abs(offset) + Math.ceil(Math.abs(offset) / 5) * 2 + 14;
  const out = [];
  for (let i = 0; i <= bound; i++) {
    const candidate = addCalendarDays(day, offset < 0 ? i : -i);
    if (addBusinessDays(candidate, offset, opts) === day) out.push(candidate);
  }
  return out.sort();
}

export function instantToKey(instant) {
  if (!instant) return null;
  const d = instant instanceof Date ? instant : new Date(instant);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: IL_TZ });
}

export function todayKey(now = new Date()) {
  return instantToKey(now);
}

// {start, end} ב-UTC של היום הישראלי - לשאילתות Prisma (gte/lte).
export function dayRange(key) {
  return getIsraelDayRange(key);
}

// טווח מאוחד לרשימת מפתחות (ממוינת או לא) - לשאילתה אחת במקום אחת לכל יום.
export function unionRange(keys) {
  if (!keys || keys.length === 0) return null;
  const sorted = [...keys].sort();
  return { start: dayRange(sorted[0]).start, end: dayRange(sorted[sorted.length - 1]).end };
}

export function hebrewLabel(key) {
  return getHebrewDateString(keyToLocalMidnight(key));
}

export function weekdayLabel(key) {
  return getHebrewWeekdayFullName(keyToLocalMidnight(key));
}
