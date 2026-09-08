// עוזר חיפוש משותף — מטפל בבעיה החוזרת בכמה מסכים (לקוחות/הזמנות/חיפוש כללי):
// חיפוש "לפי שם" נבדק בעבר בנפרד על firstName ועל lastName מול המחרוזת השלמה
// שהוקלדה (contains), כך שחיפוש שם מלא כמו "רחל כהן" לא מצא כלום - אף אחד
// מהשדות אינו מכיל את שתי המילים יחד, רק אחת מהן. ר' דיווחי לקוחה: "החיפוש
// במסך לקוחות לא עובד לפי שם" + "החיפוש בהזמנות לא עובד".
//
// הפתרון: אם המחרוזת מכילה יותר ממילה אחת, בנוסף להתאמה הרגילה (שדה בודד
// מכיל את כל המחרוזת - למקרה של שם משפחה דו-מילתי וכדומה), דורשים שכל מילה
// תימצא איפשהו בין שני השדות (שם פרטי/משפחה), בכל סדר.

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
