// Server approval hardening (2026-10-05): signed approval tokens + per-gemach enforcement flags.
// No DB, no dev server, no network: Next-only modules and the Prisma client are in-memory shims (the schedule tests' shims plus
// the thin AuditLog wrapper of order-events.test.mjs). The REAL lib/approvalTokens.js, lib/approvalGate.js, lib/auth.js,
// lib/permissions.js, lib/settingsCache.js and the REAL route files run against it. A real AUTH_SECRET is set, so the
// cookie shim signs an auth_session for the logged-in employee exactly like the login route does.
//   node --test scripts/approval-hardening.test.mjs        (one time zone)
//   node scripts/approval-hardening.test.mjs --tz          (UTC, Asia/Jerusalem, America/New_York)
import { spawnSync } from 'node:child_process';
import { register, createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PROJ = path.resolve(here, '..');

if (process.argv.includes('--tz')) {
  const zones = (process.env.ORDER_EVENTS_TEST_TZS || 'UTC,Asia/Jerusalem,America/New_York').split(',');
  let failed = 0;
  for (const tz of zones) {
    const r = spawnSync(process.execPath, ['--no-warnings', '--test', fileURLToPath(import.meta.url)], { cwd: PROJ, encoding: 'utf8', env: { ...process.env, TZ: tz } });
    const out = (r.stdout || '') + (r.stderr || '');
    const pass = (out.match(/^[#ℹ] pass (\d+)/m) || [])[1] || '?';
    const fail = (out.match(/^[#ℹ] fail (\d+)/m) || [])[1] || '?';
    if (r.status !== 0) { failed++; console.log(out); }
    console.log(`${r.status === 0 ? 'OK  ' : 'FAIL'}  TZ=${tz.padEnd(17)} approval-hardening.test.mjs pass=${pass} fail=${fail}`);
  }
  console.log(failed ? `\n${failed} run(s) failed` : '\nall runs passed');
  process.exit(failed ? 1 : 0);
}

const SECRET = 'test-auth-secret-for-approval-hardening';
process.env.AUTH_SECRET = SECRET;

const SHIMS = path.join(PROJ, 'scripts', 'schedule-tests', 'shims');
const fileUrl = (p) => pathToFileURL(p).href;
const baseShim = fileUrl(path.join(SHIMS, 'prisma.mjs'));
const prismaShimSrc = `
import base from ${JSON.stringify(baseShim)};
export { matchWhere } from ${JSON.stringify(baseShim)};
const rows = (m) => (globalThis.__MOCK_DB[m] ||= []);
let seq = 0;
function match(row, where) {
  for (const [k, c] of Object.entries(where || {})) {
    if (c && typeof c === 'object' && 'contains' in c) { if (!String(row[k] ?? '').includes(c.contains)) return false; continue; }
    if (c && typeof c === 'object' && 'in' in c) { if (!c.in.includes(row[k])) return false; continue; }
    if (row[k] !== c) return false;
  }
  return true;
}
const logModel = (m) => ({
  async create({ data }) { globalThis.__MOCK_CALLS.push({ model: m, method: 'create', args: { data } }); const r = { id: m + '-' + (++seq), createdAt: new Date(), ...data }; rows(m).push(r); return r; },
  async createMany({ data }) { globalThis.__MOCK_CALLS.push({ model: m, method: 'createMany', args: { data } }); for (const d of data) rows(m).push({ id: m + '-' + (++seq), createdAt: new Date(), ...d }); return { count: data.length }; },
  async findFirst({ where } = {}) { return rows(m).find((r) => match(r, where)) || null; },
  async findMany({ where } = {}) { return rows(m).filter((r) => match(r, where)); },
  async count({ where } = {}) { return rows(m).filter((r) => match(r, where)).length; },
});
const LOGS = { auditLog: logModel('auditLog'), emailLog: logModel('emailLog') };
const proxy = new Proxy({}, { get(_, p) { if (p === 'then') return undefined; return LOGS[p] || base[p]; } });
export default proxy;
export const prisma = proxy;
export function auditAs(action, args, changes) { if (!action) return args; return { ...args, __audit: { action, changes } }; }
export async function getActingEmployeeId() {
  // same contract as app/lib/prisma.js: the id comes from the VERIFIED auth cookie (auth_token + a matching signed auth_session)
  return globalThis.__AUTH_TOKEN || null;
}
`;
const PRISMA_SHIM = 'data:text/javascript,' + encodeURIComponent(prismaShimSrc);
const headersShimSrc = `
import { createRequire } from 'node:module';
const require = createRequire(${JSON.stringify(path.join(PROJ, 'package.json'))});
const AT = require(${JSON.stringify(path.join(PROJ, 'lib', 'authTokens.js'))});
export async function cookies() {
  return {
    get(name) {
      const id = globalThis.__AUTH_TOKEN;
      if (!id) return undefined;
      if (name === 'auth_token') return { value: id };
      if (name === 'auth_session') return { value: AT.createSessionToken({ id, roleId: (globalThis.__AUTH_ROLE ?? 5) }, process.env.AUTH_SECRET) };
      return undefined;
    },
    set() {}, delete() {},
  };
}
`;
const NH_SHIM = 'data:text/javascript,' + encodeURIComponent(headersShimSrc);
const hooksSrc = `
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const PROJ = ${JSON.stringify(PROJ)};
const NS = ${JSON.stringify(fileUrl(path.join(SHIMS, 'next-server.mjs')))};
const NH = ${JSON.stringify(NH_SHIM)};
const PRISMA = ${JSON.stringify(PRISMA_SHIM)};
async function tryResolve(spec, ctx, next) {
  try { return await next(spec, ctx); } catch (e) {
    for (const suf of ['.js', '/index.js', '.mjs']) { try { return await next(spec + suf, ctx); } catch {} }
    throw e;
  }
}
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/server') return { url: NS, shortCircuit: true };
  if (specifier === 'next/headers') return { url: NH, shortCircuit: true };
  if (specifier.startsWith('@/')) specifier = pathToFileURL(path.join(PROJ, specifier.slice(2))).href;
  const r = await tryResolve(specifier, context, nextResolve);
  if (r.url.endsWith('/app/lib/prisma.js')) return { url: PRISMA, shortCircuit: true };
  return r;
}
`;
register('data:text/javascript,' + encodeURIComponent(hooksSrc));

const { test, beforeEach } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const L = (rel) => import(fileUrl(path.join(PROJ, rel)));
const require = createRequire(path.join(PROJ, 'package.json'));
const T = require(path.join(PROJ, 'lib', 'approvalTokens.js'));
const AT = require(path.join(PROJ, 'lib', 'authTokens.js'));
const src = (rel) => fs.readFileSync(path.join(PROJ, rel), 'utf8');

const verifyPin = await L('app/api/auth/verify-pin/route.js');
const debtRoute = await L('app/api/orders/[id]/debt-approval/route.js');
const paymentsRoute = await L('app/api/payments/route.js');
const refundRoute = await L('app/api/refunds/[id]/route.js');
const nedarimRoute = await L('app/api/nedarim/route.js');
const CR = require(path.join(PROJ, 'lib', 'chargeReceipts.js'));
const orderRoute = await L('app/api/orders/[id]/route.js');
const auditRoute = await L('app/api/audit/route.js');
const deliveriesRoute = await L('app/api/deliveries/route.js');
const eventsRoute = await L('app/api/orders/events/route.js');
const RateLimit = await L('lib/eventRateLimit.js');
const AuditLib = await L('app/lib/auditLog.js');
const Gate = await L('lib/approvalGate.js');
const OE = await L('lib/history/orderEvents.js');
const { invalidatePermissionCache } = await L('lib/permissions.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { invalidateRequireLoginCache } = await L('lib/auth.js');
const bcrypt = (await import('bcryptjs')).default;

const PIN = '987654';
const PIN_HASH = bcrypt.hashSync(PIN, 4);
const OTHER_HASH = bcrypt.hashSync('111111', 4);
const DEBT = 'מאשר הזמנה ללא תשלום';

function installDb(extraSettings = []) {
  globalThis.__MOCK_DB = {
    order: [
      { id: 'uuid-501', orderId: 501, isDeleted: false, customerId: 'c1', status: 'חדש', items: [], obligations: [], payments: [], eventDate: new Date('2026-11-10T22:00:00Z'), orderDate: new Date('2026-10-01T08:00:00Z'), totalAmount: 500 },
      { id: 'uuid-502', orderId: 502, isDeleted: false, customerId: 'c2', status: 'חדש', items: [], obligations: [], payments: [], totalAmount: 300 },
    ],
    employee: [
      { id: 'emp-worker', roleId: 5, isActive: true, firstName: 'עובדת', lastName: 'רגילה', password: OTHER_HASH },
      { id: 'emp-worker2', roleId: 5, isActive: true, firstName: 'עובדת', lastName: 'שנייה', password: OTHER_HASH },
      { id: 'emp-mgr', roleId: 1, isActive: true, firstName: 'מנהלת', lastName: 'סניף', password: PIN_HASH },
      { id: 'emp-mgr-noperm', roleId: 5, isActive: true, firstName: 'מנהלת', lastName: 'ללא', password: PIN_HASH },
      { id: 'emp-head', roleId: 0, isActive: true, firstName: 'הנהלה', lastName: 'ראשית', password: PIN_HASH },
    ],
    systemSetting: [{ key: 'require_login', value: 'true' }, ...extraSettings],
    departmentPermission: [
      { roleId: 5, key: 'page:orders', value: 'true' },
      { roleId: 1, key: 'page:orders', value: 'true' },
    ],
    employeePermissionOverride: [
      { employeeId: 'emp-mgr', key: 'feature:debt_approval', value: 'true' },
      { employeeId: 'emp-mgr', key: 'feature:manual_charge_add', value: 'true' },
      { employeeId: 'emp-mgr', key: 'feature:manual_payment_credit_add', value: 'true' },
    ],
    auditLog: [],
    emailLog: [],
    payment: [
      { id: 'pay-1', orderId: 501, amount: 200, paymentMethod: 'מזומן', isDeleted: false },
    ],
    paymentObligation: [
      { id: 'ob-auto', orderId: 501, amount: 500, description: 'השכרה', isManual: false, isDeleted: false },
      { id: 'ob-man', orderId: 501, amount: 40, description: 'ידני', isManual: true, isDeleted: false },
    ],
    refund: [
      { id: 'ref-1', orderId: 501, customerId: 'c1', amount: 100, isExecuted: false, isDeleted: false, bankName: 'x', bankBranch: '1' },
    ],
    orderItem: [],
    dressModel: [],
  };
  globalThis.__MOCK_CALLS = [];
  globalThis.__MOCK_WRITABLE = [];
}

const logs = [];
const origWarn = console.warn, origErr = console.error;
beforeEach(() => {
  installDb();
  invalidateSettingsCache();
  invalidateRequireLoginCache();
  invalidatePermissionCache();
  T.resetApprovalTokenUse();
  CR.resetChargeReceiptUse();
  RateLimit.resetEventRateLimit();
  globalThis.__AUTH_TOKEN = null;
  globalThis.__AUTH_ROLE = 5;
  logs.length = 0;
  console.warn = (...a) => { logs.push(a.join(' ')); };
  console.error = (...a) => { logs.push(a.join(' ')); };
});
import { afterEach } from 'node:test';
afterEach(() => { console.warn = origWarn; console.error = origErr; });

const setFlags = (tokens, perms) => {
  const rows = globalThis.__MOCK_DB.systemSetting;
  if (tokens !== undefined) rows.push({ key: 'approval_tokens_required', value: String(tokens) });
  if (perms !== undefined) rows.push({ key: 'approval_permissions_enforced', value: String(perms) });
  invalidateSettingsCache();
};
const loginAs = (id, roleId = 5) => { globalThis.__AUTH_TOKEN = id; globalThis.__AUTH_ROLE = roleId; };
const req = (body) => ({ url: 'http://localhost/api/x', headers: { get: () => null }, json: async () => body });
const params = (id) => ({ params: Promise.resolve({ id: String(id) }) });
const callsTo = (model, method) => globalThis.__MOCK_CALLS.filter((c) => c.model === model && c.method === method);
const auditRows = () => globalThis.__MOCK_DB.auditLog;
const noSecretsLogged = () => {
  const blob = logs.join('\n');
  assert.ok(!blob.includes(PIN), 'the PIN is never logged');
  assert.ok(!/\ba1\.[A-Za-z0-9_-]{20,}/.test(blob), 'no approval token in a log line');
  assert.ok(!blob.includes('emp-'), 'no employee id in a log line');
};

// obtain a real token from the real verify-pin route
async function mint({ as = 'emp-worker', approver = 'emp-mgr', level = DEBT, orderId = 501, withContext = false, extra = {} } = {}) {
  const saved = [globalThis.__AUTH_TOKEN, globalThis.__AUTH_ROLE];
  if (as) loginAs(as, as === 'emp-head' ? 0 : as === 'emp-mgr' ? 1 : 5);
  const body = { pin: PIN, employeeId: approver, requiredLevel: level, ...(withContext ? { context: { orderId, reason: 't' } } : { orderId }), ...extra };
  const r = await verifyPin.POST(req(body));
  [globalThis.__AUTH_TOKEN, globalThis.__AUTH_ROLE] = saved;
  return r;
}

// ============================================================================================ pure token layer
const NOW = 1_800_000_000_000;
const mk = (over = {}, secret = SECRET, now = NOW) => T.createApprovalToken({ approverId: 'emp-mgr', kind: T.KINDS.DEBT_APPROVAL, orderIds: [501], actorEmployeeId: 'emp-worker', ...over }, secret, now);
const ex = (over = {}) => ({ kind: T.KINDS.DEBT_APPROVAL, orderId: 501, actorEmployeeId: 'emp-worker', ...over });

test('token: round trip, versioned format, payload has no pin and a 5-minute expiry', () => {
  const t = mk();
  assert.match(t, /^a1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  const r = T.verifyApprovalToken(t, SECRET, ex(), NOW + 1000);
  assert.equal(r.ok, true);
  assert.equal(r.payload.ap, 'emp-mgr');
  assert.equal(r.payload.exp - r.payload.iat, 5 * 60 * 1000);
  assert.ok(!JSON.stringify(r.payload).toLowerCase().includes('pin'));
});

test('token: wrong secret (another gemach), tampered payload, truncated/garbage, wrong version - all refused', () => {
  const t = mk();
  assert.equal(T.inspectApprovalToken(t, 'another-gemach-secret', NOW).reason, 'signature');
  const [v, body, sig] = t.split('.');
  const forged = JSON.parse(Buffer.from(body, 'base64url').toString());
  forged.ap = 'emp-head';
  const forgedBody = Buffer.from(JSON.stringify(forged)).toString('base64url');
  assert.equal(T.inspectApprovalToken(`${v}.${forgedBody}.${sig}`, SECRET, NOW).reason, 'signature');
  for (const bad of [undefined, null, '', 'abc', 'a1.x', `${v}.${body}`, `a2.${body}.${sig}`, t + 'x', 123, {}]) {
    assert.equal(T.inspectApprovalToken(bad, SECRET, NOW).ok, false);
  }
  assert.equal(T.inspectApprovalToken(t, '', NOW).reason, 'no_secret');
});

test('token: domain separation - an auth_session cookie is not an approval token and vice versa', () => {
  const session = AT.createSessionToken({ id: 'emp-mgr', roleId: 1 }, SECRET, NOW);
  assert.equal(T.inspectApprovalToken(session, SECRET, NOW).ok, false);
  const approval = mk();
  assert.equal(AT.verifySessionToken(approval, SECRET, NOW), null);
  // even re-labelled with the session version prefix, the signature (other key) does not verify
  const [, body, sig] = approval.split('.');
  assert.equal(AT.verifySessionToken(`v1.${body}.${sig}`, SECRET, NOW), null);
});

test('token: expiry (5 min), clock-skewed future iat refused', () => {
  const t = mk();
  assert.equal(T.verifyApprovalToken(t, SECRET, ex(), NOW + 5 * 60 * 1000 - 1, { claim: false }).ok, true);
  assert.equal(T.verifyApprovalToken(t, SECRET, ex(), NOW + 5 * 60 * 1000 + 1, { claim: false }).reason, 'expired');
  assert.equal(T.verifyApprovalToken(t, SECRET, ex(), NOW - 5 * 60 * 1000, { claim: false }).reason, 'expired', 'issued in the future');
});

test('token: kind / order / actor / amount must match', () => {
  const t = mk({ amount: 120 });
  const v = (o, n = NOW + 1) => T.verifyApprovalToken(t, SECRET, ex(o), n, { claim: false });
  assert.equal(v().ok, true);
  assert.equal(v({ kind: T.KINDS.MANUAL_CHARGE }).reason, 'kind');
  assert.equal(v({ kinds: [T.KINDS.MANUAL_CHARGE, T.KINDS.MANUAL_PAYMENT_CREDIT] }).reason, 'kind');
  assert.equal(v({ orderId: 502 }).reason, 'order');
  assert.equal(v({ actorEmployeeId: 'emp-worker2' }).reason, 'actor');
  assert.equal(v({ actorEmployeeId: null }).reason, 'actor');
  assert.equal(v({ amount: 120 }).ok, true);
  assert.equal(v({ amount: 120.005 }).ok, true, 'cent tolerance');
  assert.equal(v({ amount: 121 }).reason, 'amount');
  // a token without an amount is not amount-bound; one minted for an anonymous actor only matches an anonymous request
  assert.equal(T.verifyApprovalToken(mk({ actorEmployeeId: null }), SECRET, ex({ actorEmployeeId: null }), NOW + 1, { claim: false }).ok, true);
  assert.equal(T.verifyApprovalToken(mk({ actorEmployeeId: null }), SECRET, ex(), NOW + 1, { claim: false }).reason, 'actor');
});

test('token: single use (replay refused), release gives it back, a batch token approves each order once', () => {
  const t = mk({ orderIds: [501, 502] });
  assert.equal(T.verifyApprovalToken(t, SECRET, ex(), NOW + 1).ok, true);
  assert.equal(T.verifyApprovalToken(t, SECRET, ex(), NOW + 2).reason, 'replay');
  assert.equal(T.verifyApprovalToken(t, SECRET, ex({ orderId: 502 }), NOW + 3).ok, true, 'the other order of the batch');
  assert.equal(T.verifyApprovalToken(t, SECRET, ex({ orderId: 502 }), NOW + 4).reason, 'replay');
  const payload = T.inspectApprovalToken(t, SECRET, NOW + 5).payload;
  T.releaseApprovalToken(payload, 501);
  assert.equal(T.verifyApprovalToken(t, SECRET, ex(), NOW + 6).ok, true, 'released after a failed request');
});

test('token: bad minting arguments return null (no secret, unknown kind, no/too many orders, no approver)', () => {
  assert.equal(mk({}, ''), null);
  assert.equal(mk({ kind: 'nope' }), null);
  assert.equal(mk({ orderIds: [] }), null);
  assert.equal(mk({ orderIds: ['x', -1, 0, 1.5] }), null);
  assert.equal(mk({ orderIds: Array.from({ length: 101 }, (_, i) => i + 1) }), null);
  assert.equal(mk({ approverId: '' }), null);
  assert.deepEqual(T.normalizeOrderIds(['501', 501, 502, 'x']), [501, 502]);
  assert.equal(T.kindForRequiredLevel('feature:manual_charge_add'), 'manual_charge');
  assert.equal(T.kindForRequiredLevel('מנהל'), null);
  assert.equal(T.kindForRequiredLevel('__proto__'), null);
});

// ============================================================================================ verify-pin
test('verify-pin: issues a token for the debt level after a correct code; bound to the logged-in actor; no pin in the response', async () => {
  const r = await mint({ as: 'emp-worker', approver: 'emp-mgr' });
  assert.equal(r.status, 200);
  assert.equal(r.__json.success, true);
  assert.equal(r.__json.employeeId, 'emp-mgr', 'the existing response shape is unchanged');
  const p = T.inspectApprovalToken(r.__json.approvalToken, SECRET).payload;
  assert.equal(p.ap, 'emp-mgr');
  assert.equal(p.k, 'debt_approval');
  assert.deepEqual(p.o, [501]);
  assert.equal(p.ac, 'emp-worker');
  assert.ok(!JSON.stringify(r.__json).includes(PIN));
});

test('verify-pin: context.orderId (the new card) also binds the token; the other approval levels are mapped', async () => {
  const ctx = await mint({ withContext: true, level: 'feature:manual_charge_add' });
  assert.equal(ctx.status, 200);
  assert.equal(T.inspectApprovalToken(ctx.__json.approvalToken, SECRET).payload.k, 'manual_charge');
  assert.equal(ctx.__json.approvalLogged, true);
  const pc = await mint({ level: 'feature:manual_payment_credit_add', orderId: 502 });
  assert.equal(T.inspectApprovalToken(pc.__json.approvalToken, SECRET).payload.k, 'manual_payment_credit');
  const batch = await mint({ extra: { orderId: undefined, orderIds: [501, 502] } });
  assert.deepEqual(T.inspectApprovalToken(batch.__json.approvalToken, SECRET).payload.o, [501, 502]);
});

test('verify-pin: NO token without an order, for non-mapped levels, for a wrong code, or without AUTH_SECRET', async () => {
  const noOrder = await mint({ extra: { orderId: undefined } });
  assert.equal(noOrder.status, 200);
  assert.equal('approvalToken' in noOrder.__json, false);
  loginAs('emp-worker');
  const mgrLevel = await verifyPin.POST(req({ pin: PIN, employeeId: 'emp-mgr', requiredLevel: 'מנהל', orderId: 501 }));
  assert.equal(mgrLevel.status, 200);
  assert.equal('approvalToken' in mgrLevel.__json, false);
  const wrong = await verifyPin.POST(req({ pin: 'nope', employeeId: 'emp-mgr', requiredLevel: DEBT, orderId: 501 }));
  assert.equal(wrong.status, 401);
  assert.equal('approvalToken' in wrong.__json, false);
  // an approver who does not hold the permission gets no token (the level check fails first)
  const noPerm = await verifyPin.POST(req({ pin: PIN, employeeId: 'emp-mgr-noperm', requiredLevel: DEBT, orderId: 501 }));
  assert.equal(noPerm.status, 403);
  assert.equal('approvalToken' in noPerm.__json, false);
  delete process.env.AUTH_SECRET;
  try {
    const r = await verifyPin.POST(req({ pin: PIN, employeeId: 'emp-mgr', requiredLevel: DEBT, orderId: 501 }));
    assert.equal(r.status, 200, 'without AUTH_SECRET the legacy cookie fallback still lets the code check work');
    assert.equal('approvalToken' in r.__json, false, 'but nothing can be signed, so no token');
  } finally { process.env.AUTH_SECRET = SECRET; }
  noSecretsLogged();
});

// ============================================================================================ debt-approval route
const postDebt = (body, id = 501) => debtRoute.POST(req(body), params(id));
const deleteDebt = (body, id = 501) => debtRoute.DELETE(req(body), params(id));

test('debt-approval OFF (default): the legacy bare id still works exactly as before, with a deprecation line that carries no secrets', async () => {
  loginAs('emp-worker');
  const r = await postDebt({ employeeId: 'emp-mgr' });
  assert.equal(r.status, 200);
  assert.equal(auditRows().at(-1).action, 'DEBT_APPROVED');
  assert.equal(auditRows().at(-1).employeeId, 'emp-mgr');
  assert.ok(logs.some((l) => l.includes('[approval]') && l.includes('without an approval token')), 'deprecation line');
  noSecretsLogged();
  const denied = await postDebt({ employeeId: 'emp-worker2' });
  assert.equal(denied.status, 403, 'an approver without feature:debt_approval is still refused');
  assert.equal((await postDebt({})).status, 400);
});

test('debt-approval OFF: a valid token works and the approver comes FROM THE TOKEN, not from a different id in the body', async () => {
  const m = await mint({ approver: 'emp-head' });
  loginAs('emp-worker');
  const r = await postDebt({ employeeId: 'emp-mgr', approvalToken: m.__json.approvalToken });
  assert.equal(r.status, 200);
  assert.equal(auditRows().at(-1).employeeId, 'emp-head');
});

test('debt-approval OFF: an invalid token + legacy id = legacy behavior (nothing breaks while clients are updated); invalid token alone = 403', async () => {
  loginAs('emp-worker');
  assert.equal((await postDebt({ employeeId: 'emp-mgr', approvalToken: 'garbage' })).status, 200);
  const alone = await postDebt({ approvalToken: 'garbage' });
  assert.equal(alone.status, 403);
  assert.equal(alone.__json.code, 'APPROVAL_TOKEN_INVALID');
});

test('debt-approval ON: forged approver id (read from /api/audit) is refused - the DEBT_APPROVED row cannot be forged any more', async () => {
  setFlags(true);
  loginAs('emp-worker');
  const r = await postDebt({ employeeId: 'emp-mgr' });
  assert.equal(r.status, 403);
  assert.equal(r.__json.code, 'APPROVAL_TOKEN_REQUIRED');
  assert.equal(auditRows().filter((a) => a.action === 'DEBT_APPROVED').length, 0);
  assert.equal((await postDebt({ employeeId: 'emp-head' })).status, 403);
  assert.equal((await postDebt({ employeeId: 'emp-mgr', approvalToken: '' })).status, 403);
});

test('debt-approval ON: a real token is accepted once; replay, expiry, wrong order, wrong kind, wrong actor, other gemach secret are refused', async () => {
  setFlags(true);
  const m = await mint({});
  const tok = m.__json.approvalToken;
  loginAs('emp-worker');
  assert.equal((await postDebt({ approvalToken: tok })).status, 200);
  assert.equal(auditRows().at(-1).employeeId, 'emp-mgr');
  const replay = await postDebt({ approvalToken: tok });
  assert.equal(replay.status, 403, 'replay');
  assert.equal(replay.__json.code, 'APPROVAL_TOKEN_INVALID');

  // wrong order
  const other = (await mint({ orderId: 502 })).__json.approvalToken;
  loginAs('emp-worker');
  assert.equal((await postDebt({ approvalToken: other }, 501)).status, 403);
  // wrong kind
  const wrongKind = (await mint({ level: 'feature:manual_charge_add' })).__json.approvalToken;
  loginAs('emp-worker');
  assert.equal((await postDebt({ approvalToken: wrongKind })).status, 403);
  // wrong actor: minted while worker 1 was logged in, presented by worker 2
  const mine = (await mint({ as: 'emp-worker' })).__json.approvalToken;
  loginAs('emp-worker2');
  assert.equal((await postDebt({ approvalToken: mine })).status, 403);
  // another gemach (its own AUTH_SECRET)
  const foreign = T.createApprovalToken({ approverId: 'emp-mgr', kind: 'debt_approval', orderIds: [501], actorEmployeeId: 'emp-worker' }, 'other-org-secret');
  loginAs('emp-worker');
  assert.equal((await postDebt({ approvalToken: foreign })).status, 403);
  // expired
  const expired = T.createApprovalToken({ approverId: 'emp-mgr', kind: 'debt_approval', orderIds: [501], actorEmployeeId: 'emp-worker' }, SECRET, Date.now() - 6 * 60 * 1000);
  assert.equal((await postDebt({ approvalToken: expired })).status, 403);
  assert.equal(auditRows().filter((a) => a.action === 'DEBT_APPROVED').length, 1, 'only the first, legitimate approval was written');
  noSecretsLogged();
});

test('debt-approval ON: permission revoked inside the 5 minutes = refused (the approver is re-checked at use time)', async () => {
  setFlags(true);
  const tok = (await mint({})).__json.approvalToken;
  globalThis.__MOCK_DB.employeePermissionOverride = [{ employeeId: 'emp-mgr', key: 'feature:debt_approval', value: 'false' }];
  invalidatePermissionCache();
  loginAs('emp-worker');
  assert.equal((await postDebt({ approvalToken: tok })).status, 403);
});

test('debt-approval ON: a request that fails after the claim (order not found) gives the token back', async () => {
  setFlags(true);
  const tok = (await mint({ orderId: 999 })).__json.approvalToken;
  loginAs('emp-worker');
  assert.equal((await postDebt({ approvalToken: tok }, 999)).status, 404);
  globalThis.__MOCK_DB.order.push({ id: 'uuid-999', orderId: 999, isDeleted: false, items: [], obligations: [], payments: [], totalAmount: 10 });
  assert.equal((await postDebt({ approvalToken: tok }, 999)).status, 200);
});

test('debt-approval DELETE (cancel an approval): same rules - bare id refused when ON, token accepted', async () => {
  setFlags(true);
  loginAs('emp-worker');
  assert.equal((await deleteDebt({ employeeId: 'emp-mgr' })).status, 403);
  const tok = (await mint({})).__json.approvalToken;
  loginAs('emp-worker');
  const r = await deleteDebt({ approvalToken: tok });
  assert.equal(r.status, 200);
  assert.equal(auditRows().at(-1).action, 'CANCEL_DEBT_APPROVAL');
  assert.equal(auditRows().at(-1).employeeId, 'emp-mgr');
});

test('flags without AUTH_SECRET behave as OFF (never lock everybody out) and say so once', async () => {
  setFlags(true, true);
  loginAs('emp-worker');
  delete process.env.AUTH_SECRET;
  try {
    const mode = await Gate.getApprovalMode();
    assert.equal(mode.tokensRequired, false);
    assert.equal(mode.permissionsEnforced, false);
  } finally { process.env.AUTH_SECRET = SECRET; }
});

// ============================================================================================ order PUT (gates run before the transaction)
const putOrder = (body, id = 501) => orderRoute.PUT(req(body), params(id));
const putReachedGates = () => callsTo('paymentObligation', 'findMany').length > 0 && callsTo('payment', 'findMany').length > 0;
const gateBody = (r) => ({ status: r.status, code: r.__json && r.__json.code, approvalCode: r.__json && r.__json.approvalCode });

test('order PUT OFF: bare debtApprovedBy of an authorised approver passes the gate (today); an unauthorised id is still 403', async () => {
  loginAs('emp-worker');
  const bad = await putOrder({ debtApprovedBy: 'emp-worker2' });
  assert.equal(gateBody(bad).status, 403);
  assert.ok(!putReachedGates());
  await putOrder({ debtApprovedBy: 'emp-mgr' }).catch(() => {});
  assert.ok(putReachedGates(), 'passed the debt gate and went on');
});

test('order PUT ON: a bare debtApprovedBy is refused 403 APPROVAL_TOKEN_REQUIRED before anything else; a token passes', async () => {
  setFlags(true);
  loginAs('emp-worker');
  const bad = await putOrder({ debtApprovedBy: 'emp-mgr', cardVariant: 'a5' });
  assert.deepEqual(gateBody(bad), { status: 403, code: 'APPROVAL_TOKEN_REQUIRED', approvalCode: undefined });
  assert.equal(callsTo('paymentObligation', 'findMany').length, 0);
  const tok = (await mint({})).__json.approvalToken;
  loginAs('emp-worker');
  await putOrder({ debtApprovalToken: tok, cardVariant: 'a5' }).catch(() => {});
  assert.ok(putReachedGates());
  // the token is spent only if the save SUCCEEDS; this mock cannot commit the transaction, so the claim is handed back
  const again = await postDebt({ approvalToken: tok });
  assert.equal(again.status, 200, 'released after the failed save');
});

test('order PUT: the approver written to the history is the token approver (never a body id) - static contract', () => {
  const s = src('app/api/orders/[id]/route.js');
  assert.match(s, /resolveDebtApprover\(\{ orderId: parsedOrderId, token: data\.debtApprovalToken, bareId: data\.debtApprovedBy/);
  assert.match(s, /employeeId: debtApprover\b/);
  assert.ok(!/employeeId: data\.debtApprovedBy/.test(s), 'the row never takes the id from the body');
  assert.match(s, /releaseApprovalClaims\(claims\)/);
});

test('H2: manual charge without cardVariant - OFF unchanged (passes); ON refused unless the session holds the permission or a token/PIN comes along', async () => {
  const add = { obligations: [{ isNew: true, description: 'x', amount: 10, createdAt: new Date().toISOString() }] };
  loginAs('emp-worker');
  await putOrder(add).catch(() => {});
  assert.ok(putReachedGates(), 'OFF: the legacy body is not gated (as today)');
  globalThis.__MOCK_CALLS = [];

  setFlags(undefined, true);
  const refused = await putOrder(add);
  assert.deepEqual(gateBody(refused).status, 403);
  assert.equal(refused.__json.code, 'MANUAL_CHARGE_APPROVAL_REQUIRED');
  assert.equal(refused.__json.approvalCode, 'APPROVAL_PERMISSION_REQUIRED');
  // edit / delete a stored manual charge, delete a stored AUTO line (the extra-day / delivery hole)
  assert.equal((await putOrder({ obligations: [{ id: 'ob-man', isDeleted: true, amount: 40 }] })).status, 403);
  assert.equal((await putOrder({ obligations: [{ id: 'ob-man', isDeleted: false, amount: 400 }] })).status, 403);
  assert.equal((await putOrder({ obligations: [{ id: 'ob-auto', isDeleted: true, amount: 500 }] })).status, 403);
  // a save that sends everything back unchanged is not a charge change
  globalThis.__MOCK_CALLS = [];
  await putOrder({ obligations: [{ id: 'ob-man', isDeleted: false, amount: 40, description: 'ידני' }, { id: 'ob-auto', isDeleted: false, amount: 500 }] }).catch(() => {});
  assert.ok(putReachedGates(), 'unchanged echo passes');
});

test('H2 ON: the session holder, a token, or the typed code of an authorised approver all pass; a token of the wrong kind / order does not', async () => {
  setFlags(undefined, true);
  const add = { obligations: [{ isNew: true, description: 'x', amount: 10, createdAt: new Date().toISOString() }] };
  loginAs('emp-mgr', 1);
  await putOrder(add).catch(() => {});
  assert.ok(putReachedGates(), 'the manager holds feature:manual_charge_add');
  globalThis.__MOCK_CALLS = [];

  const tok = (await mint({ level: 'feature:manual_charge_add' })).__json.approvalToken;
  loginAs('emp-worker');
  await putOrder({ ...add, manualChargeApprovalToken: tok }).catch(() => {});
  assert.ok(putReachedGates(), 'token');
  globalThis.__MOCK_CALLS = [];

  await putOrder({ ...add, cardVariant: 'a5', manualChargeApproverId: 'emp-mgr', manualChargeApproverPin: PIN }).catch(() => {});
  assert.ok(putReachedGates(), 'typed code (the new card today)');
  globalThis.__MOCK_CALLS = [];

  const wrongKind = (await mint({ level: DEBT })).__json.approvalToken;
  loginAs('emp-worker');
  assert.equal((await putOrder({ ...add, manualChargeApprovalToken: wrongKind })).status, 403);
  const wrongOrder = (await mint({ level: 'feature:manual_charge_add', orderId: 502 })).__json.approvalToken;
  loginAs('emp-worker');
  assert.equal((await putOrder({ ...add, manualChargeApprovalToken: wrongOrder })).status, 403);
  // wrong typed PIN
  assert.equal((await putOrder({ ...add, cardVariant: 'a5', manualChargeApproverId: 'emp-mgr', manualChargeApproverPin: 'bad' })).status, 403);
});

test('a5 body with flags OFF: today\'s gate is unchanged (refused without permission, passes with the typed code)', async () => {
  const add = { cardVariant: 'a5', obligations: [{ isNew: true, description: 'x', amount: 10, createdAt: new Date().toISOString() }] };
  loginAs('emp-worker');
  assert.equal((await putOrder(add)).status, 403);
  await putOrder({ ...add, manualChargeApproverId: 'emp-mgr', manualChargeApproverPin: PIN }).catch(() => {});
  assert.ok(putReachedGates());
});

test('H3 ON: deleting / changing a stored payment needs feature:manual_payment_credit_add (session, or token of that kind for this order)', async () => {
  const del = { payments: [{ id: 'pay-1', isDeleted: true, amount: 200 }] };
  loginAs('emp-worker');
  await putOrder(del).catch(() => {});
  assert.ok(putReachedGates(), 'OFF: not enforced');
  globalThis.__MOCK_CALLS = [];

  setFlags(undefined, true);
  const refused = await putOrder(del);
  assert.equal(refused.status, 403);
  assert.equal(refused.__json.code, 'APPROVAL_PERMISSION_REQUIRED');
  assert.equal((await putOrder({ payments: [{ id: 'pay-1', isDeleted: false, amount: 1 }] })).status, 403, 'amount edit');
  // an unchanged echo, a note edit, a brand-new payment row: not gated here
  globalThis.__MOCK_CALLS = [];
  await putOrder({ payments: [{ id: 'pay-1', isDeleted: false, amount: '200', notes: 'x' }, { isNew: true, amount: 10, paymentMethod: 'אשראי', paymentDate: new Date().toISOString() }] }).catch(() => {});
  assert.ok(putReachedGates());
  globalThis.__MOCK_CALLS = [];

  const tok = (await mint({ level: 'feature:manual_payment_credit_add' })).__json.approvalToken;
  loginAs('emp-worker');
  await putOrder({ ...del, paymentApprovalToken: tok }).catch(() => {});
  assert.ok(putReachedGates(), 'token');
  globalThis.__MOCK_CALLS = [];
  loginAs('emp-mgr', 1);
  await putOrder(del).catch(() => {});
  assert.ok(putReachedGates(), 'the permitted manager needs nothing extra');
});

test('H3 ON: a debt token does not unlock payment deletion (kind), and a stolen token is useless to another actor', async () => {
  setFlags(undefined, true);
  const del = { payments: [{ id: 'pay-1', isDeleted: true }] };
  const debtTok = (await mint({ level: DEBT })).__json.approvalToken;
  loginAs('emp-worker');
  assert.equal((await putOrder({ ...del, paymentApprovalToken: debtTok })).status, 403);
  const tok = (await mint({ level: 'feature:manual_payment_credit_add', as: 'emp-worker' })).__json.approvalToken;
  loginAs('emp-worker2');
  assert.equal((await putOrder({ ...del, paymentApprovalToken: tok })).status, 403);
});

// ============================================================================================ POST /api/payments, PUT /api/refunds/[id]
const postPayment = (body) => paymentsRoute.POST(req(body));
const putRefund = (body, id = 'ref-1') => refundRoute.PUT(req(body), params(id));

test('POST /payments: OFF unchanged; ON a manual method needs the permission or a token; a card-labelled row needs a charge receipt (see the receipt tests below)', async () => {
  globalThis.__MOCK_WRITABLE = ['payment', 'orderItem'];
  loginAs('emp-worker');
  await postPayment({ orderId: 501, amount: 10, paymentMethod: 'מזומן' }).catch(() => {});
  assert.equal(callsTo('payment', 'create').length, 1, 'OFF: the payment is attempted');
  globalThis.__MOCK_CALLS = [];

  setFlags(undefined, true);
  const refused = await postPayment({ orderId: 501, amount: 10, paymentMethod: 'מזומן' });
  assert.equal(refused.status, 403);
  assert.equal(refused.__json.code, 'APPROVAL_PERMISSION_REQUIRED');
  assert.equal((await postPayment({ orderId: 501, amount: 10 })).status, 403, 'default method is cash');
  assert.equal((await postPayment({ orderId: 501, amount: 10, paymentMethod: "צ'ק" })).status, 403);
  assert.equal(callsTo('payment', 'create').length, 0);

  const fakeCard = await postPayment({ orderId: 501, amount: 10, paymentMethod: 'אשראי' });
  assert.equal(fakeCard.status, 403, 'the word אשראי alone proves nothing: a card-labelled row without a charge receipt is gated like cash');
  assert.equal(callsTo('payment', 'create').length, 0);

  const tok = (await mint({ level: 'feature:manual_payment_credit_add' })).__json.approvalToken;
  loginAs('emp-worker');
  await postPayment({ orderId: 501, amount: 10, paymentMethod: 'מזומן', approvalToken: tok }).catch(() => {});
  assert.equal(callsTo('payment', 'create').length, 1, 'token');
  const replay = await postPayment({ orderId: 501, amount: 10, paymentMethod: 'מזומן', approvalToken: tok });
  assert.equal(replay.status, 403, 'single use');
  globalThis.__MOCK_CALLS = [];
  loginAs('emp-mgr', 1);
  await postPayment({ orderId: 501, amount: 10, paymentMethod: 'מזומן' }).catch(() => {});
  assert.equal(callsTo('payment', 'create').length, 1, 'permitted employee');
});

test('POST /payments: a token for another order is refused', async () => {
  setFlags(undefined, true);
  const tok = (await mint({ level: 'feature:manual_payment_credit_add', orderId: 502 })).__json.approvalToken;
  loginAs('emp-worker');
  assert.equal((await postPayment({ orderId: 501, amount: 10, paymentMethod: 'מזומן', approvalToken: tok })).status, 403);
});

test('PUT /refunds/[id]: marking a credit done / undoing it needs the permission or a token when enforced; other edits are not gated; the token never reaches the DB write', async () => {
  loginAs('emp-worker');
  await putRefund({ isExecuted: true }).catch(() => {});
  assert.ok(callsTo('refund', 'findUnique').length > 0, 'OFF: not enforced');
  globalThis.__MOCK_CALLS = [];

  setFlags(undefined, true);
  const refused = await putRefund({ isExecuted: true });
  assert.equal(refused.status, 403);
  assert.equal(refused.__json.code, 'APPROVAL_PERMISSION_REQUIRED');
  globalThis.__MOCK_DB.refund[0].isExecuted = true;
  assert.equal((await putRefund({ isExecuted: false })).status, 403, 'undo needs it as well');
  globalThis.__MOCK_DB.refund[0].isExecuted = false;
  globalThis.__MOCK_CALLS = [];
  await putRefund({ bankName: 'לאומי' }).catch(() => {});
  assert.equal(callsTo('refund', 'update').length + callsTo('refund', 'updateMany').length >= 0, true);
  assert.notEqual((await putRefund({ bankName: 'לאומי' }).catch((e) => ({ status: 500 }))).status, 403, 'a bank-detail edit is not an execution');

  const tok = (await mint({ level: 'feature:manual_payment_credit_add' })).__json.approvalToken;
  loginAs('emp-worker');
  const ok = await putRefund({ isExecuted: true, approvalToken: tok }).catch(() => ({ status: 500 }));
  assert.notEqual(ok.status, 403, 'token accepted');
  for (const c of globalThis.__MOCK_CALLS) assert.ok(!JSON.stringify(c.args || {}).includes('approvalToken'), 'approvalToken is never written to a table');
});

// ============================================================================================ charge receipts (card rows) - finding 1
test('receipt: round trip, no card data inside, tamper / wrong secret / expiry / other domain refused, bound to order + amount + actor, single use', () => {
  const good = CR.createChargeReceipt({ orderId: 501, amount: 120.5, confirmation: 'C-77', actorEmployeeId: 'emp-worker' }, SECRET, NOW);
  assert.match(good, /^c1\.[\w-]+\.[\w-]+$/);
  const r = CR.inspectChargeReceipt(good, SECRET, NOW + 1000);
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.payload).sort(), ['ac', 'am', 'cf', 'exp', 'iat', 'n', 'o']);
  assert.equal(CR.inspectChargeReceipt(good, 'other-gemach-secret', NOW).ok, false, 'another gemach');
  const [v, , sig] = good.split('.');
  const forged = Buffer.from(JSON.stringify({ ...r.payload, am: 9999 })).toString('base64url');
  assert.equal(CR.inspectChargeReceipt(`${v}.${forged}.${sig}`, SECRET, NOW).ok, false, 'amount edited');
  assert.equal(CR.inspectChargeReceipt(good, SECRET, NOW + 61 * 60 * 1000).reason, 'expired');
  assert.equal(CR.inspectChargeReceipt(mk(), SECRET, NOW).ok, false, 'an approval token is not a receipt');
  assert.equal(T.inspectApprovalToken(good, SECRET, NOW).ok, false, 'a receipt is not an approval token');
  assert.equal(CR.inspectChargeReceipt(AT.createSessionToken({ id: 'emp-worker', roleId: 5 }, SECRET), SECRET, NOW).ok, false, 'nor a session cookie');
  const ok = { orderId: 501, amount: 120.5, actorEmployeeId: 'emp-worker' };
  assert.equal(CR.matchChargeReceipt(r.payload, ok).ok, true);
  assert.equal(CR.matchChargeReceipt(r.payload, { ...ok, orderId: 502 }).reason, 'order');
  assert.equal(CR.matchChargeReceipt(r.payload, { ...ok, amount: 120.6 }).reason, 'amount');
  assert.equal(CR.matchChargeReceipt(r.payload, { ...ok, amount: 5 }).reason, 'amount', 'a smaller payment is not the charge either');
  assert.equal(CR.matchChargeReceipt(r.payload, { ...ok, actorEmployeeId: 'emp-worker2' }).reason, 'actor');
  assert.equal(CR.claimChargeReceipt(r.payload, NOW), true);
  assert.equal(CR.claimChargeReceipt(r.payload, NOW), false, 'single use');
  CR.releaseChargeReceipt(r.payload);
  assert.equal(CR.claimChargeReceipt(r.payload, NOW), true, 'handed back');
  assert.equal(CR.createChargeReceipt({ orderId: 501, amount: 0 }, SECRET), null);
  assert.equal(CR.createChargeReceipt({ orderId: 501, amount: 10 }, null), null);
});

async function nedarimCharge({ orderId = 501, amount = 100, ok = true, as = 'emp-worker' } = {}) {
  const realFetch = globalThis.fetch;
  const prevMosad = process.env.NEDARIM_MOSAD_ID;
  const savedAuth = [globalThis.__AUTH_TOKEN, globalThis.__AUTH_ROLE];
  process.env.NEDARIM_MOSAD_ID = '1234';
  loginAs(as);
  // the real Nedarim endpoint is never contacted: fetch is replaced for the duration of the call
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify(ok ? { Status: 'OK', Confirmation: 'C-1' } : { Status: 'Error', Message: 'declined' }) });
  try {
    const res = await nedarimRoute.POST(req({ clientName: 'x', cardNumber: '4580000000000000', tokef: '1228', amount, installments: 1, notes: 'n', ...(orderId ? { orderId } : {}) }));
    return res.__json;
  } finally {
    globalThis.fetch = realFetch;
    [globalThis.__AUTH_TOKEN, globalThis.__AUTH_ROLE] = savedAuth;
    if (prevMosad === undefined) delete process.env.NEDARIM_MOSAD_ID; else process.env.NEDARIM_MOSAD_ID = prevMosad;
  }
}

test('nedarim: a successful charge also returns a signed receipt for this order / amount / employee; a declined charge returns none; no card number in it', async () => {
  const ok = await nedarimCharge({});
  assert.equal(ok.success, true);
  assert.equal(ok.confirmation, 'C-1', 'the old answer fields are untouched');
  const p = CR.inspectChargeReceipt(ok.chargeReceipt, SECRET).payload;
  assert.equal(p.o, 501); assert.equal(p.am, 100); assert.equal(p.ac, 'emp-worker'); assert.equal(p.cf, 'C-1');
  assert.ok(!Buffer.from(ok.chargeReceipt.split('.')[1], 'base64url').toString().includes('4580'), 'no card data in the receipt');
  const declined = await nedarimCharge({ ok: false });
  assert.equal(declined.success, false);
  assert.ok(!('chargeReceipt' in declined));
});

test('POST /payments ON: a card row WITH the receipt of a real charge passes for a worker without the permission; the receipt is single use and never written to the DB', async () => {
  globalThis.__MOCK_WRITABLE = ['payment', 'orderItem'];
  setFlags(undefined, true);
  const { chargeReceipt } = await nedarimCharge({ amount: 100 });
  loginAs('emp-worker');
  await postPayment({ orderId: 501, amount: 100, paymentMethod: 'אשראי', notes: '{}', chargeReceipt }).catch(() => {});
  assert.equal(callsTo('payment', 'create').length, 1, 'saved');
  assert.ok(!JSON.stringify(callsTo('payment', 'create')[0].args).includes(chargeReceipt), 'the receipt is not stored');
  globalThis.__MOCK_CALLS = [];
  const replay = await postPayment({ orderId: 501, amount: 100, paymentMethod: 'אשראי', chargeReceipt });
  assert.equal(replay.status, 403, 'a second card row from the same charge is refused');
  assert.equal(callsTo('payment', 'create').length, 0);
});

test('POST /payments ON: a receipt cannot be reused for another order, a bigger amount or another employee, nor forged - and a cash row never accepts a receipt as permission', async () => {
  setFlags(undefined, true);
  const { chargeReceipt } = await nedarimCharge({ amount: 100 });
  loginAs('emp-worker');
  assert.equal((await postPayment({ orderId: 502, amount: 100, paymentMethod: 'אשראי', chargeReceipt })).status, 403, 'other order');
  assert.equal((await postPayment({ orderId: 501, amount: 5000, paymentMethod: 'אשראי', chargeReceipt })).status, 403, 'bigger amount');
  assert.equal((await postPayment({ orderId: 501, amount: 100, paymentMethod: 'אשראי', chargeReceipt: chargeReceipt.slice(0, -3) + 'abc' })).status, 403, 'forged');
  assert.equal((await postPayment({ orderId: 501, amount: 100, paymentMethod: 'אשראי', chargeReceipt: 'a1.x.y' })).status, 403, 'garbage');
  loginAs('emp-worker2');
  assert.equal((await postPayment({ orderId: 501, amount: 100, paymentMethod: 'אשראי', chargeReceipt })).status, 403, 'copied to another session');
  loginAs('emp-worker');
  assert.equal(callsTo('payment', 'create').length, 0);
  assert.equal((await postPayment({ orderId: 501, amount: 100, paymentMethod: 'מזומן', chargeReceipt })).status, 403, 'cash + a receipt is still cash');
  // none of the refusals consumed the receipt
  globalThis.__MOCK_WRITABLE = ['payment', 'orderItem'];
  await postPayment({ orderId: 501, amount: 100, paymentMethod: 'אשראי', chargeReceipt }).catch(() => {});
  assert.equal(callsTo('payment', 'create').length, 1, 'the right order + amount + employee still works');
});

test('POST /payments: an employee WITH the permission saves a card row with no receipt; OFF flags = card rows pass exactly as before (a bad receipt is ignored)', async () => {
  globalThis.__MOCK_WRITABLE = ['payment', 'orderItem'];
  loginAs('emp-mgr', 1);
  setFlags(undefined, true);
  await postPayment({ orderId: 501, amount: 10, paymentMethod: 'אשראי' }).catch(() => {});
  assert.equal(callsTo('payment', 'create').length, 1, 'permitted employee, no receipt needed');
  globalThis.__MOCK_CALLS = [];
  installDb(); invalidateSettingsCache(); // both flags OFF again
  globalThis.__MOCK_WRITABLE = ['payment', 'orderItem'];
  loginAs('emp-worker');
  await postPayment({ orderId: 501, amount: 10, paymentMethod: 'אשראי' }).catch(() => {});
  await postPayment({ orderId: 501, amount: 10, paymentMethod: 'אשראי (מעקף מתכנת)', chargeReceipt: 'garbage' }).catch(() => {});
  assert.equal(callsTo('payment', 'create').length, 2, 'OFF: nothing is gated');
});

test('POST /payments ON: a receipt claimed by a request that then fails is handed back (the worker can retry the save)', async () => {
  setFlags(undefined, true);
  const { chargeReceipt } = await nedarimCharge({ amount: 100 });
  loginAs('emp-worker');
  // payment.create throws (the table is not writable in the mock) - the claim must be released
  await postPayment({ orderId: 501, amount: 100, paymentMethod: 'אשראי', chargeReceipt }).catch(() => {});
  globalThis.__MOCK_CALLS = [];
  globalThis.__MOCK_WRITABLE = ['payment', 'orderItem'];
  await postPayment({ orderId: 501, amount: 100, paymentMethod: 'אשראי', chargeReceipt }).catch(() => {});
  assert.equal(callsTo('payment', 'create').length, 1);
});

test('static: the two card flows send orderId to /api/nedarim and the receipt on to /api/payments', () => {
  const nc = src('app/components/order-card/hooks/usePaymentActions.js');
  assert.match(nc, /orderId: s\.order\?\.orderId \}\)/);
  assert.match(nc, /\.\.\.\(data\.chargeReceipt \? \{ chargeReceipt: data\.chargeReceipt \} : \{\}\)/);
  const mpm = src('components/orders/modern/ModernPaymentsManager.js');
  assert.match(mpm, /\.\.\.\(data\.chargeReceipt \? \{ chargeReceipt: data\.chargeReceipt \} : \{\}\)/);
  assert.match(mpm, /orderId \/\/ the server signs the charge receipt/);
  for (const f of ['lib/chargeReceipts.js', 'app/api/nedarim/route.js', 'app/api/payments/route.js', 'lib/approvalGate.js']) {
    for (const line of src(f).split('\n')) if (/console\.(log|warn|error)/.test(line)) assert.ok(!/receipt/i.test(line.replace(/'[^']*'/g, '')), `${f}: ${line.trim()}`);
  }
});

// ============================================================================================ refunds without an order / batches over 100 - finding 2
test('no-order sentinel: only the manual_payment_credit kind, only alone; real-order tokens never carry it', () => {
  const N = T.NO_ORDER_ID;
  assert.equal(typeof N, 'number');
  assert.ok(T.createApprovalToken({ approverId: 'emp-mgr', kind: T.KINDS.MANUAL_PAYMENT_CREDIT, orderIds: [N], actorEmployeeId: 'emp-worker' }, SECRET, NOW));
  assert.equal(mk({ kind: T.KINDS.DEBT_APPROVAL, orderIds: [N] }), null, 'no debt token for it');
  assert.equal(mk({ kind: T.KINDS.MANUAL_CHARGE, orderIds: [N] }), null);
  assert.equal(mk({ kind: T.KINDS.MANUAL_PAYMENT_CREDIT, orderIds: [N, 501] }), null, 'not mixed with real orders');
  const real = mk({ kind: T.KINDS.MANUAL_PAYMENT_CREDIT, orderIds: [501] });
  assert.equal(T.matchApprovalPayload(T.inspectApprovalToken(real, SECRET, NOW).payload, ex({ kind: T.KINDS.MANUAL_PAYMENT_CREDIT, orderId: N })).reason, 'order');
});

test('PUT /refunds/[id] ON, refund WITHOUT an order: a worker without the permission is no longer in a dead end - a sentinel token unlocks it; a real-order token does not', async () => {
  setFlags(undefined, true);
  globalThis.__MOCK_DB.refund.push({ id: 'ref-noorder', orderId: null, customerId: 'c1', amount: 50, isExecuted: false, isDeleted: false, bankName: 'x', bankBranch: '1' });
  loginAs('emp-worker');
  const refused = await putRefund({ isExecuted: true }, 'ref-noorder');
  assert.equal(refused.status, 403);
  assert.equal(refused.__json.approvalKind, 'manual_payment_credit', 'the client is told which approval to ask for');
  const realTok = (await mint({ level: 'feature:manual_payment_credit_add', orderId: 501 })).__json.approvalToken;
  loginAs('emp-worker');
  assert.equal((await putRefund({ isExecuted: true, approvalToken: realTok }, 'ref-noorder')).status, 403, 'a token for an order is not a no-order approval');
  const minted = await mint({ level: 'feature:manual_payment_credit_add', orderId: T.NO_ORDER_ID });
  assert.ok(minted.__json.approvalToken, 'verify-pin issues the sentinel token for the manual payment/credit level');
  const tok = minted.__json.approvalToken;
  loginAs('emp-worker');
  const ok = await putRefund({ isExecuted: true, approvalToken: tok }, 'ref-noorder').catch(() => ({ status: 500 }));
  assert.notEqual(ok.status, 403, 'accepted');
  // and the sentinel token cannot unlock an execution on a refund that HAS an order
  const tok2 = (await mint({ level: 'feature:manual_payment_credit_add', orderId: T.NO_ORDER_ID })).__json.approvalToken;
  loginAs('emp-worker');
  assert.equal((await putRefund({ isExecuted: true, approvalToken: tok2 }, 'ref-1')).status, 403);
});

test('verify-pin: the sentinel is refused for the debt and manual-charge levels; a batch of 100 gets a token, 101 gets none (the client now chunks)', async () => {
  assert.equal((await mint({ level: DEBT, orderId: T.NO_ORDER_ID })).__json.approvalToken, undefined);
  assert.equal((await mint({ level: 'feature:manual_charge_add', orderId: T.NO_ORDER_ID })).__json.approvalToken, undefined);
  const ids = (n) => Array.from({ length: n }, (_, i) => 2000 + i);
  assert.ok((await mint({ level: DEBT, orderId: undefined, extra: { orderIds: ids(100) } })).__json.approvalToken, '100 orders: one token');
  assert.equal((await mint({ level: DEBT, orderId: undefined, extra: { orderIds: ids(101) } })).__json.approvalToken, undefined, '101 orders: no token (why the client must chunk)');
});

test('static: refunds page asks one code, then one signed token per chunk of orders, and sends the sentinel for a no-order credit', () => {
  const page = src('app/refunds/page.js');
  assert.match(page, /verifyPinForOrders\('[^']*', 'feature:debt_approval', confirmModal\.orderIds\)/);
  assert.match(page, /for \(const \{ orderIds: chunkIds, approvalToken \} of auth\.approvals\)/);
  assert.match(page, /\|\| NO_ORDER_APPROVAL_ID/);
  assert.ok(!/refundOrderId\s*\?\s*sendWithApproval/.test(page), 'no more "send without approval when the credit has no order"');
  const moc = src('components/orders/modern/mocAuth.js');
  assert.match(moc, /export const verifyPinForOrders/);
  assert.match(moc, /for \(const chunk of chunkOrderIds\(orderIds\)\)/);
});

// ============================================================================================ wiring / static guards
test('static: tokens are never logged, the flag names exist, verify-pin only mints for mapped levels', () => {
  const gate = src('lib/approvalGate.js');
  assert.match(gate, /approval_tokens_required/);
  assert.match(gate, /approval_permissions_enforced/);
  for (const f of ['lib/approvalGate.js', 'lib/approvalTokens.js', 'app/api/auth/verify-pin/route.js']) {
    for (const line of src(f).split('\n')) {
      if (!/console\.(log|warn|error|info)/.test(line)) continue;
      if (/MANAGER_APPROVAL log failed|Error verifying PIN/.test(line)) continue; // pre-existing lines: they log only the Error object
      // the only interpolations allowed in a log line are kind / order number / the setting name - never an id, a token or a code
      const stripped = line.replace(/\$\{(what|kind|orderId|APPROVAL_TOKENS_SETTING)\}/g, '').replace(/approval token|approval flags|approval tokens|to require tokens|could not read setting|verify-pin/gi, '');
      assert.ok(!/token|\bpin\b|approverId|employeeId|\$\{/i.test(stripped), `${f}: ${line.trim()}`);
    }
  }
});

test('detectAutoLineRemovals / detectPaymentMoneyChanges: only real money movements', () => {
  const stored = [{ id: 'a', isManual: false, isDeleted: false }, { id: 'm', isManual: true, isDeleted: false }, { id: 'd', isManual: false, isDeleted: true }];
  assert.equal(OE.detectAutoLineRemovals(undefined, stored), 0);
  assert.equal(OE.detectAutoLineRemovals([{ id: 'a', isDeleted: true }, { id: 'm', isDeleted: true }, { id: 'd', isDeleted: true }, { id: 'zz', isDeleted: true }], stored), 1);
  assert.equal(OE.detectAutoLineRemovals([{ id: 'a', isDeleted: false }], stored), 0);
  const pays = [{ id: 'p1', isDeleted: false, amount: 100 }, { id: 'p2', isDeleted: true, amount: 50 }];
  assert.deepEqual(OE.detectPaymentMoneyChanges([{ id: 'p1', isDeleted: true }], pays), { deleted: 1, edited: 0 });
  assert.deepEqual(OE.detectPaymentMoneyChanges([{ id: 'p1', isDeleted: false, amount: '100.00' }, { id: 'p2', isDeleted: false, amount: 1 }], pays), { deleted: 0, edited: 0 }, 'echo / restore');
  assert.deepEqual(OE.detectPaymentMoneyChanges([{ id: 'p1', isDeleted: false, amount: 90 }], pays), { deleted: 0, edited: 1 });
  assert.deepEqual(OE.detectPaymentMoneyChanges([{ isNew: true, amount: 5 }, null], pays), { deleted: 0, edited: 0 });
});

// ============================================================================================ safe items: H1 audit ids, H5, H6
const auditReq = (qs = '') => ({ url: 'http://localhost/api/audit' + qs, headers: { get: () => null }, json: async () => ({}) });

test('H1: /api/audit hides OTHER employees\' ids (row employeeId + meta.approverId) from non-head-management viewers; names stay; own id stays', async () => {
  globalThis.__MOCK_DB.auditLog.push(
    { id: 'a1', entityType: 'Order', entityId: '501', action: 'DEBT_APPROVED', changesJson: JSON.stringify({ approvedDebtAmount: 10 }), employeeId: 'emp-mgr', createdAt: new Date() },
    { id: 'a2', entityType: 'Order', entityId: '501', action: 'MANAGER_APPROVAL', changesJson: JSON.stringify({ level: 'x', approverId: 'emp-head' }), employeeId: 'emp-worker', createdAt: new Date() },
    { id: 'a3', entityType: 'Order', entityId: '501', action: 'UPDATE_ORDER', changesJson: '{}', employeeId: null, createdAt: new Date() },
  );
  loginAs('emp-worker', 5);
  const r = await auditRoute.GET(auditReq('?entityType=Order'));
  assert.equal(r.status, 200);
  const rows = Object.fromEntries(r.__json.logs.map((l) => [l.id, l]));
  assert.equal(rows.a1.employeeId, 'hidden');
  assert.equal(rows.a1.employeeName, 'מנהלת סניף', 'the display name was resolved before the id was hidden');
  assert.equal(rows.a2.employeeId, 'emp-worker', 'the viewer\'s own id is theirs');
  const meta = JSON.parse(rows.a2.changesJson);
  assert.ok(!('approverId' in meta));
  assert.equal(meta.approverName, 'הנהלה ראשית');
  assert.equal(rows.a3.employeeId, null);
  assert.ok(!JSON.stringify(r.__json).includes('emp-mgr') && !JSON.stringify(r.__json).includes('emp-head'), 'no other id anywhere in the answer');
});

test('H1: head management still sees the raw rows (they own the employee screens); the helper never mutates its input', async () => {
  globalThis.__MOCK_DB.auditLog.push({ id: 'a1', entityType: 'Order', entityId: '501', action: 'DEBT_APPROVED', changesJson: '{}', employeeId: 'emp-mgr', createdAt: new Date() });
  loginAs('emp-head', 0);
  const r = await auditRoute.GET(auditReq('?entityType=Order'));
  assert.equal(r.__json.logs[0].employeeId, 'emp-mgr');
  const input = [{ id: 'x', employeeId: 'emp-mgr', changesJson: JSON.stringify({ approverId: 'emp-head' }) }];
  const out = AuditLib.hideForeignEmployeeIds(input, 'emp-worker');
  assert.equal(input[0].employeeId, 'emp-mgr');
  assert.equal(out[0].employeeId, AuditLib.HIDDEN_EMPLOYEE_ID);
});

test('H5: /api/deliveries needs page:deliveries or page:orders (customer names / addresses); login alone is not enough', async () => {
  globalThis.__MOCK_DB.departmentPermission.push({ roleId: 6, key: 'page:orders', value: 'false' }, { roleId: 6, key: 'page:deliveries', value: 'false' });
  globalThis.__MOCK_DB.employee.push({ id: 'emp-blocked', roleId: 6, isActive: true, firstName: 'א', lastName: 'ב', password: OTHER_HASH });
  invalidatePermissionCache();
  loginAs('emp-blocked', 6);
  const denied = await deliveriesRoute.GET(auditReq('?date=2026-11-10'));
  assert.equal(denied.status, 403);
  globalThis.__MOCK_CALLS = [];
  loginAs('emp-worker', 5); // roleId 5 has page:orders
  const allowed = await deliveriesRoute.GET(auditReq('?date=2026-11-10')).catch(() => ({ status: 500 }));
  assert.ok(allowed.status !== 403 && allowed.status !== 401, 'a worker with page:orders gets past the gate (the mock has no delivery data, so a 500 after it is fine)');
  globalThis.__AUTH_TOKEN = null;
  assert.equal((await deliveriesRoute.GET(auditReq('?date=2026-11-10'))).status, 401);
});

test('H6: /api/orders/events caps one employee at 5000 rows a minute (429, nothing written), other employees are unaffected; a day-print sized burst fits', async () => {
  const post = (body) => eventsRoute.POST(req(body));
  globalThis.__MOCK_DB.employee.push({ id: 'emp-w3', roleId: 5, isActive: true, firstName: 'ג', lastName: 'ד', password: OTHER_HASH });
  loginAs('emp-worker', 5);
  const doc = { action: 'ORDER_PRINTED', meta: { doc: 'order' } };
  const ids = Array.from({ length: 200 }, (_, i) => 1000 + i);
  globalThis.__MOCK_DB.order.push(...ids.map((n) => ({ id: 'u' + n, orderId: n, isDeleted: false, items: [], obligations: [], payments: [] })));
  // a 150-order day printed as a 12-page document = 1800 rows (one row per order per page, 200 orders per request) - well inside the cap
  for (let i = 0; i < 9; i++) assert.equal((await post({ orderIds: ids, ...doc })).status, 200, `day-print chunk ${i}`);
  assert.equal(auditRows().length, 1800);
  for (let i = 9; i < RateLimit.MAX_ROWS_PER_WINDOW / 200; i++) assert.equal((await post({ orderIds: ids, ...doc })).status, 200, `full batches up to the cap (${i})`);
  const over = await post({ orderIds: [501], ...doc });
  assert.equal(over.status, 429);
  assert.equal(over.__json.code, 'RATE_LIMITED');
  assert.equal(auditRows().length, RateLimit.MAX_ROWS_PER_WINDOW, 'nothing written by the refused request');
  loginAs('emp-w3', 5);
  assert.equal((await post({ orderIds: [501], ...doc })).status, 200, 'another employee has their own window');
  // a window that has passed starts over
  assert.equal(RateLimit.admitEvents({ actorId: 'emp-worker', count: 1, now: Date.now() + 61 * 1000 }).ok, true);
});

test('H6: the limiter counts rows, hands them back on release, and treats anonymous (open mode) as one shared actor with its own, larger cap', () => {
  const t = 1_000_000;
  const cap = RateLimit.MAX_ROWS_PER_WINDOW;
  assert.equal(cap, 5000, 'sized for a multi-page day print, still protective');
  assert.equal(RateLimit.admitEvents({ actorId: 'a', count: cap, now: t }).ok, true);
  assert.equal(RateLimit.admitEvents({ actorId: 'a', count: 1, now: t + 1 }).ok, false);
  RateLimit.releaseEvents({ actorId: 'a', count: 10 });
  assert.equal(RateLimit.admitEvents({ actorId: 'a', count: 10, now: t + 2 }).ok, true);
  // open mode: everyone is 'anonymous' - one bucket, bigger than a named employee's
  assert.ok(RateLimit.MAX_ROWS_ANONYMOUS > cap);
  assert.equal(RateLimit.admitEvents({ actorId: null, count: RateLimit.MAX_ROWS_ANONYMOUS, now: t }).ok, true);
  assert.equal(RateLimit.admitEvents({ actorId: undefined, count: 1, now: t }).ok, false);
  assert.equal(RateLimit.admitEvents({ actorId: 'someone-else', count: cap, now: t }).ok, true, 'named employees do not share the anonymous bucket');
});
