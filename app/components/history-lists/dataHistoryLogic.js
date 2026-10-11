// dataHistoryLogic.js - הלוגיקה הטהורה של מסך "היסטוריית נתונים" (/admin/data-history): מיפוי הבחירה בחלון "סינון" / מיון / חיפוש לפרמטרי ה-API,
// בניית קבוצות הסינון מהספירות שבשרת, שורת הרשימה ("זוגות" אייקון + ערך - ריק לא מוצג), שורות ה"לפני ← אחרי" בפירוט, וגיליון ההדפסה "יומן שינויים".
// בלי React ובלי alias: נבדקת ב-scripts/test_a5_history_lists.mjs. פונקציות עיצוב (תאריך עברי / שעה / תוויות שדות) מוזרקות מהרכיב (fns / fmt).
import { ACTION_GROUPS, ACTION_GROUP_KEYS, entityIcon, entityLabel, sentenceOf, subjectOf, verbOf } from '../../../lib/adminAuditList.js';
import { logCountsKey } from '../../../lib/adminLogList.js';
import { PAGE_SIZE, baseQuery, countOf, dynamicOptions, groupByDay, periodGroup } from './historyShared.js';

export const SORTS = [
  { k: 'time', l: 'זמן', i: 'clock' },
  { k: 'type', l: 'סוג רשומה', i: 'tag' },
  { k: 'action', l: 'פעולה', i: 'pencil' },
  { k: 'employee', l: 'עובד', i: 'user' },
  { k: 'size', l: 'היקף השינוי', i: 'list' },
];
export const DEFAULT_SORT = Object.freeze({ k: 'time', dir: -1 }); // הכי חדש ראשון
export const SHEET_TITLE = 'יומן שינויים';
export const SYSTEM_KEY = 'system';

export const countsKey = logCountsKey;

/* ------------------------------ קבוצות הסינון ------------------------------ */

/**
 * counts = תשובת /counts (או null עד שנטענה). sel = הבחירה הנוכחית (כדי שאפשרות שנבחרה לא תיעלם). names = מילון נצבר מפתח-עובד -> שם.
 * סוגי הרשומה: לפני שהספירות נטענו - כל הסוגים המוכרים בלי מספר; אחרי - רק מה שיש (לפי ספירה יורדת).
 */
export function buildAuditFilters(counts, { customLabel = 'טווח מותאם…', sel = {}, names = {}, knownTypes = [] } = {}) {
  const emp = dynamicOptions(counts, 'employees', sel.employees, {
    labelOf: (k) => (k === SYSTEM_KEY ? 'מערכת (ללא עובד)' : (counts && counts.employeeNames && counts.employeeNames[k]) || names[k] || 'עובד'),
    iconOf: (k) => (k === SYSTEM_KEY ? 'gear' : 'user'),
  });
  const groups = [
    {
      key: 'types', label: 'סוג רשומה', icon: 'tag', def: [],
      options: dynamicOptions(counts, 'types', sel.types, { labelOf: entityLabel, iconOf: entityIcon, fallbackKeys: knownTypes }),
    },
    {
      key: 'actions', label: 'פעולה', icon: 'pencil', def: [],
      options: ACTION_GROUP_KEYS.map((k) => ({ k, l: ACTION_GROUPS[k].l, i: ACTION_GROUPS[k].i, count: countOf(counts, 'actions', k) })),
    },
  ];
  if (emp.length) groups.push({ key: 'employees', label: 'עובד', icon: 'user', def: [], options: emp });
  groups.push(periodGroup(counts, customLabel));
  return groups;
}

export function buildAuditQuery({ sel = {}, sort = DEFAULT_SORT, q = '', page = 1, limit = PAGE_SIZE, custom = null } = {}) {
  return baseQuery({ sel, sort, q, page, limit, custom, groups: [['types', 'types'], ['actions', 'actions'], ['employees', 'employees'], ['period', 'period']] });
}

/* ------------------------------ ערכים ------------------------------ */

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const MONEY_KEYS = new Set(['amount', 'price', 'totalAmount', 'basePrice', 'finalPrice', 'deposit', 'approvedDebtAmount', 'refund', 'hourlyWage', 'hourlyWageSnapshot', 'totalCalculated']);
export const money = (n) => `₪${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('he-IL')}`;
const EMPTY = '(ריק)';

/** ערך שדה בעברית: כן/לא, תאריך עברי (+שעה כשיש), ₪, תווית ערך מכונה (valueLabel). fns: { hDate(iso), hm(iso) }. */
export function formatChangeValue(key, v, fns, valueLabel) {
  if (v === null || v === undefined || v === '') return EMPTY;
  if (typeof v === 'boolean') return v ? 'כן' : 'לא';
  if (valueLabel) { const t = valueLabel(key, v); if (t) return t; }
  if (typeof v === 'string' && ISO_RE.test(v)) {
    const d = fns.hDate(v);
    const hm = fns.hm(v);
    const midnight = /T00:00:00(\.0+)?Z?$/.test(v) || hm === '00:00';
    return d ? (midnight || !hm ? d : `${d} · ${hm}`) : v;
  }
  if (typeof v === 'number' && MONEY_KEYS.has(key)) return money(v);
  return String(v);
}

/** שורות ה"לפני ← אחרי" של הפירוט: [{ key, label, before, after, edit, masked }]. fmt: { label(key), value(key, v) }. */
export function changeLines(changes, fmt) {
  return (changes || []).map((c) => ({
    key: c.key,
    label: fmt.label(c.key),
    masked: !!c.masked,
    edit: !!c.edit,
    before: c.edit && !c.masked && c.from !== null && c.from !== undefined && c.from !== '' ? fmt.value(c.key, c.from) : '',
    after: c.masked ? '' : fmt.value(c.key, c.to),
  }));
}

/** סיכום קצר של השינוי (דוח / Excel): "טלפון: 050… ← 052…" עד max שדות + "ועוד N". */
export function changeSummary(r, fmt, max = 3) {
  const lines = changeLines(r.changes, fmt);
  if (!lines.length) return r.big ? 'שינוי גדול - לא מוצג' : '';
  const part = (l) => (l.masked ? `${l.label}: מוסתר` : l.before ? `${l.label}: ${l.before} ← ${l.after}` : `${l.label}: ${l.after}`);
  const shown = lines.slice(0, max).map(part).join(' · ');
  const rest = (r.n || lines.length) - Math.min(max, lines.length);
  return rest > 0 ? `${shown} · ועוד ${rest}` : shown;
}

/* ------------------------------ שורה ------------------------------ */

/** שורת הרשימה: מוסיף לרשומת השרת את המשפט האנושי. actionLabels = ACTION_TRANSLATIONS (מוזרק). */
export function auditRow(d, actionLabels) {
  return { ...d, title: sentenceOf(d.type, d.action, d.entity, actionLabels), subject: subjectOf(d.type, d.entity), verb: verbOf(d.type, d.action, actionLabels), icon: d.action === 'DELETE' ? 'trash' : entityIcon(d.type), typeLabel: entityLabel(d.type) };
}

/**
 * ה"זוגות" של שורה 2: מתי (יום עברי + שעה), מי ביצע, כמה שדות שונו (רק כשיותר מאחד). ריק לא מופיע.
 * fns: { rel(iso) -> "היום" / "ט׳ תשרי", hm(iso) }.
 */
export function auditPairs(r, fns) {
  const out = [{ key: 'when', icon: 'clock', tip: 'מתי', text: `${fns.rel(r.t)} · ${fns.hm(r.t)}`, bdi: true }];
  out.push({ key: 'who', icon: r.system ? 'gear' : 'user', tip: r.system ? 'פעולה אוטומטית של המערכת' : 'מי ביצע', text: r.system ? 'מערכת' : r.who });
  if (r.n > 1) out.push({ key: 'n', icon: 'pencil', tip: 'מספר השדות ששונו', text: String(r.n), bold: true });
  return out;
}

/* ------------------------------ גיליון הדפסה / PDF / Excel ------------------------------ */

/**
 * "יומן שינויים": מקובץ לפי יום (עברי), עמודות: שעה, מי, מה (הרשומה והפעולה), השינוי. בלי מזהים ובלי ערכים כפולים (היום בכותרת הקבוצה ולכן לא בעמודה).
 * fns: { dayKey(iso), dayLabel(dayKey), hm(iso) }; fmt ל-changeSummary; ascending = המיון הוא זמן עולה.
 */
export function buildAuditSheet(rows, filterText, fns, fmt, ascending = false) {
  const groups = groupByDay(rows, fns, ascending).map((g) => ({
    title: g.title,
    rows: g.rows.map((r) => ({ time: fns.hm(r.t), who: r.system ? 'מערכת' : r.who, what: r.title, change: changeSummary(r, fmt, 3) })),
  }));
  return { title: SHEET_TITLE, subtitle: filterText || '', groups, totals: { count: (rows || []).length } };
}

/** שורות שטוחות ל-Excel (היום הופך לעמודה כי אין כותרות קבוצה). */
export function sheetFlatRows(sheet) {
  const head = ['יום', 'שעה', 'עובד', 'רשומה ופעולה', 'השינוי'];
  const rows = [];
  for (const g of sheet.groups) for (const r of g.rows) rows.push([g.title, r.time, r.who, r.what, r.change]);
  return { head, rows };
}
