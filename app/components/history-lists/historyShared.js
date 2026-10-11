// historyShared.js - החלקים המשותפים (טהורים) לשתי רשימות היומנים בניהול (היסטוריית נתונים / היסטוריית שאילתות ו-API): אפשרויות התקופה, בניית קבוצות הסינון
// מתוך הספירות מהשרת, פרמטרי הבקשה, קיבוץ ליום לדוח ההדפסה / Excel. בלי React ובלי alias (נבדק ב-scripts/test_a5_history_lists.mjs).
import { COUNT_CAP, totalSuffix } from '../../../lib/adminLogList.js';

export const PAGE_SIZE = 50;
export const EXPORT_MAX = 5000; // תקרת שורות לייצוא Excel (עמודי ייצוא של 500)
// הדפסה / PDF: העימוד מודד פריסה אמיתית לכל גיליון (187 גיליונות ל-3,446 שורות = דקה של קיפאון), לכן תקרה נמוכה יותר מ-Excel. מעליה - הודעה "צמצמו את הסינון" ולא בונים כלום.
export const PRINT_MAX = 1500; // ~60-80 גיליונות

/** האם הרשימה ארוכה מדי להדפסה / PDF (kind = 'print' | 'download'; Excel לעולם לא). total = הסך של הרשימה (חסום ל-100,000 = ארוך). */
export function printTooLong(kind, total) {
  return kind !== 'excel' && Number(total) > PRINT_MAX;
}
export const printLimitText = (max = PRINT_MAX) => `הרשימה ארוכה מדי להדפסה - צמצמו את הסינון (נדרש עד ${max.toLocaleString('he-IL')} שורות). ייצוא ל-Excel זמין גם ברשימה הארוכה.`;
export { COUNT_CAP, totalSuffix };

export const PERIOD_OPTIONS = [
  { k: 'today', l: 'היום', i: 'cal' },
  { k: 'd7', l: '7 הימים האחרונים', i: 'cal' },
  { k: 'd30', l: '30 הימים האחרונים', i: 'cal' },
  { k: 'year', l: 'השנה האחרונה', i: 'cal' },
];

/** מפתח הספירה של אפשרות: מספר מהשרת; '' = עוד לא נטען / הספירה חסומה (האפשרות גלויה בלי מספר); 0 = אין תוצאות (מוסתרת אלא אם נבחרה). */
export function countOf(counts, group, key) {
  if (!counts) return '';
  if (counts.capped) return '';
  const g = counts[group];
  return g && g[key] !== undefined ? g[key] : 0;
}

/** קבוצת "תקופה": אפשרויות קבועות + "טווח מותאם" (הכיתוב הופך לטווח שנבחר). */
export function periodGroup(counts, customLabel = 'טווח מותאם…', def = []) {
  return {
    key: 'period', label: 'תקופה', icon: 'cal', def,
    options: [
      ...PERIOD_OPTIONS.map((o) => ({ ...o, count: countOf(counts, 'period', o.k) })),
      { k: 'custom', l: customLabel, i: 'sliders', count: '' },
    ],
  };
}

/**
 * אפשרויות קבוצה דינמית (סוגי רשומה / עובדים) מתוך הספירות: לפי ספירה יורדת, בלי אפס. הבחירות הנוכחיות נשארות תמיד (גם בלי ספירה, עם 0).
 * known = מילון מפתח -> כיתוב שנצבר (מונע היעלמות כיתוב של אפשרות שנבחרה). labelOf(key, countsObj) -> כיתוב; iconOf(key) -> אייקון.
 */
export function dynamicOptions(counts, group, selected, { labelOf, iconOf, fallbackKeys = [] }) {
  const src = counts && counts[group] ? counts[group] : null;
  const keys = src ? Object.keys(src).sort((a, b) => (src[b] - src[a]) || String(labelOf(a)).localeCompare(String(labelOf(b)), 'he')) : fallbackKeys.slice();
  for (const s of selected || []) if (!keys.includes(s)) keys.push(s);
  return keys.map((k) => ({ k, l: labelOf(k), i: iconOf(k), count: src ? (src[k] !== undefined ? src[k] : 0) : '' }))
    .map((o) => (counts && counts.capped ? { ...o, count: '' } : o));
}

/** עמוד -> פרמטרים שטוחים לבקשה: רק מה שנבחר נשלח. */
export function baseQuery({ sel = {}, sort, q = '', page = 1, limit = PAGE_SIZE, custom = null, groups = [] }) {
  const out = { page, limit, sort: sort.k, dir: sort.dir > 0 ? 'asc' : 'desc' };
  if (q && q.trim()) out.search = q.trim();
  for (const [selKey, apiKey] of groups) {
    const list = (sel[selKey] || []).filter(Boolean);
    if (list.length) out[apiKey] = list.join(',');
  }
  if ((sel.period || []).includes('custom') && custom) {
    if (custom.from) out.from = custom.from;
    if (custom.to) out.to = custom.to;
  }
  return out;
}

/* ----------------------------- קיבוץ ליום (דוח הדפסה / Excel) ----------------------------- */

/**
 * שורות -> קבוצות לפי יום (שעון ישראל). fns: { dayKey(iso), dayLabel(dayKey) -> "יום חמישי ט׳ תשרי תשפ״ז" }. הסדר: החדש ראשון (או הישן ראשון כשהמיון הוא זמן עולה).
 * מחזיר [{ key, title, rows }].
 */
export function groupByDay(rows, fns, ascending = false) {
  const list = (rows || []).slice().sort((a, b) => (ascending ? 1 : -1) * (new Date(a.t).getTime() - new Date(b.t).getTime()));
  const groups = [];
  for (const r of list) {
    const key = fns.dayKey(r.t) || '';
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) { g = { key, title: key ? fns.dayLabel(key) : 'ללא תאריך', rows: [] }; groups.push(g); }
    g.rows.push(r);
  }
  return groups;
}
