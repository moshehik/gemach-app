// בדיקת יחידה ללוגיקת ההעברה המהירה (lib/dressRelocate.js). לא נוגעת ב-DB. הרצה: node scripts/test_dress_relocate.mjs
import assert from 'node:assert/strict';
import { describeSnapshot, diffSnapshots, normalizeBarcode, patchToData, planRelocation, snapshotOf } from '../lib/dressRelocate.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const IT = (o = {}) => ({ location: 'חנות', cartonNumber: null, branch: null, isDeleted: false, ...o });

t('normalizeBarcode: מסיר סימוני כיווניות ורווחים', () => {
  assert.equal(normalizeBarcode('‏ 12 345‎67 '), '1234567');
  assert.equal(normalizeBarcode(null), '');
});
t('branch: משייך סניף, לא נוגע במיקום; אזהרה כשבמחסן', () => {
  const r = planRelocation('branch', { branch: 'בית שמש' }, IT({ location: 'מחסן' }));
  assert.equal(r.ok, true); assert.deepEqual(patchToData(r.patch), { branch: 'בית שמש' }); assert.deepEqual(r.warnings, ['הפריט נמצא במחסן']);
});
t('branch: אותו סניף = noop; בלי סניף = שגיאה', () => {
  assert.equal(planRelocation('branch', { branch: 'א' }, IT({ branch: 'א' })).noop, true);
  assert.equal(planRelocation('branch', {}, IT()).code, 'no_branch');
});
t('to_warehouse / to_reserve: משנים מיקום בלבד', () => {
  assert.deepEqual(patchToData(planRelocation('to_warehouse', {}, IT()).patch), { location: 'מחסן' });
  assert.deepEqual(patchToData(planRelocation('to_reserve', {}, IT({ branch: 'א' })).patch), { location: 'רזרבה' });
  assert.equal(planRelocation('to_warehouse', {}, IT({ location: 'מחסן' })).noop, true);
});
t('to_carton: מחסן + מספר קרטון; חובה מספר', () => {
  assert.deepEqual(patchToData(planRelocation('to_carton', { carton: ' 14 ' }, IT()).patch), { location: 'מחסן', cartonNumber: '14' });
  assert.equal(planRelocation('to_carton', { carton: '' }, IT()).code, 'no_carton');
  assert.equal(planRelocation('to_carton', { carton: 'x'.repeat(21) }, IT()).code, 'bad_carton');
});
t('from_warehouse: חנות, מנקה קרטון, סניף יעד; אזהרה כשלא היה במחסן', () => {
  const r = planRelocation('from_warehouse', { branch: 'א' }, IT({ location: 'מחסן', cartonNumber: '9' }));
  assert.deepEqual(patchToData(r.patch), { location: 'חנות', cartonNumber: null, branch: 'א' }); assert.deepEqual(r.warnings, []);
  assert.deepEqual(planRelocation('from_warehouse', { branch: 'א' }, IT({ location: 'רזרבה' })).warnings, ['הפריט היה ברזרבה ולא במחסן']);
  assert.equal(planRelocation('from_warehouse', {}, IT({ location: 'מחסן' })).code, 'no_branch');
});
t('פריט מושכר: נחסם להעברות, מותר שיוך סניף', () => {
  assert.equal(planRelocation('to_warehouse', {}, IT({ location: 'מושכר' })).code, 'rented');
  assert.equal(planRelocation('to_carton', { carton: '1' }, IT({ location: 'מושכר' })).code, 'rented');
  assert.equal(planRelocation('branch', { branch: 'א' }, IT({ location: 'מושכר' })).ok, true);
});
t('פריט מחוק / חסר / פעולה לא מוכרת', () => {
  assert.equal(planRelocation('to_warehouse', {}, IT({ isDeleted: true })).code, 'deleted');
  assert.equal(planRelocation('to_warehouse', {}, null).code, 'not_found');
  assert.equal(planRelocation('zzz', {}, IT()).code, 'bad_mode');
});
t('restore: מחזיר בדיוק את המצב הקודם (undo)', () => {
  const before = snapshotOf(IT({ location: 'מחסן', cartonNumber: 14, branch: 'א' }));
  const moved = planRelocation('from_warehouse', { branch: 'ב' }, IT({ location: 'מחסן', cartonNumber: 14, branch: 'א' }));
  const afterItem = IT({ ...moved.after });
  const undo = planRelocation('restore', { restore: before }, afterItem);
  assert.deepEqual(undo.after, before);
  assert.deepEqual(patchToData(undo.patch), { location: 'מחסן', cartonNumber: '14', branch: 'א' });
});
t('מיקום ריק נחשב חנות בתצוגה; diffSnapshots', () => {
  assert.equal(describeSnapshot({ location: null, cartonNumber: null, branch: 'א' }), 'חנות · א');
  assert.equal(describeSnapshot({ location: 'מחסן', cartonNumber: '3', branch: null }), 'מחסן · קרטון 3');
  assert.deepEqual(diffSnapshots({ location: 'א', cartonNumber: null, branch: null }, { location: 'א', cartonNumber: null, branch: null }), {});
});
console.log(`\n${passed} בדיקות עברו${process.exitCode ? ', יש כשלים' : ''}`);
