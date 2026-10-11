// lib/adminVisitList.js - הלוגיקה הטהורה של "היסטוריית שאילתות ו-API" (/management/history, API: /api/admin/management-history): יומן הגלישה והשאילתות (PageVisitLog).
// בלי prisma ובלי alias: נקרא גם מ-node רגיל (scripts/test_a5_history_lists.mjs) וגם מהלקוח.
//
// מה כאן: ניקוי קלט, בניית ה-WHERE ב-SQL עם פרמטרים (סוג: שאילתות API / ביקורי מסכים, עובד / אורח, תקין / שגיאה, תקופה, חיפוש), המיונים המותרים,
// ושם המסך בעברית לפי הנתיב (formatPageName של הדף הישן).
// חיפוש: נתיב / שגיאה / שם העובד, ובגוף הבקשה - אבל לא בגופים שעלולים להכיל סודות (אחרת החיפוש משמש אורקל לניחוש סיסמאות / PIN / ת"ז) - אותה הגנה כמו ב-/api/history.
import {
  COUNT_CAP, MAX_ID_LIST, SqlArgs, cleanSearch, csv, dateKey, likePattern, parsePaging, periodSql, pickKnown,
} from './adminLogList.js';

export { COUNT_CAP };
export const VISIT_SORT_KEYS = Object.freeze(['time', 'employee', 'path', 'size', 'duration', 'status']);
export const VISIT_TYPE_KEYS = Object.freeze(['api', 'pages']);
export const VISIT_STATUS_KEYS = Object.freeze(['error', 'ok']);
export const OLD_RECORDS_DAYS = 90; // "מחק ישן מ-90 יום" (כמו הדף הישן)
export const LARGE_LOG_WARNING = 10000; // התראה כשיש יותר מזה (כמו הדף הישן)
const ID_RE = /^[0-9a-zA-Z-]{8,40}$/;

// מילים שמעידות על סוד בגוף בקשה - אותה רשימה כמו app/api/history/route.js (חיפוש בגוף בקשה אסור כשהן מופיעות)
export const SECRET_BODY_WORDS = Object.freeze(['assword', '"pin', 'authPin', 'secret', 'token', 'zeout', 'idNumber', 'iban', 'bank', 'card', 'base64']);
export const SECRET_BODY_PATHS = Object.freeze(['/api/login', '/api/auth/', '/api/attendance']);

export function parseVisitListParams(input) {
  const p = input && typeof input === 'object' ? input : {};
  return {
    ...parsePaging(p),
    search: cleanSearch(p.search),
    sort: VISIT_SORT_KEYS.includes(p.sort) ? p.sort : 'time',
    dir: p.dir === 'asc' ? 'asc' : 'desc',
    types: pickKnown(p.types, VISIT_TYPE_KEYS),
    status: pickKnown(p.status, VISIT_STATUS_KEYS),
    employees: [...new Set(csv(p.employees).filter((x) => x === 'guest' || ID_RE.test(x)))].slice(0, MAX_ID_LIST),
    period: pickKnown(p.period, ['today', 'd7', 'd30', 'year', 'custom']),
    from: dateKey(p.from),
    to: dateKey(p.to),
    variant: 0,
  };
}

// ביטוי Postgres קבוע (ARE, case-insensitive ב-!~*): פרמטר query בשם סודי או מפתח gmk_ בכתובת
export const URL_SECRET_RE_SQL = `'([?&][^=&]*(token|secret|pass|pwd|otp|apikey|credential|authorization|bearer)[^=&]*=|gmk_)'`;

export const IS_ERROR_SQL = `(v."loadingError" IS NOT NULL AND v."loadingError" <> '')`;

/** ה-WHERE של הרשימה / הספירות; skip = קבוצה שמדלגים עליה ('types'|'status'|'employees'|'period'). ctx = { todayKey, dayRange }. */
export function buildVisitWhere(params, ctx, skip = '') {
  const a = new SqlArgs();
  const conds = [];
  if (skip !== 'types' && params.types.length === 1) conds.push(params.types[0] === 'api' ? `v."pageUrl" LIKE '%/api/%'` : `v."pageUrl" NOT LIKE '%/api/%'`);
  if (skip !== 'status' && params.status.length === 1) conds.push(params.status[0] === 'error' ? IS_ERROR_SQL : `NOT ${IS_ERROR_SQL}`);
  if (skip !== 'employees' && params.employees.length) {
    const ids = params.employees.filter((x) => x !== 'guest');
    const parts = [];
    if (ids.length) parts.push(`v."employeeId" = ANY(${a.p(ids)}::text[])`);
    if (params.employees.includes('guest')) parts.push('v."isGuest" = true');
    conds.push(`(${parts.join(' OR ')})`);
  }
  if (skip !== 'period' && params.period.length) {
    const c = periodSql('v."timestamp"', params.period, params.from, params.to, ctx.todayKey, ctx.dayRange, a);
    if (c) conds.push(c);
  }
  if (params.search) {
    const like = a.p(likePattern(params.search));
    const esc = ` ESCAPE '\\'`;
    const body = [
      `v."requestQuery" ILIKE ${like}${esc}`,
      ...SECRET_BODY_PATHS.map((x) => `v."pageUrl" NOT LIKE '%${x}%'`),
      ...SECRET_BODY_WORDS.map((w) => `v."requestQuery" NOT ILIKE '%${w}%'`),
    ];
    // כתובת עם פרמטר סודי (token / secret / pass...) לא נחפשת: pageUrl נשמר גולמי (כולל query string) והחיפוש בו היה אורקל לערך הפרמטר (ממצא F11, 11.10.2026)
    conds.push(`((v."pageUrl" ILIKE ${like}${esc} AND v."pageUrl" !~* ${URL_SECRET_RE_SQL}) OR v."employeeName" ILIKE ${like}${esc} OR v."loadingError" ILIKE ${like}${esc} OR (${body.join(' AND ')}))`);
  }
  return { where: conds.length ? `WHERE ${conds.join(' AND ')}` : '', args: a.args };
}

export function visitOrderBy(sort, dir) {
  const d = dir === 'asc' ? 'ASC' : 'DESC';
  const tie = 'v."timestamp" DESC, v.id DESC';
  switch (sort) {
    case 'employee': return `v."employeeName" ${d} NULLS LAST, ${tie}`;
    case 'path': return `v."pageUrl" ${d}, ${tie}`;
    case 'size': return `v."responseSize" ${d} NULLS LAST, ${tie}`;
    case 'duration': return `v."executionTime" ${d} NULLS LAST, ${tie}`;
    case 'status': return `${IS_ERROR_SQL} ${d}, ${tie}`;
    default: return `v."timestamp" ${d}, v.id ${d}`;
  }
}

/* ------------------------------ שורה: נתיב -> שם מסך ------------------------------ */

export const isApiPath = (url) => String(url || '').includes('/api/');

/** שם המסך בעברית לפי הנתיב (formatPageName של הדף הישן); API = "שאילתת שרת". נתיב לא מוכר = הנתיב עצמו. */
export function screenName(url) {
  const u = String(url || '');
  if (!u) return '';
  if (u.startsWith('/api')) return 'שאילתת שרת (API)';
  if (u === '/' || u === '/desktop') return 'דלפק';
  if (u.startsWith('/management/history')) return 'היסטוריית מערכת';
  if (u.startsWith('/management')) return 'ניהול';
  if (u.startsWith('/customers')) return 'לקוחות';
  if (u.startsWith('/orders')) return 'הזמנות';
  if (u.startsWith('/rentals')) return 'השכרות';
  if (u.startsWith('/admin')) return 'הגדרות מתקדמות';
  if (u.startsWith('/employees') || u.startsWith('/punch-clock')) return 'שעון נוכחות / עובדים';
  if (u.startsWith('/dashboard')) return 'ניהול מלאי ודגמים';
  return u;
}

/** הנתיב בלי מחרוזת השאילתה (לשורה הראשונה); המלא נשאר בפירוט. */
export function pathOnly(url) {
  const u = String(url || '');
  const i = u.indexOf('?');
  return i < 0 ? u : u.slice(0, i);
}

/** נפח בבתים -> "123 KB" (הדף הישן: MB / KB / B). */
export function formatSize(bytes) {
  if (bytes === null || bytes === undefined || bytes === '') return '';
  const n = Number(bytes);
  if (!Number.isFinite(n)) return '';
  if (n >= 1048576) return `${(n / 1048576).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

/** חומרת הנפח (הדף הישן: מעל 1MB אדום, מעל 100KB כתום). */
export const sizeLevel = (bytes) => (bytes > 1048576 ? 'danger' : bytes > 102400 ? 'warn' : '');
