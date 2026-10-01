// lib/loginFlow.js - הלוגיקה הטהורה של דף הכניסה החדש (app/components/login/LoginNew.js).
// מודול בלי React/Next/Prisma, נבדק ב-scripts/test_login_logic.mjs. מקור ההחלטות: החלטות הבעלים
// לדף הכניסה (L01-L17, Q01-Q09, LQ-01..LQ-07, 1.10.2026) - ר' תיאור ה-PR של הענף feature/login-new-2026-10-02.
//
// מה יש כאן:
//   ברכה לפי שעון ישראל (L10)                      greetingForHour / greetingNow
//   חזרה לאותו דף בלי open redirect (L06)            sanitizeReturnPath
//   מחשב משותף = יותר מ-3 עובדים שונים (L09/L17)     isSharedComputer / addEmployeeKeyToDevice
//   טבלת ההחלטות של רישום התחלת עבודה (L14, Q02-Q04)  decideAutoShift / classifyOpenShift
//   סגירת משמרת פתוחה מאתמול לפי שעה שהוקלדה (L15)    resolvePreviousShiftExit
//   הפס העליון: שם הגמ"ח ותגית לפי הארגון (L11, LQ-07) brandBar
//   נוסחי השגיאות והאימות של הטופס (L08)             validateLoginForm / LOGIN_MESSAGES
//   העדפת "רישום אוטומטי" בתוך העדפות העובד (Q01)     autoClockInFromPrefs / withAutoClockIn

import { getIsraelDateKey, addDaysToDateKey, getIsraelDayRange } from './hebrewDate.js';
import { hebrewDateOfInstant } from './hebrewStamp.js';
import { parseStoredDesignPrefs } from './designPrefsSchema.js';

const IL_TZ = 'Asia/Jerusalem';

// ---- ברכה (L10): בין 5:00 ל-16:00 "בוקר טוב", אחרת "ערב טוב" - כמו בעיצוב המאושר ----
export const GREETING_MORNING = 'בוקר טוב';
export const GREETING_EVENING = 'ערב טוב';

export function greetingForHour(hour) {
  const h = Number(hour);
  if (!Number.isFinite(h)) return GREETING_MORNING;
  return h >= 5 && h < 16 ? GREETING_MORNING : GREETING_EVENING;
}

/** השעה (0-23) בשעון ישראל של רגע נתון - בלי תלות באזור הזמן של המכונה. */
export function israelHour(now = new Date()) {
  const d = now instanceof Date ? now : new Date(now);
  if (isNaN(d.getTime())) return 0;
  const h = new Intl.DateTimeFormat('en-US', { timeZone: IL_TZ, hourCycle: 'h23', hour: '2-digit' }).format(d);
  const n = parseInt(h, 10);
  return Number.isFinite(n) ? n % 24 : 0;
}

export function greetingNow(now = new Date()) {
  return greetingForHour(israelHour(now));
}

/** "HH:MM" בשעון ישראל. */
export function formatIsraelHHMM(instant) {
  const d = instant instanceof Date ? instant : new Date(instant);
  if (isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: IL_TZ, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' })
    .formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${String(parts.hour).padStart(2, '0')}:${parts.minute}`;
}

// ---- חזרה לאותו דף (L06) ----
// הכניסה מוצגת במקום הדף שהתבקש (showLogin ב-app/layout.js, הכתובת לא משתנה), ולכן ברירת
// המחדל היא reload. אם בכתובת יש ?returnTo=... (קישור ישיר), מקבלים רק נתיב פנימי באותו אתר:
// מתחיל ב-"/" אחד, בלי "//" או "/\" (שהדפדפן מפרש כדומיין אחר), בלי תווי בקרה, לא /api ולא /_next.
export function sanitizeReturnPath(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s || s.length > 2000) return null;
  if (s[0] !== '/') return null;
  if (s.length > 1 && (s[1] === '/' || s[1] === '\\')) return null;
  if (/[\u0000-\u001f\u007f]/.test(s)) return null;
  if (/[\\]/.test(s)) return null;
  if (/^\/(api|_next)(\/|$)/i.test(s)) return null;
  // כתובת מקודדת שמסתירה "//" בתחילתה
  try {
    const decoded = decodeURIComponent(s);
    if (decoded.length > 1 && decoded[0] === '/' && (decoded[1] === '/' || decoded[1] === '\\')) return null;
  } catch (e) {
    return null;
  }
  return s;
}

// ---- מחשב משותף (L09/L17, החלטת הבעלים 1.10.2026) ----
// השרת רושם לכל מחשב (מהימן או לא) אילו עובדים שונים נכנסו ממנו. מעל 3 עובדים שונים המחשב
// נחשב משותף: "זכור אותי" לא מוצע בכלל (בלי כיתוב) ובקשת rememberMe מהלקוח מתעלמים ממנה.
export const SHARED_COMPUTER_THRESHOLD = 3;
export const DEVICE_EMPLOYEE_KEYS_CAP = 12;

export function isSharedComputer(distinctEmployeeCount) {
  const n = Number(distinctEmployeeCount);
  return Number.isFinite(n) && n > SHARED_COMPUTER_THRESHOLD;
}

/** רשימת מפתחות העובדים של מחשב אחרי כניסה נוספת: ייחודית, שומרת סדר, חסומה ל-cap. */
export function addEmployeeKeyToDevice(list, key, cap = DEVICE_EMPLOYEE_KEYS_CAP) {
  const base = Array.isArray(list) ? list.filter((k) => typeof k === 'string' && k) : [];
  if (typeof key !== 'string' || !key) return base.slice(0, cap);
  if (base.includes(key)) return base.slice(0, cap);
  return [...base, key].slice(-cap);
}

// ---- רישום התחלת עבודה אוטומטי (L14) ----
// Q02: משמרת כבר פתוחה היום - מתעלמים בשקט (בלי רישום שני ובלי שגיאה).
// Q03 + LQ-02: משמרת פתוחה מיום קודם - שואלים את העובדת בחלונית, לכל עובדת, גם כשהמתג כבוי.
// Q04: הרישום פועל בכל מחשב שבו המתג (ההעדפה השמורה) דלוק, לא רק במחשבים מהימנים.
export const SHIFT_ACTION = Object.freeze({
  NONE: 'none',
  PUNCH_IN: 'punch-in',
  SKIP_SILENT: 'skip-silent',
  ASK_PREVIOUS: 'ask-previous',
});

/** null (אין משמרת פתוחה) | 'today' | 'previous-day' לפי היום הקלנדרי בישראל של שעת הכניסה. */
export function classifyOpenShift(openShift, now = new Date()) {
  if (!openShift || openShift.exitTime) return null;
  const entry = openShift.entryTime || openShift.date;
  const entryKey = entry ? getIsraelDateKey(entry) : null;
  const todayKey = getIsraelDateKey(now);
  if (!entryKey || !todayKey) return 'today'; // שעה לא תקינה: לא מנחשים "אתמול", מתנהגים כמו "פתוחה היום"
  return entryKey < todayKey ? 'previous-day' : 'today';
}

export function decideAutoShift({ autoClockIn, openShift, now = new Date() }) {
  const kind = classifyOpenShift(openShift, now);
  if (kind === 'previous-day') return { action: SHIFT_ACTION.ASK_PREVIOUS, openShift };
  if (kind === 'today') return { action: SHIFT_ACTION.SKIP_SILENT, openShift };
  return { action: autoClockIn ? SHIFT_ACTION.PUNCH_IN : SHIFT_ACTION.NONE, openShift: null };
}

/** "נרשמה התחלת עבודה ב-HH:MM" (Q09). */
export function punchInMessage(punchedInAt) {
  const t = formatIsraelHHMM(punchedInAt);
  return t ? `נרשמה התחלת עבודה ב-${t}` : 'נרשמה התחלת עבודה';
}

/** הטקסט בחלונית "לא נרשמה יציאה אתמול" (L15); כשהמשמרת ישנה יותר מיום - בתאריך עברי. */
export function previousShiftPrompt(openShift, now = new Date()) {
  const entry = openShift && openShift.entryTime ? new Date(openShift.entryTime) : null;
  const hhmm = entry ? formatIsraelHHMM(entry) : '';
  const entryKey = entry ? getIsraelDateKey(entry) : null;
  const yesterdayKey = addDaysToDateKey(getIsraelDateKey(now), -1);
  const when = entryKey === yesterdayKey ? 'של אתמול' : `מתאריך ${hebrewDateOfInstant(entry)}`;
  return `המשמרת ${when} התחילה ב-${hhmm} ועדיין פתוחה. באיזו שעה סיימת?`;
}

export const PREVIOUS_SHIFT_MESSAGES = Object.freeze({
  missingTime: 'הקלידו את שעת סיום המשמרת.',
  badTime: 'שעה לא תקינה.',
  beforeStart: 'השעה חייבת להיות אחרי שעת ההתחלה של המשמרת.',
  inFuture: 'השעה לא יכולה להיות מאוחרת מהשעה הנוכחית.',
  tooLong: 'המשמרת לא יכולה להימשך יותר מיממה. אם היא אכן נמשכה, יש לפנות למנהל.',
  leftOpen: 'המשמרת של אתמול נשארה פתוחה.',
  leftOpenNoPunch: 'המשמרת של אתמול נשארה פתוחה, ולכן לא נרשמה התחלת עבודה להיום.',
});

/**
 * שעת יציאה למשמרת פתוחה מיום קודם לפי "HH:MM" שהעובדת הקלידה. השעה מתפרשת לפי שעון ישראל ביום
 * שבו התחילה המשמרת; אם היא לפני שעת ההתחלה (משמרת שחצתה חצות) - ביום שאחריו.
 * @returns {{ ok: true, exitAt: Date } | { ok: false, error: string }}
 */
export function resolvePreviousShiftExit({ entryTime, hhmm, now = new Date(), maxShiftMs = 24 * 60 * 60 * 1000 }) {
  const entry = entryTime instanceof Date ? entryTime : new Date(entryTime);
  if (isNaN(entry.getTime())) return { ok: false, error: PREVIOUS_SHIFT_MESSAGES.badTime };
  const text = typeof hhmm === 'string' ? hhmm.trim() : '';
  if (!text) return { ok: false, error: PREVIOUS_SHIFT_MESSAGES.missingTime };
  const m = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!m) return { ok: false, error: PREVIOUS_SHIFT_MESSAGES.badTime };
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return { ok: false, error: PREVIOUS_SHIFT_MESSAGES.badTime };

  const entryKey = getIsraelDateKey(entry);
  const onDay = (key) => new Date(getIsraelDayRange(key).start.getTime() + (h * 60 + min) * 60000);
  let exitAt = onDay(entryKey);
  if (exitAt.getTime() <= entry.getTime()) exitAt = onDay(addDaysToDateKey(entryKey, 1));
  if (exitAt.getTime() <= entry.getTime()) return { ok: false, error: PREVIOUS_SHIFT_MESSAGES.beforeStart };
  const nowMs = (now instanceof Date ? now : new Date(now)).getTime();
  if (exitAt.getTime() > nowMs) return { ok: false, error: PREVIOUS_SHIFT_MESSAGES.inFuture };
  if (exitAt.getTime() - entry.getTime() > maxShiftMs) return { ok: false, error: PREVIOUS_SHIFT_MESSAGES.tooLong };
  return { ok: true, exitAt };
}

// ---- העדפת "רישום אוטומטי" (Q01: בהעדפות הקיימות של העובד, Employee.themeColor JSON) ----
// LQ-04 ביקשה עמודה נפרדת; בלי שינוי סכמה (אילוץ קבוע של הענף) ההעדפה נשמרת כאן, במפתח אחד,
// דרך הפונקציות האלה בלבד - מעבר עתידי לעמודה = שינוי בקובץ הזה ובלוגיקה שב-lib/autoClockPref.js.
export const AUTO_CLOCK_PREF_KEY = 'autoClockIn';

export function autoClockInFromPrefs(prefs) {
  return !!(prefs && typeof prefs === 'object' && prefs[AUTO_CLOCK_PREF_KEY] === true);
}

export function autoClockInFromRaw(themeColorRaw) {
  return autoClockInFromPrefs(parseStoredDesignPrefs(themeColorRaw));
}

/** JSON חדש לעמודת themeColor עם ההעדפה; שאר ההעדפות נשמרות כפי שהן. */
export function withAutoClockIn(themeColorRaw, enabled) {
  const existing = parseStoredDesignPrefs(themeColorRaw) || {};
  const next = { v: 1, ...existing, [AUTO_CLOCK_PREF_KEY]: !!enabled };
  return JSON.stringify(next);
}

// ---- הפס העליון (L11, LQ-07) ----
// השם נלקח מהגדרת gmach_name של כל גמ"ח (לא מוקלד בקוד). בגמ"ח הראשי: התגית "מכובד השכרת שמלות" לצד
// השם, אלא אם השם כבר מכיל אותה. בגמ"ח אחר: התגית היא gmach_subtitle (כמו בסרגל A5) או כלום.
export const DEFAULT_GEMACH_NAME = 'גמ״ח שמלות';
export const MAIN_GEMACH_TAG = 'מכובד השכרת שמלות';

// השוואה סלחנית לפיסוק ורווחים: בגמ"ח הראשי gmach_name הוא "מכובד- השכרת שמלות" (עם מקף), ועדיין זהו השם עצמו.
const lettersOnly = (s) => String(s || '').replace(/[^\p{L}\p{N}]/gu, '');

export function brandBar({ gmachName, gmachSubtitle, isMainGemach } = {}) {
  const name = typeof gmachName === 'string' && gmachName.trim() ? gmachName.trim() : DEFAULT_GEMACH_NAME;
  let tag = '';
  if (isMainGemach) {
    tag = lettersOnly(name).includes(lettersOnly(MAIN_GEMACH_TAG)) ? '' : MAIN_GEMACH_TAG;
  } else if (typeof gmachSubtitle === 'string') {
    tag = gmachSubtitle.trim();
  }
  return { name, tag };
}

// ---- טופס הכניסה (L01, L02, L08, LQ-05) ----
export const LOGIN_MESSAGES = Object.freeze({
  bothMissing: 'מלאו שם עובד וסיסמה כדי להיכנס.',
  userMissing: 'בחרו או הקלידו את שם העובד.',
  passMissing: 'הקלידו את הסיסמה.',
  pinMissing: 'הקלידו את 4 התווים האחרונים בסיסמה.',
  userNotFound: 'לא נמצא עובד בשם הזה. בחרו את השם מהרשימה.',
  userNotFoundNoPass: 'לא נמצא עובד בשם הזה. בחרו את השם מהרשימה והקלידו סיסמה.',
  listEmpty: 'לא נמצא עובד בשם הזה ברשימה.',
  loading: 'טוען רשימת עובדים...',
  network: 'שגיאת תקשורת. נסו שוב.',
  generic: 'שגיאה בהתחברות',
  forgotNeedsEmployee: 'יש לבחור קודם עובד מהרשימה.',
  resetTooShort: 'הסיסמה החדשה קצרה מדי (לפחות 4 תווים).',
  resetMismatch: 'הסיסמאות אינן תואמות.',
});

export function employeeDisplayName(emp) {
  if (!emp) return '';
  const full = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
  return full || (typeof emp.fullName === 'string' ? emp.fullName.trim() : '');
}

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

/** סינון הרשימה לפי הקלדה (LQ-05: ההקלדה רק מסננת; שם משתמש = השם כפי שברשימה). */
export function filterEmployees(list, query) {
  const q = norm(query);
  const arr = Array.isArray(list) ? list : [];
  if (!q) return arr;
  return arr.filter((e) => norm(employeeDisplayName(e)).includes(q) || norm(e && e.fullName).includes(q));
}

/** העובד שתואם בדיוק לטקסט שהוקלד (אחרי ניקוי רווחים), או null. */
export function matchEmployeeByName(list, query) {
  const q = norm(query);
  if (!q) return null;
  const arr = Array.isArray(list) ? list : [];
  return arr.find((e) => norm(employeeDisplayName(e)) === q || norm(e && e.fullName) === q) || null;
}

/**
 * אימות לפני שליחה. @returns null כשהכול תקין, אחרת { field: 'user'|'pass', message }.
 * @param {{ userText: string, employeeId: string|null, credential: string, pinMode?: boolean, listLoaded?: boolean }} p
 */
export function validateLoginForm({ userText, employeeId, credential, pinMode = false, listLoaded = true }) {
  const hasUserText = !!norm(userText);
  const hasCred = !!(credential && String(credential).length);
  if (!hasUserText && !hasCred) return { field: 'user', message: LOGIN_MESSAGES.bothMissing };
  if (!hasUserText) return { field: 'user', message: LOGIN_MESSAGES.userMissing };
  if (!employeeId) {
    if (!listLoaded) return { field: 'user', message: LOGIN_MESSAGES.loading };
    return { field: 'user', message: hasCred ? LOGIN_MESSAGES.userNotFound : LOGIN_MESSAGES.userNotFoundNoPass };
  }
  if (!hasCred) return { field: 'pass', message: pinMode ? LOGIN_MESSAGES.pinMissing : LOGIN_MESSAGES.passMissing };
  if (pinMode && String(credential).length !== 4) return { field: 'pass', message: LOGIN_MESSAGES.pinMissing };
  return null;
}

/** "התחברת בהצלחה, שרה" - השם הפרטי בלבד, כמו בעיצוב. */
export function doneTitle(employee) {
  const first = employee && typeof employee.firstName === 'string' ? employee.firstName.trim() : '';
  return first ? `התחברת בהצלחה, ${first}` : 'התחברת בהצלחה';
}

/** "יש N הודעות חדשות שלא טופלו" (L05). */
export function unreadMessagesText(count) {
  const n = Number(count) || 0;
  if (n === 1) return 'יש הודעה חדשה אחת שלא טופלה';
  return `יש ${n} הודעות חדשות שלא טופלו`;
}
