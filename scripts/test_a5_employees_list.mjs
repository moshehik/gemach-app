// בדיקת יחידה ללוגיקה של רשימת העובדים החדשה (app/components/employees-list/employeesLogic.js): קוד עובד (לא UUID), שם, מחלקה (גם לשורות חיפוש AI
// בלי department), אייקוני מחלקה, "מחובר" + "כניסה אחרונה" מנתוני /api/employees/presence, אפשרויות הסינון. אין DB / דפדפן.
// הרצה: node scripts/test_a5_employees_list.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  STATUS_OPTIONS, deptIcon, deptNamesByRole, deptOptions, employeeCode, employeeDeptName, employeeFullName, employeeHay, employeeRow, shiftText,
} from '../app/components/employees-list/employeesLogic.js';
import { computeVisible, optionCount, initialSelection } from '../app/components/a5-list/listLogic.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

const E = [
  { id: 'aaaaaaaa-1111', legacyId: 12, firstName: 'שרה', lastName: 'כהן', phone1: '0501', email: 's@x.com', isActive: true, roleId: 0, department: { name: 'הנהלה ראשית' }, needsPasswordReset: true },
  { id: 'bbbbbbbb-2222', legacyId: null, firstName: 'רחל', lastName: 'לוי', phone1: '', email: '', isActive: true, roleId: 4, department: { name: 'מזכירה' } },
  { id: 'cccccccc-3333', firstName: 'לאה', lastName: '', fullName: 'לאה (ללא משפחה)', isActive: false, roleId: 3 },
  { id: 'dddddddd-4444', firstName: 'דנה', lastName: 'שם', isActive: true, roleId: 99 },
  { id: 'eeeeeeee-5555', firstName: 'נועה', lastName: 'בלי', isActive: true, roleId: null },
];
const PRES = {
  'aaaaaaaa-1111': { lastEntry: '2026-10-09T07:00:00.000Z', connected: true, shiftMinutes: 222 },
  'bbbbbbbb-2222': { lastEntry: '2026-10-01T05:00:00.000Z', connected: false, shiftMinutes: null },
};

console.log('שדות');
t('employeeCode: legacyId, אחרת 5 תווים - לעולם לא UUID מלא', () => {
  assert.equal(employeeCode(E[0]), '12'); assert.equal(employeeCode(E[1]), 'bbbbb'); assert.equal(employeeCode(E[2]).length, 5);
});
t('employeeFullName: שם פרטי + משפחה; בלי שניהם fullName', () => {
  assert.equal(employeeFullName(E[0]), 'שרה כהן'); assert.equal(employeeFullName({ fullName: 'X' }), 'X'); assert.equal(employeeFullName({ firstName: 'א' }), 'א');
});
t('מחלקה: department.name; בלי - לפי roleId מהמפה; אחרת "מחלקה N"; בלי כלום "ללא מחלקה"', () => {
  const m = deptNamesByRole(E);
  assert.equal(m.get(0), 'הנהלה ראשית'); assert.equal(m.get(4), 'מזכירה');
  assert.equal(employeeDeptName(E[0], m), 'הנהלה ראשית');
  assert.equal(employeeDeptName(E[2], new Map([[3, 'תופרת']])), 'תופרת', 'שורת AI בלי department');
  assert.equal(employeeDeptName(E[3], m), 'מחלקה 99');
  assert.equal(employeeDeptName(E[4], m), 'ללא מחלקה');
});
t('deptIcon לפי שם המחלקה (הפלטה), ברירת מחדל building', () => {
  assert.equal(deptIcon('הנהלה ראשית'), 'shield'); assert.equal(deptIcon('מזכירה'), 'note'); assert.equal(deptIcon('תופרת'), 'scissors');
  assert.equal(deptIcon('מתכנת'), 'gear'); assert.equal(deptIcon('מסך לקוחות'), 'users'); assert.equal(deptIcon('משהו'), 'building'); assert.equal(deptIcon(null), 'building');
});
t('shiftText: שעות:דקות', () => { assert.equal(shiftText(222), '3:42'); assert.equal(shiftText(5), '0:05'); assert.equal(shiftText(null), '0:00'); });

console.log('שורת הרשימה');
t('employeeRow: מחובר + כניסה אחרונה מהנוכחות; סיסמה ישנה; פעיל', () => {
  const r = employeeRow(E[0], PRES, deptNamesByRole(E));
  assert.equal(r.conn, true); assert.equal(r.shiftMin, 222); assert.equal(r.last, '2026-10-09T07:00:00.000Z'); assert.equal(r.pwd, true); assert.equal(r.active, true);
  const r2 = employeeRow(E[1], PRES, null); assert.equal(r2.conn, false); assert.equal(r2.shiftMin, null); assert.equal(r2.ts, '2026-10-01T05:00:00.000Z');
  const r3 = employeeRow(E[2], {}, null); assert.equal(r3.last, null); assert.equal(r3.ts, ''); assert.equal(r3.active, false);
  assert.equal(employeeRow({ id: 'x', isActive: undefined }, {}, null).active, true, 'AI בלי isActive = פעיל');
  assert.equal(employeeRow({ id: 'x', isActive: 0 }, {}, null).active, false);
});

console.log('סינון');
t('ברירת מחדל: פעילים; מחוברים / סיסמה ישנה / לא פעילים; מחלקות לפי הנתונים; חיפוש לפי שם / טלפון / קוד / מחלקה', () => {
  const byRole = deptNamesByRole(E);
  const rows = E.map((e) => employeeRow(e, PRES, byRole));
  const filters = [{ key: 'dept', label: 'מחלקה', icon: 'building', def: [], options: deptOptions(rows) }, { key: 'status', label: 'סטטוס', icon: 'userck', def: ['active'], options: STATUS_OPTIONS }];
  const sorts = [{ k: 'name', l: 'שם', get: (r) => r.full }];
  const sel = initialSelection(filters);
  const base = { items: rows, words: [], hay: employeeHay, filters, sel, sorts, sort: { k: 'name', dir: 1 } };
  assert.equal(computeVisible(base).length, 4, 'הלא פעילה (לאה) מוסתרת');
  assert.equal(computeVisible({ ...base, sel: { dept: [], status: ['conn'] } }).length, 1);
  assert.equal(computeVisible({ ...base, sel: { dept: [], status: ['pwd'] } }).length, 1);
  assert.equal(computeVisible({ ...base, sel: { dept: [], status: ['inactive'] } }).length, 1);
  assert.equal(computeVisible({ ...base, words: ['0501'] }).length, 1);
  assert.equal(computeVisible({ ...base, words: ['מזכירה'] }).length, 1);
  assert.equal(computeVisible({ ...base, words: ['12'] }).length, 1, 'לפי קוד');
  const names = deptOptions(rows).map((o) => o.l);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'he')));
  const conn = STATUS_OPTIONS.find((o) => o.k === 'conn');
  assert.equal(optionCount(base, filters[1], conn), 1);
});

console.log('נתיב הנוכחות (סטטי)');
t('/api/employees/presence: שער הנהלה ראשית / מתכנת, קריאה בלבד, בלי סכמה חדשה', () => {
  const f = 'app/api/employees/presence/route.js';
  assert.ok(existsSync(f));
  const src = readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.match(src, /getAttendanceViewer\(\)/);
  assert.match(src, /if \(!viewer\.isManager\) return json\(\{ success: false, error: 'Forbidden' \}, 403\)/);
  assert.match(src, /shiftClockInfo\(/);
  assert.ok(!/\b(create|update|delete|upsert)(Many)?\(|\$executeRaw|\$transaction/.test(src), 'קריאה בלבד');
});

console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
