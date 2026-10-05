// lib/sizeSearch.js - התאמת מידות מדויקת לחיפושי DB (Prisma): "2" = "02" = "002" ולא 12/20/32. מודול טהור וקטן (תלוי רק ב-lib/searchNormalize.js).
// נפרד מ-lib/listSearch.js כדי שנתיבים כמו app/api/inventory/capacity לא יטענו את כל תוכנית החיפוש (hebcal וכו').
import { sizeSpellings, cleanQuery } from './searchNormalize.js';

const LATIN_SIZE_RE = /^(?:[2-4]?XS|XXS|XS|S|M|L|XL|XXL|XXXL|[2-4]XL)$/i;

/**
 * רשימת ערכי sizeText לשימוש עם { sizeText: { in: [...] } } (התאמה מדויקת, בלי LIKE '%2%' שהיה מוצא גם 12/20/32):
 * הכתיבים השקולים (sizeSpellings: '2' / '02' / '002'; אות לטינית: 'XL' / 'xl') ובנוסף כל כתיב עם רווח מוביל/עוקב ("42 " / " 06" - 42 מקרים
 * בנווה יעקב, ר' sizeSpellings). ערך שמור עם רווחים פנימיים ("38 - 40") לא נתפס כאן - לשם כך sizeSqlMatcher (regex, SQL גולמי בלבד).
 * @returns {string[]} ריק כשהשאילתה ריקה.
 */
export function sizeInList(raw) {
  const base = sizeSpellings(raw);
  const out = new Set();
  for (const s of base) { out.add(s); out.add(` ${s}`); out.add(`${s} `); }
  return [...out];
}

/** תנאי Prisma לשדה sizeText (או כל שדה מידה) לפי הקלט: { in: [...] } / null כשאין מידה. */
export function sizeTextFilter(raw) {
  const list = sizeInList(raw);
  return list.length ? { in: list } : null;
}

/** האם טקסט הוא "מידה בלבד": 1-2 ספרות, או מידה לטינית (S/M/L/XL...). שלוש ספרות ומעלה = קידומת דגם, לא מידה. */
export function looksLikeSizeOnly(text) {
  const t = cleanQuery(text);
  return /^\d{1,2}$/.test(t) || LATIN_SIZE_RE.test(t);
}
