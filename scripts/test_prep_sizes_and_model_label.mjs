// "דפי הכנות" (12.10.2026): (1) סדר המידות - lib/sizeSort.js (compareSizesForList / compareModelCodes / sortByModelThenSize);
// (2) כפל הדגם "522(522)" - lib/modelCodeLabel.js (stripCodeLabel / modelNameWithCode / isSameModelCode);
// (3) בדיקות מבנה: המשטחים (הדפסת הזמנה / הכנות להיום, מייל ההזמנה) באמת משתמשים בפונקציות המשותפות ואין עוד מיון/חיתוך מקביל.
// הרצה (מהשורש): node scripts/test_prep_sizes_and_model_label.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareSizesForList, compareModelCodes, sortByModelThenSize, compareSizeText } from '../lib/sizeSort.js';
import { stripCodeLabel, modelNameWithCode, isSameModelCode, normModelCode } from '../lib/modelCodeLabel.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
let passed = 0; let failed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); } catch (e) { failed++; process.exitCode = 1; console.error('  FAIL -', name, '\n        ', e.stack || e.message); }
}
const sortSizes = (a) => [...a].sort(compareSizesForList);

// ---------------------------------------------------------------------------------------------------- סדר מידות
await t('מספרי, לא מחרוזת: 10 אחרי 8 (לא לפניו), 100 אחרי 36', () => {
  assert.deepEqual(sortSizes(['10', '8', '6', '12', '100', '36']), ['6', '8', '10', '12', '36', '100']);
  // המיון הישן לפי מחרוזת נתן את הסדר השגוי - מוודאים שזה בדיוק מה שתוקן
  assert.deepEqual(['10', '8', '6', '12'].sort(), ['10', '12', '6', '8']);
});
await t('אפס מוביל לא משנה: "06" ≡ "6" (שקולות, מיון יציב), "06" לפני "8" ו-"10"', () => {
  assert.equal(compareSizesForList('06', '6'), 0);
  assert.deepEqual(sortSizes(['10', '08', '06']), ['06', '08', '10']);
});
await t('עשרוניות: 00.5 < 6 < 06.1 < 7; "38.0" שקולה ל-"38"', () => {
  assert.deepEqual(sortSizes(['7', '06.1', '6', '00.5']), ['00.5', '6', '06.1', '7']);
  assert.equal(compareSizesForList('38.0', '38'), 0);
  assert.ok(compareSizesForList('38', '38.5') < 0);
  assert.ok(compareSizesForList('01,8', '2') < 0, 'פסיק עשרוני');
});
await t('אות צמודה / טווח: 36 < 36א < 36ב < 37 < 38 < 38-40', () => {
  assert.deepEqual(sortSizes(['38-40', '37', '36ב', '38', '36', '36א']), ['36', '36א', '36ב', '37', '38', '38-40']);
});
await t('מידות אותיות: XS < S < S/M < M < L < XL < XXL, אחרי כל המספרים; לא רגיש לאותיות גדולות/קטנות', () => {
  assert.deepEqual(sortSizes(['XL', 'S/M', 'M', 'xs', 'XXL', 'S', 'L', '40']), ['40', 'xs', 'S', 'S/M', 'M', 'L', 'XL', 'XXL']);
});
await t('טקסט אחר ("כללי", "אחיד") אחרי המספרים והאותיות, לפי א"ב', () => {
  assert.deepEqual(sortSizes(['כללי', 'XL', '40', 'אחיד']), ['40', 'XL', 'אחיד', 'כללי']);
});
await t('ריק / null / undefined / רווחים / "null" - תמיד בסוף, ובין עצמם שקולים (יציב)', () => {
  const out = sortSizes(['', '40', null, 'כללי', undefined, '  ', '6', 'null']);
  assert.deepEqual(out.slice(0, 3), ['6', '40', 'כללי']);
  assert.ok(out.slice(3).every((x) => !x || !String(x).trim() || x === 'null'));
  assert.equal(compareSizesForList('', null), 0);
  assert.ok(compareSizesForList('', 'כללי') > 0);
});
await t('מיון יציב: מידות שקולות נשארות בסדר המקורי', () => {
  const rows = [{ s: '08', i: 0 }, { s: '8', i: 1 }, { s: '8.0', i: 2 }];
  const out = sortByModelThenSize(rows, () => 1, (r) => r.s);
  assert.deepEqual(out.map((r) => r.i), [0, 1, 2]);
});
await t('compareModelCodes: 522 < 4512 (מספרי), מספרי לפני טקסט, ריק בסוף', () => {
  assert.deepEqual(['4512', '522', 'A12', null, '99'].sort(compareModelCodes), ['99', '522', '4512', 'A12', null]);
});
await t('sortByModelThenSize: דגם עולה, בתוך הדגם מידה עולה; לא משנה את המקור; פריט בלי דגם בסוף', () => {
  const src = [
    { id: 'a', code: 522, size: '10' }, { id: 'b', code: 4512, size: '6' }, { id: 'c', code: 522, size: '6' },
    { id: 'd', code: 522, size: '8' }, { id: 'e', code: null, size: '4' }, { id: 'f', code: 4512, size: null }, { id: 'g', code: 522, size: '06.1' },
  ];
  const copy = JSON.stringify(src);
  const out = sortByModelThenSize(src, (x) => x.code, (x) => x.size);
  assert.deepEqual(out.map((x) => x.id), ['c', 'g', 'd', 'a', 'b', 'f', 'e']);
  assert.equal(JSON.stringify(src), copy, 'המקור לא השתנה');
  assert.deepEqual(sortByModelThenSize(null, () => 1, () => 1), []);
});
await t('compareSizeText הקיים (תפריטי מלאי) לא שונה', () => {
  assert.ok(compareSizeText('8', '10') < 0);
  assert.ok(compareSizeText('כללי', '10') > 0);
});

// ---------------------------------------------------------------------------------------------------- כפל הדגם
await t('stripCodeLabel: שם=מספר -> פעם אחת ("522 (קוד: 522)" -> "522")', () => {
  assert.equal(stripCodeLabel('522 (קוד: 522)'), '522');
  assert.equal(stripCodeLabel('  522  (קוד: 522)  '), '522');
  assert.equal(stripCodeLabel('0522 (קוד: 522)'), '522', 'אפס מוביל');
  assert.equal(stripCodeLabel('דגם 522 (קוד: 522)'), '522', 'דגם <מספר> = אין שם אמיתי');
});
await t('stripCodeLabel: שם תיאורי אמיתי ושונה -> "שם (מספר)" כרגיל', () => {
  assert.equal(stripCodeLabel('אבן חרוזים (קוד: 440)'), 'אבן חרוזים (440)');
  assert.equal(stripCodeLabel('ורד 522 (קוד: 522)'), 'ורד 522 (522)', 'שם שמכיל את המספר אבל אינו רק המספר - נשאר');
});
await t('stripCodeLabel: שם ריק -> "(מספר)"; קוד ריק -> התווית נמחקת; ללא תווית -> ללא שינוי; null -> ""', () => {
  assert.equal(stripCodeLabel('(קוד: 440)'), '(440)');
  assert.equal(stripCodeLabel('שם (קוד: )'), 'שם');
  assert.equal(stripCodeLabel('שמלה כללית'), 'שמלה כללית');
  assert.equal(stripCodeLabel(null), '');
  assert.equal(stripCodeLabel(undefined), '');
});
await t('stripCodeLabel: טקסט אחרי התווית נשמר; כמה תוויות; ספרות ערביות', () => {
  assert.equal(stripCodeLabel('522 (קוד: 522) - קיצור 3'), '522 - קיצור 3');
  assert.equal(stripCodeLabel('אבן (קוד: 440) - 522 (קוד: 522)'), 'אבן (440) - 522 (522)');
  assert.equal(stripCodeLabel('٥٢٢ (קוד: 522)'), '522');
});
await t('modelNameWithCode / isSameModelCode', () => {
  assert.equal(modelNameWithCode('522', 522), '522');
  assert.equal(modelNameWithCode('522', '522', ' · '), '522');
  assert.equal(modelNameWithCode('', '522'), '522');
  assert.equal(modelNameWithCode('תחרה', ''), 'תחרה');
  assert.equal(modelNameWithCode('תחרה', 4512), 'תחרה - 4512');
  assert.equal(modelNameWithCode(null, null), '');
  assert.equal(isSameModelCode('דגם 7', 7), true);
  assert.equal(isSameModelCode('7', ''), false, 'ללא קוד - אין "זהה"');
  assert.equal(isSameModelCode('', ''), false);
  assert.equal(normModelCode(' 007 '), '7');
  assert.equal(normModelCode('A 12'), 'a 12');
});

// ---------------------------------------------------------------------------------------------------- מבנה סטטי
await t('הדפסת הזמנה / הכנות להיום: משתמשת ב-stripCodeLabel המשותף ובמיון המשותף (אין עוד עותק מקומי)', () => {
  const src = read('app/print/order/page.js');
  assert.match(src, /import \{ stripCodeLabel \} from '\.\.\/\.\.\/\.\.\/lib\/modelCodeLabel'/);
  assert.match(src, /import \{ sortByModelThenSize \} from '\.\.\/\.\.\/\.\.\/lib\/sizeSort'/);
  assert.doesNotMatch(src, /const stripCodeLabel\s*=/);
  assert.match(src, /activeItems = ord\?\.items \? sortPrintItems\(/);
});
await t('מייל ההזמנה: אותו stripCodeLabel ואותו מיון', () => {
  const src = read('app/api/orders/[id]/email/route.js');
  assert.match(src, /import \{ stripCodeLabel \} from '@\/lib\/modelCodeLabel'/);
  assert.doesNotMatch(src, /const stripCodeLabel\s*=/);
  assert.match(src, /sortByModelThenSize\(/);
});
await t('הלו״ז: loaders ממיין את row.items פעם אחת דרך lib/schedule/itemOrder.js; PP-07 / PP-08 / repairItems משתמשים בפונקציות המשותפות', () => {
  assert.match(read('lib/schedule/loaders.js'), /sortItemViews\(row\.items\)/);
  assert.match(read('lib/schedule/print/pages/PP-07.js'), /sortItemViews\(r\.items\)/);
  assert.match(read('lib/schedule/print/pages/PP-08.js'), /sortItemViews\(/);
  const ri = read('lib/schedule/print/repairItems.js');
  assert.match(ri, /compareSizesForList/);
  assert.match(ri, /modelNameWithCode/);
});

console.log(`\n${passed} passed, ${failed} failed`);
