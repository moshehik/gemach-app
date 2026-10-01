// lib/menu/shiftClock.js - טקסט "במשמרת" לסרגל החדש. מודול טהור (בלי React/Next), נבדק ב-scripts/test_menu_logic.mjs.
//
// למה: /api/me מחזיר את המשמרת *הפתוחה* (exitTime: null) של העובד בכל תאריך. משמרת ישנה שנשכח לרשום לה יציאה (בעיקר
// משמרות שיובאו מ-Access) נשארת פתוחה לנצח, ושעון ה"במשמרת" הראה אצל הבעלים "33819:46" (= כ-3.9 שנים).
// מעל הסף (ברירת מחדל 16 שעות) זו לא משמרת נוכחית - מציגים מצב ברור "משמרת פתוחה · <תאריך עברי>" במקום מונה ענק.

import { hebrewDateOfInstant } from '../hebrewStamp.js';

export const MAX_PLAUSIBLE_SHIFT_MS = 16 * 60 * 60 * 1000;

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * @param {string|number|Date|null|undefined} entryTime  שעת הכניסה של המשמרת הפתוחה
 * @param {number} now  Date.now()
 * @returns {null | { kind: 'ok', text: string } | { kind: 'stale', since: string, text: string, tip: string }}
 *   null = אין מה להציג (אין שעה תקינה / שעה עתידית).
 */
export function shiftClockInfo(entryTime, now, maxMs = MAX_PLAUSIBLE_SHIFT_MS) {
  const t = entryTime ? Date.parse(entryTime) : NaN;
  if (!Number.isFinite(t) || !Number.isFinite(now)) return null;
  const diff = now - t;
  if (diff < -60000) return null;
  if (diff > maxMs) {
    const since = hebrewDateOfInstant(t);
    return {
      kind: 'stale',
      since,
      text: `משמרת פתוחה · ${since}`,
      tip: `לא נרשמה יציאה מהמשמרת שהתחילה בתאריך ${since}. כדאי לסגור אותה בדף הנוכחות (עובדים ונוכחות).`,
    };
  }
  const m = Math.max(0, Math.floor(diff / 60000));
  return { kind: 'ok', text: `${Math.floor(m / 60)}:${pad2(m % 60)}` };
}
