// lib/punchClockFlow.js - הלוגיקה הטהורה של שעון הנוכחות בעיצוב החדש (app/components/login/PunchClockNew.js).
// מודול בלי React/Next/Prisma, נבדק ב-scripts/test_punch_clock_logic.mjs. אין כאן שום כלל עסקי חדש: ההכרעה
// כניסה/יציאה, בדיקת הסיסמה והקוד המקוצר ורישום המשמרת נשארים בשרת (POST /api/attendance, lib/shiftPunch.js);
// כאן רק נוסחי ההודעות, האימות לפני שליחה, ומסך האישור. הניסוחים והעיצוב לפי דף הכניסה (lib/loginFlow.js).

import { LOGIN_MESSAGES, validateLoginForm, formatIsraelHHMM, punchInMessage } from './loginFlow.js';

const IL_TZ = 'Asia/Jerusalem';

/** הפעולות שהשרת מקבל ב-POST /api/attendance (שדה action). */
export const PUNCH_ACTION = Object.freeze({ IN: 'IN', OUT: 'OUT' });

export const PUNCH_MESSAGES = Object.freeze({
  bothMissing: 'מלאו שם עובד וסיסמה כדי לרשום נוכחות.',
  network: LOGIN_MESSAGES.network,
  generic: 'לא הצלחנו לרשום את הנוכחות. נסו שוב.',
  exitCancelled: 'היציאה לא נרשמה. בדקו את ההחזרות ונסו שוב.',
  backToForm: 'חוזרים לטופס…',
});

/**
 * אימות לפני שליחה: אותם כללים כמו בדף הכניסה (בחירת עובד מהרשימה או שם מדויק + סיסמה), בניסוח של שעון הנוכחות.
 * @returns null כשהכול תקין, אחרת { field: 'user'|'pass', message }.
 */
export function validatePunchForm({ userText, employeeId, credential, listLoaded = true }) {
  const invalid = validateLoginForm({ userText, employeeId, credential, pinMode: false, listLoaded });
  if (invalid && invalid.message === LOGIN_MESSAGES.bothMissing) return { ...invalid, message: PUNCH_MESSAGES.bothMissing };
  return invalid;
}

/**
 * הטקסט להצגה כשהשרת דחה את הרישום. השרת מחזיר { error } בעברית ("סיסמה שגויה", "כבר נרשמה כניסה - ...");
 * שגיאה טכנית באנגלית ("Internal Server Error") לא מוצגת כמו שהיא.
 * @returns {{ field: 'pass'|null, message: string }} field='pass' רק כשהסיסמה/הקוד נדחו (401).
 */
export function punchErrorInfo(status, data) {
  const raw = data && typeof data.error === 'string' ? data.error.trim() : '';
  const message = /[֐-׿]/.test(raw) ? raw : PUNCH_MESSAGES.generic;
  return { field: status === 401 ? 'pass' : null, message };
}

// ---- בדיקת "כובסת ביציאה" (הגדרה laundress_return_check_on_exit): לפני יציאה - רשימת מי שלא החזירו ----
export function laundressCheckEnabled(settings) {
  return Array.isArray(settings) ? settings.find((s) => s && s.key === 'laundress_return_check_on_exit')?.value === 'true' : false;
}

/** ההזמנות בארכיון עם פריט שנלקח ולא הוחזר (תשובת GET /api/orders?filterStatus=archive). */
export function overdueOrders(response) {
  const list = (response && response.data) || [];
  return list.filter((o) => o.items?.some((i) => !i.isDeleted && i.isTaken && !i.isReturned));
}

/** הנוסח של שאלת האישור (כמו במסך הישן): כמה משפחות, ועד 5 שמות לדוגמה. */
export function overdueConfirmText(overdue) {
  const names = overdue.slice(0, 5).map((o) => `${o.customerName || '?'}`).join(', ');
  return `יש ${overdue.length} משפחות שלא החזירו (לדוגמה: ${names}). האם לוודא שהן אכן לא החזירו?`;
}

// ---- שעון ותצוגת משך ----
/** "HH:MM:SS" בשעון ישראל (בלי תלות באזור הזמן של המחשב). */
export function formatIsraelClock(instant) {
  const d = instant instanceof Date ? instant : new Date(instant);
  if (isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: IL_TZ, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${String(parts.hour).padStart(2, '0')}:${parts.minute}:${parts.second}`;
}

/** "שעתיים ו-5 דקות" - משך משמרת בעברית פשוטה. null כשאין מספר תקין. */
export function formatShiftDuration(totalMinutes) {
  const total = Number(totalMinutes);
  if (totalMinutes === null || totalMinutes === undefined || totalMinutes === '' || !Number.isFinite(total) || total < 0) return null;
  const m = Math.floor(total);
  if (m === 0) return 'פחות מדקה';
  const h = Math.floor(m / 60);
  const min = m % 60;
  const hours = h === 1 ? 'שעה אחת' : h === 2 ? 'שעתיים' : `${h} שעות`;
  const mins = min === 1 ? 'דקה אחת' : min === 2 ? 'שתי דקות' : `${min} דקות`;
  if (h === 0) return mins;
  if (min === 0) return hours;
  // ו' החיבור: צמודה למילה ("ודקה אחת", "ושתי דקות") ועם מקף לפני ספרה ("ו-13 דקות")
  return `${hours} ${min <= 2 ? 'ו' : 'ו-'}${mins}`;
}

/** "נרשמה סיום עבודה ב-HH:MM" - הצד השני של punchInMessage (דף הכניסה). */
export function punchOutMessage(punchedOutAt) {
  const t = formatIsraelHHMM(punchedOutAt);
  return t ? `נרשמה סיום עבודה ב-${t}` : 'נרשמה סיום עבודה';
}

/**
 * מסך האישור אחרי רישום מוצלח, באותו מבנה כמו מסך הסיום של דף הכניסה: כותרת, שורת שעה, ובסוף משמרת גם המשך.
 * @param {{ action: 'IN'|'OUT', firstName?: string, shift?: object, now?: Date }} p  shift = ה-shift שהשרת החזיר
 * @returns {{ title: string, clk: string, note: string }}
 */
export function punchDoneInfo({ action, firstName, shift, now = new Date() }) {
  const name = typeof firstName === 'string' ? firstName.trim() : '';
  const isIn = action === PUNCH_ACTION.IN;
  const base = isIn ? 'הכניסה נרשמה' : 'היציאה נרשמה';
  const title = name ? `${base}, ${name}` : base;
  const at = (isIn ? shift && shift.entryTime : shift && shift.exitTime) || now;
  const clk = isIn ? punchInMessage(at) : punchOutMessage(at);
  const dur = !isIn && shift ? formatShiftDuration(shift.totalMinutes) : null;
  return { title, clk, note: dur ? `משך המשמרת: ${dur}` : '' };
}
