'use strict';
// lib/rentalBarcodeMatch.js — התאמה בין ברקוד שנסרק/הוקלד לבין פריט שהוזמן בהזמנה.
//
// נכתב כ-CommonJS טהור (בלי prisma/next) בכוונה, כמו lib/authTokens.js: אפשר להריץ
// עליו סקריפט node רגיל (scripts/test_rental_barcode_match.js) ולבדוק את הלוגיקה האמיתית.
// הצד התלוי-שרת (הגדרה, אישור מנהל, התראה) נמצא ב-lib/rentalBarcodeGuard.js.
//
// פורמט הברקוד (כמו ב-app/api/rentals/scan/route.js ו-/api/rentals/verify-item):
//   קידומת (הדגם) = כל הספרות חוץ מ-4 האחרונות, מידה = שתי הספרות שלפני האחרונות,
//   מספר סידורי = שתי הספרות האחרונות.   1750301 -> דגם 175, מידה 03, סידורי 01.
// אומת מול הנתונים (TEST + נווה יעקב, 2026-09-20): בכל פריטי המאגר הכלל הזה מתאים
// בדיוק לדגם ולמידה ששמורים ב-DB, כולל הברקוד הישן באורך 5 ('41807' = דגם 4, מידה 18).
// ברקוד שאי אפשר לפענח (לא ספרות בלבד / קצר מ-5 תווים) לא נחסם - לא מוצאים בו דגם בכלל.

/**
 * מפרק ברקוד לקידומת/מידה/סידורי. מחזיר null כשהפורמט לא ניתן לפענוח.
 * @param {string|number|null|undefined} barcode
 * @returns {{prefix: string, size: string, serial: string}|null}
 */
function parseBarcode(barcode) {
  if (barcode === null || barcode === undefined) return null;
  const b = String(barcode).trim();
  if (!/^\d{5,}$/.test(b)) return null;
  return {
    prefix: b.slice(0, b.length - 4),
    size: b.slice(b.length - 4, b.length - 2),
    serial: b.slice(b.length - 2),
  };
}

// השוואה מספרית של ערך שאמור להיות מספר שלם ("06" == "6" == 6). null = לא ניתן להשוות.
function toIntOrNull(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!/^\d+$/.test(s)) return null;
  return parseInt(s, 10);
}

/**
 * הדגם והמידה שהוזמנו בפריט הזמנה, באותו סדר עדיפויות שבו הקוד הקיים מזהה אותם
 * (ר' ModernItemsManager.itemCode / scan/route.js). ערך חסר = null.
 * @returns {{prefix: string|null, size: string|null}}
 */
function getOrderedIdentity(item) {
  const prefix = item?.dressItem?.dress?.barcodePrefix || item?.dressItem?.barcodePrefix || item?.barcodePrefix || null;
  const size = item?.sizeText || item?.dressItem?.sizeText || null;
  return {
    prefix: prefix === null ? null : String(prefix),
    size: size === null ? null : String(size),
  };
}

/**
 * האם הברקוד תואם לפריט ההזמנה?
 *  - ok=true, reason='match'        : דגם ומידה תואמים.
 *  - ok=true, reason='unparsable'   : הברקוד לא ניתן לפענוח - לא חוסמים.
 *  - ok=true, reason='no-item-info' : אין בפריט לא דגם ולא מידה להשוואה - לא חוסמים.
 *  - ok=false, reason='model'|'size'|'model+size' : אי-התאמה.
 * ממד שחסר בפריט (או שאינו מספרי, למשל מידה "כללי") לא נבדק - נבדק רק מה שאפשר להשוות.
 * @returns {{ok: boolean, reason: string, expected: {prefix: string|null, size: string|null}, scanned: {prefix: string|null, size: string|null}}}
 */
function checkBarcodeMatchesItem(item, barcode) {
  const expected = getOrderedIdentity(item);
  const parsed = parseBarcode(barcode);
  if (!parsed) {
    return { ok: true, reason: 'unparsable', expected, scanned: { prefix: null, size: null } };
  }
  const scanned = { prefix: parsed.prefix, size: parsed.size };

  const expPrefix = toIntOrNull(expected.prefix);
  const expSize = toIntOrNull(expected.size);
  if (expPrefix === null && expSize === null) {
    return { ok: true, reason: 'no-item-info', expected, scanned };
  }

  const modelBad = expPrefix !== null && toIntOrNull(parsed.prefix) !== expPrefix;
  const sizeBad = expSize !== null && toIntOrNull(parsed.size) !== expSize;
  if (!modelBad && !sizeBad) return { ok: true, reason: 'match', expected, scanned };
  return { ok: false, reason: modelBad && sizeBad ? 'model+size' : (modelBad ? 'model' : 'size'), expected, scanned };
}

/**
 * הודעת אי-ההתאמה בעברית (זהה בשרת ובלקוח).
 */
function describeMismatch(expected, scanned) {
  const fmt = (v) => (v === null || v === undefined || v === '' ? '?' : String(v));
  return `הברקוד שנסרק (דגם ${fmt(scanned?.prefix)} מידה ${fmt(scanned?.size)}) לא תואם לפריט שהוזמן (דגם ${fmt(expected?.prefix)} מידה ${fmt(expected?.size)})`;
}

module.exports = { parseBarcode, getOrderedIdentity, checkBarcodeMatchesItem, describeMismatch };
