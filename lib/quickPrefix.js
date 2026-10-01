// lib/quickPrefix.js — קידומות חיפוש מהיר בשורת החיפוש ('@' = האחרונים שלי). מודול טהור: בלי React, DOM או רשת
// (נבדק ב-scripts/test_home_logic.mjs), כדי שאותה לוגיקה תשרת את החיפוש בדף הבית וגם את חיפוש התפריט.
//
// כלל (החלטת הבעלים 27.9): הקידומת פועלת רק כשהיא התו הראשון בשורת החיפוש; מה שאחריה מסנן את הרשימה.
// היום קיימת רק '@' (האחרונים של העובדת מההיסטוריה המקומית). '#' ו-'$' טרם נבנו — אסור להוסיף אותן כאן בלי החלטה.
//
// שורת רשימה (row): { key, kind, icon, title, sub?, url } — `kind` הוא סוג הרשומה ("לקוח", "הזמנה"...). כשיתווספו סוגי
// רשומות נוספים (חיפוש חכם, טיוטות...) הם נכנסים כשורות עם kind משלהם, בלי לשנות את הרכיב המשותף.

export const QUICK_PREFIXES = Object.freeze({
  '@': Object.freeze({ id: 'recent', listLabel: 'האחרונים שלי', empty: 'עוד לא נפתחו כאן הזמנות או לקוחות', noMatch: 'אין התאמות' }),
});

/** { prefix, term, def } אם שורת החיפוש מתחילה בקידומת מוכרת (התו הראשון בלבד), אחרת null. */
export function detectQuickPrefix(q) {
  const s = typeof q === 'string' ? q : '';
  if (!s) return null;
  const def = Object.prototype.hasOwnProperty.call(QUICK_PREFIXES, s[0]) ? QUICK_PREFIXES[s[0]] : null;
  return def ? { prefix: s[0], term: s.slice(1).trim(), def } : null;
}

/** סינון שורות לפי מה שהוקלד אחרי הקידומת (תת-מחרוזת בכותרת / סוג / טקסט משנה). בלי term = הכול. לא משנה את הקלט. */
export function filterPrefixRows(rows, term) {
  const list = Array.isArray(rows) ? rows : [];
  const t = String(term || '').trim().toLowerCase();
  if (!t) return list.slice();
  return list.filter((r) => [r.title, r.kind, r.sub].some((x) => typeof x === 'string' && x.toLowerCase().includes(t)));
}

/** [לפני, התאמה, אחרי] להדגשת מה שהוקלד; בלי התאמה — [טקסט, '', '']. */
export function splitMatch(text, term) {
  const s = String(text == null ? '' : text);
  const t = String(term || '').trim();
  const i = t ? s.toLowerCase().indexOf(t.toLowerCase()) : -1;
  return i < 0 ? [s, '', ''] : [s.slice(0, i), s.slice(i, i + t.length), s.slice(i + t.length)];
}
