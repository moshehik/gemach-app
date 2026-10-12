// בדיקת יחידה לחישוב הצרכים לפי סניף (lib/branchNeeds.js). לא נוגעת ב-DB. הרצה: node scripts/test_branch_needs.mjs
import assert from 'node:assert/strict';
import { buildBannerRows, computeBranchNeeds, computeReturnAdvice, groupTransfers, isUnitInStock } from '../lib/branchNeeds.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const cfg = { branches: [
  { id: '1', name: 'א', isMain: true, active: true, measure: true, pickup: true, return: true },
  { id: '2', name: 'ב', isMain: false, active: true, measure: true, pickup: true, return: true },
] };
const U = (barcode, branch, o = {}) => ({ barcode, prefix: 100, size: 38, branch, location: 'חנות', modelName: 'אורורה', ...o });
const O = (orderId, eventKey, target, items) => ({ orderId, eventKey, target, items });
const I = (id, o = {}) => ({ id, prefix: 100, size: 38, barcode: null, ...o });

t('יחידה פנויה בסניף ההזמנה - אין העברה', () => {
  const r = computeBranchNeeds({ orders: [O(1, '2026-10-20', 'ב', [I('i1')])], units: [U('1003801', 'ב')], cfg });
  assert.equal(r.transfers.length, 0); assert.equal(r.shortages.length, 0);
});
t('אין יחידה בסניף ההזמנה אבל יש בסניף אחר - העברה מוצעת עם ברקוד', () => {
  const r = computeBranchNeeds({ orders: [O(1, '2026-10-20', 'ב', [I('i1')])], units: [U('1003801', 'א')], cfg });
  assert.equal(r.transfers.length, 1);
  assert.deepEqual([r.transfers[0].from, r.transfers[0].to, r.transfers[0].barcode, r.transfers[0].kind, r.transfers[0].orderId], ['א', 'ב', '1003801', 'model', 1]);
});
t('יחידה בלי סניף = הסניף הראשי', () => {
  const r = computeBranchNeeds({ orders: [O(1, '2026-10-20', 'ב', [I('i1')])], units: [U('1003801', null)], cfg });
  assert.equal(r.transfers[0].from, 'א');
});
t('ברקוד ששויך להזמנה בסניף אחר - העברה ישירה של אותו ברקוד', () => {
  const r = computeBranchNeeds({ orders: [O(1, '2026-10-20', 'ב', [I('i1', { barcode: '1003802' })])], units: [U('1003801', 'ב'), U('1003802', 'א')], cfg });
  assert.equal(r.transfers.length, 1); assert.equal(r.transfers[0].barcode, '1003802'); assert.equal(r.transfers[0].kind, 'unit');
});
t('ברקוד ששויך לא נלקח כיחידה פנויה להזמנה אחרת', () => {
  // שתי הזמנות בסניף ב: אחת עם ברקוד 01 (בסניף ב), השנייה לפי דגם - היחידה היחידה בב כבר תפוסה, לכן מביאים מא
  const r = computeBranchNeeds({
    orders: [O(1, '2026-10-20', 'ב', [I('i1', { barcode: '1003801' })]), O(2, '2026-10-21', 'ב', [I('i2')])],
    units: [U('1003801', 'ב'), U('1003802', 'א')], cfg,
  });
  assert.deepEqual(r.transfers.map((x) => [x.orderId, x.barcode, x.from]), [[2, '1003802', 'א']]);
});
t('סדר חמדני לפי תאריך אירוע: ההזמנה המוקדמת מקבלת את היחידה המקומית', () => {
  const r = computeBranchNeeds({
    orders: [O(2, '2026-10-25', 'ב', [I('i2')]), O(1, '2026-10-20', 'ב', [I('i1')])],
    units: [U('1003801', 'ב'), U('1003802', 'א')], cfg,
  });
  assert.deepEqual(r.transfers.map((x) => x.orderId), [2]);
});
t('חוסר בכל הסניפים = shortages, לא העברה', () => {
  const r = computeBranchNeeds({ orders: [O(1, '2026-10-20', 'ב', [I('i1')])], units: [], cfg });
  assert.equal(r.transfers.length, 0); assert.equal(r.shortages.length, 1);
});
t('יחידות מושכרות / בתיקון / מחסן / רזרבה לא נספרות (אלא אם ההגדרה מאפשרת)', () => {
  const orders = [O(1, '2026-10-20', 'ב', [I('i1')])];
  for (const extra of [{ location: 'מושכר' }, { inRepair: true }, { notInUse: true }, { location: 'מחסן' }, { location: 'רזרבה' }]) {
    assert.equal(computeBranchNeeds({ orders, units: [U('1003801', 'א', extra)], cfg }).transfers.length, 0, JSON.stringify(extra));
  }
  assert.equal(computeBranchNeeds({ orders, units: [U('1003801', 'א', { location: 'מחסן' })], cfg, stock: { includeWarehouse: true } }).transfers.length, 1);
  assert.equal(computeBranchNeeds({ orders, units: [U('1003801', 'א', { location: 'רזרבה' })], cfg, stock: { allowReserve: true } }).transfers.length, 1);
  assert.equal(isUnitInStock(U('x', 'א', { location: null })), true);
});
t('הזמנה בלי סניף יעד / פריט בלי דגם - מדולגים', () => {
  const r = computeBranchNeeds({ orders: [O(1, '2026-10-20', null, [I('i1')]), O(2, '2026-10-20', 'ב', [I('i2', { prefix: null })])], units: [U('1003801', 'א')], cfg });
  assert.equal(r.transfers.length, 0);
});
t('בחירת הסניף עם הכי הרבה יחידות פנויות כמקור', () => {
  const cfg3 = { branches: [...cfg.branches, { id: '3', name: 'ג', isMain: false, active: true }] };
  const r = computeBranchNeeds({ orders: [O(1, '2026-10-20', 'ב', [I('i1')])], units: [U('1003801', 'א'), U('1003802', 'ג'), U('1003803', 'ג')], cfg: cfg3 });
  assert.equal(r.transfers[0].from, 'ג');
});
t('יחידה מושכרת כעת מאותו דגם - pendingReturns (להעביר כשתחזור) ולא חוסר', () => {
  const r = computeBranchNeeds({ orders: [O(1, '2026-10-20', 'ב', [I('i1')])], units: [U('1003801', 'א', { location: 'מושכר' })], cfg });
  assert.equal(r.shortages.length, 0); assert.equal(r.transfers.length, 0);
  assert.deepEqual(r.pendingReturns.map((x) => [x.barcode, x.to, x.orderId]), [['1003801', 'ב', 1]]);
});
t('groupTransfers: קיבוץ לפי מ-ל', () => {
  const g = groupTransfers([{ from: 'א', to: 'ב' }, { from: 'ב', to: 'א' }, { from: 'א', to: 'ב' }]);
  assert.deepEqual(g.map((x) => [x.from, x.to, x.items.length]), [['א', 'ב', 2], ['ב', 'א', 1]]);
});
t('התראת החזרה: הוחזר בסניף א ונדרש בסניף ב - מתריע; אחרת null', () => {
  const orders = [O(7, '2026-10-22', 'ב', [I('i1')])];
  const units = [U('1003801', 'ב', { location: 'מושכר' })];
  // היחידה הוחזרה בסניף א, ואין עוד יחידה בב -> להעביר אותה לב
  const a = computeReturnAdvice({ returnedBarcode: '1003801', atBranch: 'א', orders, units, cfg });
  assert.deepEqual([a.to, a.orderId, a.direct], ['ב', 7, false]);
  // הוחזרה בסניף ב עצמו - אין התראה
  assert.equal(computeReturnAdvice({ returnedBarcode: '1003801', atBranch: 'ב', orders, units, cfg }), null);
  // יש בב יחידה אחרת פנויה - אין התראה
  assert.equal(computeReturnAdvice({ returnedBarcode: '1003801', atBranch: 'א', orders, units: [...units, U('1003802', 'ב')], cfg }), null);
});
t('התראת החזרה: ברקוד ששויך להזמנה בסניף אחר - ישיר', () => {
  const orders = [O(7, '2026-10-22', 'ב', [I('i1', { barcode: '1003801' })])];
  const a = computeReturnAdvice({ returnedBarcode: '1003801', atBranch: 'א', orders, units: [U('1003801', 'ב', { location: 'מושכר' })], cfg });
  assert.equal(a.direct, true); assert.equal(a.to, 'ב');
});
t('buildBannerRows: סינון לפי ימים והיקף, וניסוח', () => {
  const transfers = [{ orderId: 5, barcode: '1003801', modelName: 'אורורה', size: 38, from: 'א', to: 'ב', daysUntil: 2 }, { orderId: 6, barcode: '1003802', from: 'א', to: 'ב', daysUntil: 9 }];
  const pendingReturns = [{ orderId: 7, barcode: '1003803', modelName: 'לילי', to: 'ב', daysUntil: 0 }];
  const all = buildBannerRows({ transfers, pendingReturns, scope: 'both', days: 3 });
  assert.deepEqual(all.map((r) => r.key), ['t:5:1003801', 'r:7:1003803']);
  assert.equal(all[0].text, 'להעביר אורורה מידה 38 (1003801) מא לב · הזמנה 5 · בעוד 2 ימים');
  assert.equal(all[1].text, 'כשיוחזר לילי (1003803) - להעביר לב · הזמנה 7 · היום');
  assert.equal(buildBannerRows({ transfers, pendingReturns, scope: 'transfer', days: 30 }).length, 2);
  assert.equal(buildBannerRows({ transfers, pendingReturns, scope: 'return', days: 30 }).length, 1);
  assert.equal(buildBannerRows({ transfers: [], pendingReturns: [] }).length, 0);
});
console.log(`\n${passed} בדיקות עברו${process.exitCode ? ', יש כשלים' : ''}`);
