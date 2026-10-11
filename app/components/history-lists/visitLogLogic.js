// visitLogLogic.js - הלוגיקה הטהורה של מסך "היסטוריית שאילתות ו-API" (/management/history): מיפוי הבחירה בחלון "סינון" / מיון / חיפוש לפרמטרי ה-API,
// קבוצות הסינון מהספירות שבשרת, שורת הרשימה (זוגות אייקון + ערך - תקין / ריק לא מוצג), ומפרט "יומן שאילתות ו-API" להדפסה / PDF / Excel.
// בלי React ובלי alias: נבדקת ב-scripts/test_a5_history_lists.mjs. עיצוב תאריך / שעה מוזרק מהרכיב (fns).
import { OLD_RECORDS_DAYS, formatSize, pathOnly, sizeLevel } from '../../../lib/adminVisitList.js';
import { logCountsKey } from '../../../lib/adminLogList.js';
import { PAGE_SIZE, baseQuery, countOf, dynamicOptions, groupByDay, periodGroup } from './historyShared.js';

export { OLD_RECORDS_DAYS, formatSize, sizeLevel };

export const SORTS = [
  { k: 'time', l: 'זמן', i: 'clock' },
  { k: 'employee', l: 'עובד', i: 'user' },
  { k: 'path', l: 'נתיב / שאילתה', i: 'online' },
  { k: 'size', l: 'נפח נתונים', i: 'box' },
  { k: 'duration', l: 'משך', i: 'clock' },
  { k: 'status', l: 'תקלות', i: 'alert' },
];
export const DEFAULT_SORT = Object.freeze({ k: 'time', dir: -1 });
export const DEFAULT_TYPES = Object.freeze(['api']); // הדף הישן נפתח על "שאילתות API בלבד" (ביקשו במפורש)
export const SHEET_TITLE = 'יומן שאילתות ו-API';
export const GUEST_KEY = 'guest';
export const countsKey = logCountsKey;

const TYPE_OPTIONS = [
  { k: 'api', l: 'שאילתות API', i: 'online' },
  { k: 'pages', l: 'ביקורי מסכים', i: 'eye' },
];
const STATUS_OPTIONS = [
  { k: 'error', l: 'עם תקלה', i: 'alert' },
  { k: 'ok', l: 'תקין', i: 'check' },
];

export function buildVisitFilters(counts, { customLabel = 'טווח מותאם…', sel = {}, names = {} } = {}) {
  const emp = dynamicOptions(counts, 'employees', sel.employees, {
    labelOf: (k) => (k === GUEST_KEY ? 'אורחים' : (counts && counts.employeeNames && counts.employeeNames[k]) || names[k] || 'עובד'),
    iconOf: (k) => (k === GUEST_KEY ? 'users' : 'user'),
  });
  const groups = [
    { key: 'types', label: 'סוג', icon: 'online', def: DEFAULT_TYPES.slice(), options: TYPE_OPTIONS.map((o) => ({ ...o, count: countOf(counts, 'types', o.k) })) },
    { key: 'status', label: 'מצב', icon: 'alert', def: [], options: STATUS_OPTIONS.map((o) => ({ ...o, count: countOf(counts, 'status', o.k) })) },
  ];
  if (emp.length) groups.push({ key: 'employees', label: 'עובד', icon: 'user', def: [], options: emp });
  groups.push(periodGroup(counts, customLabel));
  return groups;
}

export function buildVisitQuery({ sel = {}, sort = DEFAULT_SORT, q = '', page = 1, limit = PAGE_SIZE, custom = null } = {}) {
  return baseQuery({ sel, sort, q, page, limit, custom, groups: [['types', 'types'], ['status', 'status'], ['employees', 'employees'], ['period', 'period']] });
}

/* ------------------------------ שורה ------------------------------ */

/** שורת הרשימה: הכותרת = שם המסך (ביקור) או נתיב ה-API; הנתיב המלא בפירוט. */
export function visitRow(d) {
  const title = d.api ? pathOnly(d.path) : (d.screen || pathOnly(d.path));
  return { ...d, title, icon: d.error ? 'alert' : d.api ? 'online' : 'eye', whoText: d.guest ? 'אורח' : d.who };
}

/** הזוגות של שורה 2: מתי, מי, נפח (כתום / אדום כשגדול), משך, תקלה. תקין / ריק לא מופיע. fns: { rel(iso), hm(iso) }. */
export function visitPairs(r, fns) {
  const out = [{ key: 'when', icon: 'clock', tip: 'מתי', text: `${fns.rel(r.t)} · ${fns.hm(r.t)}`, bdi: true }];
  if (r.whoText) out.push({ key: 'who', icon: r.guest ? 'users' : 'user', tip: r.guest ? 'גולש לא מחובר' : 'מי ביצע', text: r.whoText });
  if (r.size != null) out.push({ key: 'size', icon: 'box', tip: 'נפח הנתונים שהוחזר', text: formatSize(r.size), warn: sizeLevel(r.size) === 'danger', bdi: true });
  if (r.ms) out.push({ key: 'ms', icon: 'clock', tip: 'משך ביצוע', text: `${r.ms} ms`, bdi: true });
  if (r.error) out.push({ key: 'err', icon: 'alert', tip: 'תקלה', text: r.error.length > 60 ? `${r.error.slice(0, 60)}…` : r.error, warn: true });
  return out;
}

/* ------------------------------ גיליון הדפסה / PDF / Excel ------------------------------ */

/**
 * "יומן שאילתות ו-API": מקובץ לפי יום; עמודות: שעה, עובד, מה (שם המסך או נתיב ה-API), נפח, משך, ו"תקלה" רק כשיש תקלה בכלל. אין ערכים כפולים (היום בכותרת הקבוצה).
 * fns: { dayKey(iso), dayLabel(dayKey), hm(iso) }.
 */
export function buildVisitSheet(rows, filterText, fns, ascending = false) {
  const hasErr = (rows || []).some((r) => r.error);
  const groups = groupByDay(rows, fns, ascending).map((g) => ({
    title: g.title,
    rows: g.rows.map((r) => ({
      time: fns.hm(r.t), who: r.guest ? 'אורח' : r.who, what: r.api ? pathOnly(r.path) : (r.screen || pathOnly(r.path)),
      size: r.size != null ? formatSize(r.size) : '', ms: r.ms ? `${r.ms} ms` : '', error: r.error || '',
    })),
  }));
  return { title: SHEET_TITLE, subtitle: filterText || '', groups, hasErr, totals: { count: (rows || []).length } };
}

export function sheetFlatRows(sheet) {
  const head = ['יום', 'שעה', 'עובד', 'נתיב / מסך', 'נפח', 'משך', ...(sheet.hasErr ? ['תקלה'] : [])];
  const rows = [];
  for (const g of sheet.groups) for (const r of g.rows) rows.push([g.title, r.time, r.who, r.what, r.size, r.ms, ...(sheet.hasErr ? [r.error] : [])]);
  return { head, rows };
}
