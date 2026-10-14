// scripts/test_permissions_a5.mjs - בדיקת הלוגיקה הטהורה של מסך ההרשאות החדש (app/components/permissions-a5/pmLogic.js) + שלמות החיבורים שלו (בלי DB / רשת).
// הרצה: node scripts/test_permissions_a5.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  defaultsFor, docOnlyCount, employeeName, groupMatches, itemMatches, matrixCell, matrixItems, rowsByKey, summarizeGroup, validateStep, whoText, withOrgDefaults,
} from '../app/components/permissions-a5/pmLogic.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { process.exitCode = 1; console.error('  FAIL -', name, '\n       ', e.message); }
}

const item = (key, over = {}) => ({ key, group: 'pages', label: key, description: '', type: 'boolean', enforced: true, defaultForRoleId: () => false, ...over });
const catalog = [
  item('page:a', { label: 'דוח כספי', description: 'הכנסות', defaultForRoleId: (r) => r === 1 }),
  item('page:b', { label: 'לוח חודשי', enforced: false }),
  item('feature:c', { group: 'features', label: 'ייצוא', defaultForRoleId: (r) => r === 1 || r === 3 }),
  item('feature:locked', { group: 'features', label: 'נעול', notConfigurable: 'הנהלה בלבד' }),
  item('feature:rows', { group: 'features', label: 'כמות שורות', type: 'number' }),
];
const departments = [
  { roleId: 1, name: 'מנהל סניף', values: { 'page:a': { value: true, isExplicit: false }, 'page:b': { value: false, isExplicit: true }, 'feature:c': { value: true, isExplicit: false }, 'feature:locked': { value: false, isExplicit: false } } },
  { roleId: 3, name: 'מזכירה', values: { 'page:a': { value: false, isExplicit: true }, 'page:b': { value: true, isExplicit: true }, 'feature:c': { value: true, isExplicit: false }, 'feature:locked': { value: false, isExplicit: false } } },
];
const groups = [
  { id: 'g1', name: 'מזכירות', keys: ['page:a', 'feature:c'], access: { 1: true, 3: false }, employeeAccess: ['e1'] },
  { id: 'g2', name: 'כולם', keys: ['page:b', 'page:a'], access: { 1: true, 3: true }, employeeAccess: [] },
];
const employees = [{ id: 'e1', firstName: 'שרה', lastName: 'לוי', department: { name: 'מזכירה' } }];

console.log('pmLogic');
t('withOrgDefaults: ברירת המחדל מקבלת את הגדרות הארגון', () => {
  const cat = withOrgDefaults([{ ...item('page:x'), defaultForRoleId: (r, s) => !!(s && s.open) }], { open: true });
  assert.equal(cat[0].defaultForRoleId(1), true);
});
t('rowsByKey: פריט שמופיע בכמה שורות', () => {
  const m = rowsByKey(groups);
  assert.deepEqual(m.get('page:a').map((g) => g.id), ['g1', 'g2']);
  assert.equal(m.get('feature:c').length, 1);
});
t('matrixCell: מקור הערך (שורה / מפורש / ברירת מחדל)', () => {
  const m = rowsByKey(groups);
  assert.deepEqual(matrixCell(catalog[0], departments[0], m.get('page:a')), { allowed: true, source: 'row', rowNames: ['מזכירות', 'כולם'] });
  assert.equal(matrixCell(catalog[2], departments[1], []).source, 'default');
  assert.equal(matrixCell(catalog[1], departments[0], []).source, 'set');
  assert.equal(matrixCell(catalog[0], { roleId: 9, values: {} }, []).allowed, false);
});
t('matrixItems: כן/לא בלבד, בלי נעולים כברירת מחדל, סינון קבוצה / חיפוש / "חסום לחלק"', () => {
  const rowMap = rowsByKey(groups);
  assert.deepEqual(matrixItems(catalog, { departments, rowMap }).map((i) => i.key), ['page:a', 'page:b', 'feature:c']);
  assert.ok(matrixItems(catalog, { departments, rowMap, showLocked: true }).some((i) => i.key === 'feature:locked'));
  assert.deepEqual(matrixItems(catalog, { group: 'features', departments, rowMap }).map((i) => i.key), ['feature:c']);
  assert.deepEqual(matrixItems(catalog, { q: 'כספי', departments, rowMap }).map((i) => i.key), ['page:a']);
  // feature:c מותר לשתי המחלקות -> לא "חסום לחלק"; page:a / page:b חסומים לאחת
  assert.deepEqual(matrixItems(catalog, { onlyRestricted: true, departments, rowMap }).map((i) => i.key), ['page:a', 'page:b']);
});
t('summarizeGroup: פריטים, תיעוד בלבד, משותפים, מי מורשה', () => {
  const s = summarizeGroup(groups[0], catalog, groups, departments, employees);
  assert.equal(s.items.length, 2);
  assert.equal(s.pages, 1); assert.equal(s.features, 1); assert.equal(s.docOnly, 0);
  assert.deepEqual(s.shared.map((i) => i.key), ['page:a']);
  assert.deepEqual(s.allowedDepts.map((d) => d.roleId), [1]);
  assert.equal(s.allowedEmployees.length, 1);
  assert.equal(s.everyone, false); assert.equal(s.nobody, false);
  assert.equal(summarizeGroup(groups[1], catalog, groups, departments, employees).everyone, true);
  assert.equal(summarizeGroup({ id: 'x', keys: ['page:a'], access: { 1: false, 3: false }, employeeAccess: [] }, catalog, [], departments, employees).nobody, true);
});
t('whoText', () => {
  assert.match(whoText(summarizeGroup(groups[0], catalog, groups, departments, employees)), /מנהל סניף \+ 1 עובדים ספציפיים/);
  assert.match(whoText(summarizeGroup(groups[1], catalog, groups, departments, employees)), /כל המחלקות/);
});
t('groupMatches: שם / פריט / מחלקה / עובד, כל המילים חייבות להתאים', () => {
  assert.ok(groupMatches(groups[0], 'מזכירות', catalog, departments, employees));
  assert.ok(groupMatches(groups[0], 'ייצוא', catalog, departments, employees));
  assert.ok(groupMatches(groups[0], 'שרה', catalog, departments, employees));
  assert.ok(groupMatches(groups[0], 'מנהל סניף', catalog, departments, employees));
  assert.ok(!groupMatches(groups[0], 'מזכירות xyz', catalog, departments, employees));
  assert.ok(groupMatches(groups[0], '', catalog, departments, employees));
  assert.ok(itemMatches(catalog[0], 'הכנסות') && !itemMatches(catalog[0], 'ייצוא'));
});
t('defaultsFor: מחלקה מותרת רק אם כל הפריטים מותרים לה היום', () => {
  assert.deepEqual(defaultsFor([catalog[0], catalog[2]], departments), { 1: true, 3: false });
  assert.deepEqual(defaultsFor([], departments), { 1: false, 3: false });
});
t('validateStep / employeeName / docOnlyCount', () => {
  assert.ok(validateStep(0, { name: '  ', keys: [] }));
  assert.equal(validateStep(0, { name: 'x', keys: [] }), null);
  assert.ok(validateStep(1, { name: 'x', keys: [] }));
  assert.equal(validateStep(1, { name: 'x', keys: ['page:a'] }), null);
  assert.equal(validateStep(2, { name: '', keys: [] }), null);
  assert.equal(employeeName({ firstName: 'שרה', lastName: 'לוי' }), 'לוי שרה');
  assert.equal(docOnlyCount(catalog), 1);
});

console.log('חיבורים');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
t('page.js עוטף ב-PermissionsSwitch, והישן (PermissionsClient.js) נשאר במקומו', () => {
  assert.match(read('app/admin/permissions/page.js'), /PermissionsSwitch/);
  assert.match(read('app/components/permissions-a5/PermissionsSwitch.js'), /useUiVariant\('permissions'\)/);
  assert.ok(fs.existsSync(path.join(ROOT, 'app/admin/permissions/PermissionsClient.js')));
});
t('המסך החדש משתמש באותם API כמו הישן ובלי window.alert / confirm', () => {
  const src = read('app/components/permissions-a5/PermissionsA5.js') + read('app/components/permissions-a5/PmRowDialog.js');
  for (const url of ['/api/admin/permissions', '/api/employees?all=true', '/api/admin/permissions/department-values', '/api/admin/permissions/page-groups']) assert.ok(src.includes(url), url);
  assert.ok(!/\b(alert|confirm|prompt)\(/.test(src.replace(/customConfirm/g, '')), 'window dialogs');
  assert.ok(!src.includes('customConfirm'));
});
t('כל מזהה מדריך-אתר perm.* של הישן קיים גם בחדש', () => {
  const legacy = [...read('app/admin/permissions/PermissionsClient.js').matchAll(/data-guide-id="(perm\.[a-z-]+)"/g)].map((m) => m[1]);
  const wiz = [...read('app/components/permissions/PermissionRowWizard.js').matchAll(/data-guide-id="(perm\.[a-z-]+)"/g)].map((m) => m[1]);
  const neu = read('app/components/permissions-a5/PermissionsA5.js') + read('app/components/permissions-a5/PmRowDialog.js');
  for (const id of new Set([...legacy, ...wiz])) assert.ok(neu.includes(`data-guide-id="${id}"`), id);
});

console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
