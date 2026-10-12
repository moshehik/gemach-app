// מיון מידות: sizeText הוא טקסט ב-DB, ולכן מיון רגיל נותן "10" לפני "2".
// כאן ממיינים לפי הערך המספרי שבתחילת המידה (גם "38-40" נופל על 38),
// ומידות בלי מספר (למשל "כללי") נדחפות לסוף לפי א"ב.
export function compareSizeText(a, b) {
  const aStr = String(a ?? '');
  const bStr = String(b ?? '');
  const aNum = parseFloat(aStr);
  const bNum = parseFloat(bStr);
  const aIsNum = !isNaN(aNum);
  const bIsNum = !isNaN(bNum);
  if (aIsNum && bIsNum) return (aNum - bNum) || aStr.localeCompare(bStr, 'he');
  if (aIsNum) return -1;
  if (bIsNum) return 1;
  return aStr.localeCompare(bStr, 'he');
}

// מפתח השוואה למידה (בדיקת מלאי, lib/stockCheck.js + lib/stockCheckUi.js): רווחים נחתכים; מספר שלם עד 3 ספרות
// בלי אפסים מובילים ("06" ≡ "6" ≡ " 06", "00" ≡ "0"); ריק = "כללי"; כל טקסט אחר ("06.1", "36א", "38-40") כפי שהוא.
// רקע: ב-DB המידות נשמרות כטקסט מהייבוא (בגמ"ח הראשי תמיד בשתי ספרות, בנווה יעקב מעורב). מודול טהור, בלי imports.
// עשרוני שהחלק שאחרי הנקודה כולו אפסים ("38.0", "38.00", "038,0") הוא אותה מידה שלמה ("38") — ככה גם ייבוא/עורך שמרשים
// ערך מספרי צף כותב מידה שלמה. עשרוני אמיתי ("06.1", "00.5") הוא מידה נפרדת ולא "38" — לא מעגלים אותו. מה שמאחדים הוא הכתיב בלבד:
// אפס מוביל בחלק השלם ופסיק/נקודה ("06.1" ≡ "6.1" ≡ "6,1"; "00.6" ≡ "0.6"), כי DressItem שומר "06.1" ו-OrderItem שומר "6.1" (החלטת בעלים 12.10.2026).
// החלק שאחרי הנקודה נשמר כמות שהוא ("6.1" ≠ "6.10" ≠ "6.2").
export const GENERAL_SIZE_KEY = 'כללי';
export function normalizeSizeKey(raw) {
  const t = String(raw ?? '').trim();
  if (!t) return GENERAL_SIZE_KEY;
  if (/^\d{1,3}$/.test(t)) return String(parseInt(t, 10));
  const zeroFraction = /^(\d{1,3})[.,]0+$/.exec(t);
  if (zeroFraction) return String(parseInt(zeroFraction[1], 10));
  const decimal = /^(\d{1,3})[.,](\d+)$/.exec(t);
  if (decimal) return `${parseInt(decimal[1], 10)}.${decimal[2]}`;
  return t;
}

// ---------------------------------------------------------------------------------------------------------------------
// תפריטי מידות (רשימות הצעות): רק מידות שלמות (בדיקת מלאי + חיפוש מתקדם). החלטת הבעלים, 12.10.2026 (נושא 12).
// ב-DB של נווה יעקב יש גם מידות עשרוניות ("06.1", "00.5", "01.8" — מידות קטנות/וריאציות של דגם), אותיות צמודות ("36א"), טווחים
// ("38-40") וכתיבים עם רווחים/אפסים (" 36", "08" ו-"8"). תפריט שמציע את כולן נראה "מלא במידות עשרוניות". הכלל: התפריט מציע
// מפתחות שלמים בלבד (1-3 ספרות, אחרי normalizeSizeKey), כל כתיב שקול מאוחד לשורה אחת. מי שמקלידה במפורש תו שאינו ספרה
// ("38." / "36א" / "XL" / "כל") מקבלת גם את המידות החריגות התואמות — כך הן עדיין ניתנות למציאה, רק לא נדחפות לרשימה.
// זה לא נוגע בנתונים וגם לא בבורר המידות של הזמנה (שם מוצגות המידות שבאמת קיימות בדגם — פריט "06.1" הוא שמלה אמיתית).
// ---------------------------------------------------------------------------------------------------------------------

/** האם מפתח (פלט normalizeSizeKey) הוא מידה שלמה: 1-3 ספרות. "כללי", "06.1", "36א", "38-40" — לא. */
export function isWholeSizeKey(key) {
  return /^\d{1,3}$/.test(String(key ?? ''));
}

/** האם ערך גולמי (כפי שנשמר ב-DB / הוקלד) הוא מידה שלמה, אחרי נרמול: "38", "038", " 38 ", "38.0" — כן; "38.5", "36א" — לא. */
export function isWholeSize(raw) {
  return isWholeSizeKey(normalizeSizeKey(raw));
}

/** האם מה שהוקלד בשדה המידה מבקש במפורש מידה חריגה (כולל תו שאינו ספרה/רווח): אז מותר להציע גם עשרוניות/אותיות. */
export function typedWantsOtherSizes(typed) {
  return /[^\d\s]/.test(String(typed ?? ''));
}

/**
 * מאחד שורות `{ sizeText, count }` (למשל תוצאת groupBy) לקבוצות לפי normalizeSizeKey.
 * display = הכתיב הנפוץ ביותר בקבוצה (שוויון: הקצר), נחתך מרווחים; כתיב שאינו ספרות בלבד ("38.0") מוצג כמפתח השלם ("38").
 * @returns {{key: string, v: string, whole: boolean, count: number}[]} בסדר ההופעה הראשונה.
 */
export function groupSizeRows(rows) {
  const groups = new Map();
  for (const r of rows || []) {
    const raw = String(r?.sizeText ?? '').trim();
    const key = normalizeSizeKey(raw);
    const n = Number(r?.count) || 0;
    const display = !raw ? GENERAL_SIZE_KEY : (/^\d{1,3}$/.test(raw) ? raw : (isWholeSizeKey(key) ? key : raw));
    const g = groups.get(key);
    if (!g) groups.set(key, { key, v: display, whole: isWholeSizeKey(key), count: n, best: n });
    else {
      g.count += n;
      if (n > g.best || (n === g.best && display.length < g.v.length)) { g.v = display; g.best = n; }
    }
  }
  return [...groups.values()].map(({ key, v, whole, count }) => ({ key, v, whole, count }));
}

/**
 * בוחר מקבוצות groupSizeRows את מה שמציעים בתפריט: מידות שלמות בלבד, אלא אם typed מבקש במפורש אחרת (typedWantsOtherSizes).
 * `match(group, typedTrimmed)` (אופציונלי) מסנן עוד לפי מה שהוקלד; בלי הפונקציה — רק כלל "שלמות" (כשהשאילתה כבר סוננה ב-DB).
 */
export function pickSizeMenu(groups, typed, match) {
  const t = String(typed ?? '').trim();
  const other = typedWantsOtherSizes(t);
  return (groups || []).filter((g) => (g.whole || other) && (!match || match(g, t)));
}

// ממיין רשימת שורות זמינות ({ sizeText / size }) בלי לשנות את המערך המקורי.
export function sortSizeRows(rows) {
  return [...rows].sort((a, b) => compareSizeText(a.sizeText || a.size, b.sizeText || b.size));
}
