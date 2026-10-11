// lib/adminLogList.js - הבסיס המשותף (טהור) לשתי רשימות היומנים בניהול: "היסטוריית נתונים" (AuditLog, /admin/data-history) ו"היסטוריית שאילתות ו-API"
// (PageVisitLog, /management/history). בלי prisma ובלי alias: נקרא גם מ-node רגיל (scripts/test_a5_history_lists.mjs) וגם מהלקוח.
//
// מה כאן: ניקוי קלט (עימוד עד 100, מפתחות מוכרים בלבד), בונה SQL בפרמטרים (SqlArgs - לעולם לא משרשרים קלט משתמש), הימלטות LIKE,
// תקופות (מפתח -> טווח ימים בשעון ישראל -> גבולות instant), וקבועי העלות של טבלאות היומן הענקיות:
//  * אין COUNT(*) מלא: הסך הוא "ספירה חסומה" (עד COUNT_CAP + 1 שורות נסרקות); מעבר לתקרה מוצג "100,000+" והעימוד נעצר ב-MAX_OFFSET.
//  * ספירות האפשרויות בחלון הסינון נשלפות רק כשהחלון פתוח (lazy) ובאותה תקרה; כשהתקרה נפגעת, אפשרויות לא מוסתרות (אין "אפס" מדומה).
import { DEFAULT_LIMIT, EXPORT_PAGE_LIMIT, MAX_LIST_LIMIT, MAX_OFFSET } from './adminListGuards.js';

export const LOG_PAGE_SIZE = DEFAULT_LIMIT;
export const COUNT_CAP = 100000; // תקרת הספירה החסומה (שורות תואמות שנסרקות כדי לדעת "כמה")
export const MAX_ID_LIST = 60; // כמה עובדים / סוגים אפשר לסנן בבקשה אחת
export const SEARCH_MAX = 200;
export const PERIOD_KEYS = Object.freeze(['today', 'd7', 'd30', 'year', 'custom']);

export const clampInt = (v, def, min, max) => {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
};
export const csv = (v) => (Array.isArray(v) ? v : String(v == null ? '' : v).split(',')).map((x) => String(x).trim()).filter(Boolean);
export const pickKnown = (v, known) => [...new Set(csv(v).filter((x) => known.includes(x)))];
export const dateKey = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : '');
export const isFlag = (v) => v === true || v === '1' || v === 1 || v === 'true';
export const cleanSearch = (v) => (typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, SEARCH_MAX) : ''); // NUL: Postgres rejects it in a text parameter (was a 500)

/** עימוד מנורמל: עמוד 1.., גודל עד 100 (ייצוא עד 500). */
export function parsePaging(p) {
  const exp = isFlag(p.export);
  return {
    page: clampInt(p.page, 1, 1, 100000),
    export: exp,
    limit: clampInt(p.limit, LOG_PAGE_SIZE, 1, exp ? EXPORT_PAGE_LIMIT : MAX_LIST_LIMIT),
  };
}

/** בדיקת קלט אחרי הניקוי (כמו validatePaging ברשימות ההזמנות): עמוד רחוק מדי = הודעה (400), אחרת ''. */
export function pagingError(params) {
  const lim = params.export ? EXPORT_PAGE_LIMIT : MAX_LIST_LIMIT;
  if (params.limit > lim) return `limit מעל ${lim}`;
  if ((params.page - 1) * params.limit > MAX_OFFSET) return 'מספר העמוד מחוץ לטווח - צמצמו את הסינון';
  return '';
}

/** הימלטות ל-LIKE / ILIKE (\ % _) - הקלט מוצג כטקסט מילולי, לא כתבנית. */
export const likePattern = (q) => `%${String(q).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** צובר פרמטרים ל-SQL: p(value) מחזיר '$n'. */
export class SqlArgs {
  constructor() { this.args = []; }
  p(v) { this.args.push(v); return `$${this.args.length}`; }
}

/* ------------------------------------ תקופות ------------------------------------ */

const addDays = (key, n) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** מפתח תקופה -> טווח ימים { from, to } (YYYY-MM-DD, כולל; מחרוזת ריקה = פתוח); null = אין תקופה / טווח מותאם חסר. */
export function resolvePeriod(key, todayKey, from = '', to = '') {
  switch (key) {
    case 'today': return { from: todayKey, to: todayKey };
    case 'd7': return { from: addDays(todayKey, -6), to: todayKey };
    case 'd30': return { from: addDays(todayKey, -29), to: todayKey };
    case 'year': return { from: addDays(todayKey, -364), to: todayKey };
    case 'custom': return from || to ? { from: from || '', to: to || '' } : null;
    default: return null;
  }
}

/**
 * ימים -> גבולות instant: gte = תחילת היום הראשון (שעון ישראל), lt = תחילת היום שאחרי האחרון. dayRange(key) -> { start, end } (lib/hebrewDate getIsraelDayRange,
 * מוזרק כדי שהקובץ יישאר טהור). כל פרמטר פתוח = null.
 */
export function periodBounds(range, dayRange) {
  if (!range) return null;
  const gte = range.from ? dayRange(range.from).start : null;
  const lt = range.to ? new Date(dayRange(range.to).end.getTime() + 1) : null;
  return { gte, lt };
}

/**
 * תנאי SQL לעמודת זמן col לפי רשימת מפתחות תקופה (OR ביניהם). now = טווח ההיום (todayKey). מחזיר '' כשאין תקופה.
 */
export function periodSql(col, keys, from, to, todayKey, dayRange, a) {
  const parts = [];
  for (const k of keys) {
    const b = periodBounds(resolvePeriod(k, todayKey, from, to), dayRange);
    if (!b) continue;
    const c = [];
    if (b.gte) c.push(`${col} >= ${a.p(b.gte)}`);
    if (b.lt) c.push(`${col} < ${a.p(b.lt)}`);
    if (c.length) parts.push(`(${c.join(' AND ')})`);
  }
  return parts.length ? `(${parts.join(' OR ')})` : '';
}

/** "מוצג כ-100,000+" - האם הסך חסום. */
export function cappedTotal(scanned) {
  return { total: Math.min(scanned, COUNT_CAP), capped: scanned > COUNT_CAP };
}

/** תוספת למספר התוצאות כשהסך חסום ("+"). */
export const totalSuffix = (capped) => (capped ? '+' : '');

/** מפתח יציב לבקשת הספירות: הכול חוץ מעמוד / מיון / גודל עמוד. */
export function logCountsKey(query) {
  const { page, limit, sort, dir, export: ex, ...rest } = query;
  return JSON.stringify(Object.keys(rest).sort().map((k) => [k, rest[k]]));
}
