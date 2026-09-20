// בדיקת יחידה ללוגיקת ההתאמה בין ברקוד לפריט הזמנה (lib/rentalBarcodeMatch.js).
// הרצה: node scripts/test_rental_barcode_match.js   (יוצא עם קוד 1 אם משהו נכשל)
const assert = require('assert');
const { parseBarcode, checkBarcodeMatchesItem, describeMismatch } = require('../lib/rentalBarcodeMatch');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

// פריט הזמנה בצורה שבה הראוטים טוענים אותו (דגם דרך dress.barcodePrefix, מידה כטקסט)
const item = (over = {}) => ({
  sizeText: '03', barcodePrefix: null,
  dressItem: { barcodePrefix: 175, sizeText: '03', dress: { barcodePrefix: 175 } },
  ...over,
});

console.log('parseBarcode');
t('פורמט רגיל 7 ספרות', () => assert.deepStrictEqual(parseBarcode('1750301'), { prefix: '175', size: '03', serial: '01' }));
t('הבאג האמיתי (הזמנה 52103): 5470606', () => assert.deepStrictEqual(parseBarcode('5470606'), { prefix: '547', size: '06', serial: '06' }));
t('ברקוד ישן באורך 5 (41807) = דגם 4, מידה 18', () => assert.deepStrictEqual(parseBarcode('41807'), { prefix: '4', size: '18', serial: '07' }));
t('קידומת ארוכה (5 ספרות)', () => assert.strictEqual(parseBarcode('123451001').prefix, '12345'));
t('מספר במקום מחרוזת', () => assert.strictEqual(parseBarcode(1750301).prefix, '175'));
t('רווחים מסביב', () => assert.strictEqual(parseBarcode(' 1750301 ').size, '03'));
t('ברקוד קצר (4) - לא ניתן לפענוח', () => assert.strictEqual(parseBarcode('3201'), null));
t('לא ספרות - לא ניתן לפענוח', () => assert.strictEqual(parseBarcode('AB12345'), null));
t('ריק / null / undefined', () => { assert.strictEqual(parseBarcode(''), null); assert.strictEqual(parseBarcode(null), null); assert.strictEqual(parseBarcode(undefined), null); });

console.log('checkBarcodeMatchesItem');
t('התאמה מלאה', () => assert.strictEqual(checkBarcodeMatchesItem(item(), '1750301').ok, true));
t('התאמה מלאה - סידורי שונה זה בסדר', () => assert.strictEqual(checkBarcodeMatchesItem(item(), '1750399').ok, true));
t('אפס מוביל: מידה "6" מול ברקוד 06', () => assert.strictEqual(checkBarcodeMatchesItem(item({ sizeText: '6', dressItem: null, barcodePrefix: 175 }), '1750601').ok, true));
t('אפס מוביל: מידה "06" מול ברקוד 06', () => assert.strictEqual(checkBarcodeMatchesItem(item({ sizeText: '06' }), '1750601').ok, true));
t('אפס מוביל: מידה "6" לא שווה ל-16', () => assert.strictEqual(checkBarcodeMatchesItem(item({ sizeText: '6' }), '1751601').reason, 'size'));
t('דגם שונה (המקרה מ-TEST: 1200301 מול דגם 175)', () => {
  const r = checkBarcodeMatchesItem(item(), '1200301');
  assert.strictEqual(r.ok, false); assert.strictEqual(r.reason, 'model');
  assert.deepStrictEqual(r.expected, { prefix: '175', size: '03' }); assert.deepStrictEqual(r.scanned, { prefix: '120', size: '03' });
});
t('מידה שונה', () => assert.strictEqual(checkBarcodeMatchesItem(item(), '1750501').reason, 'size'));
t('דגם ומידה שונים', () => assert.strictEqual(checkBarcodeMatchesItem(item(), '5470606').reason, 'model+size'));
t('המקרה מהזמנה 52103: הוזמן 557/06, נסרק 5470606', () => {
  const r = checkBarcodeMatchesItem({ sizeText: '06', dressItem: { dress: { barcodePrefix: 557 } } }, '5470606');
  assert.strictEqual(r.ok, false); assert.strictEqual(r.reason, 'model');
});
t('ברקוד ישן 41807 מול פריט דגם 4 מידה 18 - עובר', () => assert.strictEqual(checkBarcodeMatchesItem({ sizeText: '18', dressItem: { dress: { barcodePrefix: 4 } } }, '41807').ok, true));
t('ברקוד ישן 41807 מול דגם אחר - נחסם', () => assert.strictEqual(checkBarcodeMatchesItem({ sizeText: '18', dressItem: { dress: { barcodePrefix: 175 } } }, '41807').ok, false));
t('פריט ישן ללא DressItem: דגם מ-barcodePrefix של הפריט', () => assert.strictEqual(checkBarcodeMatchesItem({ sizeText: '03', barcodePrefix: 175, dressItem: null }, '1750301').ok, true));
t('סדר עדיפויות: dress.barcodePrefix גובר על dressItem.barcodePrefix', () => assert.strictEqual(checkBarcodeMatchesItem({ sizeText: '03', dressItem: { barcodePrefix: 999, dress: { barcodePrefix: 175 } } }, '1750301').ok, true));
t('מידה: sizeText של הפריט גובר על של DressItem', () => assert.strictEqual(checkBarcodeMatchesItem({ sizeText: '03', dressItem: { sizeText: '09', dress: { barcodePrefix: 175 } } }, '1750301').ok, true));

console.log('חוסר מידע - לא חוסמים');
t('אין דגם ואין מידה בפריט', () => assert.strictEqual(checkBarcodeMatchesItem({ sizeText: null, dressItem: null }, '5470606').reason, 'no-item-info'));
t('אין פריט בכלל (null)', () => assert.strictEqual(checkBarcodeMatchesItem(null, '5470606').ok, true));
t('אין דגם - נבדקת המידה בלבד (מתאימה)', () => assert.strictEqual(checkBarcodeMatchesItem({ sizeText: '06', dressItem: null }, '5470606').ok, true));
t('אין דגם - נבדקת המידה בלבד (שונה) נחסם', () => assert.strictEqual(checkBarcodeMatchesItem({ sizeText: '08', dressItem: null }, '5470606').ok, false));
t('אין מידה - נבדק הדגם בלבד (שונה) נחסם', () => assert.strictEqual(checkBarcodeMatchesItem({ sizeText: null, dressItem: { dress: { barcodePrefix: 557 } } }, '5470606').reason, 'model'));
t('מידה לא מספרית ("כללי") לא נבדקת', () => assert.strictEqual(checkBarcodeMatchesItem({ sizeText: 'כללי', dressItem: { dress: { barcodePrefix: 547 } } }, '5470606').ok, true));
t('ברקוד שלא ניתן לפענח (3201) לא נחסם', () => assert.strictEqual(checkBarcodeMatchesItem(item(), '3201').reason, 'unparsable'));
t('ברקוד עם אותיות לא נחסם', () => assert.strictEqual(checkBarcodeMatchesItem(item(), 'XYZ-77').ok, true));

console.log('describeMismatch');
t('נוסח ההודעה', () => assert.strictEqual(
  describeMismatch({ prefix: '557', size: '06' }, { prefix: '547', size: '06' }),
  'הברקוד שנסרק (דגם 547 מידה 06) לא תואם לפריט שהוזמן (דגם 557 מידה 06)'));
t('ערך חסר מוצג כ-?', () => assert.ok(describeMismatch({ prefix: null, size: '06' }, { prefix: '547', size: '06' }).includes('דגם ? מידה 06')));

console.log(process.exitCode ? '\nנכשלו בדיקות' : `\nכל ${passed} הבדיקות עברו`);
