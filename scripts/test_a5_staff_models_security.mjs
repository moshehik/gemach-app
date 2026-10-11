// Security regression test for the employees / dress-models / model-card / new-model screens (a5-staff-models port, 2026-10-09).
// Pure logic + static source assertions - no DB, no Next, no server. Run: node scripts/test_a5_staff_models_security.mjs (exit 1 on failure).
//   1. The REAL auth core (lib/authTokens.js): anonymous / forged cookie / deactivated employee / low role are refused, head management and
//      programmer pass, a deactivated head-management employee is refused on the DB path.
//   2. The REAL ui-variant self-switch core (owner decision 2026-10-11: every active employee may choose the new design for themselves):
//      any role may set its OWN override, foreign employee ids in the body are ignored, anonymous 401 / deactivated 403, unknown screens and
//      hostile values refused. Opt-in LIVE matrix against a running dev server on TEST: UI_VARIANT_LIVE=1 (see the block at the end).
//   3. Gate manifest: every API route the four screens use still starts its handler with the expected server-side gate (the old UI and
//      the new UI call the same endpoints, so a removed gate would silently open them). Update this table WITH the route, never just to turn it green.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tokens = require('../lib/authTokens.js');
const { applyUiVariantRequest } = await import('../lib/uiVariantSelfSwitch.js');
const { getScreenEntry } = await import('../lib/uiVariantScreens.js');

let passed = 0;
async function ta(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

const SECRET = 'unit-test-secret';
const ROLE_LEVELS = { 'מנהל': [1, 2], 'מתכנת': [2], 'הנהלה ראשית': [0, 2] };
const dbWith = (rows) => async (id) => rows[id] || null;

function ctx({ requireLogin = true, cookieEmployee = null, signedFor = null, fresh = true, db = {}, requiredRole } = {}) {
  const now = Date.now();
  const sessionTokenValue = signedFor ? tokens.createSessionToken(signedFor, SECRET, fresh ? now : now - 3600 * 1000) : null;
  return {
    requiredRole,
    authTokenValue: cookieEmployee,
    sessionTokenValue,
    secret: SECRET,
    roleLevels: ROLE_LEVELS,
    getRequireLogin: async () => requireLogin,
    findEmployeeRoleById: dbWith(db),
    reissueSession: () => {},
    now,
  };
}

console.log('checkAuthCore: anonymous / forged / deactivated / role');
await ta('anonymous is refused when login is required (plain + role gates)', async () => {
  assert.equal(await tokens.checkAuthCore(ctx({})), false);
  assert.equal(await tokens.checkAuthCore(ctx({ requiredRole: 'הנהלה ראשית' })), false);
});
await ta('role gate ignores require_login=false for an anonymous caller (admin gates stay closed in open mode)', async () => {
  assert.equal(await tokens.checkAuthCore(ctx({ requireLogin: false, requiredRole: 'הנהלה ראשית' })), false);
  assert.equal(await tokens.checkAuthCore(ctx({ requireLogin: false })), true, 'plain checkAuth keeps open mode');
});
await ta('low roles (0 is head, 1 branch manager, 3 seamstress, 4 secretary) vs הנהלה ראשית gate: only 0 and 2 pass', async () => {
  for (const [role, ok] of [[0, true], [2, true], [1, false], [3, false], [4, false], [6, false], [null, false]]) {
    const db = { e1: { roleId: role, isActive: true } };
    assert.equal(await tokens.checkAuthCore(ctx({ cookieEmployee: 'e1', db, requiredRole: 'הנהלה ראשית' })), ok, `role ${role}`);
  }
});
await ta('a deactivated head-management employee is refused on the DB path (stale session / legacy cookie)', async () => {
  const db = { e1: { roleId: 0, isActive: false } };
  assert.equal(await tokens.checkAuthCore(ctx({ cookieEmployee: 'e1', db, requiredRole: 'הנהלה ראשית' })), false);
  assert.equal(await tokens.checkAuthCore(ctx({ cookieEmployee: 'e1', db, signedFor: { id: 'e1', roleId: 0 }, fresh: false, requiredRole: 'הנהלה ראשית' })), false, 'stale token falls to the DB');
});
await ta('a forged session token (wrong secret / other employee) never grants a role', async () => {
  const forged = tokens.createSessionToken({ id: 'e1', roleId: 2 }, 'other-secret');
  const c = ctx({ cookieEmployee: 'e1', db: { e1: { roleId: 4, isActive: true } }, requiredRole: 'הנהלה ראשית' });
  assert.equal(await tokens.checkAuthCore({ ...c, sessionTokenValue: forged }), false);
  const other = tokens.createSessionToken({ id: 'someone-else', roleId: 2 }, SECRET);
  assert.equal(await tokens.checkAuthCore({ ...c, sessionTokenValue: other }), false, 'token bound to another employee');
});
await ta('getVerifiedAuthCookie: a hand-typed auth_token without a matching signed session is anonymous', () => {
  const store = (c) => ({ get: (n) => (c[n] === undefined ? undefined : { value: c[n] }) });
  assert.equal(tokens.getVerifiedAuthCookie(store({ auth_token: 'e1' }), SECRET), undefined);
  const good = tokens.createSessionToken({ id: 'e1', roleId: 4 }, SECRET);
  assert.equal(tokens.getVerifiedAuthCookie(store({ auth_token: 'e1', auth_session: good }), SECRET).value, 'e1');
  assert.equal(tokens.getVerifiedAuthCookie(store({ auth_token: 'e2', auth_session: good }), SECRET), undefined);
});
await ta('checkPageAccessCore (/employees layout): head management passes, branch manager / secretary / deactivated head refused', async () => {
  const run = (row) => tokens.checkPageAccessCore({ authTokenValue: 'e1', sessionTokenValue: null, secret: SECRET, allowedRoles: [0, 2], getRequireLogin: async () => true, findEmployeeForPageAccess: async () => row });
  assert.equal(await run({ roleId: 0, isActive: true }), true);
  assert.equal(await run({ roleId: 1, isActive: true }), false);
  assert.equal(await run({ roleId: 4, isActive: true }), false);
  assert.equal(await run({ roleId: 0, isActive: false }), false);
});

console.log('ui-variant self switch (owner decision 2026-10-11: every active employee may choose the new design for themselves, only for themselves)');
const read0 = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').split('\r\n').join('\n');
const prismaStub = (calls) => ({ employee: { async update(a) { calls.push(a); return { id: a.where.id }; } } });
for (const screen of ['shell', 'home', 'employees_list', 'models_list', 'model_card', 'model_new']) {
  await ta(`${screen}: every role (0 / 1 / 2 / 3 / 4 / null) may set its OWN override to a5 / legacy / null; the write targets only the authenticated employee`, async () => {
    const entry = getScreenEntry(screen);
    assert.ok(entry, `${screen} must exist in UI_SCREEN_REGISTRY`);
    for (const roleId of [0, 1, 2, 3, 4, null]) {
      for (const value of ['a5', 'legacy', null]) {
        const calls = [];
        const themeColor = value === null ? JSON.stringify({ v: 1, uiVariants: { [screen]: 'a5' } }) : null;
        const r = await applyUiVariantRequest({ screen, body: { value, employeeId: 'victim', id: 'victim', where: { id: 'victim' } }, employee: { id: 'me', roleId, isActive: true, themeColor }, prisma: prismaStub(calls) });
        assert.equal(r.status, 200, `${screen}/${roleId}/${value} -> ${r.status}`);
        assert.equal(calls.length, 1, 'one write');
        assert.deepEqual(calls[0].where, { id: 'me' }, 'never the id from the body');
        assert.deepEqual(Object.keys(calls[0].data), ['themeColor']);
      }
    }
  });
}
await ta('the rule is ONE predicate (canEmployeeSelfSwitch) used by the core, the layout and describeSelfSwitch; no leftover management-role gate', async () => {
  const lib = await import('../lib/uiVariantSelfSwitch.js');
  assert.equal(typeof lib.canEmployeeSelfSwitch, 'function');
  assert.equal(lib.isManagementRole, undefined);
  assert.equal(lib.SELF_SWITCH_ROLE_IDS, undefined);
  assert.equal(lib.SELF_SWITCH_ONLY_ROLE_IDS, null, 'null = everyone; a roleId array here is the single place to narrow it again');
  assert.match(read0('app/layout.js'), /canEmployeeSelfSwitch\(\{ roleId: emp\.roleId, isActive: true \}\)/);
  assert.doesNotMatch(read0('app/layout.js'), /isManagementRole/);
  assert.match(read0('lib/uiVariantSelfSwitch.js'), /canEmployeeSelfSwitch\(employee\)/);
});
await ta('another employee id in the body is ignored; unknown / non-switchable screens, hostile values and oversized preferences are refused without a write; the size cap guard is still there', async () => {
  const calls = [];
  const ok = await applyUiVariantRequest({ screen: 'home', body: { value: 'a5', employeeId: 'victim', id: 'victim' }, employee: { id: 'me', roleId: 4, isActive: true, themeColor: null }, prisma: prismaStub(calls) });
  assert.equal(ok.status, 200); assert.equal(calls.length, 1); assert.equal(calls[0].where.id, 'me'); assert.equal(ok.json.employeeId, 'me');
  const before = calls.length;
  for (const screen of ['employee_card', '__proto__', 'constructor', 'login', 'schedule', '', undefined]) {
    assert.equal((await applyUiVariantRequest({ screen, body: { value: 'a5' }, employee: { id: 'me', roleId: 4, isActive: true }, prisma: prismaStub(calls) })).status, 400, String(screen));
  }
  for (const value of ['A5', ' a5', 'admin', 1, true, ['a5'], { a: 1 }, undefined]) {
    assert.equal((await applyUiVariantRequest({ screen: 'home', body: { value }, employee: { id: 'me', roleId: 4, isActive: true }, prisma: prismaStub(calls) })).status, 400, String(JSON.stringify(value)));
  }
  assert.equal(calls.length, before, 'no write for any refusal');
  // the size cap is still enforced in the core (sanitised prefs cannot realistically exceed it, so assert the guard itself)
  assert.match(read0('lib/uiVariantSelfSwitch.js'), /built\.serialized\.length > MAX_THEME_COLOR_LENGTH[\s\S]{0,120}status: 413/);
});
await ta('anonymous -> 401 and deactivated (any role) -> 403, with no write; the answer to GET also hides the section from them', async () => {
  const calls = [];
  const lib = await import('../lib/uiVariantSelfSwitch.js');
  assert.equal((await applyUiVariantRequest({ screen: 'home', body: { value: 'a5' }, employee: null, prisma: prismaStub(calls) })).status, 401);
  for (const roleId of [0, 1, 2, 4, null]) {
    assert.equal((await applyUiVariantRequest({ screen: 'home', body: { value: 'a5' }, employee: { id: 'me', roleId, isActive: false }, prisma: prismaStub(calls) })).status, 403, String(roleId));
    assert.deepEqual(lib.describeSelfSwitch({ id: 'me', roleId, isActive: false }), { canSelfSwitch: false, screens: [] });
  }
  assert.equal(calls.length, 0);
});
await ta('the new design grants no permission: the designs are switched only by a display flag, every page gate and API gate in the manifest below is variant-independent', () => {
  // resolveUiVariant is documented as display-only; no gate file imports the variant code.
  for (const f of ['lib/auth.js', 'lib/authTokens.js', 'lib/roles.js', 'lib/permissions.js']) {
    if (!fs.existsSync(path.join(root, f))) continue;
    assert.doesNotMatch(read0(f), /uiVariant|resolveUiVariant|getRequestUiVariant/, `${f} must not depend on the display variant`);
  }
});

console.log('gate manifest: each handler starts with its server-side gate');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
function handlerBody(src, method) {
  const m = new RegExp(`export async function ${method}\\b[\\s\\S]*?\\n\\}(?:\\n|$)`).exec(src);
  return m ? m[0] : null;
}
const HEAD = /checkAuth\('הנהלה ראשית'\)/;
const ANY = /checkAuth\(\)/;
const ITEM_MANAGER = /requireDressItemManager\(\)/; // feature:dress_items_manage (D1 resolved 2026-10-11) - details in scripts/test_dress_items_permission.mjs
const MANIFEST = [
  // employees (head management / programmer only)
  ['app/api/employees/route.js', 'POST', HEAD, 'create employee'],
  ['app/api/employees/[id]/route.js', 'GET', HEAD, 'employee card read (wage, address)'],
  ['app/api/employees/[id]/route.js', 'PUT', HEAD, 'employee edit'],
  ['app/api/employees/[id]/history/route.js', 'GET', HEAD, 'employee change log'],
  ['app/api/employees/[id]/shifts/route.js', 'POST', /checkAuth\(\)/, 'shift write (own shifts, enforced by decideShiftWrite)'],
  ['app/api/employees/presence/route.js', 'GET', /isManager/, 'connected-now / last entry'],
  ['app/api/employees/attendance/route.js', 'GET', /decideReadAccess/, 'legacy attendance table'],
  // dress models
  ['app/api/dresses/route.js', 'GET', ANY, 'models list'],
  ['app/api/dresses/route.js', 'POST', HEAD, 'create model'],
  ['app/api/dresses/[id]/route.js', 'GET', ANY, 'model card read'],
  ['app/api/dresses/[id]/route.js', 'DELETE', HEAD, 'delete model'],
  ['app/api/dresses/[id]/items/route.js', 'POST', ITEM_MANAGER, 'create item (feature:dress_items_manage)'],
  ['app/api/dresses/[id]/rentals/route.js', 'GET', ANY, 'model rentals'],
  ['app/api/dresses/items/[itemId]/route.js', 'PUT', ITEM_MANAGER, 'edit item (feature:dress_items_manage)'],
  ['app/api/dresses/items/[itemId]/route.js', 'DELETE', ITEM_MANAGER, 'delete item (feature:dress_items_manage)'],
  ['app/api/dresses/items/[itemId]/history/route.js', 'GET', ANY, 'item history'],
  ['app/api/dresses/next-code/route.js', 'GET', ANY, 'next free model code (was public)'],
  ['app/api/upload/route.js', 'POST', ANY, 'image upload'],
  ['app/api/audit/route.js', 'GET', ANY, 'change log'],
  // dev-only helpers: never open to a non-programmer even in `next dev`
  ['app/api/dev/db-import/route.js', 'POST', /checkAuth\('מתכנת'\)/, 'dev db import'],
  ['app/api/dev/fix-employees/route.js', 'GET', /checkAuth\('מתכנת'\)/, 'dev fix employees'],
  ['app/api/dev/switch-env/route.js', 'POST', /checkAuth\('מתכנת'\)/, 'dev db switch'],
];
for (const [file, method, gate, what] of MANIFEST) {
  await ta(`${method} ${file.replace('app/api', '')} - ${what}`, () => {
    const src = read(file);
    const body = handlerBody(src, method);
    assert.ok(body, `${method} handler not found`);
    assert.match(body, gate, 'gate missing');
  });
}
await ta('dress PUT: full edits need הנהלה ראשית; only the 3 activity-toggle fields are open to staff', () => {
  const src = read('app/api/dresses/[id]/route.js');
  assert.match(src, /ACTIVITY_TOGGLE_FIELDS = \['exitDateFromRepo', 'entryDateToRepo', 'inactiveReason'\]/);
  assert.match(src, /checkAuth\(isActivityToggleOnly \? undefined : 'הנהלה ראשית'\)/);
});
await ta('dev routes are hard-disabled outside `next dev`', () => {
  for (const f of ['db-import', 'fix-employees', 'switch-env']) assert.match(read(`app/api/dev/${f}/route.js`), /NODE_ENV !== 'development'/, f);
  const login = read('app/api/dev/agent-login/route.js');
  assert.match(login, /if \(!configuredSecret\)/);
  assert.match(login, /status: 404/);
});
await ta('GET /api/employees: only head management / programmer get the full HR row; others get the slim picker shape', () => {
  const src = read('app/api/employees/route.js');
  assert.match(src, /forceSlim/);
  assert.match(src, /!HEAD_MANAGEMENT_ROLES\.includes\(me\.roleId\)/);
  assert.match(src, /password, pinHash, \.\.\.emp/, 'hashes still stripped');
});
await ta('GET /api/audit: Employee / Shift / permission / key rows are head-management only, limit is capped', () => {
  const src = read('app/api/audit/route.js');
  assert.match(src, /HEAD_ONLY_AUDIT_ENTITIES = \[[^\]]*'Shift'[^\]]*'Employee'|HEAD_ONLY_AUDIT_ENTITIES = \[[^\]]*'Employee'[^\]]*'Shift'/);
  assert.match(src, /notIn: HEAD_ONLY_AUDIT_ENTITIES/);
  assert.match(src, /Math\.min\(/);
});
await ta('GET /api/attachment/[id]: public but never serves active content as itself, always nosniff', () => {
  const src = read('app/api/attachment/[id]/route.js');
  assert.match(src, /'X-Content-Type-Options': 'nosniff'/);
  assert.match(src, /application\/octet-stream/);
  assert.match(src, /image\\\/svg/);
});
await ta('POST /api/upload: client-chosen content types are not stored (only video / audio / pdf), size capped', () => {
  const src = read('app/api/upload/route.js');
  assert.match(src, /MAX_UPLOAD_BYTES/);
  assert.match(src, /safeType/);
});
await ta('no GET handler under the audited API folders writes to the DB (CSRF: state changes are POST/PUT/DELETE only)', () => {
  const files = ['app/api/employees', 'app/api/dresses', 'app/api/audit', 'app/api/upload', 'app/api/attachment'];
  const walk = (d) => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name === 'route.js' ? [path.join(d, e.name)] : []));
  for (const f of files.flatMap(walk)) {
    const body = handlerBody(read(f), 'GET');
    if (!body) continue;
    assert.doesNotMatch(body, /\.(create|update|upsert|delete|deleteMany|updateMany|createMany)\(/, `${f} GET mutates`);
  }
});

console.log('final re-audit additions (2026-10-11): admin lists, PDF surfaces, uuid-shaped ids');
const adminOrders = await import('../lib/adminOrdersList.js');
const adminCustomers = await import('../lib/adminCustomersList.js');
const keys = await import('../lib/printAccessKeys.js');
const guards = await import('../lib/adminListGuards.js');

for (const f of ['orders-list', 'orders-list/counts', 'customers-list', 'customers-list/counts']) {
  for (const method of ['GET', 'POST']) {
    await ta(`${method} /api/admin/${f} starts with checkAuth('הנהלה ראשית') before any query`, () => {
      const src = read(`app/api/admin/${f}/route.js`);
      assert.match(src, /async function handle\(input\) \{\n\s*if \(!\(await checkAuth\('הנהלה ראשית'\)\)\)/);
      const body = handlerBody(src, method);
      assert.ok(body && /handle\(/.test(body), `${method} delegates to handle`);
    });
  }
}
await ta('orders-list params: unknown sort / dir / state / pay keys are dropped, limit and page are clamped, ids are safe integers', () => {
  const p = adminOrders.parseOrdersListParams({ sort: 'f.total; DROP TABLE "Order"', dir: "asc; --", states: "upcoming'); --,past", pays: 'debt,x', limit: 1e9, page: -3, ids: '1;DROP,2,99999999999,3', branches: Array(50).fill('b'), from: "2026-01-01'; --" });
  assert.equal(p.sort, 'eventDate'); assert.equal(p.dir, 'desc');
  assert.deepEqual(p.states, ['past']); assert.deepEqual(p.pays, ['debt']);
  assert.equal(p.limit, guards.MAX_LIST_LIMIT); assert.equal(p.page, 1);
  assert.deepEqual(p.ids, [1, 2, 3]); // parseInt keeps leading digits only: always a plain integer assert.equal(p.branches.length, 20); assert.equal(p.from, '');
  assert.equal(adminOrders.parseOrdersListParams(null).limit, adminOrders.ORDERS_PAGE_SIZE);
  assert.equal(adminOrders.parseOrdersListParams({ limit: 1e9 }).limit, guards.MAX_LIST_LIMIT, 'no export flag: capped at the list maximum');
  assert.ok(adminOrders.parseOrdersListParams({ limit: 1e9, export: true }).limit <= guards.EXPORT_PAGE_LIMIT, 'export pages are capped too');
  assert.equal(adminOrders.parseOrdersListParams([1, 2]).page, 1);
});
await ta('orders-list: every sort key the parser accepts is a fixed name, and sortFacts never throws on odd input', () => {
  for (const k of adminOrders.ORDER_SORT_KEYS) assert.match(k, /^[A-Za-z]+$/);
  for (const bad of ['constructor', '__proto__', 'toString', 'f.total; DROP']) assert.equal(adminOrders.parseOrdersListParams({ sort: bad }).sort, 'eventDate', bad);
  if (typeof adminOrders.sortFacts === 'function') assert.doesNotThrow(() => adminOrders.sortFacts([{ id: 1 }, { id: 2 }], 'constructor', 'asc'));
});
await ta('customers-list params: unknown sort dropped, ids must be uuids, limit clamped, filter keys whitelisted', () => {
  const p = adminCustomers.parseCustomersListParams({ sort: 'debt; DROP', dir: "x", ids: "' OR 1=1,00000000-0000-0000-0000-000000000000", limit: 1e9, missing: "id' OR 1=1,email", regs: 'signed,x' });
  assert.equal(p.sort, 'name'); assert.equal(p.dir, 'asc');
  assert.deepEqual(p.ids, ['00000000-0000-0000-0000-000000000000']);
  assert.equal(p.limit, guards.MAX_LIST_LIMIT);
  assert.deepEqual(p.missing, ['email']); assert.deepEqual(p.regs, ['signed']);
});
await ta('admin list rows never carry credentials, bank or national-id values', () => {
  const o = read('lib/adminOrdersListServer.js'); const c = read('lib/adminCustomersListServer.js');
  for (const src of [o, c]) assert.doesNotMatch(src, /password|pinHash|bankAccount|iban/i);
  assert.match(c, /hasId: !!\(c\.zeout/);
  assert.doesNotMatch(c.split('function shape')[1].split('function nativeOrderBy')[0], /zeout:|notes:/);
});
await ta('raw SQL in the admin list servers only interpolates fixed constants / allow-listed ORDER BY (never params, search or input)', () => {
  const ALLOWED = /^(ORDER_FACTS_SQL|ORDER_MONEY_FACTS_SQL|ORDER_SNAPSHOT_SQL|CUSTOMER_FACTS_SQL|orderBy)$/;
  for (const f of ['lib/adminOrdersListServer.js', 'lib/adminCustomersListServer.js']) {
    const src = read(f);
    let calls = 0;
    for (const m of src.matchAll(/\$queryRawUnsafe\(\s*`([^`]*)`/g)) {
      calls++;
      for (const e of m[1].matchAll(/\$\{([^}]*)\}/g)) assert.match(e[1].trim(), ALLOWED, `${f}: unexpected interpolation \${${e[1]}} in raw SQL`);
    }
    assert.ok(calls >= 0);
  }
});
await ta('PDF surfaces: every surface maps to existing catalog page keys; admin list surfaces are head-management-only keys', () => {
  const catalog = read('lib/permissionsMetadata.js');
  for (const [surface, ks] of Object.entries(keys.PDF_HTML_SURFACE_KEYS)) {
    assert.ok(ks.length >= 1, surface);
    for (const k of ks) assert.ok(catalog.includes(`key: '${k}'`), `${surface}: ${k} missing from the permissions catalog`);
  }
  for (const k of ['page:admin_orders_list', 'page:admin_customers_list']) {
    const block = catalog.split(`key: '${k}'`)[1].split('\n  },')[0];
    assert.match(block, /defaultForRoleId: \(roleId\) => HEAD_MANAGEMENT\.includes\(roleId\)/, `${k} default must be head management only`);
    assert.match(block, /notConfigurable/, `${k} must not be grantable through a row`);
  }
});
await ta('pdfHtmlSurfaceKeys uses an own-property lookup (no __proto__ / constructor surfaces); route rejects non-string / non-html surface', () => {
  assert.match(read('lib/printAccess.js'), /Object\.prototype\.hasOwnProperty\.call\(PDF_HTML_SURFACE_KEYS, name\)/);
  const route = read('app/api/pdf/route.js');
  assert.match(route, /typeof surface !== 'string' \|\| !html/);
  assert.match(route, /canUsePrintSurface\(surfaceKeys\)/);
  assert.match(route, /String\(filename \|\| 'document'\)\.slice\(0, 120\)/);
});
await ta('html-mode PDF: JS off, request interception allow-list (data:, about:, https fonts only) - real function', () => {
  const src = read('lib/pdf.js');
  assert.match(src, /setJavaScriptEnabled\(false\)/);
  assert.match(src, /setRequestInterception\(true\)/);
  const fn = src.slice(src.indexOf('const HTML_MODE_ALLOWED_HOSTS'), src.indexOf('let browserPromise')).replace('export function', 'function');
  const allowed = new Function(`${fn}; return isAllowedHtmlModeRequest;`)();
  for (const ok of ['data:image/png;base64,AAAA', 'about:blank', 'https://fonts.googleapis.com/css2?family=Rubik', 'https://fonts.gstatic.com/s/rubik/x.woff2']) assert.equal(allowed(ok), true, ok);
  for (const bad of ['http://127.0.0.1:3071/api/employees', 'http://localhost/', 'http://169.254.169.254/latest/meta-data/', 'file:///C:/Windows/win.ini', 'https://fonts.gstatic.com.evil.test/x', 'https://fonts.googleapis.com:8443/x', 'ftp://fonts.gstatic.com/x', 'https://[::1]/', 'javascript:alert(1)', 'blob:http://x/1', '']) assert.equal(allowed(bad), false, bad);
});
await ta('the print sheets escape every dynamic text with escH (head fields and cells)', () => {
  const core = read('app/components/a5-print/pkCore.js');
  assert.match(core, /\$\{escH\(o\.title\)\}/); assert.match(core, /escH\(o\.chip\)/); assert.match(core, /escH\(o\.sub\)/);
  const specs = read('app/components/a5-print/pkSpecs.js');
  assert.match(specs, /escH\(m\.notes\)/); assert.match(specs, /escH\(m\.name\)/);
});

// ---------------------------------------------------------------------------------------------------------------------------
// LIVE matrix (opt-in): UI_VARIANT_LIVE=1 node scripts/test_a5_staff_models_security.mjs   [UI_VARIANT_BASE=http://localhost:3072]
// Needs a running `next dev` on the TEST database (GET /api/dev/switch-env must say "test" - the block refuses otherwise), AUTH_SECRET in
// .env.local and TEST_DATABASE_URL in .env. Creates throwaway "UVSWITCH ..." employees DIRECTLY in the TEST database, mints their
// sessions with the repo's createSessionToken, drives the real HTTP routes, then deletes the employees. Never touches PROD. No secrets printed.
if (process.env.UI_VARIANT_LIVE === '1') {
  console.log('LIVE: /api/me/ui-variant matrix on the TEST database (minted sessions)');
  const BASE = process.env.UI_VARIANT_BASE || 'http://localhost:3072';
  const parseEnv = (file) => {
    try {
      return Object.fromEntries(fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/).map((l) => /^([A-Z0-9_]+)=(.*)$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]));
    } catch { return {}; }
  };
  const env = { ...parseEnv('.env'), ...parseEnv('.env.local'), ...process.env };
  const mode = await (await fetch(`${BASE}/api/dev/switch-env`)).json().catch(() => ({}));
  if (mode.mode !== 'test') { console.error('  FAIL - the dev server is not on the TEST database; live block refused'); process.exitCode = 1; }
  else if (!env.AUTH_SECRET || !env.TEST_DATABASE_URL) { console.error('  FAIL - AUTH_SECRET / TEST_DATABASE_URL missing'); process.exitCode = 1; }
  else {
    const { PrismaClient } = require('@prisma/client');
    const db = new PrismaClient({ datasourceUrl: env.TEST_DATABASE_URL });
    const made = [];
    const jar = {}; // per employee key -> { cookieName: value }
    const mk = async (key, roleId, isActive = true) => {
      const e = await db.employee.create({ data: { firstName: 'UVSWITCH', lastName: key, fullName: `UVSWITCH ${key}`, roleId, isActive } });
      made.push(e.id);
      jar[key] = { auth_token: e.id, auth_session: tokens.createSessionToken({ id: e.id, roleId }, env.AUTH_SECRET) };
      return e;
    };
    const cookieHeader = (key) => Object.entries(jar[key] || {}).map(([k, v]) => `${k}=${v}`).join('; ');
    const call = async (key, method, url, body, extraHeaders = {}) => {
      const res = await fetch(`${BASE}${url}`, {
        method,
        redirect: 'manual',
        signal: AbortSignal.timeout(240000), // first hit of a page compiles it in `next dev`
        headers: { cookie: key ? cookieHeader(key) : '', ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...extraHeaders },
        body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
      });
      for (const sc of (res.headers.getSetCookie ? res.headers.getSetCookie() : [])) {
        const m = /^([^=]+)=([^;]*)/.exec(sc);
        if (m && key && /^designPrefs_/.test(m[1])) jar[key][m[1]] = m[2];
      }
      const text = await res.text();
      let json = null; try { json = JSON.parse(text); } catch {}
      return { status: res.status, json, text };
    };
    const stored = async (id) => { const r = await db.employee.findUnique({ where: { id }, select: { themeColor: true } }); try { return JSON.parse(r.themeColor).uiVariants || null; } catch { return null; } };
    try {
      const E = {};
      for (const [key, roleId, active] of [['secretary', 4], ['branch', 1], ['seamstress', 3], ['regular', null], ['head', 0], ['programmer', 2], ['dead', 4, false], ['victim', 4]]) E[key] = await mk(key, roleId, active);

      await ta('anonymous: GET and POST -> 401, nothing written', async () => {
        assert.equal((await call(null, 'GET', '/api/me/ui-variant')).status, 401);
        assert.equal((await call(null, 'POST', '/api/me/ui-variant/home', { value: 'a5', employeeId: E.victim.id })).status, 401);
        assert.equal((await call(null, 'POST', '/api/me/ui-variant/shell', { value: 'a5' })).status, 401);
        assert.equal(await stored(E.victim.id), null);
      });
      await ta('a hand-typed auth_token without a signed session is anonymous (cannot switch someone else by id)', async () => {
        const res = await fetch(`${BASE}/api/me/ui-variant/home`, { method: 'POST', headers: { cookie: `auth_token=${E.victim.id}`, 'content-type': 'application/json' }, body: JSON.stringify({ value: 'a5' }) });
        assert.equal(res.status, 401);
        assert.equal(await stored(E.victim.id), null);
      });
      // each role runs ~16 HTTP calls (~5 min on a remote Neon DB); UI_VARIANT_LIVE_QUICK=1 keeps only the secretary
      for (const key of (process.env.UI_VARIANT_LIVE_QUICK === '1' ? ['secretary'] : ['secretary', 'branch', 'seamstress', 'regular', 'head', 'programmer'])) {
        await ta(`${key}: GET offers every switchable screen; may set / read back / clear their OWN a5 override; a victim id in the body is ignored`, async () => {
          const g = await call(key, 'GET', '/api/me/ui-variant');
          assert.equal(g.status, 200); assert.equal(g.json.canSelfSwitch, true);
          for (const s of ['shell', 'home', 'models_list', 'customer_card', 'new_order', 'profile']) assert.ok(g.json.screens.includes(s), `${s} offered`);
          for (const screen of ['home', 'models_list', 'customer_card', 'shell']) {
            const p = await call(key, 'POST', `/api/me/ui-variant/${screen}`, { value: 'a5', employeeId: E.victim.id, id: E.victim.id, where: { id: E.victim.id }, roleId: 0 });
            assert.equal(p.status, 200, `${screen}: ${p.status} ${p.text.slice(0, 120)}`);
            assert.equal(p.json.employeeId, E[key].id);
            assert.equal((await stored(E[key].id))[screen], 'a5');
            assert.equal(await stored(E.victim.id), null, 'victim untouched');
          }
          const row = await db.employee.findUnique({ where: { id: E[key].id }, select: { roleId: true } });
          assert.equal(row.roleId, E[key].roleId, 'role never changes through this route');
          for (const screen of ['home', 'models_list', 'customer_card', 'shell']) assert.equal((await call(key, 'POST', `/api/me/ui-variant/${screen}`, { value: null })).status, 200);
          assert.equal(await stored(E[key].id), null, 'cleared');
        });
      }
      await ta('unknown / non-switchable screens -> 404, hostile values -> 400, broken JSON -> 400; nothing stored', async () => {
        for (const screen of ['employee_card', 'login', 'schedule', '__proto__', 'constructor', 'SHELL', 'nope']) assert.equal((await call('secretary', 'POST', `/api/me/ui-variant/${screen}`, { value: 'a5' })).status, 404, screen);
        for (const value of ['A5', ' a5', 'admin', 1, true, ['a5'], { a: 1 }]) assert.equal((await call('secretary', 'POST', '/api/me/ui-variant/home', { value })).status, 400, JSON.stringify(value));
        assert.equal((await call('secretary', 'POST', '/api/me/ui-variant/home', {})).status, 400);
        assert.equal((await call('secretary', 'POST', '/api/me/ui-variant/home', '{not json')).status, 400);
        assert.equal(await stored(E.secretary.id), null);
      });
      await ta('PUT /api/me/design-prefs still cannot write uiVariants (the only write path is the audited route above)', async () => {
        await call('secretary', 'PUT', '/api/me/design-prefs', { palette: 'standard', uiVariants: { home: 'a5' } });
        assert.equal(await stored(E.secretary.id), null);
      });
      await ta('deactivated employee (valid signed session): GET 403, POST 403, nothing stored', async () => {
        assert.equal((await call('dead', 'GET', '/api/me/ui-variant')).status, 403);
        assert.equal((await call('dead', 'POST', '/api/me/ui-variant/home', { value: 'a5' })).status, 403);
        assert.equal((await call('dead', 'POST', '/api/me/ui-variant/shell', { value: 'a5' })).status, 403);
        assert.equal(await stored(E.dead.id), null);
      });

      // ---- the new design grants nothing: same page gates, same API answers, with the new design switched on ----
      const bodyFlag = (html, name) => (new RegExp(`data-ui-${name}="(a5|legacy)"`).exec(html) || [])[1];
      await ta('defaults: secretary / branch / regular / head start OLD everywhere; the programmer starts NEW', async () => {
        for (const key of ['secretary', 'branch', 'regular', 'head']) {
          const r = await call(key, 'GET', '/');
          assert.equal(r.status, 200, key);
          for (const n of ['shell', 'home', 'order-card', 'customer-card', 'new-order']) assert.equal(bodyFlag(r.text, n), 'legacy', `${key}/${n}`);
        }
        const p = await call('programmer', 'GET', '/');
        // 'home' is skipped on purpose: an org setting (ui_variant_home) outranks the role default and the TEST database has one set to 'legacy'.
        for (const n of ['shell', 'customer-card', 'new-order']) assert.equal(bodyFlag(p.text, n), 'a5', `programmer/${n}`);
      });
      await ta('choosing the new design: the secretary gets a5 for exactly the screens she chose, others stay old', async () => {
        for (const screen of ['shell', 'home']) assert.equal((await call('secretary', 'POST', `/api/me/ui-variant/${screen}`, { value: 'a5' })).status, 200);
        const r = await call('secretary', 'GET', '/');
        assert.equal(r.status, 200);
        assert.equal(bodyFlag(r.text, 'shell'), 'a5'); assert.equal(bodyFlag(r.text, 'home'), 'a5'); assert.equal(bodyFlag(r.text, 'customer-card'), 'legacy');
        for (const screen of ['shell', 'home']) assert.equal((await call('secretary', 'POST', `/api/me/ui-variant/${screen}`, { value: null })).status, 200);
      });
      await ta('switching to the new design changes no page gate: secretary with every screen on a5 gets the same status / no-access result on every page as with the old design', async () => {
        const probe = async () => {
          const out = {};
          for (const url of ['/admin', '/admin/settings', '/employees', '/employees/attendance', '/dashboard/dresses', '/dashboard/dresses/new', '/profile', '/orders/new', '/customers/new', '/my-hours', '/board']) {
            const r = await call('secretary', 'GET', url);
            out[url] = `${r.status}|${/אין הרשאה|אין לך הרשאה|no-access/i.test(r.text) ? 'noaccess' : 'page'}`;
          }
          return out;
        };
        const before = await probe();
        const screens = (await call('secretary', 'GET', '/api/me/ui-variant')).json.screens;
        for (const s of screens) assert.equal((await call('secretary', 'POST', `/api/me/ui-variant/${s}`, { value: 'a5' })).status, 200, s);
        const after = await probe();
        for (const s of screens) assert.equal((await call('secretary', 'POST', `/api/me/ui-variant/${s}`, { value: null })).status, 200, s);
        assert.deepEqual(after, before, 'gate results are identical before / after switching to a5');
        for (const url of ['/admin', '/admin/settings', '/employees']) assert.match(after[url], /noaccess/, `${url} must refuse a secretary`);
      });
      await ta('APIs answer the same with the new design on (the designs call the same endpoints): head-only APIs stay 401/403 for a secretary', async () => {
        for (const s of ['shell', 'home', 'models_list', 'customer_card']) await call('secretary', 'POST', `/api/me/ui-variant/${s}`, { value: 'a5' });
        for (const [m, url, ok] of [
          ['GET', '/api/employees/' + E.victim.id, false], ['GET', '/api/employees/presence', false], ['GET', '/api/admin/orders-list', false], ['POST', '/api/dresses', false],
          ['GET', '/api/dresses?fields=summary&counts=1', true],
        ]) {
          const r = await call('secretary', m, url, m === 'POST' ? {} : undefined);
          if (ok) assert.equal(r.status, 200, `${m} ${url} -> ${r.status}`); else assert.ok([401, 403].includes(r.status), `${m} ${url} -> ${r.status}`);
        }
        const emp = await call('secretary', 'GET', '/api/employees?all=true');
        assert.equal(emp.status, 200); assert.ok(!('hourlyWage' in (emp.json[0] || {})), 'secretary still gets the slim employee shape');
        for (const s of ['shell', 'home', 'models_list', 'customer_card']) await call('secretary', 'POST', `/api/me/ui-variant/${s}`, { value: null });
      });
    } finally {
      try { await db.pageVisitLog.deleteMany({ where: { employeeId: { in: made } } }); } catch {}
      try { await db.employee.deleteMany({ where: { id: { in: made } } }); } catch (e) { console.error('  CLEANUP FAILED', e.message); process.exitCode = 1; }
      const left = await db.employee.count({ where: { firstName: 'UVSWITCH' } }).catch(() => -1);
      console.log(`  cleanup: ${made.length} throwaway employees created, ${left} left in TEST`);
      await db.$disconnect();
    }
  }
}

// R4 (2026-10-11): the AI smart search 'employees' context is head management / programmer only and answers from a safe projection (full suite: scripts/test_ai_employees_context.mjs).
await ta('smart-search: pageContext employees is gated by role BEFORE any data access and runs only guard-approved SQL', async () => {
  const route = fs.readFileSync(path.join(root, 'app/api/ai/smart-search/route.js'), 'utf8').replace(/\r\n/g, '\n');
  const post = route.slice(route.indexOf('export async function POST'));
  const iGate = post.indexOf('HEAD_MANAGEMENT_ROLES.includes(me.roleId)');
  assert.ok(post.indexOf('getSessionEmployee()') > -1 && iGate > post.indexOf('getSessionEmployee()') && iGate < post.indexOf('checkAiAccess()'), 'employees gate must precede checkAiAccess');
  assert.ok(post.indexOf('handleEmployeesSearch(') > post.indexOf('checkAiAccess()'), 'handler only after the gates');
  assert.match(route, /assertEmployeesWhere\(/);
  assert.ok(!/employees:\s*"Table:/.test(route), 'no raw-table employees schema in SCHEMA_MAP');
});

console.log(`\n${passed} passed${process.exitCode ? ' - WITH FAILURES' : ''}`);
