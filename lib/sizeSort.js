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
export const GENERAL_SIZE_KEY = 'כללי';
export function normalizeSizeKey(raw) {
  const t = String(raw ?? '').trim();
  if (!t) return GENERAL_SIZE_KEY;
  if (/^\d{1,3}$/.test(t)) return String(parseInt(t, 10));
  return t;
}

// ממיין רשימת שורות זמינות ({ sizeText / size }) בלי לשנות את המערך המקורי.
export function sortSizeRows(rows) {
  return [...rows].sort((a, b) => compareSizeText(a.sizeText || a.size, b.sizeText || b.size));
}

// ---------------------------------------------------------------------------------------------------------------------
// מיון רשימות הכנה (מסך הלו״ז, דף הכנה / מדבקות / צ׳ק ליסט, הדפסת "הכנות להיום" = /print/order, מייל ההזמנה).
// הבעיה (12.10.2026): פריטי הזמנה נשלפים בלי ORDER BY, ולכן יצאו בסדר ההכנסה: "10, 6, 8". הכלל המשותף לכל המשטחים:
//   דגם לפי מספר הדגם (barcodePrefix) עולה, ובתוך אותו דגם לפי המידה עולה; שוויון = סדר ההופעה המקורי (מיון יציב).
// סדר מידות (compareSizesForList): מספרי קודם — לפי הערך המספרי שבתחילת המידה ("6" < "06.1" < "8" < "10" < "36" < "36א" < "38-40",
// "00.5" לפני הכל; אפסים מובילים לא משנים: "06" ≡ "6"); אחר כך מידות אותיות ("XS" < "S" < "S/M" < "M" < "L" < "XL" < "XXL"); אחר כך כל טקסט אחר
// ("כללי", "אחיד") לפי א"ב; ריק / null / "null" / רווחים — תמיד בסוף. מודול טהור, בלי imports.
// ---------------------------------------------------------------------------------------------------------------------

const LETTER_SIZE_RANK = { XXS: 1, XS: 2, S: 3, M: 4, L: 5, XL: 6, XXL: 7, '2XL': 7, XXXL: 8, '3XL': 8 };

// מפתח מיון: kind 0 = מספרי (num + rest), 1 = אותיות (num = דרגה), 2 = טקסט אחר, 3 = ריק.
function listSortKey(raw, letters) {
  const s = String(raw ?? '').trim();
  if (!s || /^(null|undefined)$/i.test(s)) return { kind: 3, num: 0, rest: '' };
  const m = /^(\d+)(?:[.,](\d+))?(.*)$/.exec(s);
  if (m) return { kind: 0, num: parseFloat(m[1] + (m[2] ? '.' + m[2] : '')), rest: m[3].trim() };
  if (letters) {
    const parts = s.toUpperCase().split(/[\s/\-]+/).filter(Boolean);
    if (parts.length && parts.length <= 2 && parts.every((p) => LETTER_SIZE_RANK[p])) {
      return { kind: 1, num: LETTER_SIZE_RANK[parts[0]] + (parts.length - 1) * 0.5, rest: '' };
    }
  }
  return { kind: 2, num: 0, rest: s };
}

function compareListKeys(a, b) {
  if (a.kind !== b.kind) return a.kind - b.kind;
  if (a.num !== b.num) return a.num - b.num;
  return a.rest === b.rest ? 0 : a.rest.localeCompare(b.rest, 'he');
}

/** השוואת מידות לרשימות הכנה: מספרי עולה, אחר כך אותיות (XS..XXL), אחר כך טקסט, ריקים בסוף. 0 = שקולות (מיון יציב משאיר את הסדר המקורי). */
export function compareSizesForList(a, b) {
  return compareListKeys(listSortKey(a, true), listSortKey(b, true));
}

/** השוואת מספרי דגם (barcodePrefix): מספרי עולה ("522" < "4512"), אחר כך טקסט, ריקים בסוף. */
export function compareModelCodes(a, b) {
  return compareListKeys(listSortKey(a, false), listSortKey(b, false));
}

/**
 * מחזיר עותק ממוין של `list`: לפי מספר דגם עולה ואז מידה עולה; שוויון = הסדר המקורי.
 * getCode(item) = מספר הדגם (barcodePrefix; אפשר גם שם הדגם כשאין מספר), getSize(item) = טקסט המידה.
 */
export function sortByModelThenSize(list, getCode, getSize) {
  return (list || [])
    .map((item, i) => ({ item, i, code: getCode(item), size: getSize(item) }))
    .sort((a, b) => compareModelCodes(a.code, b.code) || compareSizesForList(a.size, b.size) || a.i - b.i)
    .map((x) => x.item);
}
