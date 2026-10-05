// מיקוד "התראות" בחיפוש המתקדם של דף הבית (החלטת הבעלים HM-04 = א, F23): רשימת הזמנות והחזרות עם דגל שדורש טיפול.
// כאן הלוגיקה הטהורה (בלי DB): פרסור הפרמטרים, סיווג הזמנה "בחוץ" (איחור / שמלה שלא חזרה), מיזוג הסיבות לשורה אחת
// למי שמופיעה ביותר מסוג אחד, מיון, ובניית השורות. השאילתות עצמן ב-app/api/a5/adv-alerts/route.js.
//
// כל סוג = כלל שכבר קיים באתר, בלי כלל חדש:
//   ar_late     איחור בהחזרה       = getLateReturnInfo (lib/lateReturn.js), בדיוק כמו /api/orders/overdue וחלונית האיחורים
//   ar_unret    שמלה שלא חזרה      = כמו /api/orders/rented-past-event (דיווח 7dad77c4): פריט שנלקח ולא הוחזר והאירוע כבר עבר, עדיין לפני סף האיחור
//   ar_debt     חוב פתוח           = אותו כלל חוב כמו רשימת ההזמנות / adv-b "כספים" (שולם < סכום), רק להזמנות שהאירוע שלהן כבר עבר
//   ar_missing  פרטי לקוח חסרים    = lib/customerMissing.js (אותו כלל כמו הסטטוס "התראה" בהזמנות), רק להזמנות שהאירוע שלהן עוד לפנינו
//   ar_unsaved  שינויים שלא נשמרו  = טיוטות כרטיס הזמנה ב-localStorage (הדפדפן שולח את המספרים; אין מקור בשרת), כמו "לא נשמר" בהזמנות
// "ציפוף" (חלק מהסטטוס "התראה" בהזמנות) לא נכלל: זו תכונה של ההזמנה, לא תקלה שדורשת טיפול. טיוטות שרת (status 'טיוטה') לא נכללות:
// בגמ"ח עם draft_orders_show_as_deleted (ברירת מחדל) הן מוצגות במכוון כ"מחוק".

import { getLateReturnInfo } from './lateReturn';
import { getIsraelDateKey, getIsraelDayRange, getHebrewDateString } from './hebrewDate';

export const ALERT_FLAGS = ['ar_late', 'ar_unret', 'ar_debt', 'ar_missing', 'ar_unsaved'];
// תקרות (כל שאילתה חסומה; חריגה = truncated בתשובה)
export const ALERT_LIMITS = {
  ROWS: 200, // שורות בתשובה (כמו adv / adv-b)
  OUT_SCAN: 1000, // מועמדות "בחוץ" (איחור / לא חזר): חלון הישנים ביותר (האיחורים החמורים) + חלון החדשים ביותר (לא חזרו) כשיש יותר מהתקרה
  DEBT_IDS: 2000, // מועמדות חוב מה-SQL (מזהה + סכומים בלבד)
  DEBT_ROWS: 300, // הזמנות חוב שנטענות במלואן
  MISSING_SCAN: 300,
  UNSAVED_IDS: 500, // כמו unsavedOrderIds בצד הלקוח
  UNSAVED_ROWS: 200,
  DEBT_LOOKBACK_DAYS: 365,
};
export const ALERT_COLS = ['שם', 'הזמנה', 'תאריך אירוע', 'התראה', 'טלפון'];
// סדר עדיפות (הראשון קובע את צבע הצ'יפ, את התג ואת מקום השורה)
export const ALERT_RANK = { ar_late: 0, ar_unret: 1, ar_debt: 2, ar_missing: 3, ar_unsaved: 4 };
export const ALERT_CHIP_CLASS = { ar_late: 'red', ar_unret: 'amber', ar_debt: 'gold', ar_missing: 'rose', ar_unsaved: 'blue' };
const RETURN_FLAGS = new Set(['ar_late', 'ar_unret']);

const str = (v) => (v == null ? '' : String(v).trim());
const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');

// הסוגים שנבחרו: רק ערכים מוכרים, בלי כפילויות; ריק = כולם
export function parseAlertFlags(raw) {
  const picked = str(raw).split(',').map((x) => x.trim()).filter((x) => ALERT_FLAGS.includes(x));
  return [...new Set(picked)];
}

// מספרי הזמנה מטיוטות הדפדפן: מספרים שלמים חיוביים בלבד, בלי כפילויות, עד UNSAVED_IDS
export function parseUnsavedIds(raw) {
  const out = [];
  const seen = new Set();
  for (const part of str(raw).split(',')) {
    const t = part.trim();
    if (!/^\d{1,9}$/.test(t)) continue;
    const n = parseInt(t, 10);
    if (n < 1 || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= ALERT_LIMITS.UNSAVED_IDS) break;
  }
  return out;
}

/* ---------- תאריך אירוע / סינון הזמנה (כמו commonOrderWhere + eventDateCond ב-adv-b, בלי עובד מבצע) ---------- */
export function eventDateWhere(p) {
  const from = isIso(p.from) ? p.from : '';
  const to = isIso(p.to) ? p.to : '';
  if (from && to) return { gte: getIsraelDayRange(from).start, lte: getIsraelDayRange(to).end };
  if (from) return { gte: getIsraelDayRange(from).start, lte: getIsraelDayRange(from).end }; // תאריך בודד = אותו יום
  if (to) return { lte: getIsraelDayRange(to).end };
  return null;
}

// תנאי Prisma משותפים לכל השאילתות: לא מחוק, לא טיוטת שרת, + קוד הזמנה / תאריך אירוע / שם / פרטי לקוח.
export function orderFilterAnd(p, draftStatus) {
  const AND = [{ isDeleted: false }, { OR: [{ status: null }, { status: { not: draftStatus } }] }];
  const oid = str(p.oid);
  if (oid) AND.push(/^\d{1,9}$/.test(oid) ? { orderId: parseInt(oid, 10) } : { orderId: -1 });
  const ev = eventDateWhere(p);
  if (ev) AND.push({ eventDate: ev });
  for (const tok of str(p.name).split(/\s+/).filter(Boolean).slice(0, 5)) {
    AND.push({ customer: { OR: [{ firstName: { contains: tok, mode: 'insensitive' } }, { lastName: { contains: tok, mode: 'insensitive' } }] } });
  }
  const ci = str(p.cinfo).slice(0, 60);
  if (ci) AND.push({ customer: { OR: ['email', 'phone1', 'phone2', 'city', 'street'].map((k) => ({ [k]: { contains: ci, mode: 'insensitive' } })) } });
  return AND;
}

/* ---------- סיווג הזמנה "בחוץ" (יש פריט שנלקח ולא הוחזר) ---------- */
// ctx: { threshold, nonWorkingDays, now }. מחזיר { flag: 'ar_late', daysLate } | { flag: 'ar_unret', daysSinceEvent } | null
export function classifyOutOrder(o, ctx) {
  const active = (o.items || []).filter((i) => !i.isDeleted);
  if (!active.some((i) => i.isTaken && !i.isReturned)) return null;
  const now = ctx.now || new Date();
  const late = getLateReturnInfo(o, ctx.threshold, { now, nonWorkingDays: ctx.nonWorkingDays });
  if (late.isLate) return { flag: 'ar_late', daysLate: late.daysLate };
  const todayKey = getIsraelDateKey(now);
  const eventKey = o.eventDate ? getIsraelDateKey(o.eventDate) : null;
  if (!eventKey || eventKey >= todayKey) return null; // האירוע עוד לא עבר (כמו rented-past-event: eventDate <= אתמול)
  const explicit = o.toDate || o.returnDate;
  if (explicit) {
    const k = getIsraelDateKey(explicit);
    if (!k || k >= todayKey) return null; // תאריך החזרה מפורש שעוד לא הגיע (אירוע רב-יומי / חו"ל): עוד לא "צריכה להיות בחזרה"
  }
  const days = Math.round((Date.parse(todayKey + 'T00:00:00Z') - Date.parse(eventKey + 'T00:00:00Z')) / 86400000);
  return { flag: 'ar_unret', daysSinceEvent: days };
}

/* ---------- עיצוב ---------- */
const money = (n) => '₪' + Number(Math.abs(n).toFixed(2)).toLocaleString('he-IL');
const fullName = (c) => [c?.firstName, c?.lastName].filter(Boolean).join(' ').trim();
const fullNameRev = (c) => [c?.lastName, c?.firstName].filter(Boolean).join(' ').trim();
function fmtPhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length === 9) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return String(p || '').trim();
}
// השנה היא האסימון האחרון (מתחיל ב-ת/הת); כמו hebNoYear ב-adv-b
function stripYear(raw) {
  const parts = raw.trim().split(/\s+/);
  if (parts.length >= 3 && /^ה?ת/.test(parts[parts.length - 1])) parts.pop();
  return parts.join(' ');
}
export function hebNoYear(order) {
  const raw = order.eventDateHebrew || (order.eventDate ? getHebrewDateString(order.eventDate) : '');
  return raw ? stripYear(raw) : '';
}

export function reasonLabel(r) {
  switch (r.flag) {
    case 'ar_late': return `איחור בהחזרה (${r.daysLate} ${r.daysLate === 1 ? 'יום' : 'ימים'})`;
    case 'ar_unret': return 'שמלה שלא חזרה';
    case 'ar_debt': return `חוב פתוח ${money(r.amount)}`;
    case 'ar_missing': return 'פרטי לקוח חסרים';
    case 'ar_unsaved': return 'שינויים שלא נשמרו';
    default: return '';
  }
}

// מפתח הספירה בתשובה לכל סוג התראה (תואם ל-ALERT_FLAGS)
export const ALERT_COUNT_KEY = { ar_late: 'late', ar_unret: 'notReturned', ar_debt: 'debt', ar_missing: 'missing', ar_unsaved: 'unsaved' };

const entryRank = (e) => Math.min(...e.reasons.map((r) => ALERT_RANK[r.flag]));
const entryFlag = (e) => e.reasons.reduce((a, r) => (ALERT_RANK[r.flag] < ALERT_RANK[a.flag] ? r : a)).flag;
const lateDays = (e) => {
  const r = e.reasons.find((x) => x.flag === 'ar_late');
  return r && Number.isFinite(r.daysLate) ? r.daysLate : 0;
};
// מיון: עדיפות; באיחורים הכי מאחרת קודם (daysLate יורד); בשאר הסוגים האירוע הישן קודם.
export function sortAlertEntries(entries) {
  const evMs = (e) => (e.order.eventDate ? new Date(e.order.eventDate).getTime() : Infinity);
  return entries.slice().sort((a, b) => {
    const ra = entryRank(a);
    const rb = entryRank(b);
    if (ra !== rb) return ra - rb;
    if (ra === ALERT_RANK.ar_late) {
      const d = lateDays(b) - lateDays(a);
      if (d) return d;
    }
    return evMs(a) - evMs(b) || a.order.orderId - b.order.orderId;
  });
}

// ספירה לפי סוג (הזמנה עם כמה סיבות נספרת בכל אחת מהן): { late, notReturned, debt, missing, unsaved }
export function countAlertTypes(entries) {
  const out = { late: 0, notReturned: 0, debt: 0, missing: 0, unsaved: 0 };
  for (const e of entries) for (const f of new Set(e.reasons.map((r) => r.flag))) out[ALERT_COUNT_KEY[f]]++;
  return out;
}

// תקרת שורות הוגנת: כל סוג (לפי הסיבה הראשית של השורה) מקבל מנה שווה מתוך התקרה, ומה שסוג קטן לא מנצל עובר לסוגים הגדולים.
// סוג אחד בלבד = כל התקרה לו. הסדר בתוצאה נשאר כמו ב-sortAlertEntries. מחזיר { kept, capped }.
export function capAlertEntries(entries, cap = ALERT_LIMITS.ROWS) {
  const sorted = sortAlertEntries(entries);
  if (sorted.length <= cap) return { kept: sorted, capped: false };
  const buckets = new Map();
  for (const e of sorted) { const f = entryFlag(e); buckets.set(f, (buckets.get(f) || 0) + 1); }
  const quota = new Map();
  let left = cap;
  let pending = [...buckets.entries()].sort((a, b) => a[1] - b[1]);
  while (pending.length) {
    const share = Math.floor(left / pending.length);
    const [f, n] = pending[0];
    if (n <= share) { quota.set(f, n); left -= n; pending = pending.slice(1); continue; }
    // כל הנותרים גדולים מהמנה: מחלקים את השאר שווה (השארית לראשונים בסדר העדיפות)
    const rest = pending.map(([k]) => k).sort((a, b) => ALERT_RANK[a] - ALERT_RANK[b]);
    const base = Math.floor(left / rest.length);
    let extra = left - base * rest.length;
    for (const k of rest) { quota.set(k, base + (extra-- > 0 ? 1 : 0)); }
    break;
  }
  const used = new Map();
  const kept = sorted.filter((e) => {
    const f = entryFlag(e);
    const u = used.get(f) || 0;
    if (u >= (quota.get(f) || 0)) return false;
    used.set(f, u + 1);
    return true;
  });
  return { kept, capped: true };
}

// entries: [{ order, reasons: [{ flag, ...פרטים }] }] (כבר ממוזגות לפי הזמנה). מיון: ר' sortAlertEntries.
export function buildAlertRows(entries) {
  const sorted = sortAlertEntries(entries);
  return sorted.map((e) => {
    const reasons = e.reasons.slice().sort((a, b) => ALERT_RANK[a.flag] - ALERT_RANK[b.flag]);
    const o = e.order;
    return {
      link: `/orders/${o.orderId}`,
      cells: [fullName(o.customer), `הזמנה ${o.orderId}`, hebNoYear(o), [reasons.map(reasonLabel).join(' · '), ALERT_CHIP_CLASS[reasons[0].flag]], fmtPhone(o.customer?.phone1 || o.customer?.phone2)],
      nameRev: fullNameRev(o.customer),
      tag: RETURN_FLAGS.has(reasons[0].flag) ? 'return' : 'order',
    };
  });
}

// ממזג רשימת סיבות לפי הזמנה: [{ order, reason }] -> [{ order, reasons }]
export function mergeReasons(list) {
  const by = new Map();
  for (const { order, reason } of list) {
    const cur = by.get(order.orderId) || { order, reasons: [] };
    if (!cur.reasons.some((r) => r.flag === reason.flag)) cur.reasons.push(reason);
    by.set(order.orderId, cur);
  }
  return [...by.values()];
}
