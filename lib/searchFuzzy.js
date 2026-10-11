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

// ---------------------------------------------------------------------------------------------------------------------------------
// איות חכם לעוזר ה-AI (lib/ai/smartNames.js): מדרגים איותים שמורים של שם מול מילה שהוקלדה. אותה לוגיקה בדיוק (fuzzyBudget / editDistance /
// מפתח פונטי) - רק עם רמת "חזק" למצב שבו כבר קיימת התאמה מדויקת, כדי שהתשובה לא תתמלא בשמות שרק דומים מרחוק.
// ---------------------------------------------------------------------------------------------------------------------------------

/** כמה איותים קרובים לכל היותר נכללים אוטומטית בשאילתה (השאר נספרים ומדווחים, לא נכללים). */
export const NEAR_SPELLINGS_MAX = 5;

/** אותיות שמשמשות לעיתים קרובות כתנועה/מקום-שמור באיות שמות (ר' hebrewPhonetic.js): החלפה ביניהן אינה מחליפה שם אחר. */
const VOWELISH = new Set(['א', 'ע', 'ה', 'ו', 'י']);

/**
 * "גרסת איות" חזקה: אותו מפתח פונטי (באורך 3+: שיינועטר / שיינווטר / שיינוטר / שיינאטר, כהן / כהנא...), או - במילה של 5 תווים ומעלה - הבדל של תו אחד
 * שהוא הוספה/מחיקה (שפרינצל / שפרינצלס, גולדשטין / גולדשטיין) או החלפה בין אותיות-תנועה בלבד (ו/י/א/ע/ה). החלפה של אות עיקרית (ברקוביץ / מרקוביץ) אינה
 * גרסה חזקה: שם אחר. שני האסימונים מקופלים (foldHebrew / nameTokens). אסימון זהה אינו "גרסה" (זו ההתאמה המדויקת).
 */
export function isStrongNameVariant(q, n) {
  if (!q || !n || q === n) return false;
  const kq = hebrewPhoneticKey(q);
  if (kq && kq.length >= 3 && kq === hebrewPhoneticKey(n)) return true;
  const a = Array.from(q); const b = Array.from(n);
  if (a.length < 5) return false;
  if (Math.abs(a.length - b.length) === 1) return editDistance(q, n, 1) <= 1;
  if (a.length === b.length) {
    const diff = a.map((ch, i) => [ch, b[i]]).filter(([x, y]) => x !== y);
    return diff.length === 1 && VOWELISH.has(diff[0][0]) && VOWELISH.has(diff[0][1]);
  }
  return false;
}

/**
 * מדרג איותים שמורים של שם מול מילה שהוקלדה.
 * @param {string} word  המילה כפי שהוקלדה
 * @param {{raw: string, count?: number}[]} spellings  אסימוני שם שמורים (אות-בלבד) עם מספר הרשומות שבהן הם מופיעים
 * @param {{loose?: boolean, max?: number}} [opts]  loose=true (אין התאמה מדויקת): כל אסימון "קרוב" לפי tokenIsNear נכלל (אם אין גרסאות חזקות; אחרת רק הן);
 *   אחרת (יש התאמה מדויקת) רק גרסאות חזקות. השאר מוחזרים ב-extra (לניסיון חוזר רק אם התוצאה ריקה).
 * @returns {{near: {raw:string,count:number,strong:boolean}[], extra: {raw:string,count:number,strong:boolean}[], more: number}}
 *   near = עד max איותים (חזקים קודם, אחר כך מרחק עריכה, אחר כך שכיחות); more = כמה איותים קרובים נוספים לא נכללו.
 */
export function rankNameSpellings(word, spellings, { loose = false, max = NEAR_SPELLINGS_MAX } = {}) {
  const q = nameTokens(word)[0];
  const out = { near: [], extra: [], more: 0 };
  if (!q || Array.from(q).length < 3) return out;
  const budget = fuzzyBudget(Array.from(q).length);
  const seen = new Set();
  const scored = [];
  for (const sp of spellings || []) {
    const raw = sp && sp.raw;
    const n = nameTokens(raw)[0];
    if (!n || n === q || seen.has(n)) continue;
    if (String(raw).toLowerCase().includes(String(word).trim().toLowerCase())) continue; // כבר נתפס ע"י התאמת "מכיל" (ILIKE) של השאילתה עצמה
    seen.add(n);
    const strong = isStrongNameVariant(q, n);
    if (!strong && !tokenIsNear(q, n)) continue;
    scored.push({ raw, count: Number(sp.count) || 1, strong, dist: editDistance(q, n, budget + 1) });
  }
  scored.sort((a, b) => (b.strong - a.strong) || (a.dist - b.dist) || (b.count - a.count) || (a.raw < b.raw ? -1 : 1));
  // loose (אין התאמה מדויקת): כל מה שקרוב לפי התקציב - אבל אם יש גרסאות חזקות, הן לבדן (כמו "שיינועטר" ל"שיינוטר"), והרחוקות יותר מחכות ב-extra לתוצאה ריקה
  const strongOnes = scored.filter((x) => x.strong);
  const eligible = loose && !strongOnes.length ? scored : strongOnes;
  const pick = ({ raw, count, strong }) => ({ raw, count, strong });
  out.near = eligible.slice(0, max).map(pick);
  out.more = Math.max(0, eligible.length - max);
  out.extra = scored.filter((x) => !eligible.includes(x)).slice(0, max).map(pick);
  return out;
}
