// lib/attendance/summary.js — "סיכום נוכחות": החישובים, הפורמטים והכללים של הדף (טהור: שרת, דפדפן, דף ההדפסה ובדיקות Node).
//
// מקור העיצוב: תצוגות-עיצוב/סיכום-נוכחות.html (אושר 4.10.2026, "מעולה ומוכן") + תשובות הבעלים לשאלות AT-01..AT-16
// (scratch/attendance-summary-answers-2026-10-04.json; כל החלטה מתועדת ב-scratch/attendance-build/NOTES.md).
// כל החלטה שאפשר להפוך היא קבוע אחד כאן:
//   AT-04 (כן = א'): "כמות ימים" סופרת ימים קלנדריים שונים (שתי משמרות באותו יום = יום אחד). "סה״כ משמרות" = מספר המשמרות.
//   AT-06 (כן): שעות מוצגות תמיד כשעות:דקות (141:25) - בטבלה, בסה״כ, בדפים המודפסים וב-Excel. עמודה שכתוב בה "דקות" נשארת דקות.
//   AT-11 (לא = ב'): ברירת המחדל בפתיחה = החודש הקודם (לחישוב השכר), לפי שעון ישראל.
//   AT-14 (לא = ב'): "לפי עובד" מתחיל מכל הנתונים (המשמרת הראשונה), עד 20 שורות בעמוד ולחצני מעבר עמוד.
//   AT-08 (לא = ב'): אין מגבלת שורות ואין סיסמת מאשר בייצוא (הייצוא ממילא להנהלה בלבד).
//   AT-01 (כן = א'): הסיכום נשאר עם העמודות הקיימות בלבד (שעות, ימים, תקלות, סה״כ, נסיעות). אין נתון "איחור" / "יציאה מוקדמת"
//     (אין במערכת שעת התחלה/סיום רשמית לעובד או למשמרת). "נערך ידנית" נגזר מההיסטוריה (AuditLog) ומוצג בשורות דף העריכה (AT-12),
//     ובטבלת הסיכום רק אם SHOW_EDITED_IN_SUMMARY דלוק (כבוי כברירת מחדל - ר' NOTES).
//   AT-05 (כן = א'): הסינון לפי חודש לועזי (כך נשמר השכר) עם כיתוב עברי של טווח החודש.

import { hebrewParts, gematria } from '../schedule/print/format.js';

export const DAYS_COUNT_MODE = 'distinct-days'; // AT-04: 'distinct-days' | 'shifts'
export const DEFAULT_PERIOD = 'previous'; // AT-11: 'previous' | 'current'
export const BYEMP_PAGE_SIZE = 20; // AT-14
export const EXPORT_ROW_LIMIT = null; // AT-08: null = בלי מגבלה ובלי סיסמת מאשר
export const SHOW_EDITED_IN_SUMMARY = false; // AT-01 - ר' למעלה
export const HISTORY_LIMIT = 100; // כמו לשונית ההיסטוריה בכרטיס העובד (take: 100)
// AuditLog.employeeId של משמרות נכתב עד התיקון הזה כמזהה **בעל המשמרת** (לא מי שערך) - ר' app/api/employees/[id]/shifts.
// שורה ישנה יותר מהתאריך הזה לא מציגה "ע״י" (המידע לא אמין); מהתאריך הזה נרשם מי שערך בפועל. לעדכן לתאריך הפריסה בפועל.
// ניתן לדריסה בלי שינוי קוד: משתנה הסביבה SHIFT_AUDIT_ACTOR_SINCE (ISO, בצד השרת בלבד - ההיסטוריה מעובדת בשרת).
// רשימת מיזוג: לקבוע לזמן הפריסה בפועל (scratch/attendance-build/NOTES.md, CHECKLIST).
const DEFAULT_ACTOR_SINCE = '2026-10-05T00:00:00.000Z';
const envActorSince = typeof process !== 'undefined' && process.env ? process.env.SHIFT_AUDIT_ACTOR_SINCE : undefined;
export const SHIFT_AUDIT_ACTOR_SINCE = envActorSince && !isNaN(new Date(envActorSince).getTime()) ? new Date(envActorSince).toISOString() : DEFAULT_ACTOR_SINCE;

export const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const TZ = 'Asia/Jerusalem';
const pad = (n) => (n < 10 ? '0' : '') + n;

// ---------- זמן ותאריכים (תמיד שעון ישראל; השרת של Vercel וה-Chromium של ה-PDF רצים ב-UTC) ----------
let dayFmt = null;
let timeFmt = null;
let partsFmt = null;
function getDayFmt() { return dayFmt || (dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })); }
function getTimeFmt() { return timeFmt || (timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })); }
function getPartsFmt() { return partsFmt || (partsFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })); }

const toDate = (v) => (v instanceof Date ? v : v === null || v === undefined || v === '' ? null : new Date(v));

/** מפתח יום YYYY-MM-DD בישראל של רגע נתון (null לא תקין). Shift.date נשמר כחצות UTC של היום הישראלי - מחזיר את אותו יום. */
export function israelDayKey(value) {
  const d = toDate(value);
  if (!d || isNaN(d.getTime())) return null;
  const p = {};
  getDayFmt().formatToParts(d).forEach((x) => { p[x.type] = x.value; });
  return `${p.year}-${p.month}-${p.day}`;
}

/** "08:05" (שעון ישראל) או null */
export function israelTime(value) {
  const d = toDate(value);
  if (!d || isNaN(d.getTime())) return null;
  return getTimeFmt().format(d).replace(/^24:/, '00:');
}

function tzOffsetMinutes(utcMs) {
  const p = {};
  getPartsFmt().formatToParts(new Date(utcMs)).forEach((x) => { p[x.type] = x.value; });
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return Math.round((asUtc - utcMs) / 60000);
}

/** יום ישראלי + "HH:MM" -> ISO (UTC). שתי איטרציות כדי לעבור נכון מעבר שעון קיץ. */
export function israelTimeToIso(dayKey, hhmm) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dayKey || '')) || !/^\d{1,2}:\d{2}$/.test(String(hhmm || ''))) return null;
  const [y, m, d] = dayKey.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, h, mi);
  let utc = wall - tzOffsetMinutes(wall) * 60000;
  utc = wall - tzOffsetMinutes(utc) * 60000;
  return new Date(utc).toISOString();
}

/** הכניסה/יציאה מהטופס -> { entryTime, exitTime } ב-ISO; יציאה לפני הכניסה = למחרת (כמו בכרטיס העובד). */
export function buildShiftTimes(dayKey, entry, exit) {
  const entryTime = entry ? israelTimeToIso(dayKey, entry) : null;
  let exitTime = exit ? israelTimeToIso(dayKey, exit) : null;
  if (entryTime && exitTime && new Date(exitTime) < new Date(entryTime)) exitTime = new Date(new Date(exitTime).getTime() + 86400000).toISOString();
  return { entryTime, exitTime };
}

/** היום והחודש הנוכחיים בישראל */
export function israelToday(now = new Date()) {
  const k = israelDayKey(now);
  const [y, m] = k.split('-').map(Number);
  return { key: k, y, m: m - 1 };
}

/** החודש שנפתח בדף (AT-11): {y, m} עם m מ-0 */
export function defaultPeriod(now = new Date(), mode = DEFAULT_PERIOD) {
  const t = israelToday(now);
  if (mode === 'current') return { y: t.y, m: t.m };
  return shiftMonth(t.y, t.m, -1);
}
export function shiftMonth(y, m, delta) {
  const k = y * 12 + m + delta;
  return { y: Math.floor(k / 12), m: ((k % 12) + 12) % 12 };
}
export const isSameMonth = (a, b) => !!a && !!b && a.y === b.y && a.m === b.m;
export const monthKey = (y, m) => `${y}-${pad(m + 1)}`;
export const monthLabel = (y, m) => `${MONTHS[m]} ${y}`;

/** {y, m} מפרמטרים (y=2026, m=0..11) עם ולידציה; null = לא תקין */
export function parsePeriod(yRaw, mRaw) {
  const y = Number(yRaw);
  const m = Number(mRaw);
  if (!Number.isInteger(y) || !Number.isInteger(m) || y < 2000 || y > 2100 || m < 0 || m > 11) return null;
  return { y, m };
}

/** טווח השאילתה של חודש: יום לפני ויום אחרי (Shift.date בשתי צורות אחסון); הסינון המדויק לפי israelDayKey */
export function monthQueryRange(y, m) {
  return { gte: new Date(Date.UTC(y, m, 1) - 86400000), lt: new Date(Date.UTC(y, m + 1, 1) + 86400000) };
}
export const dayKeyInMonth = (key, y, m) => !!key && key.slice(0, 7) === monthKey(y, m);

const lastDay = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
/** "י״ט אלול – כ׳ תשרי תשפ״ז" (שנה בצד הראשון רק כשהיא שונה) */
export function hebSpan(y, m) {
  const a = hebrewParts(`${y}-${pad(m + 1)}-01`);
  const b = hebrewParts(`${y}-${pad(m + 1)}-${pad(lastDay(y, m))}`);
  return `${a.dl} ${a.m}${a.y !== b.y ? ' ' + a.y : ''} – ${b.dl} ${b.m} ${b.y}`;
}
/** "י״ד אלול" */
export const hDayShort = (key) => { const h = hebrewParts(key); return `${h.dl} ${h.m}`; };
/** "י״ד אלול תשפ״ו" */
export const hDayYear = (key) => { const h = hebrewParts(key); return `${h.dl} ${h.m} ${h.y}`; };
/** "יום א׳" / "שבת" */
export function weekdayShort(key) {
  const [y, m, d] = key.split('-').map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 6 ? 'שבת' : 'יום ' + ['א', 'ב', 'ג', 'ד', 'ה', 'ו'][w] + '׳';
}
/** "14.9.2026" */
export const gregDots = (key) => { const [y, m, d] = key.split('-').map(Number); return `${d}.${m}.${y}`; };
export { gematria };

// ---------- מספרים ----------
/** AT-06: דקות -> "141:25" */
export function hm(minutes) {
  const t = Math.max(0, Math.round(Number(minutes) || 0));
  return `${Math.floor(t / 60)}:${pad(t % 60)}`;
}
/** "₪1,234.50" */
export function money(n) {
  const v = Number(n) || 0;
  return '₪' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------- משמרות ----------
/** משמרת "לא שלמה": יש כניסה או יציאה אבל לא שתיהן - אותו כלל כמו isIncompleteShift בכרטיס העובד */
export const isIncomplete = (s) => !!s && !!s.entryTime !== !!s.exitTime;

/**
 * צורת המשמרת שנשלחת ללקוח. wages=false (עובד רגיל / דף "השעות שלי") - בלי שכר, נסיעות ותשלום.
 * edit (אופציונלי): { kind:'added'|'edited', at, by } מתוך ההיסטוריה.
 */
export function shapeShift(raw, { wages, edit = null } = {}) {
  const dayKey = israelDayKey(raw.date) || israelDayKey(raw.entryTime) || null;
  const out = {
    id: raw.id,
    dayKey,
    hebrewDate: raw.hebrewDate || null,
    entryTime: raw.entryTime ? toDate(raw.entryTime).toISOString() : null,
    exitTime: raw.exitTime ? toDate(raw.exitTime).toISOString() : null,
    minutes: raw.totalMinutes === null || raw.totalMinutes === undefined ? null : Number(raw.totalMinutes),
    notes: raw.notes || '',
    isDeleted: !!raw.isDeleted,
    edit: edit || null,
  };
  if (wages) {
    out.pay = raw.totalCalculated === null || raw.totalCalculated === undefined ? null : Number(raw.totalCalculated);
    out.travel = Number(raw.travelExpensesSnapshot) || 0;
    out.wage = raw.hourlyWageSnapshot === null || raw.hourlyWageSnapshot === undefined ? null : Number(raw.hourlyWageSnapshot);
  }
  return out;
}

export function sortShifts(list) {
  return [...list].sort((a, b) => {
    if (a.dayKey !== b.dayKey) return String(a.dayKey || '') < String(b.dayKey || '') ? -1 : 1;
    const ae = a.entryTime || '';
    const be = b.entryTime || '';
    if (!ae && be) return -1;
    if (ae && !be) return 1;
    return ae < be ? -1 : ae > be ? 1 : 0;
  });
}

/**
 * סיכום של רשימת משמרות (פעילות בלבד): minutes, days (AT-04), shiftCount, issues, pay, travels(bool), edited.
 * ריק = אפסים. pay/travels רלוונטיים רק כשהמשמרות נשלחו עם שכר.
 */
export function aggregate(shifts, mode = DAYS_COUNT_MODE) {
  const act = (shifts || []).filter((s) => s && !s.isDeleted);
  let minutes = 0;
  let pay = 0;
  let issues = 0;
  let travels = false;
  let edited = 0;
  const days = new Set();
  for (const s of act) {
    minutes += Number(s.minutes) || 0;
    pay += Number(s.pay) || 0;
    if (Number(s.travel) > 0) travels = true;
    if (isIncomplete(s)) issues++;
    if (s.edit) edited++;
    if (s.dayKey) days.add(s.dayKey);
  }
  return {
    minutes,
    days: mode === 'shifts' ? act.length : days.size,
    shiftCount: act.length,
    issues,
    pay: Math.round(pay * 100) / 100,
    travels,
    edited,
  };
}

export function sumRows(rows) {
  const T = { minutes: 0, days: 0, shiftCount: 0, issues: 0, pay: 0, edited: 0 };
  for (const r of rows || []) {
    T.minutes += r.minutes || 0;
    T.days += r.days || 0;
    T.shiftCount += r.shiftCount || 0;
    T.issues += r.issues || 0;
    T.pay += r.pay || 0;
    T.edited += r.edited || 0;
  }
  T.pay = Math.round(T.pay * 100) / 100;
  return T;
}

export const fullName = (e) => (e ? (e.fullName || [e.firstName, e.lastName].filter(Boolean).join(' ').trim()) : '') || '';
export const initials = (e) => `${(e && e.firstName ? e.firstName : '').charAt(0)}${(e && e.lastName ? e.lastName : '').charAt(0)}` || (fullName(e).charAt(0) || '?');

/** שורות טבלת החודש: עובד לכל שורה, רק מי שיש לו משמרות (כמו processedAttendance הישן) */
export function monthRows(employees) {
  return (employees || [])
    .map((e) => ({ id: e.id, name: e.name || fullName(e), firstName: e.firstName, lastName: e.lastName, dept: e.dept || '', shifts: e.shifts || [], ...aggregate(e.shifts) }))
    .filter((r) => r.shiftCount > 0);
}

/** חודשים של עובד (מהחדש לישן), רק חודשים שיש בהם משמרות - מתוך רשימת משמרות שטוחה */
export function monthsFromShifts(shifts) {
  const by = new Map();
  for (const s of shifts || []) {
    if (!s || s.isDeleted || !s.dayKey) continue;
    const k = s.dayKey.slice(0, 7);
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(s);
  }
  return [...by.keys()].sort().reverse().map((k) => {
    const [y, mm] = k.split('-').map(Number);
    return { y, m: mm - 1, key: k, ...aggregate(by.get(k)) };
  });
}

// ---------- מיון (טבלת החודש) ----------
export const SORT_KEYS = ['name', 'minutes', 'days', 'issues', 'pay', 'travels'];
export function sortRows(rows, sort) {
  if (!sort || !sort.key || !SORT_KEYS.includes(sort.key)) return rows;
  const dir = sort.dir === -1 || sort.dir === 'desc' ? -1 : 1;
  const val = (r) => (sort.key === 'travels' ? (r.travels ? 1 : 0) : r[sort.key]);
  return [...rows].sort((a, b) => {
    const x = val(a);
    const y = val(b);
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), 'he');
    return c * dir;
  });
}

// ---------- עימוד (AT-14) ----------
export function paginate(list, page, size = BYEMP_PAGE_SIZE) {
  const total = (list || []).length;
  const pages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(1, Number(page) || 1), pages);
  return { items: (list || []).slice((p - 1) * size, p * size), page: p, pages, total };
}

// ---------- "נערך ידנית" (AT-12) מתוך ההיסטוריה ----------
// Shift מוחרג מתוסף היומן האוטומטי; כל שורת AuditLog של משמרת נכתבה ידנית מנתיבי העריכה (הוספה / עריכה / מחיקה / שחזור)
// ב-app/api/employees/[id]/shifts. שעון הנוכחות (/api/attendance) לא כותב היסטוריה - לכן שורת היסטוריה = נגיעה ידנית.
export function actionKind(log) {
  const a = String(log && log.action || '').toUpperCase();
  if (a === 'CREATE') return 'added';
  if (a === 'DELETE') return 'deleted';
  if (a === 'UPDATE') {
    const ch = parseChanges(log);
    if (ch && ch.isDeleted && ch.isDeleted.to === false && ch.isDeleted.from === true) return 'restored';
    return 'edited';
  }
  return 'edited';
}
export const ACTION_LABEL = { added: 'נוספה משמרת', edited: 'נערכה משמרת', deleted: 'נמחקה משמרת', restored: 'שוחזרה משמרת' };

export function parseChanges(log) {
  if (!log || !log.changesJson) return null;
  if (typeof log.changesJson === 'object') return log.changesJson;
  try { return JSON.parse(log.changesJson); } catch { return null; }
}

/** האם אפשר לסמוך על AuditLog.employeeId כ"מי ערך" (ר' SHIFT_AUDIT_ACTOR_SINCE) */
export function actorReliable(log, since = SHIFT_AUDIT_ACTOR_SINCE) {
  const at = toDate(log && log.createdAt);
  return !!at && at.getTime() >= new Date(since).getTime();
}

/** shiftId -> { kind:'added'|'edited', at, by } לפי השורה האחרונה בהיסטוריה (names: מזהה -> שם) */
export function editInfoByShift(logs, names = {}) {
  const out = {};
  const sorted = [...(logs || [])].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  for (const l of sorted) {
    const prev = out[l.entityId];
    // "נוסף ידנית" רק כשכל ההיסטוריה של המשמרת היא ההוספה; כל עריכה / מחיקה / שחזור = "נערך"
    const onlyAdded = (!prev || prev.kind === 'added') && actionKind(l) === 'added';
    out[l.entityId] = {
      kind: onlyAdded ? 'added' : 'edited',
      at: toDate(l.createdAt).toISOString(),
      by: actorReliable(l) && l.employeeId ? (names[l.employeeId] || null) : null,
    };
  }
  return out;
}

const WAGE_FIELDS = ['totalCalculated', 'hourlyWageSnapshot', 'travelExpensesSnapshot'];
const SHOW_WAGE_CHANGES = false; // שינויי שכר / תשלום בחלון ההיסטוריה (להנהלה בלבד גם כשדלוק) - כבוי, כמו בעיצוב
const TIME_FIELDS = ['entryTime', 'exitTime'];
/** שורת היסטוריה לתצוגה: לפני/אחרי של כניסה, יציאה, דקות, הערות, תאריך (+ שכר להנהלה בלבד) */
export function shapeHistory(log, { wages, names = {}, shiftDayKey = null } = {}) {
  const ch = parseChanges(log) || {};
  const kind = actionKind(log);
  const fromTo = (k) => {
    const v = ch[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && ('from' in v || 'to' in v)) return { from: v.from ?? null, to: v.to ?? null };
    if (kind === 'added' && k in ch) return { from: null, to: ch[k] };
    return null;
  };
  const fmt = (k, v) => {
    if (v === null || v === undefined || v === '') return null;
    if (TIME_FIELDS.includes(k)) return israelTime(v);
    if (k === 'date') return israelDayKey(v);
    if (k === 'totalMinutes') return hm(v);
    if (WAGE_FIELDS.includes(k)) return money(v);
    return String(v);
  };
  const changes = [];
  // כמו בעיצוב: כניסה / יציאה (וגם תאריך והערות כשהשתנו). הדקות והתשלום נגזרים מהן בשרת ולכן לא מוצגים כשינוי נפרד.
  for (const k of ['date', 'entryTime', 'exitTime', 'notes', ...(wages && SHOW_WAGE_CHANGES ? WAGE_FIELDS : [])]) {
    const ft = fromTo(k);
    if (!ft) continue;
    const a = fmt(k, ft.from);
    const b = fmt(k, ft.to);
    if (a === b) continue;
    changes.push({ field: k, from: a, to: b });
  }
  const dayFromChanges = ch.date ? israelDayKey(ch.date.to || ch.date.from || ch.date) : null;
  return {
    id: log.id,
    at: toDate(log.createdAt).toISOString(),
    kind,
    label: ACTION_LABEL[kind],
    shiftId: log.entityId,
    dayKey: shiftDayKey || dayFromChanges || null,
    by: actorReliable(log) && log.employeeId ? (names[log.employeeId] || null) : null,
    changes,
  };
}
export const FIELD_LABEL = { date: 'תאריך', entryTime: 'כניסה', exitTime: 'יציאה', totalMinutes: 'שעות', notes: 'הערות', totalCalculated: 'לתשלום', hourlyWageSnapshot: 'שכר שעה', travelExpensesSnapshot: 'נסיעות' };
