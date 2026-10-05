import { getLateReturnInfo, LATE_RETURN_THRESHOLD_DAYS } from './lateReturn';

// כלל "משפחות באיחור" של חלונית התזכורת בכניסה/כל שעה/ביציאה בלבד (app/api/orders/overdue/route.js,
// דיווח 749aaf87). בכוונה לא נוגע ב-getLateReturnInfo ובסף late_return_threshold_days שמשותפים לפריים האדום
// בלוח, התראות הלו"ז, המייל היומי והצעת "חזר לא תקין" - רק החלונית משתמשת בכלל הזה.
//
// שתי הגדרות אופציונליות (שתיהן ריקות = בדיוק ההתנהגות הקודמת, "late_return_threshold_days ימים"):
//  - overdue_popup_threshold_days: סף ימים לחלונית בלבד (מותר 0). ריק => late_return_threshold_days.
//  - overdue_popup_after_hour: שעה בשעון ישראל (0-23, או HH:MM) שממנה ואילך נספר גם היום-הסף עצמו. ריק => בלי לוגיקת שעה.
// daysLate = ימי לוח ישראליים מאז יום ההחזרה הצפוי (יום העבודה הראשון אחרי האירוע, או toDate/returnDate המגולגל).
// מופיעה בחלונית כש-daysLate > סף, או כש-daysLate === סף והשעה בישראל כבר >= שעת ההגדרה.
// בנווה יעקב (ערכים 0 + 14): אירוע אתמול שלא חזר מופיע רק מ-14:00 היום; אירוע לפני יומיים ויותר - בכל שעה.

const MAX_THRESHOLD_DAYS = 90;
const IL_TZ = 'Asia/Jerusalem';
let hmFormatter = null;

const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';

/**
 * @param {{popupThreshold?: any, lateThreshold?: any, afterHour?: any}} raw - ערכים גולמיים של ההגדרות (value מה-DB)
 * @returns {{threshold: number, afterMinutes: number|null}} afterMinutes = דקות מחצות (שעון ישראל), או null = ללא שעה
 */
export function parseOverduePopupConfig({ popupThreshold, lateThreshold, afterHour } = {}) {
  // כמו קודם בדיוק: Number(x) || 7 (late_return_threshold_days מינימום 1, 0/ריק נופל ל-7)
  const fallback = Number(lateThreshold) || LATE_RETURN_THRESHOLD_DAYS;
  // 0 חוקי כאן - לכן בלי "||"; ערך ריק/לא תקין => נופל לסף הרגיל
  let threshold = fallback;
  if (!isBlank(popupThreshold)) {
    const n = Number(String(popupThreshold).trim());
    if (Number.isInteger(n) && n >= 0) threshold = Math.min(n, MAX_THRESHOLD_DAYS);
  }
  let afterMinutes = null;
  if (!isBlank(afterHour)) {
    const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(String(afterHour).trim());
    if (m) {
      const h = Number(m[1]);
      const mi = m[2] === undefined ? 0 : Number(m[2]);
      if (h <= 23 && mi <= 59) afterMinutes = h * 60 + mi;
    }
  }
  return { threshold, afterMinutes };
}

/** דקות מחצות בשעון ישראל של רגע נתון - בלי תלות באזור הזמן של השרת (Vercel = UTC). */
export function getIsraelMinutesOfDay(now = new Date()) {
  const d = now instanceof Date ? now : new Date(now);
  if (isNaN(d.getTime())) return 0;
  if (!hmFormatter) hmFormatter = new Intl.DateTimeFormat('en-US', { timeZone: IL_TZ, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' });
  const p = hmFormatter.formatToParts(d).reduce((acc, x) => { acc[x.type] = x.value; return acc; }, {});
  return (parseInt(p.hour, 10) % 24) * 60 + parseInt(p.minute, 10);
}

/**
 * האם ההזמנה מופיעה בחלונית. משתמש ב-getLateReturnInfo עם סף 0 רק כדי לקבל daysLate (אותו יום החזרה צפוי
 * בדיוק כמו בכל המערכת, כולל דילוג שישי/שבת/חג/ימים ללא פעילות); ההחלטה עצמה כאן.
 * @returns {{show: boolean, daysLate?: number}}
 */
export function getOverduePopupInfo(order, config, { now, nonWorkingDays } = {}) {
  const at = now || new Date();
  const info = getLateReturnInfo(order, 0, { now: at, nonWorkingDays });
  if (info.daysLate === undefined) return { show: false };
  const { threshold, afterMinutes } = config;
  let show = info.daysLate > threshold;
  if (!show && info.daysLate === threshold) show = afterMinutes === null || getIsraelMinutesOfDay(at) >= afterMinutes;
  return { show, daysLate: info.daysLate };
}
