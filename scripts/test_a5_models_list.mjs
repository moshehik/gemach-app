// בדיקת יחידה ללוגיקה של רשימת הדגמים החדשה (app/components/models-list/modelsLogic.js) ולהרחבה התואמת-לאחור של /api/dresses (counts=1):
// המרת שורת summary לשורת רשימה, סטטוס (פעיל / לא פעיל / מחוק - כמו filterStatus בשרת), אפשרויות סינון וספירות, מיון, מיזוג עמודי קטלוג. אין DB / דפדפן.
// הרצה: node scripts/test_a5_models_list.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CATALOG_PAGE, SORTS, buildFilters, catOptions, isActive, isInactive, mergePages, modelRow, rowClass, rowIcon, sizesPlain, statusKey, statusReason, statusText,
} from '../app/components/models-list/modelsLogic.js';
import { computeVisible, initialSelection, optionCount } from '../app/components/a5-list/listLogic.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

const D = [
  { id: 'a', name: 'אורורה', barcodePrefix: 105, priceCategory: 'כללי', itemsCount: 10, activeItemsCount: 8, notInUseCount: 2, repairCount: 1, reserveCount: 0, deletedItemsCount: 0, rentalsCount: 31, sizeCounts: [['12', 2], ['08', 3], ['10', 5]], entryDateToRepo: '2020-01-02T10:00:00Z', updatedAt: '2026-08-05T10:00:00Z' },
  { id: 'b', name: 'בלה', barcodePrefix: 106, priceCategory: 'תיקונים', itemsCount: 3, activeItemsCount: 0, notInUseCount: 3, repairCount: 0, reserveCount: 2, deletedItemsCount: 1, rentalsCount: 0, sizeCounts: [] },
  { id: 'c', name: 'גלאם', barcodePrefix: null, priceCategory: null, itemsCount: 4, activeItemsCount: 4, notInUseCount: 0, exitDateFromRepo: '2025-01-01T00:00:00Z', rentalsCount: 12 },
  { id: 'd', name: null, barcodePrefix: 110, isDeleted: true, itemsCount: 1, activeItemsCount: 1, rentalsCount: 60 },
];
const R = D.map(modelRow);

console.log('שורה וסטטוס');
t('modelRow: מזהים, קוד, שם חלופי, מידות ממוינות מספרית, ספירות', () => {
  assert.equal(R[0].code, 105); assert.equal(R[2].code, null); assert.equal(R[3].name, 'דגם 110');
  assert.equal(modelRow({ id: 'z' }).name, '—');
  assert.equal(modelRow({ id: 'p', name: 'ללא שם - 1243', barcodePrefix: 815 }).name, '815', 'שם "ללא שם - N" -> מספר הדגם (לא ה-N של אקסס)');
  assert.equal(modelRow({ id: 'q', name: 'ורוד', barcodePrefix: 124 }).name, 'ורוד');
  assert.deepEqual(R[0].sizes, [['08', 3], ['10', 5], ['12', 2]]);
  assert.equal(R[0].inactive, 2); assert.equal(R[0].usable, 8); assert.equal(R[0].repair, 1); assert.equal(R[1].delItems, 1); assert.equal(R[0].rentals, 31);
  assert.equal(modelRow({ id: 'y', itemsCount: 5, notInUseCount: 2 }).usable, 3, 'בלי activeItemsCount: items - inactive');
});
t('סטטוס כמו filterStatus בשרת: מחוק > לא פעיל (יצא מהמאגר / אין פריטים שאפשר להשכיר) > פעיל', () => {
  assert.deepEqual(R.map(statusKey), ['active', 'inactive', 'inactive', 'deleted']);
  assert.equal(isActive(R[0]), true); assert.equal(isInactive(R[1]), true, 'אין פריטים פעילים'); assert.equal(isInactive(R[2]), true, 'יצא מהמאגר');
  assert.equal(isInactive(R[3]), false, 'מחוק אינו "לא פעיל"');
  assert.deepEqual(R.map(statusText), ['פעיל', 'לא פעיל', 'לא פעיל', 'מחוק']);
  assert.deepEqual(R.map(rowIcon), ['dress', 'ban', 'ban', 'trash']);
  assert.deepEqual(R.map(rowClass), ['', 'off', 'off', 'off gone']);
  assert.equal(statusReason(R[1]), 'לא פעיל - אין פריטים בשימוש'); assert.equal(statusReason(R[2]), 'לא פעיל - יצא מהמאגר'); assert.equal(statusReason(R[3]), 'מחוק'); assert.equal(statusReason(R[0]), 'פעיל');
  assert.equal(sizesPlain(R[0]), '08×3 10×5 12×2');
});

console.log('סינון, ספירות ומיון');
t('ברירת מחדל פעילים; קבוצות סטטוס / מלאי / קטגוריה (מהנתונים) / השכרות; OR בתוך קבוצה', () => {
  const filters = buildFilters(R);
  assert.deepEqual(filters.map((f) => f.key), ['status', 'inv', 'cat', 'rent']);
  assert.deepEqual(filters[0].def, ['active']);
  const sel = initialSelection(filters);
  const base = { items: R, words: [], filters, sel, sorts: SORTS, sort: { k: 'name', dir: 1 } };
  assert.deepEqual(computeVisible(base).map((m) => m.id), ['a']);
  assert.deepEqual(computeVisible({ ...base, sel: { ...sel, status: ['active', 'deleted'] } }).map((m) => m.id).sort(), ['a', 'd']);
  assert.deepEqual(computeVisible({ ...base, sel: { ...sel, status: [], inv: ['repair', 'reserve'] } }).map((m) => m.id).sort(), ['a', 'b'], 'OR בתוך "מלאי"');
  assert.deepEqual(computeVisible({ ...base, sel: { ...sel, status: [], rent: ['r30'] } }).map((m) => m.id).sort(), ['a', 'd'], 'לפחות 30 השכרות');
  assert.deepEqual(computeVisible({ ...base, sel: { ...sel, status: [], rent: ['r0'] } }).map((m) => m.id), ['b']);
  const cats = catOptions(R).map((o) => o.l);
  assert.deepEqual(cats, ['כללי', 'תיקונים', 'ללא קטגוריה'], 'ללא קטגוריה אחרון');
  assert.equal(optionCount(base, filters[0], filters[0].options[2]), 1, 'מחוקים: 1 (לא מושפע מהסטטוס עצמו)');
});
t('מיון: שם / קוד (בלי קוד ראשון) / כניסה / השכרות; כל עמודת טבלה ממופה לפי מיון קיים', () => {
  const by = (k, dir = 1) => computeVisible({ items: R, words: [], filters: [], sel: {}, sorts: SORTS, sort: { k, dir } }).map((m) => m.id);
  assert.deepEqual(by('code'), ['c', 'a', 'b', 'd']);
  assert.deepEqual(by('rentals', -1), ['d', 'a', 'c', 'b']);
  assert.equal(by('name')[0], 'a');
  assert.deepEqual(SORTS.map((s) => s.k), ['name', 'code', 'entry', 'items', 'rentals', 'inactive', 'reserve', 'repair', 'status']);
});

console.log('מיזוג עמודים והרחבת ה-API');
t('mergePages: בלי כפילויות, סובל null', () => {
  assert.deepEqual(mergePages([{ data: [{ id: 1 }, { id: 2 }] }, null, { data: [{ id: 2 }, { id: 3 }] }]).map((d) => d.id), [1, 2, 3]);
  assert.equal(CATALOG_PAGE, 500);
});
t('/api/dresses: counts=1 תואם-לאחור - נוסף רק ב-fields=summary, ובלעדיו התשובה לא משתנה', () => {
  const src = readFileSync('app/api/dresses/route.js', 'utf8').replace(/\r\n/g, '\n');
  assert.match(src, /const wantCounts = fieldsMode === 'summary' && searchParams\.get\('counts'\) === '1';/);
  assert.match(src, /if \(!wantCounts\) return summary;/, 'בלי counts - אותה תשובה כמו קודם');
  assert.match(src, /const needItemRentals = !fieldsMode \|\| advRentalsCountMin > 0 \|\| wantCounts;/);
  for (const k of ['notInUseCount', 'repairCount', 'reserveCount', 'deletedItemsCount', 'rentalsCount', 'sizeCounts', 'updatedAt']) assert.ok(src.includes(k), k);
  assert.match(src, /itemsCount: adjustedItems\.filter\(i => !i\.isDeleted\)\.length,\n\s+inUseItemsCount:/, 'שדות summary הקיימים ללא שינוי');
});

console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
