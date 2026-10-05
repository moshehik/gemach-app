// בדיקת יחידה לכרטיס העובד החדש (lib/employeeCardA5.js + lib/employeeCardPermGroups.js + lib/employeeCardHistory.js + שומרי מקור
// לרכיבי app/components/employee-card/*): המטענים מול השרת זהים לכרטיס הישן (העתקים מילוליים של handleSave / saveShift / שינוי סיסמה /
// SendEmailModal כ"אורקל"), 37 שורות ההרשאה מכוסות בקטגוריות בדיוק פעם אחת, נרמול ההיסטוריה, והחלטות הבעלים EC-05..EC-12 בקוד.
// לא נוגעת ב-DB / ברשת. הרצה: node scripts/test_employee_card_a5.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  blankEmployee, employeeBody, employeeSaveRequest, joinDateValue, initialsOf, needsGmailFill, withGmail,
  startEditData, startAddData, shiftMonthError, shiftRequest, buildShiftPayload, filterShifts, isIncompleteShift, monthlySalary,
  passwordChangeBody, passwordChangeError, setPasswordError, departmentOptions, buildSendEmailBody, filterApprovers, authBody,
} from '../lib/employeeCardA5.js';
import { PERM_CATEGORIES, OTHER_CATEGORY, categoryOfKey, groupPermissionItems } from '../lib/employeeCardPermGroups.js';
import { PERMISSION_CATALOG } from '../lib/permissionsMetadata.js';
import { buildHistoryRows } from '../lib/employeeCardHistory.js';

let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
// פיצול רשימת סלקטורים בפסיקים ברמה העליונה (לא בתוך :is(...))
const topLevelSplit = (sel) => { const out = []; let d = 0; let cur = ''; for (const ch of sel) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };
// הערות: בלוק רק בתחילת שורה (accept="image/*" אינו הערה), שורה שלמה או " // ..." בסוף שורה
const stripComments = (s) => s.replace(/^\s*\/\*[\s\S]*?\*\//gm, '').replace(/^\s*\/\/.*$/gm, '').replace(/(\s)\/\/ .*$/gm, '$1');

// ---------------------------------------------------------------------------------------------
// אורקלים: העתקים מילוליים של הלוגיקה בכרטיס הישן (app/employees/[id]/LegacyEmployeeCardPage.js) ושל SendEmailModal
// ---------------------------------------------------------------------------------------------
function legacyShiftPayload(editShiftData, isAddingShift, filterMonth, filterYear) {
  const payload = { ...editShiftData };
  delete payload.totalMinutes;
  delete payload.totalCalculated;
  if (isAddingShift) {
    payload.displayedMonth = filterMonth;
    payload.displayedYear = filterYear;
  }
  const dateBase = editShiftData.date ? editShiftData.date.split('T')[0] : '';
  if (payload.date) {
    payload.date = new Date(payload.date).toISOString();
  }
  if (editShiftData.entryTime && dateBase) {
    payload.entryTime = new Date(`${dateBase}T${editShiftData.entryTime}`).toISOString();
  } else { payload.entryTime = null; }
  if (editShiftData.exitTime && dateBase) {
    const entry = new Date(`${dateBase}T${editShiftData.entryTime}`);
    let exit = new Date(`${dateBase}T${editShiftData.exitTime}`);
    if (exit < entry) {
      exit = new Date(exit.getTime() + 24 * 60 * 60 * 1000);
    }
    payload.exitTime = exit.toISOString();
  } else { payload.exitTime = null; }
  return payload;
}
const legacyStartEdit = (shift) => ({
  date: shift.date ? shift.date.split('T')[0] : '',
  hebrewDate: shift.hebrewDate || '',
  entryTime: shift.entryTime ? new Date(shift.entryTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
  exitTime: shift.exitTime ? new Date(shift.exitTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
  totalMinutes: shift.totalMinutes || '',
  totalCalculated: shift.totalCalculated || '',
  notes: shift.notes || '',
  isDeleted: shift.isDeleted || false,
});
const legacyStartAdd = (filterMonth, filterYear) => ({
  date: `${filterYear}-${String(filterMonth + 1).padStart(2, '0')}-01`,
  hebrewDate: '', entryTime: '', exitTime: '', totalMinutes: '', totalCalculated: '', notes: '', isDeleted: false,
});
function legacyMonthlySalary(employee, filterMonth, filterYear) {
  if (!employee || !employee.shifts) return 0;
  let total = 0;
  employee.shifts.forEach((shift) => {
    const shiftDate = new Date(shift.date);
    if (!shift.isDeleted && shiftDate.getMonth() === filterMonth && shiftDate.getFullYear() === filterYear && shift.totalCalculated) {
      total += shift.totalCalculated;
    }
  });
  return total.toFixed(2);
}
const legacyFilterShifts = (employee, showDeletedShifts, filterMonth, filterYear) => (employee.shifts?.filter((shift) => {
  const d = new Date(shift.date);
  if (!showDeletedShifts && shift.isDeleted) return false;
  return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
}) || []).sort((a, b) => {
  const dateDiff = new Date(a.date) - new Date(b.date);
  if (dateDiff !== 0) return dateDiff;
  return new Date(a.entryTime || a.date) - new Date(b.entryTime || b.date);
});
const legacyPasswordBody = (isOwnCard, oldPasswordInput, managerPasswordInput, newPasswordInput) => (isOwnCard
  ? { oldPassword: oldPasswordInput, newPassword: newPasswordInput }
  : { managerPassword: managerPasswordInput, newPassword: newPasswordInput });
// SendEmailModal: ...formData (to, cc, subject, body, username, password) + שדות הנספחים
function legacySendEmailBody({ formData, firstFileName, firstFileContent, attachments, sendMode, driveFolderId, customerId, employeeId }) {
  return { ...formData, emailBody: formData.body, fileName: firstFileName, fileContent: firstFileContent, attachments, sendMode, driveFolderId, customerId, employeeId };
}
// PopupProvider.showAuthPrompt: סינון המאשרים לפי הרמה (שורות 145-151 שם)
function legacyApprovers(employees, requiredLevel) {
  if (requiredLevel === 'מנהל') return employees.filter((e) => e.roleId === 1 || e.roleId === 2);
  if (requiredLevel === 'מתכנת') return employees.filter((e) => e.roleId === 2);
  if (requiredLevel === 'הנהלה ראשית') return employees.filter((e) => e.roleId === 0 || e.roleId === 2);
  if (requiredLevel === 'מנהל סניף ומעלה') return employees.filter((e) => e.roleId === 0 || e.roleId === 1 || e.roleId === 2);
  return employees;
}

console.log('מטענים מול השרת = הכרטיס הישן');
await t('שמירת פרטים: URL / שיטה / כותרות כמו handleSave, והגוף = JSON של האובייקט בלי emailSuffix (EC-05)', () => {
  const emp = { ...blankEmployee(), firstName: 'א', lastName: 'ב', phone1: '050', roleId: '3', hourlyWage: '40', travelExpenses: true };
  const neu = employeeSaveRequest('new', emp);
  assert.equal(neu.url, '/api/employees'); assert.equal(neu.method, 'POST');
  const upd = employeeSaveRequest('e1', { ...emp, id: 'e1', shifts: [{ id: 's' }], emailSuffix: 'x' });
  assert.equal(upd.url, '/api/employees/e1'); assert.equal(upd.method, 'PUT');
  assert.deepEqual(upd.headers, { 'Content-Type': 'application/json' });
  const body = JSON.parse(upd.body);
  assert.equal('emailSuffix' in body, false);
  assert.deepEqual(body, { ...emp, id: 'e1', shifts: [{ id: 's' }] });
  // שאר השדות זהים לאורקל (JSON.stringify(employee))
  const full = { ...emp, id: 'e1' };
  assert.equal(employeeBody(full), JSON.stringify(full));
});
await t('עובד חדש: אותם שדות ריקים כמו fetchEmployee בישן, בלי emailSuffix', () => {
  const legacy = {
    firstName: '', lastName: '', fullName: '', phone1: '', phone2: '', email: '', emailSuffix: '', city: '', street: '', houseNum: '',
    joinDate: '', password: '', roleId: '', hourlyWage: '', travelExpenses: false, paymentMethod: '', notes: '', profileImage: '',
    isActive: true, receiveEmailAlerts: false, shifts: [],
  };
  const { emailSuffix, ...expected } = legacy; // eslint-disable-line no-unused-vars
  assert.deepEqual(blankEmployee(), expected);
});
await t('משמרת: buildShiftPayload זהה לאורקל (הוספה / עריכה / יציאה אחרי חצות / בלי שעות)', () => {
  const cases = [
    { editShiftData: { date: '2026-10-05', entryTime: '08:00', exitTime: '16:30', notes: 'x', hebrewDate: '', isDeleted: false, totalMinutes: '', totalCalculated: '' }, isAdding: true, m: 9, y: 2026 },
    { editShiftData: { date: '2026-10-05', entryTime: '22:00', exitTime: '06:00', notes: '', totalMinutes: 5, totalCalculated: 9 }, isAdding: true, m: 9, y: 2026 },
    { editShiftData: { date: '2026-10-05T00:00:00.000Z', entryTime: '09:15', exitTime: '', notes: 'a' }, isAdding: false, m: 9, y: 2026 },
    { editShiftData: { date: '2026-10-05', entryTime: '', exitTime: '10:00' }, isAdding: false, m: 9, y: 2026 },
    { editShiftData: { date: '', entryTime: '08:00', exitTime: '09:00' }, isAdding: true, m: 0, y: 2026 },
  ];
  for (const c of cases) {
    assert.deepEqual(buildShiftPayload({ editShiftData: c.editShiftData, isAdding: c.isAdding, filterMonth: c.m, filterYear: c.y }),
      legacyShiftPayload(c.editShiftData, c.isAdding, c.m, c.y));
  }
  const p = buildShiftPayload({ editShiftData: cases[0].editShiftData, isAdding: true, filterMonth: 9, filterYear: 2026 });
  assert.equal('totalMinutes' in p, false); assert.equal('totalCalculated' in p, false);
  assert.equal(p.displayedMonth, 9); assert.equal(p.displayedYear, 2026);
});
await t('משמרת: נקודות קצה (startEditData / startAddData / URL ושיטה / בדיקת החודש המוצג) כמו saveShift בישן', () => {
  const shift = { id: 's1', date: '2026-10-05T00:00:00.000Z', hebrewDate: 'כ״ג תשרי', entryTime: '2026-10-05T05:00:00.000Z', exitTime: '2026-10-05T13:30:00.000Z', totalMinutes: 510, totalCalculated: 85, notes: 'n', isDeleted: false };
  assert.deepEqual(startEditData(shift), legacyStartEdit(shift));
  assert.deepEqual(startEditData({ id: 's2' }), legacyStartEdit({ id: 's2' }));
  for (const [m, y] of [[0, 2026], [8, 2026], [11, 2027]]) assert.deepEqual(startAddData(m, y), legacyStartAdd(m, y));
  assert.deepEqual(shiftRequest('e1', true, 'new'), { url: '/api/employees/e1/shifts', method: 'POST' });
  assert.deepEqual(shiftRequest('e1', false, 's1'), { url: '/api/employees/e1/shifts/s1', method: 'PUT' });
  assert.equal(shiftMonthError({ isAdding: false, date: '', filterMonth: 0, filterYear: 2026 }), null);
  assert.equal(shiftMonthError({ isAdding: true, date: '', filterMonth: 9, filterYear: 2026 }), 'יש לבחור תאריך למשמרת');
  assert.equal(shiftMonthError({ isAdding: true, date: '2026-10-05', filterMonth: 9, filterYear: 2026 }), null);
  assert.match(shiftMonthError({ isAdding: true, date: '2026-09-30', filterMonth: 9, filterYear: 2026 }), /לא ניתן להוסיף משמרת בתאריך שאינו בחודש המוצג/);
  assert.match(shiftMonthError({ isAdding: true, date: '2025-10-05', filterMonth: 9, filterYear: 2026 }), /לא ניתן להוסיף משמרת/);
});
await t('סינון / מיון משמרות וסיכום שכר זהים לאורקל', () => {
  const shifts = [
    { id: 'a', date: '2026-10-02T00:00:00.000Z', entryTime: '2026-10-02T08:30:00.000Z', exitTime: '2026-10-02T13:00:00.000Z', totalCalculated: 100.5 },
    { id: 'b', date: '2026-10-01T00:00:00.000Z', entryTime: '2026-10-01T17:30:00.000Z', exitTime: null, totalCalculated: null },
    { id: 'c', date: '2026-10-01T00:00:00.000Z', entryTime: '2026-10-01T08:00:00.000Z', exitTime: '2026-10-01T16:30:00.000Z', totalCalculated: 340 },
    { id: 'd', date: '2026-10-02T00:00:00.000Z', isDeleted: true, entryTime: '2026-10-02T10:00:00.000Z', exitTime: '2026-10-02T11:00:00.000Z', totalCalculated: 40 },
    { id: 'e', date: '2026-09-15T00:00:00.000Z', totalCalculated: 50 },
  ];
  const emp = { shifts };
  for (const showDeleted of [false, true]) {
    assert.deepEqual(filterShifts(shifts, { showDeleted, filterMonth: 9, filterYear: 2026 }).map((s) => s.id),
      legacyFilterShifts(emp, showDeleted, 9, 2026).map((s) => s.id));
  }
  assert.equal(monthlySalary(shifts, 9, 2026), legacyMonthlySalary(emp, 9, 2026));
  assert.equal(monthlySalary(shifts, 8, 2026), legacyMonthlySalary(emp, 8, 2026));
  assert.equal(monthlySalary(null, 8, 2026), 0);
  assert.equal(isIncompleteShift(shifts[1]), true); assert.equal(isIncompleteShift(shifts[0]), false); assert.equal(isIncompleteShift({}), false);
});
await t('סיסמה: גוף הבקשה לפי isOwnCard זהה לישן, והבדיקות בצד הלקוח כמו בישן', () => {
  for (const own of [true, false]) {
    assert.deepEqual(passwordChangeBody({ isOwnCard: own, oldPassword: 'o', managerPassword: 'm', newPassword: 'n' }), legacyPasswordBody(own, 'o', 'm', 'n'));
  }
  assert.equal(passwordChangeError({ newPassword: '', sessionEmployeeId: 'e1' }), 'יש להזין סיסמא חדשה');
  assert.match(passwordChangeError({ newPassword: 'abcd', sessionEmployeeId: null }), /לא ניתן לזהות את המשתמש המחובר/);
  assert.equal(passwordChangeError({ newPassword: 'abcd', sessionEmployeeId: 'e1' }), null);
  assert.equal(setPasswordError('abc'), 'הסיסמה חייבת להכיל לפחות 4 תווים');
  assert.equal(setPasswordError(''), 'הסיסמה חייבת להכיל לפחות 4 תווים');
  assert.equal(setPasswordError('abcd'), null);
  assert.deepEqual(authBody({ pin: '1234', employeeId: 'm1' }), { authPin: '1234', authEmployeeId: 'm1' });
  assert.deepEqual(authBody(null), { authPin: null, authEmployeeId: null });
});
await t('מייל (EC-10): הגוף זהה ל-SendEmailModal, username/password = מזהה המנהל וקודו', () => {
  const form = { to: 'a@b.co', cc: '', subject: 's', body: 'b' };
  const f1 = { fileName: 'x.pdf', fileContent: 'QUJD', mimeType: 'application/pdf', sizeBytes: 3 };
  const f2 = { fileName: 'y.png', fileContent: 'REVG', mimeType: '', sizeBytes: 0 };
  const files = [f1, f2];
  const mine = buildSendEmailBody({ form, files, sendMode: 'both', driveFolderId: 'fold', employeeId: 'e1', approval: { employeeId: 'm1', pin: '1234' } });
  const attachments = files.map((f) => ({ fileName: f.fileName, fileContent: f.fileContent, mimeType: f.mimeType || 'application/octet-stream', sizeBytes: f.sizeBytes || null, dest: 'both' }));
  const legacy = legacySendEmailBody({ formData: { ...form, username: 'm1', password: '1234' }, firstFileName: 'x.pdf', firstFileContent: 'QUJD', attachments, sendMode: 'both', driveFolderId: 'fold', customerId: undefined, employeeId: 'e1' });
  assert.equal(JSON.stringify(mine), JSON.stringify(legacy));
  const none = buildSendEmailBody({ form, files: [], sendMode: 'email', driveFolderId: '', employeeId: 'e1', approval: { employeeId: 'm1', pin: '1' } });
  assert.equal(none.fileName, ''); assert.equal(none.fileContent, ''); assert.deepEqual(none.attachments, []);
});
await t('מאשרים (EC-10 חלון נפרד): filterApprovers זהה להכרעה של PopupProvider, ו-feature: לפי approvals', () => {
  const emps = [0, 1, 2, 3, null].map((roleId, i) => ({ id: `e${i}`, roleId, canApproveWithoutPayment: i === 3, approvals: i === 1 ? { 'feature:customer_email_approval': true } : {} }));
  for (const lvl of ['מנהל', 'מתכנת', 'הנהלה ראשית', 'מנהל סניף ומעלה']) {
    assert.deepEqual(filterApprovers(emps, lvl).map((e) => e.id), legacyApprovers(emps, lvl).map((e) => e.id), lvl);
  }
  assert.deepEqual(filterApprovers(emps, 'feature:customer_email_approval').map((e) => e.id), ['e1']);
  assert.deepEqual(filterApprovers(emps, 'מאשר הזמנה ללא תשלום').map((e) => e.id), ['e3']);
  assert.deepEqual(filterApprovers(null, 'מנהל'), []);
});
await t('מחלקה (EC-05): אופציות הבורר כמו ה-select הישן; ערך לא מוכר נשמר; בלי שדה מספר חלופי', () => {
  const depts = [{ roleId: 0, name: 'הנהלה ראשית' }, { roleId: 3, name: 'מכירות' }];
  assert.deepEqual(departmentOptions(depts, 3), [['', 'ללא מחלקה'], ['0', 'הנהלה ראשית (0)'], ['3', 'מכירות (3)']]);
  assert.deepEqual(departmentOptions(depts, 99).at(-1), ['99', 'מחלקה לא מוכרת (99)']);
  assert.equal(departmentOptions(depts, '').length, 3);
  assert.equal(departmentOptions(depts, null).length, 3);
  assert.equal(departmentOptions(depts, 0).length, 3);
});
await t('עזרים קטנים: תאריך כניסה, ראשי תיבות, "השלם ל-@gmail.com"', () => {
  assert.equal(joinDateValue('2021-03-15T00:00:00.000Z'), '2021-03-15');
  assert.equal(joinDateValue(''), ''); assert.equal(joinDateValue('garbage'), '');
  assert.equal(initialsOf({ firstName: 'אסתר', lastName: 'גולד' }), 'אג');
  assert.equal(initialsOf(null), '');
  assert.equal(needsGmailFill(''), true); assert.equal(needsGmailFill('abc'), true); assert.equal(needsGmailFill('a@b.c'), false);
  assert.equal(withGmail('abc'), 'abc@gmail.com'); assert.equal(withGmail(''), '@gmail.com');
});

console.log('קטגוריות ההרשאות (EC-09)');
const configurable = PERMISSION_CATALOG.filter((i) => !i.notConfigurable);
await t('37 השורות הניתנות להגדרה: כל אחת בקטגוריה אחת בדיוק (ואף אחת לא ב"אחר")', () => {
  assert.equal(configurable.length, 37);
  const seen = new Map();
  for (const c of PERM_CATEGORIES) for (const k of c.keys) { assert.equal(seen.has(k), false, `${k} בשתי קטגוריות`); seen.set(k, c.id); }
  for (const item of configurable) assert.ok(seen.has(item.key), `${item.key} ללא קטגוריה`);
  for (const k of seen.keys()) assert.ok(PERMISSION_CATALOG.some((i) => i.key === k), `${k} אינו בקטלוג`);
  assert.equal(configurable.filter((i) => categoryOfKey(i.key) === OTHER_CATEGORY.id).length, 0);
});
await t('groupPermissionItems: 8-10 קבוצות (החלטת הבעלים המעודכנת: יותר קבוצות), כל הפריטים פעם אחת, בלי קבוצה ריקה, פריט חדש -> "אחר"', () => {
  const groups = groupPermissionItems(configurable);
  assert.ok(groups.length >= 8 && groups.length <= 10, `קבוצות: ${groups.length}`);
  const flat = groups.flatMap((g) => g.items.map((i) => i.key));
  assert.equal(flat.length, 37); assert.equal(new Set(flat).size, 37);
  assert.ok(groups.every((g) => g.items.length > 0 && g.title && g.icon));
  const extra = groupPermissionItems([...configurable, { key: 'feature:future_thing' }]);
  assert.equal(extra.at(-1).id, 'other'); assert.equal(extra.at(-1).items[0].key, 'feature:future_thing');
  assert.deepEqual(groupPermissionItems([]), []); assert.deepEqual(groupPermissionItems(null), []);
});
await t('כותרות הקטגוריות: בלי סוגריים ובלי "מקופל" (EC-09)', () => {
  for (const c of [...PERM_CATEGORIES, OTHER_CATEGORY]) { assert.doesNotMatch(c.title, /[()[\]]|מקופל/); }
  const src = stripComments(read('app/components/employee-card/EcPermissions.js'));
  assert.doesNotMatch(src, /מקופל/);
});

console.log('היסטוריה (EC-06)');
await t('נרמול: חריגת הרשאה אישית + מייל קריא (תקציר, בלי JSON גולמי)', () => {
  const rows = buildHistoryRows([
    { id: 'p1', entityType: 'EmployeePermissionOverride', entityId: 'o1', action: 'CREATE', changesJson: JSON.stringify({ key: 'feature:ai', value: 'true' }), createdAt: '2026-10-01T08:00:00.000Z', employeeId: 'a1', employeeName: 'דנה' },
    { id: 'm1', entityType: 'Employee', entityId: 'e1', action: 'EMAIL_SENT', changesJson: JSON.stringify({ to: 'a@b.co', subject: 'ש', body: 'x', sendMode: 'drive' }), createdAt: '2026-10-01T09:00:00.000Z', employeeId: 'a1', employeeName: 'דנה' },
  ], { catalogLabel: (k) => (k === 'feature:ai' ? 'בינה מלאכותית' : k) });
  assert.equal(rows[0].actionLabel, 'שינוי הרשאה'); assert.equal(rows[0].changes[0].label, 'בינה מלאכותית'); assert.equal(rows[0].changes[0].to, 'מותר');
  assert.equal(rows[1].actionLabel, 'שליחת מייל'); assert.deepEqual(rows[1].changes.map((c) => c.key), ['subject', 'to', 'body', 'sendMode']);
  assert.equal(rows[1].changes[3].to, 'העלאה לדרייב + שיתוף');
});

console.log('כתיבת הרשאות אישיות מהכרטיס (EC-06): נרשמת פעם אחת, דרך התוסף');
await t('permissions.js: audit:true = create / update / delete עם auditAs (התוסף של app/lib/prisma.js כותב את השורה); אין כתיבה ידנית ל-AuditLog; התוסף באמת מדלג על upsert', () => {
  const perm = stripComments(read('lib/permissions.js'));
  assert.doesNotMatch(perm, /auditLog\.(create|createMany)/);
  assert.match(perm, /auditAs\('UPDATE'/); assert.match(perm, /auditAs\('CREATE'/); assert.match(perm, /auditAs\('DELETE'/);
  // התוסף רושם רק create / update / delete (upsert לא), ולכן המסלול ה-audit לא יכול לכפול שורה
  const ext = stripComments(read('app/lib/prisma.js'));
  assert.match(ext, /\['create', 'update', 'delete'\]\.includes\(operation\)/);
  // המסלול של סנכרון שורות ההרשאה (בלי audit) נשאר upsert כמו קודם
  const route = read('app/api/admin/permissions/employees/[employeeId]/route.js');
  assert.match(route, /setEmployeeOverride\(.*audit: true/); assert.match(route, /clearEmployeeOverride\(.*audit: true/);
});

console.log('החלטות הבעלים בקוד (בדיקת מקור)');
const a5 = read('app/components/employee-card/EmployeeCardA5.js');
const a5Code = stripComments(a5);
const css = read('app/components/employee-card/employee-card.css');
await t('שורש הדף: gm-ds gm-ec home-bg dlg-dark, בלי gm-home; sprite מוטמע; טולטיפ הדף', () => {
  assert.match(a5Code, /className="gm-ds gm-ec home-bg dlg-dark"/);
  assert.doesNotMatch(a5Code, /gm-home/);
  assert.match(a5Code, /<HomeSprite \/>/);
  assert.match(a5Code, /usePageTooltip\(/);
  assert.match(a5Code, /className="pl-tt"/);
});
await t('EC-05: תמונה בלבד (accept="image/*", בלי pdf), בלי emailSuffix, בלי שדה מספר מחלקה, בלי "מסמך"', () => {
  assert.match(a5Code, /accept="image\/\*"/);
  assert.doesNotMatch(a5Code, /\.pdf/i);
  assert.doesNotMatch(a5Code, /emailSuffix/);
  assert.doesNotMatch(a5Code, /name="roleId"/);
  assert.doesNotMatch(a5Code, /type="number"[^>]*roleId/);
  assert.doesNotMatch(a5Code, /מסמך/);
});
await t('EC-05: בחירת קובץ בדיאלוג עוברת את אותה בדיקת תמונה + תקרת גודל 2MB כמו הגרירה, עם טוסט עברי', () => {
  assert.match(a5Code, /const AVATAR_MAX_BYTES = 2 \* 1024 \* 1024/);
  const fn = a5Code.slice(a5Code.indexOf('const readAvatar'), a5Code.indexOf('const removeAvatar'));
  assert.match(fn, /\^image\\\//, 'בדיקת סוג בתוך readAvatar (משותף לדיאלוג ולגרירה)');
  assert.match(fn, /file\.size > AVATAR_MAX_BYTES/);
  assert.match(fn, /say\([^)]*'error'\)/);
  assert.match(fn, /fileRef\.current\.value = ''/, 'איפוס הקלט אחרי דחייה');
  assert.match(a5Code, /onChange=\{\(e\) => readAvatar\(e\.target\.files\[0\]\)\}/);
});
await t('הערות/טולטיפ: אין title= מקורי ברכיבי הכרטיס (label/קישור/מתג/כפתור) - data-tip בלבד', () => {
  for (const f of ['EmployeeCardA5', 'EcUi', 'EcApproval', 'EcAttendance', 'EcHistory', 'EcMail', 'EcPermissions']) {
    assert.doesNotMatch(stripComments(read(`app/components/employee-card/${f}.js`)), /\btitle=/, f);
  }
});
await t('EC-08: כרטיס אחד "מחלקה, סטטוס והערות" (7 כרטיסי פרטים, בלי כרטיס "הערות" נפרד)', () => {
  assert.match(a5Code, />מחלקה, סטטוס והערות</);
  assert.equal((a5Code.match(/<CardHead /g) || []).length, 7);
  assert.doesNotMatch(a5Code, /<CardHead icon="note"/);
});
await t('EC-11: הודעת הצלחה לעובד חדש לפני router.push', () => {
  const i = a5Code.indexOf("say('הפרטים נשמרו בהצלחה!')");
  const j = a5Code.indexOf('router.push(`/employees/${result.data.id}`)');
  assert.ok(i > 0 && j > i);
});
await t('EC-12: .app.ec ברוחב 1040px וכפתור השמירה 420px; כל סלקטור ב-CSS בהיקף .gm-ds.gm-ec', () => {
  assert.match(css, /\.gm-ds\.gm-ec \.app\.ec\{max-width:1040px\}/);
  assert.match(css, /\.gm-ds\.gm-ec \.ec-save \.btn\{width:100%;max-width:420px\}/);
  const rules = stripComments(css).replace(/@media[^{]*\{/g, '').split('}').map((x) => x.trim()).filter(Boolean);
  const bad = rules.map((r) => r.split('{')[0].trim()).filter((sel) => sel && !/^@keyframes/.test(sel) && !topLevelSplit(sel).every((s) => /^(\.gm-ds\.gm-ec\b|\.app-shell \.main \.content:has\(> \.gm-ds\.gm-ec\)|body \*|to\b|from\b)/.test(s.trim())));
  assert.deepEqual(bad, [], `סלקטורים בלי היקף: ${bad.slice(0, 3).join(' | ')}`);
});
await t('דליפות: אין :root / body (מלבד כלל ההדפסה) / html ב-CSS של הכרטיס; אין בחירת סגנון על .gm-home', () => {
  const code = stripComments(css);
  assert.doesNotMatch(code, /(^|[},])\s*(:root|html)\b/);
  assert.doesNotMatch(code, /gm-home/);
});
await t('EC-01 (עדכון): מתג הנסיעות נשאר עם כותרת שדה (.lbl) כמו "אופן תשלום"; EC-12 (עדכון): הרשת במקסימום 2 עמודות', () => {
  assert.match(a5Code, /className="field ec-travel"><span className="lbl" id="ec-travel-l">זכאות לנסיעות<\/span>/);
  assert.match(a5Code, /name="travelExpenses"/);
  assert.match(css, /\.gm-ds\.gm-ec \.app\.ec \.dfields \.grid2\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(stripComments(css), /auto-fit/);
});
await t('התקנים: בלי window.alert / confirm, חלונות כהים דרך portal, אימות מנהל בשכבה 2, avatar לא נשמר כמסמך', () => {
  for (const f of ['EmployeeCardA5', 'EcApproval', 'EcAttendance', 'EcHistory', 'EcMail', 'EcPermissions', 'EcUi']) {
    const code = stripComments(read(`app/components/employee-card/${f}.js`));
    assert.doesNotMatch(code, /window\.(alert|confirm|prompt)\(|customConfirm|customAuthPrompt|(^|[^.\w])alert\(/m, f);
  }
  assert.match(stripComments(read('app/components/employee-card/EcUi.js')), /createPortal\(/);
  assert.match(stripComments(read('app/components/employee-card/EcApproval.js')), /layer=\{2\}/);
  assert.match(stripComments(read('app/components/employee-card/EcMail.js')), /ec\.approve\(/);
  assert.doesNotMatch(stripComments(read('app/components/employee-card/EcMail.js')), /id="m-(user|username|pass|password)"/);
});
await t('ללא "טוגל" בטקסטים של הכרטיס', () => {
  for (const f of ['EmployeeCardA5', 'EcApproval', 'EcAttendance', 'EcHistory', 'EcMail', 'EcPermissions', 'EcUi']) assert.doesNotMatch(read(`app/components/employee-card/${f}.js`), /טוגל/, f);
});
await t('הכרטיס החדש משחזר את אותם נתיבי API של הישן (אין נתיב חדש לכתיבה)', () => {
  const legacy = read('app/employees/[id]/LegacyEmployeeCardPage.js');
  const writes = (src) => [...new Set([...src.matchAll(/\/api\/employees\/\$\{id\}\/(password|reset-password|set-password|shifts)/g)].map((m) => m[1]))].sort();
  const all = ['EmployeeCardA5', 'EcAttendance'].map((f) => read(`app/components/employee-card/${f}.js`)).join('\n');
  const mine = [...new Set([...all.matchAll(/\/api\/employees\/\$\{(?:id|employeeId)\}\/(password|reset-password|set-password|shifts)/g)].map((m) => m[1]))].sort();
  assert.deepEqual(mine, writes(legacy));
});

console.log(`\n${passed} passed${process.exitCode ? ' (with failures)' : ''}`);
