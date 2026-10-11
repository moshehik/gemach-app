// listLogic.js - הלוגיקה הטהורה של מנוע הרשימות (ערכת a5-list): חיפוש מילים, סינון קבוצתי (OR בתוך קבוצה, AND בין קבוצות),
// ספירות לכל אפשרות, מיון (מספרים לפי ערך, טקסט לפי locale עברי), עימוד של 50 ורשימת מספרי העמודים.
// זה הפורט 1:1 של createList() ב-scratch/emp-models-build/list-core.js (העיצוב המאושר), בלי DOM ובלי React - נבדק ב-
// scripts/test_a5_list_logic.mjs. אסור לייבא כאן שום דבר עם alias (@/) - הקובץ נקרא גם מ-node רגיל.

export const PAGE_SIZE = 50;

/** המילים של שאילתה (אותיות קטנות, בלי ריק). */
export function wordsOf(q) {
  return String(q == null ? '' : q).trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/** האם כל המילים נמצאות במחרוזת (hit() במקור). בלי מילים = כן. */
export function matchesWords(hayText, words) {
  if (!words || !words.length) return true;
  const h = String(hayText == null ? '' : hayText).toLowerCase();
  return words.every((w) => h.includes(w));
}

/** הבחירה ההתחלתית של כל קבוצות הסינון: { key: [def...] } */
export function initialSelection(filters) {
  const sel = {};
  (filters || []).forEach((f) => { sel[f.key] = (f.def || []).slice(); });
  return sel;
}

/** האם פריט עובר קבוצה: בלי בחירה = כן; אחרת לפחות אפשרות נבחרת אחת שה-test שלה מתקיים (OR בתוך קבוצה). */
export function passesGroup(item, f, selected) {
  const s = selected || [];
  return !s.length || f.options.some((o) => s.includes(o.k) && (typeof o.test === 'function' ? o.test(item) : true));
}

export function totalSelected(filters, sel) {
  return (filters || []).reduce((n, f) => n + ((sel && sel[f.key]) || []).length, 0);
}

/** ערכים להשוואה במיון: שני מספרים -> הפרש; אחרת localeCompare עברי עם numeric. */
export function compareValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a == null ? '' : a).localeCompare(String(b == null ? '' : b), 'he', { numeric: true });
}

export function findSorter(sorts, key) {
  return (sorts || []).find((s) => s.k === key) || (sorts || [])[0];
}

/** מיון יציב: ערך שווה -> סדר המקור. dir = 1 עולה / -1 יורד. */
export function sortItems(items, sorter, dir) {
  if (!sorter) return items.slice();
  const d = dir < 0 ? -1 : 1;
  return items
    .map((it, i) => ({ it, i, v: sorter.get(it) }))
    .sort((a, b) => (compareValues(a.v, b.v) || a.i - b.i) * d)
    .map((x) => x.it);
}

/**
 * הרשימה המוצגת: חיפוש (hay) + כל קבוצות הסינון + מיון.
 * opts = { items, words, hay, filters, sel, sorts, sort, localSearch=true }
 */
export function computeVisible(opts) {
  const { items, words, hay, filters, sel, sorts, sort } = opts;
  const useSearch = opts.localSearch !== false && typeof hay === 'function';
  const L = (items || []).filter((it) => (!useSearch || matchesWords(hay(it), words)) && (filters || []).every((f) => passesGroup(it, f, sel[f.key])));
  return sortItems(L, findSorter(sorts, sort.k), sort.dir);
}

/**
 * הספירה של אפשרות: כל הפריטים שעוברים את החיפוש ואת כל הקבוצות האחרות (לא את הקבוצה של האפשרות) ושעומדים בתנאי האפשרות.
 * אפשרות עם count קבוע (מצב שרת) מחזירה אותו.
 */
export function optionCount(opts, f, o) {
  if (o.count != null && typeof o.test !== 'function') return o.count;
  const { items, words, hay, filters, sel } = opts;
  const useSearch = opts.localSearch !== false && typeof hay === 'function';
  return (items || []).filter((it) => (!useSearch || matchesWords(hay(it), words)) && (filters || []).every((g) => g === f || passesGroup(it, g, sel[g.key])) && o.test(it)).length;
}

/** אפשרות מוסתרת: ספירה 0 ולא נבחרה (hidden במקור). */
export const isOptionHidden = (count, selected) => count === 0 && !selected;

/* ---------------------------------- עימוד ---------------------------------- */

export const pageCount = (n, ps = PAGE_SIZE) => Math.max(1, Math.ceil((n || 0) / ps));
export const clampPage = (p, n, ps = PAGE_SIZE) => Math.max(1, Math.min(pageCount(n, ps), p || 1));
export const pageSlice = (list, page, ps = PAGE_SIZE) => list.slice((page - 1) * ps, page * ps);

/** "שורות 51–100": from / to של העמוד (0 כשאין שורות). */
export function pageRange(n, page, ps = PAGE_SIZE) {
  const from = n ? (page - 1) * ps + 1 : 0;
  return { from, to: Math.min(n, page * ps) };
}

/** מספרי העמודים המוצגים (עד 7 מלא; אחרת 1, אחרון, סביב הנוכחי, ו-'…' בפערים) - pageList במקור. */
export function pageList(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, cur - 1, cur, cur + 1]);
  if (cur <= 3) [2, 3, 4].forEach((x) => set.add(x));
  if (cur >= total - 2) [total - 3, total - 2, total - 1].forEach((x) => set.add(x));
  const a = [...set].filter((x) => x >= 1 && x <= total).sort((x, y) => x - y);
  const out = [];
  a.forEach((x, i) => { if (i && x - a[i - 1] > 1) out.push('…'); out.push(x); });
  return out;
}

/* ------------------------------- הדגשת חיפוש ------------------------------- */

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** מפרק טקסט לחלקים [{ t, mark }] לפי המילים (הדגשה לא תלוית רישיות). בלי מילים / בלי טקסט -> חלק אחד. */
export function splitHighlight(text, words) {
  const s = String(text == null ? '' : text);
  if (!words || !words.length || !s) return [{ t: s, mark: false }];
  const re = new RegExp(`(${words.map(escRe).join('|')})`, 'gi');
  const out = [];
  let last = 0;
  let m;
  while ((m = re.exec(s))) {
    if (m[0] === '') { re.lastIndex++; continue; }
    if (m.index > last) out.push({ t: s.slice(last, m.index), mark: false });
    out.push({ t: m[0], mark: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ t: s.slice(last), mark: false });
  return out.length ? out : [{ t: s, mark: false }];
}

/* --------------------------- סיכום מצב לייצוא / הדפסה --------------------------- */

/** שורת סינון קריאה ("מחלקה: מכירות · סטטוס: פעילים") לכותרת דף הדפסה - רק קבוצות עם בחירה. */
export function filterSummary(filters, sel) {
  const parts = [];
  (filters || []).forEach((f) => {
    const s = (sel && sel[f.key]) || [];
    if (!s.length) return;
    const names = s.map((k) => { const o = f.options.find((x) => x.k === k); return o ? o.l : k; });
    parts.push(`${f.label}: ${names.join(', ')}`);
  });
  return parts.join(' · ');
}

/** שם מחלקה / ספרות עברית "עובד אחד / 5 עובדים" (plural() במקור). */
export function plural(n, one, many, zero) {
  if (n === 0 && zero !== undefined) return zero;
  return n === 1 ? one : `${n} ${many}`;
}
