// lib/hebrewStamp.js - תאריכים עבריים לתצוגה בלבד (כלל קבוע: אף תאריך לועזי לא מוצג בממשק; שעות נשארות).
// מודול טהור (בלי React/Next), נבדק ב-scripts/test_menu_logic.mjs. משתמש בעזרי lib/hebrewDate.js הקיימים.
// היום הקלנדרי הוא היום האזרחי בישראל (Asia/Jerusalem), לא לפי שקיעה.

import { getHebrewDateString, getIsraelDateKey } from './hebrewDate.js';

/** תאריך עברי ("ט תשרי תשפ"ז") ליום הקלנדרי בישראל של רגע נתון (ms / Date / ISO). '' אם לא תקין. */
export function hebrewDateOfInstant(instant) {
  const key = getIsraelDateKey(instant instanceof Date ? instant : new Date(instant));
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  return getHebrewDateString(new Date(y, m - 1, d));
}

/**
 * מחרוזת הגרסה של app/version.json ("DD/MM/YYYY HH:MM", שעון ישראל - נכתבת ע"י scripts/update_build_time.js)
 * -> "ט תשרי תשפ"ז, 12:47". מחרוזת שלא ניתן לפרש מחזירה '' (לא מציגים תאריך לועזי).
 */
export function hebrewVersionStamp(versionDate) {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?\s*$/.exec(String(versionDate == null ? '' : versionDate));
  if (!m) return '';
  const day = +m[1], month = +m[2], year = +m[3];
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  const probe = new Date(year, month - 1, day);
  if (probe.getMonth() !== month - 1 || probe.getDate() !== day) return '';
  const heb = getHebrewDateString(probe);
  if (!heb) return '';
  return m[4] !== undefined ? `${heb}, ${String(+m[4]).padStart(2, '0')}:${m[5]}` : heb;
}

/**
 * תאריך עדכון מחושב אוטומטית (מדיניות הפרטיות, GQ-03f): התאריך העברי של גרסת האתר (בלי שעה); אם מחרוזת הגרסה לא ניתנת לפירוש -
 * התאריך העברי של היום בישראל. תמיד תאריך עברי בלבד (בלי לועזי); '' רק אם גם חישוב היום נכשל.
 */
export function hebrewUpdatedDate(versionDate, now = Date.now()) {
  const stamp = hebrewVersionStamp(versionDate);
  if (stamp) return stamp.split(',')[0].trim();
  return hebrewDateOfInstant(now);
}
