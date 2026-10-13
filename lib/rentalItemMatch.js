'use strict';
// lib/rentalItemMatch.js — איזה פריטים של הזמנה מתאימים לברקוד שנסרק (קידומת + מידה).
// חולץ מ-app/api/rentals/scan/route.js (POST, שלב 5) כדי שגם חלונית הברקוד בלו״ז (lib/schedule/barcodeScan.js) תשתמש באותו כלל בדיוק
// ולא בפענוח מקביל. CommonJS טהור (בלי prisma/next) - נבדק ב-scripts/schedule-tests/barcode-match.test.mjs מול הקוד הישן.
//
// הפענוח: קידומת = כל הספרות חוץ מ-4 האחרונות (parseInt), מידה = שתי הספרות שלפני האחרונות (parseInt) - כמו parseBarcode
// ב-lib/rentalBarcodeMatch.js, אבל עם parseInt "רופף" כמו בראוט המקורי (ברקוד לא-מספרי נותן NaN ולא מתאים לכלום).

/** @returns {{prefix:number, size:number}} (NaN אפשרי - ואז שום פריט לא יתאים) */
function splitBarcodeForMatch(barcode) {
  const b = String(barcode ?? '');
  const prefixStr = b.substring(0, b.length - 4);
  const sizeStr = b.substring(b.length - 4, b.length - 2);
  return { prefix: parseInt(prefixStr), size: parseInt(sizeStr) };
}

/** האם פריט הזמנה אחד מתאים לברקוד (אותה מחרוזת תנאי כמו בראוט המקורי). */
function itemMatchesBarcode(item, parsed) {
  const pfx = item.dressItem?.dress?.barcodePrefix || item.dressItem?.barcodePrefix || item.barcodePrefix;
  const sz = item.dressItem?.sizeText || item.sizeText || '';
  return pfx === parsed.prefix && parseInt(sz) === parsed.size;
}

/** מסנן מתוך רשימת פריטי הזמנה את אלה שמתאימים לברקוד. */
function filterItemsForBarcode(items, barcode) {
  const parsed = splitBarcodeForMatch(barcode);
  return (items || []).filter((item) => itemMatchesBarcode(item, parsed));
}

/**
 * האם כמה פריטים תואמים נבדלים בתיקונים (אז המשתמשת צריכה לבחור) - אותו תנאי כמו שלב 7 בראוט המקורי.
 * @returns {boolean}
 */
function matchesDifferInAlterations(matching) {
  if (!matching || matching.length < 2) return false;
  return matching.some((item) =>
    item.neckAlteration !== matching[0].neckAlteration ||
    item.lengthAlteration !== matching[0].lengthAlteration ||
    item.sleeveAlteration !== matching[0].sleeveAlteration);
}

module.exports = { splitBarcodeForMatch, itemMatchesBarcode, filterItemsForBarcode, matchesDifferInAlterations };
