// בדיקות לוגיקה טהורה: lib/dressInputValidation.js (ולידציית שרת ליצירת דגם / פריט). הרצה: node scripts/test_dress_input_validation.mjs
import assert from 'node:assert/strict';
import { validateCode, validateModelInput, validateItemInput } from '../lib/dressInputValidation.js';

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log('  ok   -', name); };

t('קוד: אורך לפי ההגדרה, ספרות בלבד, בלי 0 מוביל', () => {
  assert.equal(validateCode('623', 3).data, 623);
  for (const bad of ['62', '6234', '99871', '998x', '007', '٦٢٣', '６２３', '', ' ']) assert.ok(validateCode(bad, 3).error, `"${bad}"`);
  assert.equal(validateCode('1234', 4).data, 1234);
});
t('דגם: שם ריק / רווחים / ארוך נדחה; חסר = אוטומטי', () => {
  assert.ok(validateModelInput({ barcodePrefix: '623', name: '   ' }, { codeLen: 3 }).error);
  assert.ok(validateModelInput({ barcodePrefix: '623', name: 'x'.repeat(101) }, { codeLen: 3 }).error);
  assert.equal(validateModelInput({ barcodePrefix: '623' }, { codeLen: 3 }).data.name, null);
  assert.equal(validateModelInput({ barcodePrefix: 623, name: ' רומנטיקה ' }, { codeLen: 3 }).data.name, 'רומנטיקה');
});
t('דגם: קטגוריה חייבת להתקיים במחירון; הערות / כתובת תמונה / תאריך מוגבלים', () => {
  const ctx = { codeLen: 3, categories: ['כללי', 'אחר'] };
  assert.ok(validateModelInput({ barcodePrefix: '623', name: 'א', priceCategory: 'לא-קיימת' }, ctx).error);
  assert.equal(validateModelInput({ barcodePrefix: '623', name: 'א', priceCategory: 'כללי' }, ctx).data.priceCategory, 'כללי');
  assert.equal(validateModelInput({ barcodePrefix: '623', name: 'א', priceCategory: '' }, ctx).data.priceCategory, null);
  assert.ok(validateModelInput({ barcodePrefix: '623', name: 'א', notes: 'x'.repeat(2001) }, ctx).error);
  assert.ok(validateModelInput({ barcodePrefix: '623', name: 'א', imageUrl: 'x'.repeat(2001) }, ctx).error);
  assert.ok(validateModelInput({ barcodePrefix: '623', name: 'א', entryDateToRepo: 'nope' }, ctx).error);
  assert.ok(validateModelInput({ barcodePrefix: '623', name: 'א', entryDateToRepo: '0001-01-01' }, ctx).error);
  assert.ok(validateModelInput(null).error);
  assert.ok(validateModelInput([]).error);
});
t('פריט: מידה / סידורי / כמות / ריק', () => {
  const m = { barcodePrefix: 623 };
  const ok = validateItemInput({ sizeText: '38', serialNumber: 1, dressBarcode: '6233801' }, m);
  assert.deepEqual([ok.data.sizeText, ok.data.serialNumber, ok.data.dressBarcode, ok.data.quantity], ['38', 1, '6233801', 1]);
  assert.ok(validateItemInput({}, m).error, 'פריט ריק');
  for (const serial of [0, 100, 777, 'abc', 1.5, -1]) assert.ok(validateItemInput({ sizeText: '38', serialNumber: serial, dressBarcode: '6233801' }, m).error, `serial ${serial}`);
  assert.ok(validateItemInput({ sizeText: '38', serialNumber: 1, dressBarcode: '6233801', quantity: -5 }, m).error);
  assert.ok(validateItemInput({ sizeText: '38', serialNumber: 1, dressBarcode: '6233801', quantity: 1000 }, m).error);
  assert.ok(validateItemInput({ sizeText: '<b>', serialNumber: 1 }, m).error);
});
t('פריט: ברקוד ספרות בלבד, מתחיל בקוד הדגם, ומתאים למידה+סידורי', () => {
  const m = { barcodePrefix: 623 };
  assert.ok(validateItemInput({ sizeText: '38', serialNumber: 1, dressBarcode: 'zzz' }, m).error);
  assert.ok(validateItemInput({ sizeText: '38', serialNumber: 1, dressBarcode: '1233801' }, m).error, 'קידומת שגויה');
  assert.ok(validateItemInput({ sizeText: '38', serialNumber: 1, dressBarcode: '6233802' }, m).error, 'סידורי לא מתאים');
  assert.ok(validateItemInput({ sizeText: '40', serialNumber: 1, dressBarcode: '6233801' }, m).error, 'מידה לא מתאימה');
  assert.equal(validateItemInput({ sizeText: '8', serialNumber: 3, dressBarcode: '6230803' }, m).data.dressBarcode, '6230803'); // מידה "8" = "08"
  assert.equal(validateItemInput({ sizeText: 'S', serialNumber: 3, dressBarcode: '6230003' }, m).error, undefined); // מידה לא מספרית - לא כופים התאמה
});
console.log(`\n${pass} passed`);
