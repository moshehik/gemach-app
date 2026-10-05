// GET /api/employees (CPU phase 1B): no params / all=true -> the OLD full rows (legacy employees pages + anybody not asking for slim);
// ?slim=1 (authenticated, no all) -> only what the picker/approval consumers read; the anonymous login picker gets the identical response as
// before while the query now selects only those columns. In-memory prisma, no DB.
//   node --no-warnings --import ./scripts/cpu-phase1b-tests/register.mjs --test scripts/cpu-phase1b-tests/employees-list.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const route = await L('app/api/employees/route.js');

const THEME = JSON.stringify({ palette: Object.fromEntries(Array.from({ length: 23 }, (_, i) => [`--c${i}`, `#${(i * 977331).toString(16).padStart(6, '0').slice(0, 6)}`])) });
const DEPTS = { 0: 'הנהלה ראשית', 1: 'מנהל', 2: 'מתכנת', 3: 'מוכרת' };
const EMPS = Array.from({ length: 70 }, (_, i) => ({
  id: `emp-${i}`, legacyId: i === 69 ? 900001 : 100 + i, firstName: `שם${i}`, lastName: `משפחה${i}`, fullName: `שם${i} משפחה${i}`, phone1: '0501234567', phone2: '0521234567',
  city: 'ירושלים', street: 'הרצל', houseNum: '12', email: `e${i}@example.com`, joinDate: new Date('2020-01-01'), notes: 'הערה '.repeat(20), emailSuffix: null,
  roleId: i % 4, password: i % 7 === 0 ? 'plain-legacy' : '$2b$10$abcdefghijklmnopqrstuv', pinHash: '$2b$10$zzzzzzzzzzzzzzzzzzzzzz', mustResetPassword: false, isActive: i % 10 !== 9,
  hourlyWage: 40, paymentMethod: 'העברה', travelExpenses: false, themeColor: THEME, profileImage: i % 3 === 0 ? 'data:image/jpeg;base64,' + 'A'.repeat(3000) : null,
  receiveEmailAlerts: false, showAi: false, canReportErrors: false, firstNamePhoneticKey: 'x', lastNamePhoneticKey: 'y', updatedAt: new Date('2026-09-01'),
  department: { id: `d${i % 4}`, legacyId: i % 4, roleId: i % 4, name: DEPTS[i % 4] },
}));
globalThis.__CALLS = [];
function project(e, args) {
  if (args.select) {
    const out = {};
    for (const [k, v] of Object.entries(args.select)) {
      if (k === 'department') out.department = e.department ? Object.fromEntries(Object.keys(v.select).map((f) => [f, e.department[f]])) : null;
      else if (v) out[k] = e[k];
    }
    return out;
  }
  return { ...e, department: e.department };
}
globalThis.__PRISMA = {
  systemSetting: { findMany: async () => [], findUnique: async () => null },
  employee: {
    findMany: async (args) => {
      globalThis.__CALLS.push(args);
      let rows = EMPS.filter((e) => (args.where && 'isActive' in args.where ? e.isActive === args.where.isActive : true));
      rows = [...rows].sort((a, b) => (a.lastName < b.lastName ? -1 : a.lastName > b.lastName ? 1 : 0));
      return rows.map((e) => project(e, args));
    },
  },
};

const get = async (qs = '') => {
  const res = await route.GET(new Request(`http://test.local/api/employees${qs}`));
  const text = await res.text();
  return { status: res.status, text, json: JSON.parse(text) };
};
const kb = (t) => Buffer.byteLength(t) / 1024;

test('no params (authenticated): the old full rows - every column except password/pinHash, department, approvals, canApproveWithoutPayment', async () => {
  globalThis.__AUTH = true; globalThis.__CALLS = [];
  const { json } = await get();
  assert.equal(json.length, EMPS.filter((e) => e.isActive).length);
  const e = json[0];
  for (const k of ['phone1', 'email', 'hourlyWage', 'themeColor', 'profileImage', 'department', 'notes', 'canApproveWithoutPayment', 'approvals', 'roleId', 'isActive']) assert.ok(k in e, k);
  assert.ok(!('password' in e) && !('pinHash' in e));
  assert.ok(!('needsPasswordReset' in e), 'needsPasswordReset only for all=true');
  assert.ok(globalThis.__CALLS[0].include && !globalThis.__CALLS[0].select, 'full include query');
});

test('all=true: unchanged (inactive employees too, needsPasswordReset) and slim is ignored there (the legacy employees page keeps its shape)', async () => {
  globalThis.__AUTH = true;
  const a = await get('?all=true');
  const b = await get('?all=true&slim=1');
  assert.equal(a.text, b.text);
  assert.equal(a.json.length, EMPS.length);
  assert.ok('needsPasswordReset' in a.json[0] && 'phone1' in a.json[0]);
});

test('slim=1: only the fields the pickers / approval dialogs read; same people, same order, same approvals', async () => {
  globalThis.__AUTH = true; globalThis.__CALLS = [];
  const full = (await get()).json;
  const slim = (await get('?slim=1')).json;
  assert.ok(globalThis.__CALLS[1].select && !globalThis.__CALLS[1].include, 'slim selects instead of include');
  assert.deepEqual(slim.map((e) => e.id), full.map((e) => e.id));
  assert.deepEqual(Object.keys(slim[0]).sort(), ['approvals', 'canApproveWithoutPayment', 'department', 'firstName', 'fullName', 'id', 'isActive', 'lastName', 'roleId']);
  assert.deepEqual(Object.keys(slim[0].department).sort(), ['name', 'roleId']);
  for (let i = 0; i < full.length; i++) {
    for (const k of ['id', 'firstName', 'lastName', 'fullName', 'isActive', 'roleId', 'canApproveWithoutPayment']) assert.deepEqual(slim[i][k], full[i][k], k);
    assert.deepEqual(Object.keys(slim[i].approvals).sort(), Object.keys(full[i].approvals).filter((k) => full[i].approvals[k]).sort(), 'slim lists only the approved keys');
    for (const k of Object.keys(full[i].approvals)) assert.equal(!!slim[i].approvals[k], full[i].approvals[k], k);
    assert.equal(slim[i].department.name, full[i].department.name, 'EcApproval shows department.name');
  }
});

test('every consumer of the picker shape works on a slim row (the approver filters + name rendering)', async () => {
  globalThis.__AUTH = true;
  const slim = (await get('?slim=1')).json;
  const full = (await get()).json;
  const CC = await L('app/components/customer-card/customerCardLogic.js');
  const EC = await L('lib/employeeCardA5.js');
  for (const level of ['מנהל', 'מתכנת', 'הנהלה ראשית', 'מנהל סניף ומעלה', 'מאשר הזמנה ללא תשלום', 'feature:debt_approval', 'feature:customer_email_approval']) {
    assert.deepEqual(CC.filterApprovers(slim, level).map((e) => e.id), CC.filterApprovers(full, level).map((e) => e.id), 'customer card ' + level);
    assert.deepEqual(EC.filterApprovers(slim, level).map((e) => e.id), EC.filterApprovers(full, level).map((e) => e.id), 'employee card ' + level);
  }
});

test('slim payload is a fraction of the full list (themeColor palettes, profile images, contact + HR columns dropped)', async () => {
  globalThis.__AUTH = true;
  const full = await get(), slim = await get('?slim=1');
  console.log(`      full=${kb(full.text).toFixed(0)} KB  slim=${kb(slim.text).toFixed(0)} KB  (${slim.json.length} employees)`);
  assert.ok(kb(full.text) > 100);
  assert.ok(kb(slim.text) < kb(full.text) / 3);
});

test('anonymous caller (login picker): identical response to before - id, names, isActive only, service employees hidden - from a narrower select', async () => {
  globalThis.__AUTH = false; globalThis.__CALLS = [];
  const { json } = await get('?all=true&slim=1');
  assert.equal(json.length, EMPS.filter((e) => e.isActive && e.legacyId < 900000).length);
  assert.deepEqual(Object.keys(json[0]).sort(), ['fullName', 'firstName', 'id', 'isActive', 'lastName'].sort());
  assert.ok(!json.some((e) => e.id === 'emp-69'), 'service employee (legacyId >= SERVICE_EMPLOYEE_LEGACY_ID_MIN) not listed');
  const q = globalThis.__CALLS[0];
  assert.ok(q.select && !q.include && !('phone1' in q.select) && !('themeColor' in q.select));
  assert.deepEqual(q.where, { isActive: true }, 'anonymous callers never get all=true');
  globalThis.__AUTH = true;
});

test('static: every non-all consumer asks for ?slim=1; the all=true consumers and the frozen legacy login/punch pages keep their URLs', () => {
  const out = execFileSync('git', ['grep', '-n', '-E', "api/employees(\\?[a-z=0-9]+)?['\"`]", '--', 'app', 'components', 'lib'], { cwd: process.env.PROJ, encoding: 'utf8' });
  const lines = out.split('\n').filter((l) => l && !/\/\/|\*/.test(l.split(/:\d+:/)[1] || '') && !l.includes('desktop.ini'));
  const slimFiles = lines.filter((l) => l.includes('/api/employees?slim=1')).map((l) => l.split(':')[0]).sort();
  assert.deepEqual(slimFiles, [
    'app/components/PopupProvider.js', 'app/components/customer-card/CcApproval.js', 'app/components/employee-card/EcApproval.js', 'app/components/new-order/NoDialogs.js',
    'app/components/order-card/OcApproval.js', 'app/components/order-card/tabs/OcItemsTab.js', 'app/components/settings-sim/SettingsDialogs.js', 'app/customer-interface/page.js',
    'app/management/history/page.js', 'app/messages/page.js', 'components/SendEmailModal.js',
  ].sort());
  const read = (p) => fs.readFileSync(process.env.PROJ + '/' + p, 'utf8');
  assert.match(read('app/employees/LegacyEmployeesPage.js'), /fetchSharedJson\('\/api\/employees\?all=true'/);
  assert.match(read('app/employees/page.js'), /fetchSharedJson\('\/api\/employees\?all=true'/);
  assert.match(read('app/admin/permissions/PermissionsClient.js'), /fetch\('\/api\/employees\?all=true'\)/);
  // anonymous pickers: the server already answers them with names only; their URL/cache key is left as is
  for (const f of ['app/components/LoginScreen.js', 'app/components/login/LoginNew.js', 'app/components/login/PunchClockNew.js', 'app/punch-clock/PunchClockLegacy.js']) assert.match(read(f), /fetchSharedJson\('\/api\/employees', \{ ttl: TTL\.STATIC \}\)/, f);
});
