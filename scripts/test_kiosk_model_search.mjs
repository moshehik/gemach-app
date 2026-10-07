// בדיקות טהורות לשדה חיפוש הדגם של עמדת הלקוח (lib/kioskModelSearch.js) - דיווחים 7983b79d, b2cf3796, e6f564d6 (נווה יעקב).
// הרצה (מהשורש): node --import ./scripts/business-days-tests/register.mjs scripts/test_kiosk_model_search.mjs
// (בלי DB ובלי שרת; יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { modelMatchesQuery, normalizeModelQuery } from '../lib/kioskModelSearch.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

const M = {
  a: { name: '316', barcodePrefix: 316 },
  b: { name: 'דגם 567', barcodePrefix: 567 },
  c: { name: 'ללא שם - 1245', barcodePrefix: 565 },
  d: { name: 'שחור כסוף', barcodePrefix: 500 },
  e: { name: 'ורוד חלק קצר', barcodePrefix: 124 },
};
const hits = (q) => Object.entries(M).filter(([, m]) => modelMatchesQuery(m, q)).map(([k]) => k).join('');

console.log('modelMatchesQuery');
t('טקסט ריק או רווחים = הכול תואם', () => { assert.equal(hits(''), 'abcde'); assert.equal(hits('   '), 'abcde'); assert.equal(hits(null), 'abcde'); });
t('מספר מלא: 567 / #567 / "דגם 567" / "דגם567" מוצאים את דגם 567', () => {
  for (const q of ['567', '#567', 'דגם 567', 'דגם567', ' 567 ']) assert.equal(hits(q), 'b', q);
});
t('התחלה של מספר (מקלידים בהדרגה): 56 -> 565 ו-567; 5 -> 500, 565, 567', () => {
  assert.equal(hits('56'), 'bc');
  assert.equal(hits('5'), 'bcd');
});
t('מספר לא מחפש בתוך מידות ולא באמצע מספר', () => { assert.equal(hits('67'), ''); assert.equal(hits('16'), ''); });
t('"316" לדגם ששמו רק המספר', () => assert.equal(hits('316'), 'a'));
t('שם: חלק מהשם, בלי תלות באותיות גדולות/קטנות', () => { assert.equal(hits('כסוף'), 'd'); assert.equal(hits('חלק'), 'e'); });
t('"ללא שם" לא מוצג כשם לחיפוש מספר פנימי (1245), אבל הקידומת 565 כן', () => { assert.equal(hits('1245'), ''); assert.equal(hits('565'), 'c'); });
t('דגם בלי קידומת: חיפוש לפי שם עדיין עובד', () => assert.equal(modelMatchesQuery({ name: 'כחול', barcodePrefix: null }, 'כחו'), true));
t('normalizeModelQuery מנקה #, "דגם" ורווחים', () => assert.equal(normalizeModelQuery('  דגם #567 '), '567'));

console.log('חיבור לעמוד');
const page = readFileSync(new URL('../app/customer-interface/page.js', import.meta.url), 'utf8');
t('העמוד מייבא את הפונקציה ומחבר אותה מאחורי kiosk_model_search', () => {
  assert.match(page, /from '@\/lib\/kioskModelSearch'/);
  assert.match(page, /settings\.kiosk_model_search === 'true'/);
  assert.match(page, /modelMatchesQuery\(d, modelQuery\)/);
});
t('פס התאריך הדביק מאחורי kiosk_sticky_date_bar', () => assert.match(page, /settings\.kiosk_sticky_date_bar === 'true'/));

console.log(`\n${passed} passed${process.exitCode ? ' (with failures)' : ''}`);
