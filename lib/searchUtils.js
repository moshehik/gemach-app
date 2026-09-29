// עוזר חיפוש משותף — מטפל בבעיה החוזרת בכמה מסכים (לקוחות/הזמנות/חיפוש כללי):
// חיפוש "לפי שם" נבדק בעבר בנפרד על firstName ועל lastName מול המחרוזת השלמה
// שהוקלדה (contains), כך שחיפוש שם מלא כמו "רחל כהן" לא מצא כלום - אף אחד
// מהשדות אינו מכיל את שתי המילים יחד, רק אחת מהן. ר' דיווחי לקוחה: "החיפוש
// במסך לקוחות לא עובד לפי שם" + "החיפוש בהזמנות לא עובד".
//
// הפתרון: אם המחרוזת מכילה יותר ממילה אחת, בנוסף להתאמה הרגילה (שדה בודד
// מכיל את כל המחרוזת - למקרה של שם משפחה דו-מילתי וכדומה), דורשים שכל מילה
// תימצא איפשהו בין שני השדות (שם פרטי/משפחה), בכל סדר.

import { hebrewPhoneticKey } from './hebrewPhonetic';

/**
 * מפצל מחרוזת חיפוש חופשית למילים (מתעלם מרווחים כפולים/קצוות).
 */
export function splitSearchWords(search) {
  return String(search || '').trim().split(/\s+/).filter(Boolean);
}

/**
 * בונה תנאי Prisma נוסף שמתאים חיפוש שם-מלא רב-מילים על פני שני שדות טקסט
 * (בד"כ firstName/lastName) - כל מילה מהחיפוש חייבת להימצא (contains) באחד
 * משני השדות, בלי תלות בסדר. מחזיר null כשאין טעם להוסיף תנאי (0-1 מילים,
 * כי אז ההתאמה הרגילה על כל שדה בנפרד כבר מכסה את זה).
 *
 * @param {string} search
 * @param {string} firstField - למשל 'firstName'
 * @param {string} secondField - למשל 'lastName'
 * @returns {object|null} תנאי Prisma למקום ב-OR קיים, או null
 */
export function buildMultiWordNameCondition(search, firstField, secondField) {
  const words = splitSearchWords(search);
  if (words.length < 2) return null;
  return {
    AND: words.map((w) => ({
      OR: [
        { [firstField]: { contains: w } },
        { [secondField]: { contains: w } }
      ]
    }))
  };
}

/**
 * כמו buildMultiWordNameCondition, אבל לשדה מקונן ביחס (למשל customer.firstName
 * בטבלת Order) - עוטף כל תנאי ב-{ customer: { OR: [...] } } במקום שטוח.
 */
export function buildMultiWordRelationNameCondition(search, relationName, firstField, secondField) {
  const words = splitSearchWords(search);
  if (words.length < 2) return null;
  return {
    AND: words.map((w) => ({
      [relationName]: {
        OR: [
          { [firstField]: { contains: w } },
          { [secondField]: { contains: w } }
        ]
      }
    }))
  };
}

/**
 * גרסת SQL-גולמי (למסלולים שמשתמשים ב-$queryRawUnsafe, כמו global-search):
 * מחזיר { clauseSql, params } - clauseSql הוא ביטוי SQL בסגנון
 * '(("firstName" ILIKE $4 OR "lastName" ILIKE $4) AND ("firstName" ILIKE $5 OR "lastName" ILIKE $5))'
 * שיש לשלב עם OR לתוך שאילתת ה-WHERE הקיימת, ו-params הם הערכים להוסיף
 * לרשימת הפרמטרים המקושרים (LIKE, לא ILIKE, כדי להתאים למוסכמת השאילתות
 * הקיימות באותו קובץ).
 *
 * @param {string} search
 * @param {number} startParamIndex - האינדקס הבא הפנוי ב-$N (אחרי הפרמטרים הקיימים)
 * @param {string} firstCol - למשל '"firstName"' (עם מרכאות/prefix טבלה לפי הצורך)
 * @param {string} secondCol - למשל '"lastName"'
 */
export function buildMultiWordNameSql(search, startParamIndex, firstCol, secondCol) {
  const words = splitSearchWords(search);
  if (words.length < 2) return null;
  const parts = [];
  const params = [];
  words.forEach((w, i) => {
    const paramIdx = startParamIndex + i;
    parts.push(`(${firstCol} LIKE $${paramIdx} OR ${secondCol} LIKE $${paramIdx})`);
    params.push(`%${w}%`);
  });
  return { clauseSql: `(${parts.join(' AND ')})`, params };
}

/**
 * Tier 2+3 fuzzy name matching for raw-SQL routes (docs/smart-quick-search-plan-2026-09-27.md):
 * pg_trgm similarity (catches typos/small edits) + a Hebrew phonetic key
 * (lib/hebrewPhonetic.js; catches recurring Ashkenazi-surname spelling variants
 * like שיינועטר/שיינווטר that trigram similarity alone can miss). Additive only -
 * never replaces the caller's existing exact/LIKE tier, just widens recall.
 *
 * Requires the pg_trgm extension + a gin_trgm_ops index on firstNameCol/lastNameCol,
 * and a plain index on firstKeyCol/lastKeyCol, to stay index-accelerated (see the
 * plan doc's verified EXPLAIN results - both now exist on both orgs' prod DBs).
 *
 * @returns {{clauseSql: string, scoreSql: string, params: any[]}|null} null when
 *   the search string is too short (<2 chars) to be meaningful. clauseSql is an
 *   extra OR condition for the WHERE; scoreSql is an ORDER BY ... DESC expression
 *   that ranks real trigram matches above phonetic-only matches.
 */
export function buildFuzzyNameSql(search, startParamIndex, firstCol, secondCol, firstKeyCol, secondKeyCol) {
  const q = String(search || '').trim();
  if (q.length < 2) return null;

  const key = hebrewPhoneticKey(q);
  const qParam = startParamIndex;
  const params = [q];
  const orParts = [`${firstCol} % $${qParam}`, `${secondCol} % $${qParam}`];
  let keyParam = null;
  if (key) {
    keyParam = startParamIndex + 1;
    params.push(key);
    orParts.push(`${firstKeyCol} = $${keyParam}`, `${secondKeyCol} = $${keyParam}`);
  }

  const clauseSql = `(${orParts.join(' OR ')})`;
  // Phonetic-only matches get a small fixed score (below pg_trgm's default 0.3
  // similarity_threshold) so real trigram matches always outrank them, but they
  // still sort above unrelated rows.
  const scoreSql = `GREATEST(similarity(${firstCol}, $${qParam}), similarity(${secondCol}, $${qParam})${
    key ? `, CASE WHEN ${firstKeyCol} = $${keyParam} OR ${secondKeyCol} = $${keyParam} THEN 0.15 ELSE 0 END` : ''
  })`;

  return { clauseSql, scoreSql, params };
}
