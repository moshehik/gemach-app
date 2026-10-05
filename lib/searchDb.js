// lib/searchDb.js - שאילתות עזר ל-DB של חיפושי הרשימות: מזהי לקוחות לפי טלפון (בכל צורת כתיבה) ולפי שם דומה.
// כל פונקציה חסומה ב-LIMIT, ונכשלת "בשקט" (מחזירה []) - כך שכשל בעזר (למשל חסר pg_trgm בסביבה) לא מפיל את החיפוש הרגיל.
// ללא שינויי סכמה: עובד על העמודות והאינדקסים הקיימים (ר' עלות בכל פונקציה).
import prisma from '@/app/lib/prisma';
import { buildFuzzyNameSql } from './searchUtils.js';
import { fuzzyTokens, nameIsNear, nameTokens } from './searchFuzzy.js';

const PHONE_LIMIT = 300;
const FUZZY_CANDIDATES = 120;
const FUZZY_RESULTS = 60;

/** חותך ל-cap ומסמן ids.capped = true (מאפיין לא-נספר, כך שהמערך ממשיך להתנהג כמערך) כשהיו יותר תוצאות - הנתיב מציג "מוצגות תוצאות חלקיות". */
export function markCapped(ids, cap) {
  const capped = ids.length > cap;
  const out = capped ? ids.slice(0, cap) : ids;
  Object.defineProperty(out, 'capped', { value: capped, enumerable: false });
  return out;
}

const DIGITS = (col) => `regexp_replace(COALESCE(${col}, ''), '\\D', '', 'g')`;

/**
 * מזהי לקוחות (Customer.id) שאחד משני הטלפונים שלהם שווה / מכיל את הספרות שהוקלדו, בלי קשר לצורת הכתיבה השמורה
 * ("050-1234567", "050 123 4567", "+972501234567" = "0501234567"). phones נשמרים כפי שהוקלדו (customers/route.js POST), לכן ההשוואה על
 * regexp_replace של הערך השמור.
 * @param {{exact?: string[], partial?: string|null}} keys  exact = מפתחות ספרות שקולים (phoneEquivalentKeys); partial = תת-מחרוזת ספרות
 * @returns {Promise<string[]>}  מערך מזהים; כשיש יותר מ-limit התאמות - נחתך ל-limit (לפי id) ו-ids.capped === true
 * עלות: סריקה של טבלת Customer (עשרות אלפי שורות לכל היותר) עם regexp_replace על שתי עמודות - עשרות אלפיות שנייה; רצה רק כשהקלט נראה כמו טלפון
 * (~9% מהחיפושים). אינדקס פונקציונלי על regexp_replace(phone1,'\D','','g') ועל phone2 יהפוך אותה לחיפוש באינדקס (המלצה בלבד, לא נוצר).
 */
export async function findCustomerIdsByPhone(keys, { limit = PHONE_LIMIT } = {}) {
  const exact = (keys && keys.exact) || [];
  const partial = keys && keys.partial;
  if (!exact.length && !partial) return [];
  try {
    const params = [];
    const ph = (v) => { params.push(v); return `$${params.length}`; };
    const conds = [];
    if (exact.length) {
      const list = exact.map(ph).join(', ');
      conds.push(`${DIGITS('"phone1"')} IN (${list})`, `${DIGITS('"phone2"')} IN (${list})`);
    }
    if (partial) {
      const likes = [`%${partial}%`];
      if (partial.startsWith('0')) likes.push(`%972${partial.slice(1)}%`);
      for (const l of likes) conds.push(`${DIGITS('"phone1"')} LIKE ${ph(l)}`, `${DIGITS('"phone2"')} LIKE ${ph(l)}`);
    }
    // ORDER BY id: אותה קבוצה בכל הרצה (בלי סדר מוגדר, LIMIT היה מחזיר "מזהים כלשהם" שונים בין בקשות); LIMIT+1 כדי לדעת אם נחתכנו
    const cap = Number(limit) || PHONE_LIMIT;
    const rows = await prisma.$queryRawUnsafe(`SELECT "id" FROM "Customer" WHERE (${conds.join(' OR ')}) ORDER BY "id" LIMIT ${cap + 1}`, ...params);
    const ids = (rows || []).map((r) => r.id).filter(Boolean);
    return markCapped(ids, cap);
  } catch (e) {
    console.warn('searchDb.findCustomerIdsByPhone failed:', e && e.message ? e.message : e);
    return [];
  }
}

/**
 * מזהי לקוחות עם שם "קרוב" לטקסט שהוקלד (מרחק עריכה 1-2 על כל מילה, או אותו מפתח פונטי) - לחיפוש שלא מצא התאמה מדויקת.
 * שני שלבים: (1) מועמדים מה-DB לפי אינדקסי pg_trgm על firstName/lastName והמפתח הפונטי (אותו buildFuzzyNameSql של global-search, מילה-מילה,
 * AND בין המילים), חסום ב-FUZZY_CANDIDATES; (2) אימות מדויק ב-JS (lib/searchFuzzy.js) כדי לסנן התאמות טריגרמות רופפות.
 * כמות הקלט מוגבלת (עד 3 מילים באורך 3+), אין סריקה לא חסומה.
 * @returns {Promise<string[]>}
 */
export async function findFuzzyCustomerIds(text, { limit = FUZZY_RESULTS } = {}) {
  const toks = fuzzyTokens(text);
  if (!toks.length) return [];
  try {
    const params = [];
    const clauses = [];
    const scores = [];
    for (const tok of toks) {
      const f = buildFuzzyNameSql(tok, params.length + 1, '"firstName"', '"lastName"', '"firstNamePhoneticKey"', '"lastNamePhoneticKey"');
      if (!f) return [];
      params.push(...f.params);
      clauses.push(f.clauseSql);
      scores.push(f.scoreSql);
    }
    const sql = `SELECT "id", "firstName", "lastName" FROM "Customer" WHERE "isDeleted" = false AND ${clauses.map((c) => `(${c})`).join(' AND ')} ` +
      `ORDER BY (${scores.join(' + ')}) DESC NULLS LAST LIMIT ${FUZZY_CANDIDATES}`;
    const rows = await prisma.$queryRawUnsafe(sql, ...params);
    const qTokens = toks.map((t) => nameTokens(t)[0]).filter(Boolean);
    return (rows || []).filter((r) => nameIsNear(qTokens, r.firstName, r.lastName)).slice(0, limit).map((r) => r.id);
  } catch (e) {
    console.warn('searchDb.findFuzzyCustomerIds failed:', e && e.message ? e.message : e);
    return [];
  }
}
