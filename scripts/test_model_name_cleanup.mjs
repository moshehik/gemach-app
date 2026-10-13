// בדיקות טהורות ל-lib/modelNameCleanup.js (תכנון ניקוי "ללא שם - N") + מבנה הסקריפט scripts/clean_placeholder_model_names.js.
// הרצה (מהשורש): node scripts/test_model_name_cleanup.mjs   (בלי DB; יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planModelRenames, planItemDressNames, planObligationTexts } from '../lib/modelNameCleanup.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

const M = (id, name, code, extra = {}) => ({ id, name, barcodePrefix: code, isDeleted: false, ...extra });

console.log('planModelRenames');
t('"ללא שם - N" -> מספר הדגם (barcodePrefix), לא ה-N; שם אמיתי / שם=קוד לא נוגעים', () => {
  const p = planModelRenames([M('a', 'ללא שם - 1243', 815), M('b', '559', 559), M('c', 'שחור כסוף', 500), M('d', null, 77), M('e', 'ללא שם - 1235', 559)]);
  assert.deepEqual(p.renames.map((r) => [r.id, r.to]), [['a', '815']]);
  assert.equal(p.collisions.length, 1); // 'e' רוצה "559" והוא תפוס ע"י b
  assert.deepEqual(p.collisions[0], { id: 'e', from: 'ללא שם - 1235', wanted: '559', heldBy: 'b' });
  assert.equal(p.unchanged, 3);
});
t('בלי מספר דגם -> NULL (כמה שורות באותו מצב אפשר)', () => {
  const p = planModelRenames([M('a', 'ללא שם - 1164', null), M('b', 'ללא שם - 1186', null)]);
  assert.deepEqual(p.renames.map((r) => [r.id, r.to]), [['a', null], ['b', null]]);
});
t('התנגשות עם דגם מחוק רך (השם UNIQUE גם עליו) = דילוג, לא כתיבה', () => {
  const p = planModelRenames([M('a', 'ללא שם - 1', 815), M('z', '815', 999, { isDeleted: true })]);
  assert.equal(p.renames.length, 0); assert.equal(p.collisions.length, 1);
});
t('"דגם <קוד>" נוקה רק כש-useModelNames=false', () => {
  const rows = [M('a', 'דגם 567', 567)];
  assert.equal(planModelRenames(rows).renames.length, 0);
  assert.equal(planModelRenames(rows, { useModelNames: true }).renames.length, 0);
  assert.deepEqual(planModelRenames(rows, { useModelNames: false }).renames.map((r) => r.to), ['567']);
});
t('אידמפוטנטי: אחרי יישום התכנון אין עוד שינויים', () => {
  const rows = [M('a', 'ללא שם - 1243', 815), M('b', 'דגם 567', 567), M('c', '559', 559)];
  const p1 = planModelRenames(rows, { useModelNames: false });
  const after = rows.map((r) => { const x = p1.renames.find((q) => q.id === r.id); return x ? { ...r, name: x.to } : r; });
  const p2 = planModelRenames(after, { useModelNames: false });
  assert.equal(p2.renames.length, 0); assert.equal(p2.collisions.length, 0);
});
t('שני דגמים שמבקשים את אותו יעד: רק הראשון זוכה, השני מדווח', () => {
  const p = planModelRenames([M('a', 'ללא שם - 1', 815), M('b', 'ללא שם - 2', 815)]);
  assert.equal(p.renames.length, 1); assert.equal(p.collisions.length, 1);
});

console.log('planItemDressNames / planObligationTexts');
t('DressItem.dressName מילוי -> מספר הדגם; שם אמיתי / ריק לא נוגעים', () => {
  const p = planItemDressNames([{ id: 1, dressName: 'ללא שם - 1243', barcodePrefix: 815 }, { id: 2, dressName: 'ורוד', barcodePrefix: 124 }, { id: 3, dressName: null, barcodePrefix: 1 }, { id: 4, dressName: 'ללא שם - 7', barcodePrefix: null }]);
  assert.deepEqual(p, [{ id: 1, from: 'ללא שם - 1243', to: '815' }, { id: 4, from: 'ללא שם - 7', to: null }]);
});
t('תיאורי חיוב: ממירים לפי מפת השמות; מילוי לא מזוהה = השורה נשארת כמו שהיא', () => {
  const map = new Map([['ללא שם - 1243', '815']]);
  const p = planObligationTexts([
    { id: 'o1', description: 'ללא שם - 1243 מידה 36 (פריט #ab-1)' },
    { id: 'o2', description: 'זיכוי בגין ביטול: ללא שם - 1243 (פריט #c-2)' },
    { id: 'o3', description: 'ללא שם - 999 מידה 38 (פריט #d-3)' },
    { id: 'o4', description: 'שחור כסוף מידה 36' },
  ], map);
  assert.deepEqual(p.updates.map((u) => [u.id, u.to]), [['o1', '815 מידה 36 (פריט #ab-1)'], ['o2', 'זיכוי בגין ביטול: 815 (פריט #c-2)']]);
  assert.equal(p.unresolved, 1);
});

console.log('הסקריפט');
t('dry-run כברירת מחדל, --confirm-host חובה, checkHost, CAS, אין DDL', () => {
  const src = readFileSync(new URL('./clean_placeholder_model_names.js', import.meta.url), 'utf8');
  assert.match(src, /--confirm-host <full DB host or ep-xxxx endpoint id> is required/);
  assert.match(src, /checkHost\(/);
  assert.match(src, /if \(!opts\.apply\)/);
  assert.match(src, /WHERE id = \$2 AND name = \$3/);
  assert.doesNotMatch(src, /\b(DROP|ALTER|CREATE|TRUNCATE|DELETE)\b\s+(TABLE|COLUMN|INDEX|FROM)/i);
  const m = [...src.matchAll(/client\.query\(`([^`]*)`/g)].map((x) => x[1]).filter((q) => /^\s*(UPDATE|INSERT|DELETE)/i.test(q));
  assert.equal(m.length, 3, 'exactly the three UPDATE statements');
  assert.ok(m.every((q) => /^\s*UPDATE "(DressModel|DressItem|PaymentObligation)"/.test(q)));
});

console.log(`\n${passed} passed`);
