// בדיקות "סיכום נוכחות" (4.10.2026): החישובים והפורמטים (lib/attendance/summary.js), ההרשאות (lib/attendance/access.js),
// מטען ההדפסה / ה-Excel (lib/attendance/print.js), בדיקת הבעלות בשרת על נתיבי המשמרות (AT-13: POST/PUT/DELETE
// /api/employees/<id>/shifts...) ועל GET /api/attendance-sheet - עם lib/auth.js ו-lib/permissions.js האמיתיים מול DB מדומה בזיכרון
// (אותו מנגנון כמו scripts/schedule-tests: next/headers + prisma מוחלפים ב-shims), ובדיקת חוזה סטטית של קבצי הדף.
// בלי DB אמיתי, בלי רשת ובלי דפדפן. הרצה: node scripts/test_attendance_summary.mjs   (קוד יציאה 1 אם משהו נכשל)
// בדיקה חזותית מול העיצוב: scripts/attendance-bg-audit (ר' ההערה בראש run.mjs).
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJ = path.resolve(HERE, '..');
process.env.PROJ = PROJ;
process.env.SPDIR = path.join(HERE, 'schedule-tests');
delete process.env.AUTH_SECRET; // shim: העוגייה הגולמית מתקבלת (המסלול הישן המתועד של lib/authTokens.js)
register(pathToFileURL(path.join(HERE, 'schedule-tests', 'hooks.mjs')).href);
const L = (rel) => import(pathToFileURL(path.join(PROJ, rel)).href);
const read = (rel) => readFileSync(path.join(PROJ, rel), 'utf8');

let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n         ') : e); process.exitCode = 1; }
}

const S = await L('lib/attendance/summary.js');
const A = await L('lib/attendance/access.js');
const P = await L('lib/attendance/print.js');

console.log('\n== חישובים ופורמטים (lib/attendance/summary.js) ==');
await t('AT-06: שעות תמיד h:mm', () => {
  assert.equal(S.hm(0), '0:00');
  assert.equal(S.hm(65), '1:05');
  assert.equal(S.hm(8485), '141:25');
  assert.equal(S.hm(null), '0:00');
});
await t('AT-04: "כמות ימים" = ימים קלנדריים שונים; "משמרות" = מספר המשמרות; מחוקות לא נספרות; תקלה = כניסה בלי יציאה או להפך', () => {
  const sh = [
    { id: 'a', dayKey: '2026-09-01', entryTime: 'x', exitTime: 'y', minutes: 300, pay: 100, travel: 0 },
    { id: 'b', dayKey: '2026-09-01', entryTime: 'x', exitTime: 'y', minutes: 60, pay: 20, travel: 15 },
    { id: 'c', dayKey: '2026-09-02', entryTime: 'x', exitTime: null, minutes: null, pay: null },
    { id: 'd', dayKey: '2026-09-03', entryTime: 'x', exitTime: 'y', minutes: 90, pay: 30, isDeleted: true },
  ];
  const a = S.aggregate(sh);
  assert.equal(a.days, 2);
  assert.equal(a.shiftCount, 3);
  assert.equal(a.minutes, 360);
  assert.equal(a.issues, 1);
  assert.equal(a.pay, 120);
  assert.equal(a.travels, true);
  assert.equal(S.aggregate(sh, 'shifts').days, 3, 'המצב הישן (DAYS_COUNT_MODE=shifts) עדיין זמין כקבוע');
  assert.equal(S.DAYS_COUNT_MODE, 'distinct-days');
  assert.equal(S.isIncomplete({ entryTime: 'x', exitTime: null }), true);
  assert.equal(S.isIncomplete({ entryTime: null, exitTime: null }), false);
});
await t('AT-11: ברירת המחדל = החודש הקודם לפי שעון ישראל (כולל מעבר שנה ו-23:30 UTC של סוף החודש)', () => {
  assert.deepEqual(S.defaultPeriod(new Date('2026-10-04T09:00:00Z')), { y: 2026, m: 8 });
  assert.deepEqual(S.defaultPeriod(new Date('2027-01-10T09:00:00Z')), { y: 2026, m: 11 });
  // 31.10 23:30 UTC = 1.11 בישראל -> החודש הקודם הוא אוקטובר
  assert.deepEqual(S.defaultPeriod(new Date('2026-10-31T23:30:00Z')), { y: 2026, m: 9 });
  assert.deepEqual(S.defaultPeriod(new Date('2026-10-04T09:00:00Z'), 'current'), { y: 2026, m: 9 });
  assert.equal(S.DEFAULT_PERIOD, 'previous');
  assert.deepEqual(S.shiftMonth(2026, 0, -1), { y: 2025, m: 11 });
});
await t('שעון ישראל: יום של Shift.date בשתי צורות האחסון, שעה, והמרה מהטופס (קיץ / חורף / יציאה אחרי חצות)', () => {
  assert.equal(S.israelDayKey('2026-09-14T00:00:00.000Z'), '2026-09-14'); // חצות UTC (שעון הנוכחות / הוספה ידנית)
  assert.equal(S.israelDayKey('2026-09-13T21:00:00.000Z'), '2026-09-14'); // חצות ישראל (נתונים ישנים)
  assert.equal(S.israelTime('2026-09-14T05:05:00.000Z'), '08:05');
  assert.equal(S.israelTimeToIso('2026-07-01', '08:00'), '2026-07-01T05:00:00.000Z'); // קיץ +3
  assert.equal(S.israelTimeToIso('2026-12-01', '08:00'), '2026-12-01T06:00:00.000Z'); // חורף +2
  const o = S.buildShiftTimes('2026-12-01', '22:00', '01:30');
  assert.equal(o.entryTime, '2026-12-01T20:00:00.000Z');
  assert.equal(o.exitTime, '2026-12-01T23:30:00.000Z', 'יציאה לפני הכניסה = למחרת');
  assert.deepEqual(S.buildShiftTimes('2026-12-01', '', ''), { entryTime: null, exitTime: null });
  assert.equal(S.israelTimeToIso('bad', '08:00'), null);
});
await t('טווח החודש: יום לפני ואחרי בשאילתה, הסינון לפי היום הישראלי', () => {
  const r = S.monthQueryRange(2026, 8);
  assert.equal(r.gte.toISOString(), '2026-08-31T00:00:00.000Z');
  assert.equal(r.lt.toISOString(), '2026-10-02T00:00:00.000Z');
  assert.equal(S.dayKeyInMonth('2026-09-30', 2026, 8), true);
  assert.equal(S.dayKeyInMonth('2026-10-01', 2026, 8), false);
  assert.equal(S.parsePeriod('2026', '8').m, 8);
  assert.equal(S.parsePeriod('2026', '12'), null);
  assert.equal(S.parsePeriod('x', '1'), null);
});
await t('תאריכים עבריים: טווח החודש (שנה פעם אחת), יום קצר, שבוע', () => {
  assert.equal(S.hebSpan(2026, 8), 'י״ט אלול תשפ״ו – י״ט תשרי תשפ״ז', 'החודש חוצה שנה עברית - השנה בשני הצדדים');
  assert.equal(S.hebSpan(2026, 10), 'כ״א חשוון – כ׳ כסלו תשפ״ז', 'אותה שנה - פעם אחת');
  assert.equal(S.weekdayShort('2026-10-04'), 'יום א׳');
  assert.equal(S.weekdayShort('2026-10-03'), 'שבת');
  assert.equal(S.gregDots('2026-09-07'), '7.9.2026');
  assert.equal(S.monthLabel(2026, 8), 'ספטמבר 2026');
});
await t('AT-14: "לפי עובד" - חודשים מהחדש לישן מכל הנתונים, 20 בעמוד', () => {
  const sh = [];
  for (let k = 0; k < 22; k++) { const y = 2025 + Math.floor(k / 12); const m = (k % 12) + 1; sh.push({ id: 's' + k, dayKey: `${y}-${String(m).padStart(2, '0')}-10`, entryTime: 'x', exitTime: 'y', minutes: 60 }); }
  sh.push({ id: 'del', dayKey: '2027-01-10', entryTime: 'x', exitTime: 'y', minutes: 60, isDeleted: true });
  const months = S.monthsFromShifts(sh);
  assert.equal(months.length, 22);
  assert.equal(months[0].key, '2026-10');
  assert.equal(months[21].key, '2025-01');
  const p1 = S.paginate(months, 1);
  const p2 = S.paginate(months, 2);
  assert.equal(S.BYEMP_PAGE_SIZE, 20);
  assert.equal(p1.items.length, 20);
  assert.equal(p2.items.length, 2);
  assert.equal(p2.pages, 2);
  assert.equal(S.paginate(months, 99).page, 2, 'עמוד מעבר לטווח -> האחרון');
  assert.equal(S.sumRows(months).minutes, 22 * 60);
});
await t('מיון הטבלה החודשית (שם בעברית, מספרים, נסיעות)', () => {
  const rows = [{ name: 'רחל', minutes: 5, travels: false }, { name: 'אסתר', minutes: 9, travels: true }];
  assert.deepEqual(S.sortRows(rows, { key: 'name', dir: 1 }).map((r) => r.name), ['אסתר', 'רחל']);
  assert.deepEqual(S.sortRows(rows, { key: 'minutes', dir: -1 }).map((r) => r.name), ['אסתר', 'רחל']);
  assert.deepEqual(S.sortRows(rows, { key: 'travels', dir: 1 }).map((r) => r.name), ['רחל', 'אסתר']);
  assert.equal(S.sortRows(rows, { key: 'evil', dir: 1 }), rows);
});
await t('AT-12: "נערך ידנית" מההיסטוריה - הוספה בלבד = "נוסף ידנית", כל עריכה/מחיקה/שחזור = "נערך"; "ע״י" רק משורות אמינות', () => {
  const since = S.SHIFT_AUDIT_ACTOR_SINCE;
  const after = new Date(new Date(since).getTime() + 3600e3).toISOString();
  const before = new Date(new Date(since).getTime() - 86400e3).toISOString();
  const logs = [
    { entityId: 's1', action: 'CREATE', createdAt: after, employeeId: 'emp-head', changesJson: '{}' },
    { entityId: 's2', action: 'CREATE', createdAt: after, employeeId: 'emp-1', changesJson: '{}' },
    { entityId: 's2', action: 'UPDATE', createdAt: new Date(new Date(after).getTime() + 1000).toISOString(), employeeId: 'emp-1', changesJson: JSON.stringify({ exitTime: { from: null, to: '2026-09-14T14:00:00.000Z' } }) },
    { entityId: 's3', action: 'UPDATE', createdAt: before, employeeId: 'emp-owner', changesJson: '{}' },
  ];
  const ed = S.editInfoByShift(logs, { 'emp-head': 'הנהלה', 'emp-1': 'לאה', 'emp-owner': 'בעלת המשמרת' });
  assert.equal(ed.s1.kind, 'added');
  assert.equal(ed.s1.by, 'הנהלה');
  assert.equal(ed.s2.kind, 'edited');
  assert.equal(ed.s2.by, 'לאה');
  assert.equal(ed.s3.by, null, 'שורה ישנה: AuditLog.employeeId היה בעל המשמרת, לא מי שערך');
});
await t('היסטוריה: לפני/אחרי של כניסה ויציאה בשעון ישראל, סוג הפעולה (כולל שחזור), בלי שדות שכר', () => {
  const at = new Date(new Date(S.SHIFT_AUDIT_ACTOR_SINCE).getTime() + 1000).toISOString();
  const up = S.shapeHistory({ id: 'h1', entityId: 's1', action: 'UPDATE', createdAt: at, employeeId: 'e1', changesJson: JSON.stringify({ entryTime: { from: '2026-09-14T05:00:00.000Z', to: '2026-09-14T05:15:00.000Z' }, totalCalculated: { from: 100, to: 90 } }) }, { wages: true, names: { e1: 'שרה' }, shiftDayKey: '2026-09-14' });
  assert.equal(up.kind, 'edited');
  assert.equal(up.label, 'נערכה משמרת');
  assert.deepEqual(up.changes, [{ field: 'entryTime', from: '08:00', to: '08:15' }]);
  assert.equal(up.by, 'שרה');
  const rs = S.shapeHistory({ id: 'h2', entityId: 's1', action: 'UPDATE', createdAt: at, changesJson: JSON.stringify({ isDeleted: { from: true, to: false } }) }, {});
  assert.equal(rs.kind, 'restored');
  const del = S.shapeHistory({ id: 'h3', entityId: 's1', action: 'DELETE', createdAt: at, changesJson: JSON.stringify({ isDeleted: { from: false, to: true } }) }, {});
  assert.equal(del.kind, 'deleted');
  const cr = S.shapeHistory({ id: 'h4', entityId: 's1', action: 'CREATE', createdAt: at, changesJson: JSON.stringify({ entryTime: '2026-09-14T05:00:00.000Z', exitTime: null, totalCalculated: 77, hourlyWageSnapshot: 50 }) }, { wages: false });
  assert.equal(cr.kind, 'added');
  assert.deepEqual(cr.changes, [{ field: 'entryTime', from: null, to: '08:00' }]);
});
await t('shapeShift: בלי שכר לעובד רגיל (pay / wage / travel לא נשלחים)', () => {
  const raw = { id: 's', date: new Date('2026-09-14T00:00:00Z'), entryTime: new Date('2026-09-14T05:00:00Z'), exitTime: null, totalMinutes: null, totalCalculated: 12, hourlyWageSnapshot: 50, travelExpensesSnapshot: 15 };
  const a = S.shapeShift(raw, { wages: false });
  assert.ok(!('pay' in a) && !('wage' in a) && !('travel' in a));
  assert.equal(a.dayKey, '2026-09-14');
  const b = S.shapeShift(raw, { wages: true });
  assert.equal(b.pay, 12);
  assert.equal(b.travel, 15);
});
await t('AT-08 / AT-01 / AT-05: בלי מגבלת ייצוא, בלי עמודות חדשות בסיכום, סינון לפי חודש לועזי', () => {
  assert.equal(S.EXPORT_ROW_LIMIT, null);
  assert.equal(S.SHOW_EDITED_IN_SUMMARY, false);
  assert.deepEqual(S.SORT_KEYS, ['name', 'minutes', 'days', 'issues', 'pay', 'travels']);
});

console.log('\n== הרשאות (lib/attendance/access.js) ==');
await t('קריאה: טבלת כל העובדים - הנהלה בלבד; עובד רגיל - רק עצמו, בלי שכר; מזהה מהעוגייה', () => {
  assert.equal(A.decideReadAccess({ isManager: false, sessionEmployeeId: 'e1', scope: 'month' }).status, 403);
  assert.equal(A.decideReadAccess({ isManager: false, sessionEmployeeId: null, scope: 'month' }).status, 401);
  assert.equal(A.decideReadAccess({ isManager: true, sessionEmployeeId: 'h', scope: 'month' }).ok, true);
  assert.deepEqual(A.decideReadAccess({ isManager: false, sessionEmployeeId: 'e1', requestedEmployeeId: null, scope: 'employee' }), { ok: true, employeeId: 'e1', wages: false });
  assert.equal(A.decideReadAccess({ isManager: false, sessionEmployeeId: 'e1', requestedEmployeeId: 'e2', scope: 'employee' }).status, 403);
  assert.deepEqual(A.decideReadAccess({ isManager: true, sessionEmployeeId: 'h', requestedEmployeeId: 'e2', scope: 'employee' }), { ok: true, employeeId: 'e2', wages: true });
  assert.equal(A.decideReadAccess({ isManager: true, sessionEmployeeId: null, requestedEmployeeId: null, scope: 'employee' }).status, 401, 'אורח במצב פתוח בלי עובד: יש להתחבר');
});
await t('כתיבה: הנהלה - כל עובד; עובד - רק עצמו; משמרת שאינה של העובד שבנתיב = 404 לכולם', () => {
  assert.deepEqual(A.decideShiftWrite({ isManager: true, sessionEmployeeId: 'h', routeEmployeeId: 'e2' }), { ok: true, wages: true });
  assert.deepEqual(A.decideShiftWrite({ isManager: false, sessionEmployeeId: 'e1', routeEmployeeId: 'e1' }), { ok: true, wages: false });
  assert.equal(A.decideShiftWrite({ isManager: false, sessionEmployeeId: 'e1', routeEmployeeId: 'e2' }).status, 403);
  assert.equal(A.decideShiftWrite({ isManager: false, sessionEmployeeId: null, routeEmployeeId: 'e2' }).status, 401);
  assert.equal(A.decideShiftWrite({ isManager: false, sessionEmployeeId: 'e1', routeEmployeeId: 'e1', shiftEmployeeId: 'e2' }).status, 404);
  assert.equal(A.decideShiftWrite({ isManager: true, sessionEmployeeId: 'h', routeEmployeeId: 'e1', shiftEmployeeId: 'e2' }).status, 404);
  assert.equal(A.decideShiftWrite({ isManager: true, routeEmployeeId: '' }).status, 400);
  assert.deepEqual(A.stripWages({ id: 1, totalCalculated: 5, hourlyWageSnapshot: 40, travelExpensesSnapshot: 2, paymentMethod: 'x', totalMinutes: 60 }), { id: 1, totalMinutes: 60 });
  assert.equal(A.cleanEmployeeId('abc-123'), 'abc-123');
  assert.equal(A.cleanEmployeeId("a'; drop"), null);
});

console.log('\n== דף ההדפסה / Excel (lib/attendance/print.js) ==');
const EMP = (id, name, shifts) => ({ id, name, dept: 'מכירות', shifts });
const sh = (id, day, en, ex, min, pay) => ({ id, dayKey: day, entryTime: en, exitTime: ex, minutes: min, pay, travel: 0 });
await t('דוח מלא: גיליון לכל עובד שיש לו משמרות ("כל העובדים ברצף"), שעות h:mm, "N משמרות" = מספר המשמרות', () => {
  const p = P.buildAttendancePrintPayload({ type: 'full', period: { y: 2026, m: 8 }, wages: true, gmach: { name: 'גמ״ח' }, printedBy: 'שרה', now: new Date('2026-10-04T08:12:00Z'), employees: [
    EMP('e1', 'רחל לוי', [sh('a', '2026-09-01', '2026-09-01T05:00:00Z', '2026-09-01T10:00:00Z', 300, 210), sh('b', '2026-09-01', '2026-09-01T14:00:00Z', null, null, null)]),
    EMP('e2', 'ריקה', []),
    EMP('e3', 'מרים', [sh('c', '2026-09-02', '2026-09-02T05:00:00Z', '2026-09-02T06:30:00Z', 90, 60)]),
  ] });
  assert.equal(p.sheets.length, 2);
  assert.equal(p.sheets[0].title, 'דוח נוכחות עובד: רחל לוי');
  assert.equal(p.sheets[0].sum.b, '2 משמרות');
  assert.equal(p.sheets[0].sum.small, '5:00 שעות');
  assert.equal(p.sheets[0].totals.days, 1);
  assert.equal(p.sheets[0].shifts[1].incomplete, true);
  assert.equal(p.sheets[0].shifts[0].entry, '08:00');
  assert.equal(p.meta.producedTime, '11:12');
  assert.equal(p.meta.wages, true);
  const xl = P.payloadToSheets(p);
  assert.equal(xl[0].sheetName, 'ריכוז נתונים');
  assert.equal(xl.length, 3);
  assert.equal(xl[1].rows[0]['סה"כ שעות'], '5:00');
  assert.equal(xl[1].rows[0]['סה"כ יומי'], 210);
  assert.equal(P.fileBase(p), 'נוכחות_9_2026');
});
await t('עובד רגיל (wages=false): בלי עמודות שכר בגיליון ובאקסל', () => {
  const p = P.buildAttendancePrintPayload({ type: 'full', period: { y: 2026, m: 8 }, wages: false, employees: [EMP('e1', 'לאה', [sh('a', '2026-09-01', '2026-09-01T05:00:00Z', '2026-09-01T10:00:00Z', 300)])] });
  assert.equal(p.meta.wages, false);
  assert.ok(!('pay' in p.sheets[0].shifts[0]));
  const xl = P.payloadToSheets(p);
  assert.ok(!Object.keys(xl[0].rows[0]).some((k) => /תשלום|שכר|נסיעות|יומי/.test(k)), Object.keys(xl[0].rows[0]).join(','));
  assert.equal(P.fileBase(p), 'נוכחות_9_2026_לאה');
});
await t('טבלת סיכום + "לפי עובד - כל החודשים": שורת סה״כ, טווח החודשים בכותרת', () => {
  const s = P.buildAttendancePrintPayload({ type: 'summary', period: { y: 2026, m: 8 }, wages: true, employees: [EMP('e1', 'רחל', [sh('a', '2026-09-01', 'x', 'y', 60, 40)]), EMP('e2', 'אסתר', [sh('b', '2026-09-02', 'x', null, 0, 0)])] });
  assert.equal(s.sheets.length, 1);
  assert.equal(s.sheets[0].rows.length, 2);
  assert.equal(s.sheets[0].totals.issues, 1);
  assert.equal(s.sheets[0].sum.b, '2 עובדים');
  const b = P.buildAttendancePrintPayload({ type: 'byemp', wages: true, monthsBy: [{ employee: { id: 'e1', name: 'רחל', dept: '' }, months: [{ y: 2026, m: 8, minutes: 120, days: 2, shiftCount: 2, issues: 0, pay: 80, travels: false }, { y: 2025, m: 0, minutes: 60, days: 1, shiftCount: 1, issues: 1, pay: 40, travels: true }] }] });
  assert.equal(b.sheets[0].sub, 'ינואר 2025 – ספטמבר 2026');
  assert.equal(b.sheets[0].totals.minutes, 180);
  const xl = P.payloadToSheets(b);
  assert.equal(xl[0].rows[2]['חודש'], 'סה"כ לכל התקופה');
  assert.equal(xl[0].rows[2]['סה"כ שעות'], '3:00');
});

console.log('\n== שרת: בדיקת בעלות על נתיבי המשמרות (AT-13) ו-GET /api/attendance-sheet ==');
const shiftsRoute = await L('app/api/employees/[id]/shifts/route.js');
const shiftRoute = await L('app/api/employees/[id]/shifts/[shiftId]/route.js');
const sheetRoute = await L('app/api/attendance-sheet/route.js');
const { invalidateSettingsCache, invalidateAllSettingsCache } = await L('lib/settingsCache.js');
const { invalidateRequireLoginCache } = await L('lib/auth.js');
const { invalidatePermissionCache } = await L('lib/permissions.js');
const PA = await L('lib/printAccess.js');

const D = (s) => new Date(s);
function installDb({ requireLogin = true } = {}) {
  globalThis.__MOCK_DB = {
    systemSetting: [{ key: 'require_login', value: requireLogin ? 'true' : 'false' }, { key: 'gmach_name', value: 'גמ״ח בדיקה' }],
    employee: [
      { id: 'emp-head', roleId: 0, isActive: true, firstName: 'הנהלה', lastName: 'ראשית', hourlyWage: 60 },
      { id: 'emp-branch', roleId: 1, isActive: true, firstName: 'מנהלת', lastName: 'סניף', hourlyWage: 50 },
      { id: 'emp-1', roleId: 5, isActive: true, firstName: 'לאה', lastName: 'פרידמן', hourlyWage: 45, travelExpenses: false },
      { id: 'emp-2', roleId: 5, isActive: true, firstName: 'רחל', lastName: 'לוי', hourlyWage: 42, travelExpenses: false },
    ],
    shift: [
      { id: 'sh-1', employeeId: 'emp-1', date: D('2026-09-14T00:00:00Z'), entryTime: D('2026-09-14T05:00:00Z'), exitTime: D('2026-09-14T10:00:00Z'), totalMinutes: 300, totalCalculated: 225, hourlyWageSnapshot: 45, travelExpensesSnapshot: 0, isDeleted: false, hebrewDate: 'ג׳ תשרי' },
      { id: 'sh-2', employeeId: 'emp-2', date: D('2026-09-14T00:00:00Z'), entryTime: D('2026-09-14T05:00:00Z'), exitTime: D('2026-09-14T09:00:00Z'), totalMinutes: 240, totalCalculated: 168, hourlyWageSnapshot: 42, travelExpensesSnapshot: 0, isDeleted: false },
    ],
    auditLog: [],
    departmentPermission: [],
    employeePermissionOverride: [],
  };
  // loadMonth קורא את המשמרות דרך היחס employee.shifts - במוק הן מוצמדות לעובד (אותם אובייקטים)
  for (const e of globalThis.__MOCK_DB.employee) e.shifts = globalThis.__MOCK_DB.shift.filter((x) => x.employeeId === e.id);
  globalThis.__MOCK_CALLS = [];
  globalThis.__MOCK_WRITABLE = ['shift', 'auditLog'];
  // המוק מעדכן את אותו אובייקט שהקריאה החזירה (findUnique מחזיר הפניה) - ב-Prisma האמיתי oldShift הוא עותק. לפני עדכון מחליפים
  // את השורה בעותק כדי שההשוואה "לפני / אחרי" (ושורת ההיסטוריה) תעבוד כמו בשרת; ערך undefined לא נכתב (כמו ב-Prisma)
  globalThis.__MOCK_BEFORE_WRITE = (model, method, args) => {
    if (method !== 'update' || !args || !args.data) return;
    for (const k of Object.keys(args.data)) if (args.data[k] === undefined) delete args.data[k];
    const rows = globalThis.__MOCK_DB[model];
    const i = rows.findIndex((r) => r.id === (args.where && args.where.id));
    if (i >= 0) rows[i] = { ...rows[i] };
  };
  globalThis.__AUTH_TOKEN = null;
  (invalidateAllSettingsCache || invalidateSettingsCache)();
  invalidateRequireLoginCache();
  invalidatePermissionCache();
}
const as = (who) => { globalThis.__AUTH_TOKEN = who; };
const req = (body) => ({ json: async () => body, url: 'http://localhost/x' });
const ctx = (id, shiftId) => ({ params: Promise.resolve(shiftId ? { id, shiftId } : { id }) });
const status = async (r) => r.status;
const writes = () => (globalThis.__MOCK_CALLS || []).filter((c) => ['create', 'update', 'updateMany', 'delete'].includes(c.method));
const NEW = { date: '2026-09-15T00:00:00.000Z', entryTime: '2026-09-15T05:00:00.000Z', exitTime: '2026-09-15T07:00:00.000Z', notes: '' };

await t('עובד רגיל מוסיף משמרת לעצמו: 200, בלי שכר בתשובה, ובהיסטוריה נרשם הוא עצמו כמי שהוסיף', async () => {
  installDb(); as('emp-1');
  const r = await shiftsRoute.POST(req(NEW), ctx('emp-1'));
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  assert.ok(!('totalCalculated' in r.__json) && !('hourlyWageSnapshot' in r.__json), 'שכר דלף לעובד');
  assert.equal(r.__json.totalMinutes, 120);
  const log = globalThis.__MOCK_DB.auditLog.at(-1);
  assert.equal(log.action, 'CREATE');
  assert.equal(log.employeeId, 'emp-1');
});
await t('עובד רגיל לא מוסיף / עורך / מוחק משמרת של עובד אחר (403) - ושום דבר לא נכתב', async () => {
  installDb(); as('emp-1');
  assert.equal(await status(await shiftsRoute.POST(req(NEW), ctx('emp-2'))), 403);
  assert.equal(await status(await shiftRoute.PUT(req({ entryTime: '2026-09-14T04:00:00.000Z' }), ctx('emp-2', 'sh-2'))), 403);
  assert.equal(await status(await shiftRoute.DELETE(req({}), ctx('emp-2', 'sh-2'))), 403);
  assert.equal(writes().length, 0, JSON.stringify(writes()));
});
await t('עובד רגיל שמחליף רק את ה-id בנתיב לשלו עם משמרת של אחר: 404 (המשמרת חייבת להיות של העובד שבנתיב)', async () => {
  installDb(); as('emp-1');
  assert.equal(await status(await shiftRoute.PUT(req({ isDeleted: true }), ctx('emp-1', 'sh-2'))), 404);
  assert.equal(await status(await shiftRoute.DELETE(req({}), ctx('emp-1', 'sh-2'))), 404);
  assert.equal(writes().length, 0);
});
await t('עובד רגיל עורך / מוחק / משחזר משמרת של עצמו: 200, בלי שכר, מי שערך = הוא', async () => {
  installDb(); as('emp-1');
  const r = await shiftRoute.PUT(req({ entryTime: '2026-09-14T04:30:00.000Z' }), ctx('emp-1', 'sh-1'));
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  assert.equal(r.__json.totalMinutes, 330);
  assert.ok(!('totalCalculated' in r.__json));
  assert.equal(globalThis.__MOCK_DB.auditLog.at(-1).employeeId, 'emp-1');
  assert.equal((await shiftRoute.DELETE(req({}), ctx('emp-1', 'sh-1'))).status, 200);
  assert.equal(globalThis.__MOCK_DB.shift[0].isDeleted, true);
  assert.equal((await shiftRoute.PUT(req({ isDeleted: false }), ctx('emp-1', 'sh-1'))).status, 200);
  assert.equal(globalThis.__MOCK_DB.shift[0].isDeleted, false);
});
await t('הנהלה ראשית עורכת כל עובד (כמו בכרטיס העובד): 200 עם שכר, ובהיסטוריה נרשמת ההנהלה ולא בעלת המשמרת', async () => {
  installDb(); as('emp-head');
  const r = await shiftRoute.PUT(req({ exitTime: '2026-09-14T11:00:00.000Z' }), ctx('emp-2', 'sh-2'));
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  assert.equal(typeof r.__json.totalCalculated, 'number');
  assert.equal(globalThis.__MOCK_DB.auditLog.at(-1).employeeId, 'emp-head');
  assert.equal((await shiftsRoute.POST(req(NEW), ctx('emp-2'))).status, 200);
});
await t('מנהלת סניף (roleId 1) - כמו עובד רגיל: רק את עצמה (AT-09)', async () => {
  installDb(); as('emp-branch');
  assert.equal(await status(await shiftRoute.PUT(req({ notes: 'x' }), ctx('emp-2', 'sh-2'))), 403);
  assert.equal(await status(await shiftsRoute.POST(req(NEW), ctx('emp-branch'))), 200);
});
await t('בלי התחברות (חובת התחברות פעילה): 401; מצב פתוח (בלי חובת התחברות) - נשאר כמו היום (כמו הכניסה ל-/employees)', async () => {
  installDb(); as(null);
  assert.equal(await status(await shiftsRoute.POST(req(NEW), ctx('emp-2'))), 401);
  assert.equal(await status(await shiftRoute.DELETE(req({}), ctx('emp-2', 'sh-2'))), 401);
  installDb({ requireLogin: false }); as(null);
  assert.equal(await status(await shiftRoute.PUT(req({ notes: 'x' }), ctx('emp-2', 'sh-2'))), 200);
  assert.equal(globalThis.__MOCK_DB.auditLog.at(-1).employeeId, null, 'אורח: אין "מי ערך"');
});
const get = (qs) => sheetRoute.GET({ url: 'http://localhost/api/attendance-sheet?' + qs });
await t('GET month: הנהלה בלבד (עובד רגיל ומנהלת סניף 403, בלי התחברות 401)', async () => {
  installDb(); as('emp-1');
  assert.equal((await get('scope=month&y=2026&m=8')).status, 403);
  as('emp-branch');
  assert.equal((await get('scope=month&y=2026&m=8')).status, 403);
  as(null);
  assert.equal((await get('scope=month&y=2026&m=8')).status, 401);
  as('emp-head');
  const r = await get('scope=month&y=2026&m=8');
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  assert.equal(r.__json.viewer.isManager, true);
});
await t('GET employee / history / months: עובד רגיל רק את עצמו ובלי שכר; "נערך ידנית" מההיסטוריה', async () => {
  installDb(); as('emp-1');
  assert.equal((await get('scope=employee&emp=emp-2&y=2026&m=8')).status, 403);
  assert.equal((await get('scope=history&emp=emp-2')).status, 403);
  assert.equal((await get('scope=months&emp=emp-2')).status, 403);
  await shiftRoute.PUT(req({ entryTime: '2026-09-14T04:30:00.000Z' }), ctx('emp-1', 'sh-1'));
  const r = await get('scope=employee&y=2026&m=8');
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  assert.equal(r.__json.employee.id, 'emp-1');
  assert.equal(r.__json.shifts.length, 1);
  assert.ok(!('pay' in r.__json.shifts[0]), 'שכר דלף');
  assert.equal(r.__json.shifts[0].edit.kind, 'edited');
  const h = await get('scope=history');
  assert.equal(h.status, 200);
  assert.equal(h.__json.entries[0].changes[0].field, 'entryTime');
  const m = await get('scope=months');
  assert.equal(m.status, 200);
  assert.ok(!('pay' in m.__json.months[0]) && !('employees' in m.__json));
  assert.equal((await get('scope=totals')).status, 403);
});
await t('GET print: טבלת הסיכום להנהלה בלבד; עובד רגיל מקבל רק את הדוח שלו בלי שכר (גם כשביקש אחר - 403)', async () => {
  installDb(); as('emp-1');
  assert.equal((await get('scope=print&type=summary&y=2026&m=8')).status, 403);
  assert.equal((await get('scope=print&type=full&ids=emp-2&y=2026&m=8')).status, 403);
  const r = await get('scope=print&type=full&y=2026&m=8');
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  assert.equal(r.__json.sheets.length, 1);
  assert.equal(r.__json.meta.wages, false);
  assert.equal(r.__json.meta.gmach.name, 'גמ״ח בדיקה');
  as('emp-head');
  const s = await get('scope=print&type=summary&y=2026&m=8');
  assert.equal(s.status, 200);
  assert.equal(s.__json.sheets[0].rows.length, 2);
  const w0 = await get('scope=print&type=full&ids=emp-1&y=2026&m=8&wages=0');
  assert.equal(w0.__json.meta.wages, false, '"השעות שלי" של הנהלה - בלי שכר');
  assert.equal((await get('scope=print&type=full&ids=a%27b&y=2026&m=8')).status, 400);
});
await t('נכשל סגור: שגיאת DB בחיפוש העובד המחובר (עוגייה קיימת) -> לא מנהל: 401/403 על טבלת כל העובדים ועל משמרת של אחר', async () => {
  installDb(); as('emp-1');
  // כל קריאה לטבלת העובדים זורקת (getSessionEmployee -> null; checkPageAccess היה מחזיר true בשגיאה)
  const emps = globalThis.__MOCK_DB.employee;
  Object.defineProperty(globalThis.__MOCK_DB, 'employee', { get() { throw new Error('DB down'); }, configurable: true, enumerable: true });
  try {
    const denied = (st) => st === 401 || st === 403;
    assert.ok(denied((await get('scope=month&y=2026&m=8')).status), 'שכר של כולם דלף בשגיאת DB');
    assert.ok(denied(await status(await shiftsRoute.POST(req(NEW), ctx('emp-2')))), 'כתיבה למשמרת של אחר בשגיאת DB');
    assert.equal(writes().length, 0);
  } finally {
    Object.defineProperty(globalThis.__MOCK_DB, 'employee', { value: emps, writable: true, configurable: true, enumerable: true });
  }
});
await t('נכשל סגור: הנהלה ראשית לא פעילה (isActive=false) אינה מנהלת - 401/403', async () => {
  installDb();
  globalThis.__MOCK_DB.employee.push({ id: 'emp-head-old', roleId: 0, isActive: false, firstName: 'ישנה', lastName: 'לא פעילה', shifts: [] });
  as('emp-head-old');
  assert.ok([401, 403].includes((await get('scope=month&y=2026&m=8')).status));
  assert.ok([401, 403].includes(await status(await shiftRoute.PUT(req({ notes: 'x' }), ctx('emp-2', 'sh-2')))));
  assert.equal(writes().length, 0);
});
await t('אורח במצב פתוח: "השעות שלי" בלי עובד -> 401 "יש להתחבר"; טבלת ההנהלה נשארת כמו הדפים (פתוחה במצב פתוח)', async () => {
  installDb({ requireLogin: false }); as(null);
  const r = await get('scope=employee&y=2026&m=8');
  assert.equal(r.status, 401, JSON.stringify(r.__json));
  assert.equal((await get('scope=months')).status, 401);
  assert.equal((await get('scope=month&y=2026&m=8')).status, 200);
});
await t('GET /api/attendance (שורות משמרת עם שכר): הנהלה בלבד - עובד רגיל ושגיאת DB 403; הנהלה 200; POST (שעון הנוכחות) לא השתנה', async () => {
  const att = await L('app/api/attendance/route.js');
  const g = () => att.GET({ url: 'http://localhost/api/attendance?employeeId=emp-2' });
  installDb(); as('emp-1');
  assert.equal((await g()).status, 403);
  as('emp-head');
  assert.equal((await g()).status, 200);
  as(null);
  assert.equal((await g()).status, 401);
  assert.equal(typeof att.POST, 'function');
});
await t('"לפי עובד" לכמה עובדים: שאילתה מקובצת אחת (לא שאילתה לכל עובד)', async () => {
  installDb(); as('emp-head');
  globalThis.__MOCK_CALLS = [];
  const r = await get('scope=print&type=byemp&ids=emp-1,emp-2');
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  assert.equal(r.__json.sheets.length, 2);
  assert.equal(globalThis.__MOCK_CALLS.filter((c) => c.model === 'shift').length, 1);
});
await t('SHIFT_AUDIT_ACTOR_SINCE ניתן לדריסה במשתנה סביבה (לקבוע לזמן הפריסה במיזוג)', async () => {
  const { execFileSync } = await import('node:child_process');
  const url = pathToFileURL(path.join(PROJ, 'lib/attendance/summary.js')).href;
  const run = (env) => execFileSync(process.execPath, ['--no-warnings', '--input-type=module', '-e', `import(${JSON.stringify(url)}).then((m) => console.log(m.SHIFT_AUDIT_ACTOR_SINCE))`], { env: { ...process.env, ...env }, encoding: 'utf8' }).trim();
  assert.equal(run({ SHIFT_AUDIT_ACTOR_SINCE: '2026-11-01T10:00:00+02:00' }), '2026-11-01T08:00:00.000Z');
  assert.equal(run({ SHIFT_AUDIT_ACTOR_SINCE: 'garbage' }), '2026-10-04T12:15:00.000Z');
});
await t('PDF בשרת (AT-07): /attendance/print פתוח לכל מחובר (הנתונים נבדקים ב-API), נתיבים אחרים נשארים סגורים', async () => {
  assert.equal(PA.printPathPageKeys('/attendance/print'), PA.LOGIN_ONLY_PAGE_KEYS);
  assert.equal(await PA.canUsePrintSurface(PA.LOGIN_ONLY_PAGE_KEYS), true);
  for (const bad of ['/attendance', '/attendance/print/x', '/attendance/printx', '/employees/attendance']) assert.equal(PA.printPathPageKeys(bad), null, bad);
  const pdf = read('app/api/pdf/route.js');
  assert.match(pdf, /checkAuth\(\)/, 'POST /api/pdf עדיין דורש התחברות');
});

console.log('\n== חוזה הקבצים (סטטי) ==');
const SW = read('app/components/attendance/AttendanceSwitch.js');
const PAGE = read('app/components/attendance/AttendancePage.js');
const EDIT = read('app/components/attendance/AttendanceEdit.js');
const WIZ = read('app/components/attendance/AttendanceWizard.js');
const DLG = read('app/components/attendance/AttendanceDialogs.js');
const PARTS = read('app/components/attendance/parts.js');
const CSS = read('app/components/attendance/attendance.css');
const UI = PAGE + EDIT + WIZ + DLG + PARTS;
await t('נתיבים: /employees/attendance ו-/employees/<id>/attendance (תחת השער של /employees), /my-hours במצב עצמי, /employees/report מפנה, /attendance/print', () => {
  assert.match(SW, /dynamic\(\(\) => import\('\.\/AttendancePage'\), \{ ssr: false \}\)/);
  assert.match(read('app/employees/attendance/page.js'), /<AttendanceSwitch mode="manager"/);
  assert.match(read('app/employees/[id]/attendance/page.js'), /view: 'emp', empId/);
  assert.match(read('app/my-hours/page.js'), /<AttendanceSwitch mode="self"/);
  assert.match(read('app/employees/report/page.js'), /redirect\('\/employees\/attendance'\)/);
  assert.match(read('app/employees/layout.js'), /checkPageAccess\(HEAD_MANAGEMENT_ROLES\)/, 'השער של /employees לא השתנה');
  assert.ok(existsSync(path.join(PROJ, 'app/attendance/print/page.js')));
  assert.ok(!existsSync(path.join(PROJ, 'app/api/employees/attendance/route.js')), 'ה-API הישן שהוסר חזר');
  const emp = read('app/employees/page.js');
  assert.match(emp, /router\.push\('\/employees\/attendance'\)/, 'לשונית "נוכחות" מובילה לדף החדש');
  assert.ok(!/print-area|employee-page|ExportButtons|\/api\/employees\/attendance/.test(emp), 'קוד הלשונית הישנה נשאר');
  assert.ok(!/components\.css/.test(SW + read('app/my-hours/page.js')), 'ה-CSS של הפלטה נטען רק מתוך AttendancePage');
  assert.match(PAGE, /import '@\/design-system\/components\.css'/);
});
await t('נתיבי המשמרות: שער הבעלות בכל שלוש הפעולות ו"מי ערך" = העובד המחובר', () => {
  const post = read('app/api/employees/[id]/shifts/route.js');
  const one = read('app/api/employees/[id]/shifts/[shiftId]/route.js');
  assert.match(post, /authorizeShiftWrite\(\{ routeEmployeeId: employeeId \}\)/);
  assert.equal((one.match(/authorizeShiftWrite\(\{ routeEmployeeId: employeeId, shiftEmployeeId: oldShift\.employeeId \}\)/g) || []).length, 2);
  assert.ok(!/employeeId: employeeId\s*\n?\s*\}/.test(post + one), 'AuditLog עדיין נרשם על שם בעל המשמרת');
  assert.equal((post + one).match(/employeeId: guard\.actorId/g).length, 3);
});
await t('הדף: שורש .gm-ds.gm-at.home-bg.dlg-dark בלי gm-home, sprite מוטמע, בלי title= / alert / console, טולטיפים data-tip', () => {
  assert.match(PAGE, /className="gm-ds gm-at home-bg dlg-dark"/);
  assert.ok(!/gm-home/.test(UI));
  assert.match(PAGE, /<HomeSprite \/>/);
  assert.ok(!/\btitle="/.test(UI.replace(/<iframe[^>]*>/g, '')), 'title= (טולטיפ דפדפן) במקום data-tip');
  assert.ok(!/window\.alert|\balert\(|window\.confirm|customConfirm/.test(UI));
  assert.ok(!/console\.(log|info|debug|warn|error)/.test(UI));
  assert.ok(!/sprite\.svg/.test(UI));
  assert.match(PARTS, /SPRITE_ID_PREFIX/);
  assert.ok(!/<select/.test(UI), 'select במקום תיבת הבחירה של המערכת (.cb)');
});
await t('החלטות הבעלים בממשק: XL ושכר להנהלה בלבד, בלי סיסמת ייצוא, עימוד 20, "נערך ידנית" + היסטוריה, מתג תצוגה 46px', () => {
  assert.match(PAGE, /canXl=\{isMgr\}/);
  assert.match(WIZ, /own \|\| !isMgr \? \['print', 'dl'\] : \['print', 'dl', 'xl'\]/);
  assert.ok(!/approvalPin|lz-wpin|EXPORT_LIMIT|סיסמת מאשר/.test(UI + CSS), 'מגבלת ייצוא / סיסמה (AT-08)');
  assert.match(PAGE, /paginate\(months, page, BYEMP_PAGE_SIZE\)/);
  assert.match(EDIT, /chip gold at-man/);
  assert.match(EDIT, /היסטוריית שינויים/);
  assert.match(DLG, /\?tab=history|cardHref/);
  assert.match(PAGE, /\?tab=history/);
  assert.match(CSS, /\.seg\.pill\.at-vseg\{box-sizing:border-box;height:46px/);
  assert.match(CSS, /#mNow\{box-sizing:border-box;min-height:46px;height:46px\}/);
  assert.match(PAGE, /'עריכת הנוכחות שלי'|עריכת הנוכחות שלי/);
  assert.match(WIZ, /downloadPdf\(/);
  assert.match(WIZ, /printNow\(\);\n/, 'גיבוי: הדפסה רגילה כשה-PDF נכשל');
  assert.match(read('app/employees/[id]/page.js'), /get\('tab'\)/, 'כרטיס העובד נפתח על לשונית ההיסטוריה');
});
await t('CSS: כל כלל בהיקף .gm-ds.gm-at (חוץ מהמעטפת :has) ובלי */ בתוך הערה', () => {
  const rules = CSS.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.split('{')[0].trim()).filter((sel) => sel && !sel.startsWith('@'));
  const parts = (sel) => { const out = []; let d = 0; let cur = ''; for (const ch of sel) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };
  const bad = rules.filter((sel) => parts(sel).some((x) => x.trim() && !x.trim().startsWith('.gm-ds.gm-at') && !x.trim().startsWith('.app-shell .main .content:has(> .gm-ds.gm-at)') && !/^(to|from|\d+%)$/.test(x.trim())));
  assert.deepEqual(bad, []);
  assert.equal((CSS.match(/\/\*/g) || []).length, (CSS.match(/\*\//g) || []).length);
});

console.log(`\n${passed} passed`);
if (process.exitCode) process.exit(1);
process.exit(0);
