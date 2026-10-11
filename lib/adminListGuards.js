// lib/adminListGuards.js - רשת הביטחון של העלות לרשימות הניהול (הזמנות / לקוחות). מודול טהור (בלי prisma / alias) - נבדק ב-scripts/test_a5_orders_customers_lists.mjs.
//
// הרקע: ב-PROD יש 27k+ הזמנות ו-Neon / Vercel עם מכסות CPU שכבר נשרפו בעבר על סריקות כבדות. לכן כל בקשה לרשימות הניהול חסומה בארבע דרכים:
//  1. גבולות קלט קשיחים: גודל עמוד עד 100 (ייצוא: 500 לעמוד, ראו EXPORT_*), היסט עד MAX_OFFSET - אחרת 400, בלי "שלוף הכול".
//  2. תקציב זמן: כל שאילתה רצה בטרנזקציה עם SET LOCAL statement_timeout (lib/adminListDb.js); חריגה = BudgetError 503 "צמצמו את הסינון", לא תלייה.
//  3. מגבלת מקביליות (createLimiter): לכל היותר N בקשות כבדות במקביל לאינסטנס; מעבר לכך 503 "העמוס כרגע" במקום תור שמחזיק חיבורי DB.
//  4. מטמון קצר בזיכרון (createTtlCache) לספירות ולצבירות, עם איחוד בקשות זהות שרצות במקביל (in-flight) - כמו lib/settingsCache.js.

export const MAX_LIST_LIMIT = 100; // שורות לעמוד בבקשת רשימה רגילה
export const DEFAULT_LIMIT = 50;
export const EXPORT_PAGE_LIMIT = 500; // עמוד ייצוא (export:true) - מותר רק לבקשת ייצוא, בלי items בשורות
export const MAX_EXPORT_ROWS = 5000; // תקרת שורות ייצוא מהרשימה (הלקוח: EXPORT_MAX; עוצר שם ומודיע)
export const MAX_OFFSET = 100000; // page * limit מעבר לזה = בקשה לא סבירה (400)
export const STATEMENT_TIMEOUT_MS = 8000; // תקציב לשאילתה בודדת (SET LOCAL statement_timeout)
export const REQUEST_BUDGET_MS = 20000; // תקציב לבקשה כולה (כמה שאילתות בסדרה)
export const MAX_CONCURRENT = 4; // בקשות כבדות במקביל לאינסטנס
export const COUNTS_TTL_MS = 60 * 1000;
export const AGG_TTL_MS = 60 * 1000; // צבירות גלובליות (חוב / פעילות)
export const CACHE_MAX_ENTRIES = 300;

export const MSG_NARROWER = 'הבקשה כבדה מדי - צמצמו את הסינון או את החיפוש ונסו שוב';
export const MSG_BUSY = 'השרת עמוס כרגע בבקשות כבדות - נסו שוב בעוד רגע';
export const MSG_BAD_PAGE = 'מספר העמוד מחוץ לטווח';

export class BudgetError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'BudgetError';
    this.kind = kind; // 'timeout' | 'busy' | 'deadline'
    this.status = 503;
  }
}
export class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BadRequestError';
    this.status = 400;
  }
}

/** האם השגיאה היא חריגת statement_timeout של Postgres (קוד 57014, או הודעת "canceling statement due to statement timeout"; Prisma עוטף כ-P2010 / P1008). */
export function isStatementTimeout(err) {
  if (!err) return false;
  const msg = String(err.message || err);
  if (/statement timeout|canceling statement|57014|Transaction already closed|expired transaction|timed out/i.test(msg)) return true;
  const meta = err.meta && (err.meta.code || err.meta.message);
  return !!(meta && /57014|statement timeout/i.test(String(meta)));
}

/** משפט ה-SQL של התקציב לטרנזקציה (ms מספר שלם בטווח - לעולם לא קלט משתמש). */
export function statementTimeoutSql(ms = STATEMENT_TIMEOUT_MS) {
  const n = Math.max(500, Math.min(60000, Math.floor(Number(ms) || STATEMENT_TIMEOUT_MS)));
  return `SET LOCAL statement_timeout = ${n}`;
}

/** תשובת השגיאה לנתיב: { status, body } לשגיאה מוכרת, או null (שגיאה לא צפויה -> 500 רגיל). */
export function errorResponse(err) {
  if (err instanceof BadRequestError) return { status: 400, body: { error: err.message, code: 'bad_request' } };
  if (err instanceof BudgetError) return { status: 503, body: { error: err.kind === 'busy' ? MSG_BUSY : MSG_NARROWER, code: err.kind } };
  if (isStatementTimeout(err)) return { status: 503, body: { error: MSG_NARROWER, code: 'timeout' } };
  return null;
}

/**
 * בדיקות קלט שאחרי הניקוי: מחזיר הודעת שגיאה (400) או ''.
 * params = תוצאת parse*ListParams (page, limit, export).
 */
export function validatePaging(params) {
  const limit = params.export ? EXPORT_PAGE_LIMIT : MAX_LIST_LIMIT;
  if (params.limit > limit) return `limit מעל ${limit}`;
  if ((params.page - 1) * params.limit > MAX_OFFSET) return MSG_BAD_PAGE;
  return '';
}

/** מגבלת מקביליות: run(fn) מריץ אם יש מקום, אחרת זורק BudgetError('busy'). משחרר תמיד (גם בשגיאה). */
export function createLimiter(max = MAX_CONCURRENT) {
  let active = 0;
  return {
    get active() { return active; },
    async run(fn) {
      if (active >= max) throw new BudgetError('busy', MSG_BUSY);
      active++;
      try { return await fn(); } finally { active--; }
    },
  };
}

/** תקציב לבקשה כולה: check() זורק BudgetError('deadline') אחרי שחלף הזמן (נקרא בין שלבים). now מוזרק לבדיקות. */
export function createDeadline(ms = REQUEST_BUDGET_MS, now = () => Date.now()) {
  const end = now() + ms;
  return { check() { if (now() > end) throw new BudgetError('deadline', MSG_NARROWER); }, remaining: () => Math.max(0, end - now()) };
}

/**
 * מטמון TTL בזיכרון עם איחוד בקשות במקביל: get(key, loader) מחזיר ערך טרי, או את ההבטחה שכבר רצה, או מריץ loader.
 * שגיאות לא נמטמנות. מוגבל ל-max רשומות (הישנה ביותר יוצאת). now מוזרק לבדיקות.
 */
export function createTtlCache({ ttl = COUNTS_TTL_MS, max = CACHE_MAX_ENTRIES, now = () => Date.now() } = {}) {
  const map = new Map(); // key -> { value, expiresAt, promise }
  const evict = () => { while (map.size > max) map.delete(map.keys().next().value); };
  return {
    get size() { return map.size; },
    clear() { map.clear(); },
    async get(key, loader) {
      const hit = map.get(key);
      if (hit && hit.promise) return hit.promise;
      if (hit && hit.expiresAt > now()) return hit.value;
      const promise = Promise.resolve().then(loader);
      map.delete(key);
      map.set(key, { promise, expiresAt: 0 });
      evict();
      try {
        const value = await promise;
        map.delete(key);
        map.set(key, { value, expiresAt: now() + ttl });
        evict();
        return value;
      } catch (e) {
        map.delete(key);
        throw e;
      }
    },
  };
}

/** מפתח מטמון יציב לפרמטרים בלי קבוצות מסוימות ובלי עימוד / מיון (הספירות של קבוצה לא תלויות בבחירה שבה). */
export function paramsKey(params, omit = []) {
  const skip = new Set(['page', 'limit', 'sort', 'dir', 'counts', 'export', ...omit]);
  return JSON.stringify(Object.keys(params).filter((k) => !skip.has(k)).sort().map((k) => [k, params[k]]));
}
