// lib/schedule/dates.js — תאריכים ללו״ז היומי, בלי שום תלות באזור הזמן של השרת.
//
// כל "יום" בלו״ז מיוצג כמפתח 'YYYY-MM-DD' של היום הקלנדרי בישראל (Asia/Jerusalem).
// חשבון ימים נעשה על המפתח בלבד (Date.UTC + getUTC*), כך ש-Vercel (UTC), מחשב בישראל
// ומחשב באזור זמן שלילי נותנים אותה תוצאה. חלונות DB = getIsraelDayRange (lib/hebrewDate.js),
// המרת instant ליום = toLocaleDateString('en-CA', Asia/Jerusalem) - אותו דפוס כמו
// toIsraelCalendarDate/ilKey ב-app/api/a5/adv/route.js. ר' CLAUDE.md, Standing rules → Dates & time.
//
// ימי עסקים / "יום לא עובד" (2026-10-01, החלטות הבעלים 3+4 ב-DECISIONS-לוז-יומי.md): ללו״ז אין כלל
// משלו. "האם יום X עובד", "N ימי עסקים קדימה/אחורה" ו"אילו אירועים נוחתים על יום X" עוברים כולם
// לכלל האחיד ב-lib/businessDays.js - שישי, שבת, יום טוב, ערב יום טוב, והימים שהבעלים סימן בניהול
// היומן (non_working_days_extra). אין כאן חישוב חג ואין בדיקת יום בשבוע, בכוונה: כשהכלל מתרחב
// (גרסה 2: חול המועד, טווחים, תאריכים עבריים קבועים) הלו״ז מקבל אותו אוטומטית, יחד עם משלוחים
// (lib/deliveries.js), איחורים (lib/lateReturn.js) וכרטיס ההזמנה. החוזה: CONTRACT-non-working-days.md.

// טווח תאריכים סביר לבקשה (שנים קדימה/אחורה מהיום הישראלי). מעבר לזה - 400 ולא 500: addCalendarDays
// על שנת 9999 חורג מטווח Date (RangeError) - סקירת WP1, ממצא 4.
export const MAX_YEARS_FROM_TODAY = 3;

import { getIsraelDayRange, getHebrewDateString, getHebrewWeekdayFullName } from '@/lib/hebrewDate';
import {
  isValidDayKey,
  isNonWorkingDay as helperIsNonWorkingDay,
  dayStatus as helperDayStatus,
  addBusinessDays as helperAddBusinessDays,
  inverseBusinessDays,
} from '@/lib/businessDays';

export const ISO_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const IL_TZ = 'Asia/Jerusalem';
const DAY_MS = 24 * 60 * 60 * 1000;
// מגן לולאה להרחבת טווח ההופכי לרשימת מפתחות (הכלל עצמו עוצר אחרי 400 ימים סגורים רצופים)
const MAX_SOURCE_KEYS = 800;

export function isValidKey(key) {
  return isValidDayKey(key);
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

// Date "מקומי" בחצות של היום שבמפתח - לפונקציות קיימות שקוראות getDay()/getDate() (getHebrewDateString,
// getDeliveriesForDate). בכל אזור זמן זה אותו יום קלנדרי. לא להעביר ל-lib/businessDays.js (שם מצפים למפתח).
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

// ---- הכלל האחיד (עטיפות דקות; nonWorkingDays = NonWorkingConfig של הבעלים, ריק = ברירות המחדל) ----

// true = יום לא עובד לפי הכלל האחיד (שישי/שבת/חג/ערב חג/רשימת הבעלים).
export function isNonWorkingDay(key, nonWorkingDays) {
  return helperIsNonWorkingDay(key, nonWorkingDays ?? null);
}

// { key, working, reasons[], titles[], note } - ללו״ז מוצג "יום לא עובד" עם הסיבה (ר' index.js).
export function dayStatus(key, nonWorkingDays) {
  return helperDayStatus(key, nonWorkingDays ?? null);
}

// n ימי עסקים קדימה (n>0) או אחורה (n<0) מהמפתח. n=0 מחזיר את המפתח עצמו גם אם אינו יום עסקים
// (אירוע יכול ליפול בשבת - זה תאריך של הלקוחה, לא תאריך עבודה).
export function addBusinessDays(key, n, nonWorkingDays) {
  return helperAddBusinessDays(key, n, nonWorkingDays ?? null);
}

// כל המפתחות שהזזה של `offset` ימי עסקים מהם נוחתת בדיוק על `day` (ההופכי של addBusinessDays, לפי אותו
// כלל ואותה רשימה). offset שלילי = שלבים "לפני האירוע" (המועמדים אחרי day), חיובי = "אחרי האירוע"
// (המועמדים לפני day). כמה תאריכי אירוע יכולים למפות לאותו יום (אירועים בשישי, שבת וראשון -> הכנה
// בחמישי; יום שהבעלים סגר מצטרף לאותו טווח), ולכן זו רשימה - תמיד טווח רציף. יום לא עובד אינו יעד של
// שום ספירה (offset≠0) ולכן מחזיר [] - אין הכנות/איסופים/החזרות ביום סגור.
export function sourceKeysForDay(day, offset, nonWorkingDays) {
  if (!offset) return [day];
  const range = inverseBusinessDays(day, offset, nonWorkingDays ?? null);
  if (!range) return [];
  const out = [];
  for (let k = range.startKey, i = 0; k <= range.endKey && i < MAX_SOURCE_KEYS; k = addCalendarDays(k, 1), i++) out.push(k);
  return out;
}

// החלטת הבעלים 2.10.2026 ("ההחזרה של אירוע בחמישי תהיה בראשון"): מועד החזרה לעולם לא נוחת על יום סגור -
// המפתח עצמו אם הוא יום עובד, אחרת יום העבודה הראשון אחריו (לפי הכלל האחיד + רשימת הבעלים). משמש את שלב 8:
// גם תאריך מפורש (toDate/returnDate) שנופל על שישי/שבת/חג/יום סגור, וגם offset 0 (= יום האירוע) מתגלגלים קדימה.
// null לקלט לא תקין.
export function rollForwardToWorkingDay(key, nonWorkingDays) {
  if (!isValidKey(key)) return null;
  return isNonWorkingDay(key, nonWorkingDays) ? addBusinessDays(key, 1, nonWorkingDays) : key;
}

// ההופכי של rollForwardToWorkingDay: כל המפתחות שמתגלגלים ל-day = day עצמו + רצף הימים הסגורים שלפניו
// (ראשון 4.10.2026 אוסף את שישי 2.10 ושבת 3.10). [] כש-day עצמו סגור - שום החזרה לא נוחתת עליו.
// משמש לחלון השאילתה של toDate/returnDate ולמפתחות שלב 8 עם offset 0.
export function rolledSourceKeysForDay(day, nonWorkingDays) {
  if (!isValidKey(day) || isNonWorkingDay(day, nonWorkingDays)) return [];
  const out = [day];
  for (let k = addCalendarDays(day, -1), i = 0; i < MAX_SOURCE_KEYS && isNonWorkingDay(k, nonWorkingDays); k = addCalendarDays(k, -1), i++) out.unshift(k);
  return out;
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
