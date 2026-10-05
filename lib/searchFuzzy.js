// lib/searchFuzzy.js - סובלנות לשגיאות כתיב בשמות (מרחק עריכה 1-2) לחיפושי הרשימות. מודול טהור (בלי prisma).
// איך זה משתלב: ה-DB מייצר מועמדים בעזרת אינדקסי pg_trgm/מפתח פונטי הקיימים (lib/searchDb.js, "חסום" ב-LIMIT, בלי סריקה רחבה),
// והמודול הזה מאמת אותם בדיוק בצד JS (מרחק עריכה אמיתי, לא רק דמיון טריגרמות שעלול להיות רופף) - כך שרק התאמות באמת קרובות מוצגות.
// הערה לאיחוד עתידי: ההיגיון הפונטי עצמו (lib/hebrewPhonetic.js) משותף עם app/api/global-search/route.js; כאן לא נוגעים בקובץ ההוא.

import { foldHebrew } from './searchNormalize.js';
import { hebrewPhoneticKey } from './hebrewPhonetic.js';

/** כמה עריכות מותרות במילה באורך len: עד 2 תווים - 0 (לא מנחשים), 3-4 תווים - 1, 5 ומעלה - 2. */
export function fuzzyBudget(len) {
  if (len < 3) return 0;
  if (len <= 4) return 1;
  return 2;
}

/**
 * מרחק עריכה (Damerau-Levenshtein "מוגבל": הוספה/מחיקה/החלפה/החלפת תווים סמוכים = 1). עוצר מוקדם: אם המרחק גדול מ-max מחזיר max+1.
 */
export function editDistance(a, b, max = 2) {
  const s = Array.from(String(a)); const t = Array.from(String(b));
  if (Math.abs(s.length - t.length) > max) return max + 1;
  if (s.length === 0) return t.length <= max ? t.length : max + 1;
  if (t.length === 0) return s.length <= max ? s.length : max + 1;
  let prev2 = null;
  let prev = Array.from({ length: t.length + 1 }, (_, j) => j);
  for (let i = 1; i <= s.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (prev2 && i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return prev[t.length] <= max ? prev[t.length] : max + 1;
}

/** אסימוני שם מקופלים (ללא ניקוד/אותיות סופיות/גרשיים): "בן-דוד" -> ['בנ','דוד']; מחרוזת ריקה -> []. */
export function nameTokens(s) {
  return foldHebrew(s).split(/[\s\-"'.,]+/).filter(Boolean);
}

/** האם אסימון מוקלד "קרוב" לאסימון שם: מרחק עריכה בתקציב לפי אורך המוקלד, או אותו מפתח פונטי (כשיש אותיות עבריות). */
export function tokenIsNear(queryToken, nameToken) {
  if (!queryToken || !nameToken) return false;
  if (queryToken === nameToken) return true;
  const budget = fuzzyBudget(Array.from(queryToken).length);
  if (budget > 0 && editDistance(queryToken, nameToken, budget) <= budget) return true;
  if (budget > 0) {
    const kq = hebrewPhoneticKey(queryToken);
    if (kq && kq.length >= 2 && kq === hebrewPhoneticKey(nameToken)) return true;
  }
  return false;
}

/**
 * האם כל אסימוני החיפוש קרובים (או זהים / תחילית) לאסימון כלשהו בשם הפרטי/משפחה. אסימונים קצרים מ-3 תווים חייבים להיות זהים או תחילית של
 * אסימון (כדי ש"אב" לא יתאים לכל השמות).
 */
export function nameIsNear(queryTokens, firstName, lastName) {
  const names = [...nameTokens(firstName), ...nameTokens(lastName)];
  if (!queryTokens.length || !names.length) return false;
  return queryTokens.every((q) => {
    if (Array.from(q).length < 3) return names.some((n) => n === q || n.startsWith(q));
    return names.some((n) => tokenIsNear(q, n) || n.startsWith(q));
  });
}

/** האם יש טעם בחיפוש מטושטש לטקסט הזה: אסימון אחד לפחות באורך 3+ שכולו אותיות (עברית/לטינית), ולא ספרות. */
export function fuzzyTokens(text) {
  const toks = nameTokens(text);
  const usable = toks.filter((t) => /^[א-תa-z]+$/.test(t));
  if (usable.length !== toks.length) return []; // יש ספרות/סימנים - לא שם
  if (!usable.some((t) => Array.from(t).length >= 3)) return [];
  return usable.slice(0, 3);
}
