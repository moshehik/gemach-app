// W0 (new order card, server side): order event logging + approvals + print/email history + PUT contract.
// No DB, no dev server, no network: Next-only modules and the Prisma client are replaced by in-memory shims
// (the schedule tests' shims, plus a thin wrapper below that adds AuditLog/EmailLog writes and a `contains`
// filter). The REAL lib/auth.js, lib/permissions.js, lib/settingsCache.js, lib/redactSensitive.js and the REAL
// route files run against it.
//   node --test scripts/order-events.test.mjs               (one time zone)
//   node scripts/order-events.test.mjs --tz                 (UTC, Asia/Jerusalem, America/New_York)
// Coverage = the server part of PLAN §C.6 (H01-H07/H32 diff rows, H16 manual charge gate, H19-H21 approvals,
// H22-H26 events, H27 email, H33 local actions rejected) + auth / permission / PIN-leak / idempotence cases.
import { spawnSync } from 'node:child_process';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PROJ = path.resolve(here, '..');

// ---- 3-time-zone runner mode -----------------------------------------------------------------------
if (process.argv.includes('--tz')) {
  const zones = (process.env.ORDER_EVENTS_TEST_TZS || 'UTC,Asia/Jerusalem,America/New_York').split(',');
  let failed = 0;
  for (const tz of zones) {
    const r = spawnSync(process.execPath, ['--no-warnings', '--test', fileURLToPath(import.meta.url)], { cwd: PROJ, encoding: 'utf8', env: { ...process.env, TZ: tz } });
    const out = (r.stdout || '') + (r.stderr || '');
    const pass = (out.match(/^[#ℹ] pass (\d+)/m) || [])[1] || '?';
    const fail = (out.match(/^[#ℹ] fail (\d+)/m) || [])[1] || '?';
    if (r.status !== 0) { failed++; console.log(out); }
    console.log(`${r.status === 0 ? 'OK  ' : 'FAIL'}  TZ=${tz.padEnd(17)} order-events.test.mjs pass=${pass} fail=${fail}`);
  }
  console.log(failed ? `\n${failed} run(s) failed` : '\nall runs passed');
  process.exit(failed ? 1 : 0);
}

// ---- module hooks (registered before any project module is imported) --------------------------------
const SHIMS = path.join(PROJ, 'scripts', 'schedule-tests', 'shims');
const fileUrl = (p) => pathToFileURL(p).href;
const baseShim = fileUrl(path.join(SHIMS, 'prisma.mjs'));
const prismaShimSrc = `
import base from ${JSON.stringify(baseShim)};
export { matchWhere } from ${JSON.stringify(baseShim)};
// AuditLog / EmailLog: real writes into __MOCK_DB (the base shim blocks createMany), and a findFirst that
// understands { changesJson: { contains } } (the base evaluator ignores unknown operators).
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
  async createMany({ data }) {
    globalThis.__MOCK_CALLS.push({ model: m, method: 'createMany', args: { data } });
    if (globalThis.__FAIL_AUDIT && m === 'auditLog') throw new Error('db down');
    await new Promise((r) => setTimeout(r, 1)); // let concurrent requests interleave (race tests)
    // one INSERT statement: a duplicate primary key fails the whole batch (Postgres semantics)
    if (data.some((d) => d.id && rows(m).some((r) => r.id === d.id))) { const e = new Error('Unique constraint failed on the fields: (id)'); e.code = 'P2002'; throw e; }
    for (const d of data) rows(m).push({ id: m + '-' + (++seq), createdAt: new Date(), ...d });
    return { count: data.length };
  },
  async findFirst({ where } = {}) { globalThis.__MOCK_CALLS.push({ model: m, method: 'findFirst', args: { where } }); return rows(m).find((r) => match(r, where)) || null; },
  async findMany({ where } = {}) { return rows(m).filter((r) => match(r, where)); },
});
const LOGS = { auditLog: logModel('auditLog'), emailLog: logModel('emailLog') };
const proxy = new Proxy({}, { get(_, p) { if (p === 'then') return undefined; return LOGS[p] || base[p]; } });
export default proxy;
export const prisma = proxy;
export function auditAs(action, args, changes) { if (!action) return args; return { ...args, __audit: { action, changes } }; }
export async function getActingEmployeeId() { return globalThis.__AUTH_TOKEN || null; }
`;
const PRISMA_SHIM = 'data:text/javascript,' + encodeURIComponent(prismaShimSrc);
const hooksSrc = `
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const PROJ = ${JSON.stringify(PROJ)};
const NS = ${JSON.stringify(fileUrl(path.join(SHIMS, 'next-server.mjs')))};
const NH = ${JSON.stringify(fileUrl(path.join(SHIMS, 'next-headers.mjs')))};
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
const src = (rel) => fs.readFileSync(path.join(PROJ, rel), 'utf8');

const OE = await L('lib/history/orderEvents.js');
const eventsRoute = await L('app/api/orders/events/route.js');
const verifyPin = await L('app/api/auth/verify-pin/route.js');
const emailRoute = await L('app/api/orders/[id]/email/route.js');
const itemsRoute = await L('app/api/orders/[id]/items/route.js');
const { invalidatePermissionCache } = await L('lib/permissions.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { invalidateRequireLoginCache } = await L('lib/auth.js');
const { getCatalogItem, getApproverKeys } = await L('lib/permissionsMetadata.js');
const { redactRequestQuery, redactUrl } = await L('lib/redactSensitive.js');
const { ACTION_TRANSLATIONS } = await L('components/HistoryViewer.js').catch(() => ({ ACTION_TRANSLATIONS: null }));
const CH = await L('lib/history/customerHistory.js');
const bcrypt = (await import('bcryptjs')).default;

const PIN = '987654';
const PIN_HASH = bcrypt.hashSync(PIN, 4);
const OTHER_HASH = bcrypt.hashSync('111111', 4);

function installDb(extraSettings = []) {
  globalThis.__MOCK_DB = {
    order: [
      { id: 'uuid-501', orderId: 501, isDeleted: false, customerId: 'c1', customer: { firstName: 'שרה', lastName: 'כהן', email: 'sara@example.com' }, items: [], obligations: [], payments: [], eventDate: new Date('2026-11-10T22:00:00Z'), orderDate: new Date('2026-10-01T08:00:00Z') },
      { id: 'uuid-502', orderId: 502, isDeleted: true, customerId: 'c2', customer: { firstName: 'רבקה', lastName: 'לוי' }, items: [], obligations: [], payments: [] },
      ...Array.from({ length: 200 }, (_, i) => ({ id: 'uuid-b' + i, orderId: 1000 + i, isDeleted: false, items: [], obligations: [], payments: [] })),
    ],
    employee: [
      { id: 'emp-worker', roleId: 5, isActive: true, firstName: 'עובדת', lastName: 'רגילה', password: OTHER_HASH },
      { id: 'emp-blocked', roleId: 6, isActive: true, firstName: 'עובדת', lastName: 'חסומה', password: OTHER_HASH },
      { id: 'emp-sched', roleId: 7, isActive: true, firstName: 'עובדת', lastName: 'לו״ז', password: OTHER_HASH },
      { id: 'emp-mgr', roleId: 1, isActive: true, firstName: 'מנהלת', lastName: 'סניף', password: PIN_HASH },
      { id: 'emp-head', roleId: 0, isActive: true, firstName: 'הנהלה', lastName: 'ראשית', password: OTHER_HASH },
    ],
    systemSetting: [{ key: 'require_login', value: 'true' }, { key: 'email_link_a', value: 'http://mailer.test/exec' }, ...extraSettings],
    departmentPermission: [
      { roleId: 5, key: 'page:orders', value: 'true' },
      { roleId: 6, key: 'page:orders', value: 'false' }, { roleId: 6, key: 'page:rentals', value: 'false' }, { roleId: 6, key: 'page:board', value: 'false' }, { roleId: 6, key: 'page:schedule', value: 'false' },
      { roleId: 7, key: 'page:orders', value: 'false' }, { roleId: 7, key: 'page:rentals', value: 'false' }, { roleId: 7, key: 'page:board', value: 'false' }, { roleId: 7, key: 'page:schedule', value: 'true' },
      { roleId: 1, key: 'feature:item_change_approval', value: 'true' },
      { roleId: 1, key: 'page:orders', value: 'true' },
    ],
    employeePermissionOverride: [],
    auditLog: [],
    emailLog: [],
    dressModel: [],
  };
  globalThis.__MOCK_CALLS = [];
  globalThis.__FAIL_AUDIT = false;
}

beforeEach(() => {
  installDb();
  invalidateSettingsCache();
  invalidateRequireLoginCache();
  invalidatePermissionCache();
  globalThis.__AUTH_TOKEN = null;
});

const req = (body) => ({ url: 'http://localhost/api/x', headers: { get: () => null }, json: async () => (typeof body === 'function' ? body() : body) });
const postEvent = (body) => eventsRoute.POST(req(body));
const audit = () => globalThis.__MOCK_DB.auditLog;
const noPinAnywhere = () => {
  const blob = JSON.stringify(globalThis.__MOCK_DB.auditLog) + JSON.stringify(globalThis.__MOCK_DB.emailLog);
  assert.ok(!blob.includes(PIN), 'the PIN value must never be written');
  assert.ok(!/"(pin|managerPin|emailApproverPin|manualChargeApproverPin)"/i.test(blob), 'no pin-named key in any row');
};

// =========================================================================================== pure layer
test('action lists: client vs server-only, all distinct, every action translated for the legacy card', () => {
  assert.deepEqual([...OE.CLIENT_EVENT_ACTIONS], ['ORDER_PRINTED', 'ORDER_PDF_DOWNLOADED', 'ORDER_XLSX_EXPORTED', 'HISTORY_EXPORTED']);
  assert.deepEqual([...OE.SERVER_ONLY_EVENT_ACTIONS], ['MANAGER_APPROVAL', 'EMAIL_SENT', 'EMAIL_FAILED']);
  assert.equal(new Set(OE.ALL_ORDER_EVENT_ACTIONS).size, OE.ALL_ORDER_EVENT_ACTIONS.length);
  // HistoryViewer is a client component (JSX) - check its map in source when it cannot be imported in node
  const hv = src('components/HistoryViewer.js');
  for (const a of [...OE.ALL_ORDER_EVENT_ACTIONS, 'UPDATE_ORDER']) {
    if (ACTION_TRANSLATIONS) assert.ok(ACTION_TRANSLATIONS[a], a);
    else assert.match(hv, new RegExp(`\\n\\s*${a}: '[^']+'`), `HistoryViewer ACTION_TRANSLATIONS.${a}`);
  }
});

test('sanitizeEventMeta: required fields, enums, defaults, unknown keys dropped, digit runs masked', () => {
  assert.equal(OE.sanitizeEventMeta('ORDER_PRINTED', {}).ok, false);
  assert.equal(OE.sanitizeEventMeta('ORDER_PRINTED', { doc: 'invoice' }).ok, false);
  const p = OE.sanitizeEventMeta('ORDER_PRINTED', { doc: 'order', pin: '1234', employeeId: 'emp-head', evil: 'x' });
  assert.deepEqual(p, { ok: true, meta: { source: 'card', batch: false, doc: 'order' } });
  assert.equal(OE.sanitizeEventMeta('ORDER_PRINTED', { doc: 'prep', sheet: 'PP-12' }).ok, false, 'prep is PP-07');
  assert.deepEqual(OE.sanitizeEventMeta('ORDER_PRINTED', { doc: 'delivery', sheet: 'PP-12', source: 'print-page' }).meta, { source: 'print-page', batch: false, doc: 'delivery', sheet: 'PP-12' });
  assert.equal(OE.sanitizeEventMeta('ORDER_PRINTED', { doc: 'order', count: 0 }).ok, false);
  assert.equal(OE.sanitizeEventMeta('ORDER_PRINTED', { doc: 'order', batch: 'yes' }).ok, false);
  const f = OE.sanitizeEventMeta('ORDER_XLSX_EXPORTED', { fileName: 'הזמנה 501\u0000 כרטיס 4580-1234-5678-9012.xlsx' });
  assert.equal(f.meta.fileName, 'הזמנה 501 כרטיס [מוסתר].xlsx');
  assert.equal(OE.sanitizeEventMeta('ORDER_XLSX_EXPORTED', { fileName: 'x'.repeat(500) }).meta.fileName.length, 120);
  assert.equal(OE.sanitizeEventMeta('HISTORY_EXPORTED', { format: 'csv' }).ok, false);
  assert.deepEqual(OE.sanitizeEventMeta('HISTORY_EXPORTED', { format: 'xlsx', rows: 42 }).meta, { format: 'xlsx', rows: 42 });
  assert.equal(OE.sanitizeEventMeta('ORDER_PDF_DOWNLOADED', { doc: 'prep' }).ok, false);
  assert.equal(OE.sanitizeEventMeta('ORDER_PRINTED', ['doc']).ok, false);
});

test('parseEventsRequest: orderId / orderIds / dedupe / limits / server-only / unknown (H33) / clientEventId', () => {
  const ok = OE.parseEventsRequest({ orderId: 501, orderIds: [501, '502'], action: 'ORDER_PRINTED', meta: { doc: 'order' } });
  assert.deepEqual(ok.orderIds, [501, 502]);
  assert.equal(OE.parseEventsRequest(null).code, 'BAD_REQUEST');
  assert.equal(OE.parseEventsRequest({ orderId: 501, action: 'MANAGER_APPROVAL', meta: {} }).code, 'SERVER_ONLY_ACTION');
  assert.equal(OE.parseEventsRequest({ orderId: 501, action: 'EMAIL_SENT' }).code, 'SERVER_ONLY_ACTION');
  for (const local of ['TAB_SWITCHED', 'CARD_OPENED', 'DRAFT_RESTORED', 'UPDATE', 'CREATE']) {
    assert.equal(OE.parseEventsRequest({ orderId: 501, action: local }).code, 'UNKNOWN_ACTION', local);
  }
  assert.equal(OE.parseEventsRequest({ action: 'ORDER_PRINTED', meta: { doc: 'order' } }).code, 'BAD_ORDER_IDS');
  assert.equal(OE.parseEventsRequest({ orderId: -3, action: 'ORDER_PRINTED', meta: { doc: 'order' } }).code, 'BAD_ORDER_IDS');
  assert.equal(OE.parseEventsRequest({ orderId: '5a', action: 'ORDER_PRINTED', meta: { doc: 'order' } }).code, 'BAD_ORDER_IDS');
  assert.equal(OE.parseEventsRequest({ orderIds: 'x', action: 'ORDER_PRINTED', meta: { doc: 'order' } }).code, 'BAD_ORDER_IDS');
  const ids200 = Array.from({ length: 200 }, (_, i) => i + 1);
  assert.equal(OE.parseEventsRequest({ orderIds: ids200, action: 'ORDER_PRINTED', meta: { doc: 'order' } }).ok, true);
  assert.equal(OE.parseEventsRequest({ orderIds: [...ids200, 201], action: 'ORDER_PRINTED', meta: { doc: 'order' } }).code, 'TOO_MANY_ORDERS');
  assert.equal(OE.parseEventsRequest({ orderId: 1, action: 'ORDER_PRINTED', meta: { doc: 'order' }, clientEventId: 'short' }).code, 'BAD_REQUEST');
  assert.equal(OE.parseEventsRequest({ orderId: 1, action: 'ORDER_PRINTED', meta: { doc: 'order' }, clientEventId: 'abc"def,ghi' }).code, 'BAD_REQUEST');
  assert.equal(OE.parseEventsRequest({ orderId: 1, action: 'ORDER_PRINTED', meta: { doc: 'order' }, clientEventId: 'evt-12345678' }).clientEventId, 'evt-12345678');
  assert.equal(OE.parseEventsRequest({ orderId: 1, action: 'ORDER_PRINTED' }).code, 'BAD_META');
});

test('printPageEventBodies: one body per 200 ids, batch flag/count, doc from ?type, chunked clientEventIds', () => {
  const single = OE.printPageEventBodies({ orderIds: [501], printType: 'rental', isBatch: false, clientEventId: 'abcdefgh-1234' });
  assert.deepEqual(single, [{ orderIds: [501], action: 'ORDER_PRINTED', meta: { doc: 'rental', source: 'print-page', batch: false }, clientEventId: 'abcdefgh-1234-0' }]);
  const ids = Array.from({ length: 450 }, (_, i) => i + 1);
  const many = OE.printPageEventBodies({ orderIds: ids, printType: 'order', isBatch: true, clientEventId: 'abcdefgh-1234' });
  assert.deepEqual(many.map((b) => b.orderIds.length), [200, 200, 50]);
  assert.ok(many.every((b) => b.meta.batch === true && b.meta.count === 450 && b.meta.doc === 'order'));
  assert.deepEqual(many.map((b) => b.clientEventId), ['abcdefgh-1234-0', 'abcdefgh-1234-1', 'abcdefgh-1234-2']);
  for (const b of many) assert.equal(OE.parseEventsRequest(b).ok, true, 'every body passes the route validator');
  assert.equal(OE.printPageEventBodies({ orderIds: [1], printType: 'weird' })[0].meta.doc, 'order');
  // a uuid-based id stays within the 64-char limit with its chunk suffix
  assert.equal(OE.parseEventsRequest(OE.printPageEventBodies({ orderIds: [1], printType: 'order', clientEventId: '123e4567-e89b-12d3-a456-426614174000' })[0]).ok, true);
});

test('diffOrderUpdate (AMB-19, H01-H07, H32): only real changes, before/after, no-op = {}, standing order masked', () => {
  const existing = {
    eventDate: new Date('2026-11-10T22:00:00Z'), fromDate: null, toDate: null, notes: 'ישן', internalNotes: null, customSpacing: 3,
    extraDay: null, isDelivery: false, deliveryCity: null, totalAmount: 450, hasSignedRegulations: false, isAbroad: false, eventDateHebrew: 'י חשון', hokDetails: '{"card":"4580123412341234"}', status: 'חדש',
  };
  // H32: a save that sends the same values (dates as ISO strings parse to the same instant; '' == null)
  assert.deepEqual(OE.diffOrderUpdate(existing, {
    eventDate: new Date('2026-11-10T22:00:00.000Z'), notes: 'ישן', internalNotes: '', totalAmount: 450, hasSignedRegulations: undefined,
    isAbroad: false, eventDateHebrew: 'י חשון', fromDate: null, status: undefined, customSpacing: 3,
  }), {});
  const d = OE.diffOrderUpdate(existing, {
    eventDate: new Date('2026-11-17T22:00:00Z'), eventDateHebrew: 'יז חשון', // H01
    isAbroad: true, fromDate: new Date('2026-11-15T22:00:00Z'), // H02
    notes: 'חדש', internalNotes: 'פנימי', // H03
    customSpacing: 1, extraDay: 'after', // H04
    isDelivery: true, deliveryCity: 'ירושלים', // H05
    hasSignedRegulations: true, // H07
    totalAmount: 450.0000000001, hokDetails: '{"card":"4580999999999999"}',
  });
  assert.deepEqual(d.eventDate, { from: '2026-11-10T22:00:00.000Z', to: '2026-11-17T22:00:00.000Z' });
  assert.deepEqual(d.eventDateHebrew, { from: 'י חשון', to: 'יז חשון' });
  assert.deepEqual(d.isAbroad, { from: false, to: true });
  assert.deepEqual(d.fromDate, { from: null, to: '2026-11-15T22:00:00.000Z' });
  assert.deepEqual(d.notes, { from: 'ישן', to: 'חדש' });
  assert.deepEqual(d.internalNotes, { from: null, to: 'פנימי' });
  assert.deepEqual(d.customSpacing, { from: 3, to: 1 });
  assert.deepEqual(d.extraDay, { from: null, to: 'after' });
  assert.deepEqual(d.isDelivery, { from: false, to: true });
  assert.deepEqual(d.deliveryCity, { from: null, to: 'ירושלים' });
  assert.deepEqual(d.hasSignedRegulations, { from: false, to: true });
  assert.ok(!('totalAmount' in d), 'float noise is not a change');
  assert.deepEqual(d.hokDetails, { from: '[הוסתר]', to: '[עודכן]' }, 'distinct markers - viewers drop from===to as "no change"');
  assert.notEqual(d.hokDetails.from, d.hokDetails.to);
  assert.ok(!JSON.stringify(d).includes('4580'), 'standing-order payment data never reaches the row');
});

test('detectManualChargeChanges (R35/H16): new, edited, deleted and restored STORED manual rows; automatic rows ignored', () => {
  const stored = [
    { id: 'm1', isManual: true, isDeleted: false, amount: 50, description: 'חיוב ידני' },
    { id: 'a1', isManual: false, isDeleted: false, amount: 120, description: 'השכרה' },
    { id: 'm2', isManual: true, isDeleted: true, amount: 30, description: 'ישן' },
  ];
  const Z = { added: 0, removed: 0, restored: 0, edited: 0 };
  assert.deepEqual(OE.detectManualChargeChanges(undefined, stored), Z);
  // the legacy-shaped "send everything back unchanged" body is not a change
  assert.deepEqual(OE.detectManualChargeChanges([{ id: 'm1', isDeleted: false, amount: 50, description: 'חיוב ידני' }, { id: 'a1', isDeleted: false, amount: 999 }, { id: 'm2', isDeleted: true, amount: '30', description: 'ישן' }], stored), Z);
  assert.deepEqual(OE.detectManualChargeChanges([{ isNew: true, description: 'x', amount: 10 }], stored), { ...Z, added: 1 });
  assert.deepEqual(OE.detectManualChargeChanges([{ id: 'm1', isDeleted: true, amount: 50 }], stored), { ...Z, removed: 1 });
  assert.deepEqual(OE.detectManualChargeChanges([{ id: 'm2', isDeleted: false, amount: 30 }], stored), { ...Z, restored: 1 });
  assert.deepEqual(OE.detectManualChargeChanges([{ id: 'm1', isDeleted: false, amount: 500 }], stored), { ...Z, edited: 1 }, 'amount');
  assert.deepEqual(OE.detectManualChargeChanges([{ id: 'm1', isDeleted: false, amount: 50, description: 'אחר' }], stored), { ...Z, edited: 1 }, 'description');
  assert.deepEqual(OE.detectManualChargeChanges([{ id: 'm1', isDeleted: false }], stored), { ...Z, edited: 1 }, 'a missing amount is written as 0 by the route - a change');
  assert.deepEqual(OE.detectManualChargeChanges([{ id: 'a1', isDeleted: true, amount: 0 }], stored), Z, 'automatic obligation');
  assert.deepEqual(OE.detectManualChargeChanges([{ id: 'gone', isDeleted: true }, null], stored), Z);
  assert.equal(OE.hasManualChargeChange(Z), false);
  for (const k of ['added', 'removed', 'restored', 'edited']) assert.equal(OE.hasManualChargeChange({ ...Z, [k]: 1 }), true, k);
});

test('approval helpers: context validation, feature key normalization, reason cleaned', () => {
  assert.deepEqual(OE.parseApprovalContext(undefined), { present: false });
  assert.equal(OE.parseApprovalContext({ orderId: 'abc' }).ok, false);
  assert.equal(OE.parseApprovalContext([]).ok, false);
  assert.equal(OE.parseApprovalContext({ orderId: 5, reason: 7 }).ok, false);
  assert.deepEqual(OE.parseApprovalContext({ orderId: '501', reason: '  שחרור נעילה\n' }), { present: true, ok: true, orderId: 501, reason: 'שחרור נעילה' });
  assert.equal(OE.approvalFeatureKey('מאשר הזמנה ללא תשלום'), 'feature:debt_approval');
  assert.equal(OE.approvalFeatureKey('feature:locked_order_edit'), 'feature:locked_order_edit');
  assert.equal(OE.approvalFeatureKey(undefined), 'unspecified');
});

test('catalog: feature:manual_charge_add is an enforced approver item, closed by default, head management always', () => {
  const item = getCatalogItem('feature:manual_charge_add');
  assert.ok(item);
  assert.equal(item.approver, true);
  assert.equal(item.enforced, true);
  assert.equal(item.type, 'boolean');
  for (const roleId of [1, 3, 4, 5, 6, 7]) assert.equal(item.defaultForRoleId(roleId), false, 'roleId ' + roleId);
  assert.ok(getApproverKeys().includes('feature:manual_charge_add'));
});

// ============================================================================ POST /api/orders/events
test('events: 401 without login (require_login on), nothing written', async () => {
  const r = await postEvent({ orderId: 501, action: 'ORDER_PRINTED', meta: { doc: 'order' } });
  assert.equal(r.status, 401);
  assert.equal(r.__json.code, 'UNAUTHORIZED');
  assert.equal(audit().length, 0);
});

test('events: 403 for a department without page:orders/rentals/board, nothing written', async () => {
  globalThis.__AUTH_TOKEN = 'emp-blocked';
  const r = await postEvent({ orderId: 501, action: 'ORDER_PRINTED', meta: { doc: 'order' } });
  assert.equal(r.status, 403);
  assert.equal(r.__json.code, 'FORBIDDEN');
  assert.equal(audit().length, 0);
});

test('events H22: ORDER_PRINTED row shape - actor from the cookie, not from the body; meta whitelisted', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const r = await postEvent({ orderId: 501, action: 'ORDER_PRINTED', meta: { doc: 'order', source: 'print-page' }, employeeId: 'emp-head', actorId: 'emp-head' });
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  assert.deepEqual(r.__json, { ok: true, action: 'ORDER_PRINTED', orderIds: [501], written: 1, duplicate: false });
  assert.equal(audit().length, 1);
  const row = audit()[0];
  assert.equal(row.entityType, 'Order');
  assert.equal(row.entityId, '501');
  assert.equal(row.action, 'ORDER_PRINTED');
  assert.equal(row.employeeId, 'emp-worker');
  assert.deepEqual(JSON.parse(row.changesJson), { source: 'print-page', batch: false, doc: 'order' });
  assert.ok(!('createdAt' in globalThis.__MOCK_CALLS.find((c) => c.method === 'createMany').args.data[0]), 'time comes from the DB default');
});

test('events H22 batch: one row per order, a deleted order still counts; 404 lists missing orders and writes nothing', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const ok = await postEvent({ orderIds: [501, 502], action: 'ORDER_PRINTED', meta: { doc: 'order', batch: true, count: 2, source: 'print-page' } });
  assert.equal(ok.status, 200);
  assert.deepEqual(audit().map((r) => r.entityId), ['501', '502']);
  const miss = await postEvent({ orderIds: [501, 999999], action: 'ORDER_PRINTED', meta: { doc: 'order' } });
  assert.equal(miss.status, 404);
  assert.equal(miss.__json.code, 'ORDER_NOT_FOUND');
  assert.deepEqual(miss.__json.missing, [999999]);
  assert.equal(audit().length, 2);
  const big = await postEvent({ orderIds: Array.from({ length: 200 }, (_, i) => 1000 + i), action: 'ORDER_PRINTED', meta: { doc: 'order', batch: true, count: 200 } });
  assert.equal(big.status, 200);
  assert.equal(big.__json.written, 200);
  const tooBig = await postEvent({ orderIds: [...Array.from({ length: 200 }, (_, i) => 1000 + i), 501], action: 'ORDER_PRINTED', meta: { doc: 'order' } });
  assert.equal(tooBig.status, 400);
  assert.equal(tooBig.__json.code, 'TOO_MANY_ORDERS');
});

test('events H24-H26: PDF download / Excel export / history export rows', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const cases = [
    ['ORDER_PDF_DOWNLOADED', { doc: 'order', fileName: 'הזמנה 501.pdf' }, { doc: 'order', fileName: 'הזמנה 501.pdf' }],
    ['ORDER_XLSX_EXPORTED', { fileName: 'הזמנה 501.xlsx' }, { fileName: 'הזמנה 501.xlsx' }],
    ['HISTORY_EXPORTED', { format: 'pdf', rows: 37 }, { format: 'pdf', rows: 37 }],
    ['HISTORY_EXPORTED', { format: 'print' }, { format: 'print' }],
  ];
  for (const [action, meta, stored] of cases) {
    const r = await postEvent({ orderId: 501, action, meta });
    assert.equal(r.status, 200, action);
    const row = audit().at(-1);
    assert.equal(row.action, action);
    assert.deepEqual(JSON.parse(row.changesJson), stored);
    assert.equal(row.employeeId, 'emp-worker');
  }
});

test('events H23: schedule print docs (PP-07/PP-12) - page:schedule may log them, but not an order print', async () => {
  globalThis.__AUTH_TOKEN = 'emp-sched';
  const prep = await postEvent({ orderId: 501, action: 'ORDER_PRINTED', meta: { doc: 'prep', sheet: 'PP-07', source: 'print-page' } });
  assert.equal(prep.status, 200, JSON.stringify(prep.__json));
  assert.deepEqual(JSON.parse(audit()[0].changesJson), { source: 'print-page', batch: false, doc: 'prep', sheet: 'PP-07' });
  const order = await postEvent({ orderId: 501, action: 'ORDER_PRINTED', meta: { doc: 'order' } });
  assert.equal(order.status, 403);
  const xlsx = await postEvent({ orderId: 501, action: 'ORDER_XLSX_EXPORTED', meta: {} });
  assert.equal(xlsx.status, 403);
  assert.equal(audit().length, 1);
});

test('events: MANAGER_APPROVAL / EMAIL_SENT from a client are rejected (400), even for head management', async () => {
  globalThis.__AUTH_TOKEN = 'emp-head';
  for (const action of ['MANAGER_APPROVAL', 'EMAIL_SENT', 'EMAIL_FAILED']) {
    const r = await postEvent({ orderId: 501, action, meta: { featureKey: 'feature:debt_approval', approverId: 'emp-head' } });
    assert.equal(r.status, 400, action);
    assert.equal(r.__json.code, 'SERVER_ONLY_ACTION');
  }
  assert.equal(audit().length, 0);
});

test('events: bad JSON / bad meta / unknown action -> 400, nothing written', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const badJson = await eventsRoute.POST({ json: async () => { throw new SyntaxError('x'); } });
  assert.equal(badJson.status, 400);
  assert.equal((await postEvent({ orderId: 501, action: 'ORDER_PRINTED', meta: { doc: 'nope' } })).__json.code, 'BAD_META');
  assert.equal((await postEvent({ orderId: 501, action: 'TAB_SWITCHED' })).__json.code, 'UNKNOWN_ACTION');
  assert.equal(audit().length, 0);
});

test('events: clientEventId makes a repeat idempotent (same id -> 200 duplicate, no second row; new id -> new row)', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const body = { orderIds: [501, 502], action: 'ORDER_PRINTED', meta: { doc: 'order', batch: true, count: 2 }, clientEventId: 'print-abcdef-0' };
  const a = await postEvent(body);
  const b = await postEvent(body);
  assert.equal(a.__json.duplicate, false);
  assert.equal(b.status, 200);
  assert.deepEqual(b.__json, { ok: true, action: 'ORDER_PRINTED', orderIds: [501, 502], written: 0, duplicate: true });
  assert.equal(audit().length, 2);
  assert.equal(JSON.parse(audit()[0].changesJson).clientEventId, 'print-abcdef-0');
  const c = await postEvent({ ...body, clientEventId: 'print-abcdef-1' });
  assert.equal(c.__json.written, 2);
  // the same id on another action is not a duplicate
  const d = await postEvent({ orderId: 501, action: 'ORDER_XLSX_EXPORTED', meta: {}, clientEventId: 'print-abcdef-0' });
  assert.equal(d.__json.written, 1);
  // without an id every call is a new row
  await postEvent({ orderId: 501, action: 'ORDER_PRINTED', meta: { doc: 'order' } });
  await postEvent({ orderId: 501, action: 'ORDER_PRINTED', meta: { doc: 'order' } });
  assert.equal(audit().filter((r) => r.action === 'ORDER_PRINTED' && r.entityId === '501').length, 4);
});

test('events: a DB failure is a 500 with a code, not a crash', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  globalThis.__FAIL_AUDIT = true;
  const r = await postEvent({ orderId: 501, action: 'ORDER_PRINTED', meta: { doc: 'order' } });
  assert.equal(r.status, 500);
  assert.equal(r.__json.code, 'SERVER_ERROR');
});

test('events: open mode (require_login off) - anonymous may log, actor null (same rule as the print page)', async () => {
  installDb([]);
  globalThis.__MOCK_DB.systemSetting = globalThis.__MOCK_DB.systemSetting.filter((s) => s.key !== 'require_login');
  invalidateSettingsCache(); invalidateRequireLoginCache();
  const r = await postEvent({ orderId: 501, action: 'ORDER_PRINTED', meta: { doc: 'order' } });
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  assert.equal(audit()[0].employeeId, null);
});

// ======================================================================== POST /api/auth/verify-pin
const pinReq = (body) => verifyPin.POST(req(body));

test('verify-pin WITHOUT context: legacy response shape unchanged, nothing logged (old card / wizard)', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const r = await pinReq({ pin: PIN, requiredLevel: 'feature:item_change_approval', employeeId: 'emp-mgr' });
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  assert.deepEqual(r.__json, { success: true, employeeId: 'emp-mgr', employeeName: 'מנהלת סניף' });
  assert.equal(audit().length, 0);
});

test('verify-pin H19-H21: context -> one MANAGER_APPROVAL row (actor = session, approver = code owner), PIN never stored', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const r = await pinReq({ pin: PIN, requiredLevel: 'feature:item_change_approval', employeeId: 'emp-mgr', context: { orderId: 501, reason: 'מחיקת פריט שנשמר' } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.__json, { success: true, employeeId: 'emp-mgr', employeeName: 'מנהלת סניף', approvalLogged: true });
  assert.equal(audit().length, 1);
  const row = audit()[0];
  assert.equal(row.action, 'MANAGER_APPROVAL');
  assert.equal(row.entityType, 'Order');
  assert.equal(row.entityId, '501');
  assert.equal(row.employeeId, 'emp-worker');
  assert.deepEqual(JSON.parse(row.changesJson), { featureKey: 'feature:item_change_approval', level: 'feature:item_change_approval', reason: 'מחיקת פריט שנשמר', approverId: 'emp-mgr' });
  noPinAnywhere();
});

test('verify-pin: approver found by code only (no employeeId) + Hebrew tier -> normalized feature key', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const r = await pinReq({ pin: PIN, requiredLevel: 'מנהל', context: { orderId: 501, reason: 'שחרור נעילה' } });
  assert.equal(r.status, 200);
  assert.equal(JSON.parse(audit()[0].changesJson).approverId, 'emp-mgr');
  assert.equal(JSON.parse(audit()[0].changesJson).featureKey, 'מנהל');
  installDb();
  invalidatePermissionCache();
  globalThis.__MOCK_DB.departmentPermission.push({ roleId: 1, key: 'feature:debt_approval', value: 'true' });
  const d = await pinReq({ pin: PIN, requiredLevel: 'מאשר הזמנה ללא תשלום', employeeId: 'emp-mgr', context: { orderId: 501, reason: 'הזמנה ללא תשלום ₪200' } });
  assert.equal(d.status, 200, JSON.stringify(d.__json));
  assert.equal(JSON.parse(audit()[0].changesJson).featureKey, 'feature:debt_approval');
  noPinAnywhere();
});

test('verify-pin: failed approvals are NOT logged (OQ-2): wrong code 401, no permission 403', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const wrong = await pinReq({ pin: '000000', requiredLevel: 'feature:item_change_approval', employeeId: 'emp-mgr', context: { orderId: 501 } });
  assert.equal(wrong.status, 401);
  const denied = await pinReq({ pin: PIN, requiredLevel: 'feature:locked_order_edit', employeeId: 'emp-mgr', context: { orderId: 501 } });
  assert.equal(denied.status, 403, 'closed by default for roleId 1 without a permission row');
  assert.equal(audit().length, 0);
});

test('verify-pin: invalid context -> 400 before the code is checked; unknown order -> approval valid, approvalLogged:false', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const bad = await pinReq({ pin: PIN, requiredLevel: 'feature:item_change_approval', context: { orderId: 'x' } });
  assert.equal(bad.status, 400);
  assert.ok(!globalThis.__MOCK_CALLS.some((c) => c.model === 'employee' && c.method === 'findMany'), 'pin not checked');
  const ghost = await pinReq({ pin: PIN, requiredLevel: 'feature:item_change_approval', employeeId: 'emp-mgr', context: { orderId: 424242 } });
  assert.equal(ghost.status, 200);
  assert.equal(ghost.__json.approvalLogged, false);
  assert.equal(audit().length, 0);
  globalThis.__FAIL_AUDIT = true;
  const down = await pinReq({ pin: PIN, requiredLevel: 'feature:item_change_approval', employeeId: 'emp-mgr', context: { orderId: 501 } });
  assert.equal(down.status, 200, 'a logging failure never turns a valid approval into a failure');
  assert.equal(down.__json.approvalLogged, false);
});

test('verify-pin: still 401 when not logged in (with or without context)', async () => {
  const r = await pinReq({ pin: PIN, requiredLevel: 'מנהל', context: { orderId: 501 } });
  assert.equal(r.status, 401);
  assert.equal(audit().length, 0);
});

test('verify-pin: manual charge approvals go through the new catalog key (H16 approval step)', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const closed = await pinReq({ pin: PIN, requiredLevel: 'feature:manual_charge_add', employeeId: 'emp-mgr', context: { orderId: 501, reason: 'חיוב ידני ₪50' } });
  assert.equal(closed.status, 403, 'closed by default');
  globalThis.__MOCK_DB.departmentPermission.push({ roleId: 1, key: 'feature:manual_charge_add', value: 'true' });
  invalidatePermissionCache();
  const open = await pinReq({ pin: PIN, requiredLevel: 'feature:manual_charge_add', employeeId: 'emp-mgr', context: { orderId: 501, reason: 'חיוב ידני ₪50' } });
  assert.equal(open.status, 200);
  assert.equal(JSON.parse(audit()[0].changesJson).featureKey, 'feature:manual_charge_add');
});

// =================================================================== POST /api/orders/[id]/email (H27)
function stubMailer(result) {
  const sent = [];
  globalThis.fetch = async (url, init) => { sent.push({ url, body: JSON.parse(init.body) }); return { text: async () => JSON.stringify(result) }; };
  return sent;
}
const emailReq = (body) => emailRoute.POST(req(body), { params: Promise.resolve({ id: '501' }) });

test('email H27: EMAIL_SENT with sender (session), self-approval, attachment kinds+names; EmailLog has employeeId', async () => {
  globalThis.__AUTH_TOKEN = 'emp-head'; // head management holds feature:customer_email_approval
  const sent = stubMailer({ status: 'success' });
  const r = await emailReq({ email: 'sara@example.com', type: 'order', pdfBase64: 'JVBERi0x', extraAttachments: [{ fileName: 'תקנון.pdf', fileContent: 'QUJD', kind: 'regulations' }, { fileName: 'x.png', fileContent: 'QUJD', kind: 'evil' }, { fileName: 'no-content.pdf' }] });
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  assert.equal(sent.length, 1);
  const row = audit().find((a) => a.action === 'EMAIL_SENT');
  assert.ok(row);
  assert.equal(row.entityId, '501');
  assert.equal(row.employeeId, 'emp-head');
  const meta = JSON.parse(row.changesJson);
  assert.equal(meta.to, 'sara@example.com');
  assert.equal(meta.approverId, 'emp-head');
  assert.equal(meta.selfApproved, true);
  assert.deepEqual(meta.attachments, [{ kind: 'order-pdf', name: 'הזמנה 501.pdf' }, { kind: 'regulations', name: 'תקנון.pdf' }, { kind: 'file', name: 'x.png' }]);
  assert.equal(meta.attachmentCount, 3);
  assert.ok(!JSON.stringify(meta).includes('JVBERi0x') && !JSON.stringify(meta).includes('QUJD'), 'no file bytes in the row');
  assert.equal(globalThis.__MOCK_DB.emailLog[0].employeeId, 'emp-head');
});

test('email H27: approved by another employee\'s code -> approverId = that employee, PIN never stored', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  globalThis.__MOCK_DB.departmentPermission.push({ roleId: 1, key: 'feature:customer_email_approval', value: 'true' });
  stubMailer({ status: 'success' });
  const r = await emailReq({ email: 'sara@example.com', type: 'rental', pdfBase64: 'JVBERi0x', emailApproverId: 'emp-mgr', emailApproverPin: PIN });
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  const row = audit().find((a) => a.action === 'EMAIL_SENT');
  assert.equal(row.employeeId, 'emp-worker');
  const meta = JSON.parse(row.changesJson);
  assert.equal(meta.approverId, 'emp-mgr');
  assert.equal(meta.selfApproved, false);
  assert.deepEqual(meta.attachments, [{ kind: 'rental-pdf', name: 'הזמנה 501.pdf' }]);
  noPinAnywhere();
});

test('email H27: send failure -> EMAIL_FAILED row (with actor, error) and the existing 500 answer', async () => {
  globalThis.__AUTH_TOKEN = 'emp-head';
  stubMailer({ status: 'error', message: 'quota 4580123412341234' });
  const r = await emailReq({ email: 'sara@example.com', type: 'order', pdfBase64: 'JVBERi0x' });
  assert.equal(r.status, 500);
  assert.equal(audit().filter((a) => a.action === 'EMAIL_SENT').length, 0);
  const row = audit().find((a) => a.action === 'EMAIL_FAILED');
  assert.ok(row);
  assert.equal(row.employeeId, 'emp-head');
  assert.equal(JSON.parse(row.changesJson).error, 'quota [מוסתר]');
});

test('email: no approval -> 403 approval_required, nothing sent, nothing logged (unchanged)', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const sent = stubMailer({ status: 'success' });
  const r = await emailReq({ email: 'sara@example.com', type: 'order' });
  assert.equal(r.status, 403);
  assert.equal(sent.length, 0);
  assert.equal(audit().length, 0);
});

// ================================================== PUT /api/orders/[id] + print page + visit log (static)
test('PUT /api/orders/[id] (static): STOCK_SHORTAGE / CONFLICT codes on the SAME 409s, a5-only manual-charge gate', () => {
  const s = src('app/api/orders/[id]/route.js');
  const stock = s.slice(s.indexOf('code: STOCK_SHORTAGE_CODE'), s.indexOf('code: STOCK_SHORTAGE_CODE') + 400);
  assert.match(stock, /validationErrors: validationResult\.errors\s*\}, \{ status: 409 \}/);
  const conflict = s.slice(s.indexOf('code: CONFLICT_CODE'), s.indexOf('code: CONFLICT_CODE') + 400);
  assert.match(conflict, /error: 'Data Collision'[\s\S]*\{ status: 409 \}/);
  assert.equal((s.match(/status: 409/g) || []).length, 2, 'no new 409');
  assert.match(s, /if \(data\.cardVariant === A5_CARD_VARIANT\) \{\s*const manualCharges = detectManualChargeChanges\(data\.obligations, storedObligations\);/);
  assert.match(s, /hasPermission\(sessionEmployee, MANUAL_CHARGE_PERMISSION\)\)\)\s*\|\| \(await verifyManagerPin\(data\.manualChargeApproverId, data\.manualChargeApproverPin, MANUAL_CHARGE_PERMISSION\)\)/);
  assert.match(s, /code: MANUAL_CHARGE_APPROVAL_REQUIRED_CODE[\s\S]{0,200}status: 403/);
  assert.match(s, /select: \{ id: true, isDeleted: true, isManual: true, amount: true, description: true \}/);
  assert.match(s, /if \(hasManualChargeChange\(manualCharges\)\) \{/);
  // the gate runs BEFORE the transaction (no reads inside $transaction)
  assert.ok(s.indexOf('detectManualChargeChanges(data.obligations') < s.indexOf('prisma.$transaction(async (tx)'));
  // the signature-only PUT (legacy + new card) still skips the id checks when the new card tags its body
  assert.match(s, /SIGNATURE_ONLY_KEYS = new Set\(\['hasSignedRegulations', 'updatedAt', 'overwriteConflict', 'cardVariant'\]\)/);
  // AMB-19: the order row is written through auditAs('UPDATE_ORDER', ..., diffOrderUpdate(existingOrder, data))
  assert.match(s, /tx\.order\.update\(auditAs\('UPDATE_ORDER', \{\s*where: \{ orderId: parsedOrderId \},\s*data: orderUpdateData\s*\}, diffOrderUpdate\(existingOrder, orderUpdateData\)\)\)/);
  assert.ok(!/auditLog\.create\(\{[\s\S]{0,80}UPDATE_ORDER/.test(s), 'no manual AuditLog for the model write');
});

test('print page (static): logs ORDER_PRINTED once per load via the events route; never for downloadPdf=1 / headless', () => {
  const s = src('app/print/order/page.js');
  assert.match(s, /import \{ printPageEventBodies \} from '..\/..\/..\/lib\/history\/orderEvents'/);
  assert.match(s, /fetch\('\/api\/orders\/events'/);
  assert.match(s, /if \(isPdfRender \|\| headless\) return undefined;/);
  assert.ok(s.indexOf('if (isPdfRender || headless) return undefined;') < s.indexOf('window.print()'), 'no print dialog for a PDF render');
  assert.match(s, /if \(!printLoggedRef\.current\) \{\s*printLoggedRef\.current = true;/);
  assert.match(s, /const isPdfRender = \['1', 'true'\]\.includes\(searchParams\.get\('downloadPdf'\)\);/);
});

test('single manual AuditLog site: only the helper (+ the two pre-existing documented sites) write AuditLog by hand', () => {
  const helper = src('app/lib/auditLog.js');
  assert.match(helper, /eslint-disable-next-line no-restricted-syntax -- an order event with no model write/);
  assert.match(helper, /prisma\.auditLog\.createMany\(\{ data \}\)/);
  for (const f of ['app/api/orders/events/route.js', 'app/api/auth/verify-pin/route.js', 'app/api/orders/[id]/email/route.js']) {
    assert.ok(!/auditLog\.(create|createMany)\(/.test(src(f)), f + ' writes through writeOrderEvents only');
    assert.match(src(f), /writeOrderEvents\(/, f);
  }
  assert.ok(!/\$transaction/.test(src('app/api/orders/events/route.js')));
});

test('PageVisitLog redaction (risk #5): verify-pin / login bodies dropped, pin-like keys masked, layout copy in sync', () => {
  assert.equal(redactRequestQuery(JSON.stringify({ pin: PIN, requiredLevel: 'מנהל', context: { orderId: 501 } }), '/api/auth/verify-pin'), null);
  assert.equal(redactRequestQuery(JSON.stringify({ username: 'a', password: 'b' }), '/api/login'), null);
  const put = JSON.parse(redactRequestQuery(JSON.stringify({ notes: 'x', managerPin: PIN, manualChargeApproverPin: PIN, orderDateApproverPin: PIN, emailApproverPin: PIN, cardVariant: 'a5', manualChargeApproverId: 'emp-mgr' }), '/api/orders/501'));
  assert.equal(put.notes, 'x');
  for (const k of ['managerPin', 'manualChargeApproverPin', 'orderDateApproverPin', 'emailApproverPin']) assert.equal(put[k], '[מוסתר]', k);
  assert.equal(put.manualChargeApproverId, 'emp-mgr');
  assert.equal(put.cardVariant, 'a5');
  assert.equal(redactUrl('/api/x?pin=1234&orderId=5'), '/api/x?pin=%5B%D7%9E%D7%95%D7%A1%D7%AA%D7%A8%5D&orderId=5');
  // events bodies are kept (nothing secret, useful for support)
  const ev = redactRequestQuery(JSON.stringify({ orderId: 501, action: 'ORDER_PRINTED', meta: { doc: 'order' }, clientEventId: 'abcdefgh-0' }), '/api/orders/events');
  assert.deepEqual(JSON.parse(ev).meta, { doc: 'order' });
  const layout = src('app/layout.js');
  const serverRe = src('lib/redactSensitive.js').match(/const AUTH_ENDPOINT_RE = (\/.*\/i);/)[1];
  // the interceptor lives inside a template literal (__html: `...`), where "\/" renders as "/" and turns the regex
  // into a "//" line comment - so the SOURCE must carry doubled backslashes for the RENDERED script to match.
  assert.ok(layout.includes('var AUTH_EP = ' + serverRe.replace(/\\/g, '\\\\') + ';'), 'client interceptor uses the same endpoint list (escaped for the template literal)');
  assert.match(layout, /if \(requestQuery\) requestQuery = sanitizeRequestQuery\(requestQuery, endpoint\);/);
  assert.match(src('app/api/log-visit/route.js'), /redactRequestQuery\(String\(e\.requestQuery\)\.slice\(0, 4000\), e\.pageUrl\)/);
});

test('customer feed: ORDER_PRINTED mapped (no raw action text), UPDATE_ORDER treated like UPDATE, approvals stay out', () => {
  assert.ok(CH.ORDER_AUDIT_ACTIONS.includes('ORDER_PRINTED'));
  assert.ok(CH.ORDER_AUDIT_ACTIONS.includes('UPDATE_ORDER'));
  assert.ok(!CH.ORDER_AUDIT_ACTIONS.includes('MANAGER_APPROVAL'));
  assert.deepEqual(CH.ORDER_UPDATE_ACTIONS, ['UPDATE', 'UPDATE_ORDER']);
  const ctx = { orderByKey: new Map(), employeeNames: new Map() };
  const [p] = CH.mapOrderAuditRow({ id: 'r1', entityId: '501', action: 'ORDER_PRINTED', employeeId: null, createdAt: new Date('2026-10-04T08:00:00Z'), changesJson: '{"doc":"rental","batch":true}' }, ctx);
  assert.equal(p.title, 'הודפס דף השכרה #501');
  assert.equal(p.category, 'docs');
  assert.ok(!/ORDER_PRINTED|פעולה:/.test(JSON.stringify(p)));
  const [u] = CH.mapOrderAuditRow({ id: 'r2', entityId: '501', action: 'UPDATE_ORDER', employeeId: null, createdAt: new Date('2026-10-04T08:00:00Z'), changesJson: '{"notes":{"from":"a","to":"b"}}' }, ctx);
  assert.equal(u.type, 'order-updated');
});

// ============================== follow-up: no raw UUIDs / machine values in the legacy history chips
const CD = await L('components/modern/changesDisplay.js');
const { attachEmployeeNames } = await L('app/lib/auditLog.js');
const { isMutationSkipped } = await L('lib/apiCache.js');
const UUID = '3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c';

test('changesDisplay: UUID-valued keys, approverId and clientEventId are hidden; ordinary keys stay', () => {
  assert.equal(CD.isVisibleChangeKey('approverId', 'emp-mgr'), false);
  assert.equal(CD.isVisibleChangeKey('clientEventId', 'p1abc-0'), false);
  assert.equal(CD.isVisibleChangeKey('employeeId', UUID), false);
  assert.equal(CD.isVisibleChangeKey('customerId', { from: UUID, to: UUID }), false, 'unchanged reference');
  assert.equal(CD.isVisibleChangeKey('debtApprovedBy', UUID.toUpperCase()), false);
  for (const [k, v] of [['notes', 'x'], ['approverName', 'מנהלת סניף'], ['doc', 'order'], ['eventDate', { from: '2026-01-01T00:00:00Z', to: '2026-02-01T00:00:00Z' }], ['amount', 50], ['orderId', 501]]) {
    assert.equal(CD.isVisibleChangeKey(k, v), true, k);
  }
});

test('changesDisplay: machine values -> Hebrew labels, attachments -> names, unknown -> null (caller formats as before)', () => {
  assert.equal(CD.labelChangeValue('doc', 'order'), 'סיכום הזמנה');
  assert.equal(CD.labelChangeValue('doc', 'rental'), 'דף השכרה');
  assert.equal(CD.labelChangeValue('format', 'xlsx'), 'Excel');
  assert.equal(CD.labelChangeValue('source', 'print-page'), 'דף ההדפסה');
  assert.equal(CD.labelChangeValue('sendMode', 'both'), 'מייל ודרייב');
  assert.equal(CD.labelChangeValue('type', 'rental'), 'השכרה');
  assert.equal(CD.labelChangeValue('type', 'Customer'), null, 'other entities keep their `type` values');
  assert.equal(CD.labelChangeValue('featureKey', 'feature:manual_charge_add'), 'מאשר חיוב ידני');
  assert.equal(CD.labelChangeValue('level', 'מנהל'), null);
  assert.equal(CD.labelChangeValue('attachments', [{ kind: 'order-pdf', name: 'הזמנה 501.pdf' }, { kind: 'file', name: 'x.png' }]), 'הזמנה 501.pdf, x.png');
  assert.equal(CD.labelChangeValue('files', [{ fileName: 'a.pdf', sizeBytes: 3 }]), 'a.pdf');
  assert.equal(CD.labelChangeValue('notes', 'order'), null);
  assert.equal(CD.labelChangeValue('doc', null), null);
  // every value the events route can store for doc/format/source has a label
  for (const [k, spec] of Object.entries(OE.EVENT_META_SCHEMAS.ORDER_PRINTED)) if (spec.type === 'enum' && CD.VALUE_LABELS[k]) for (const v of spec.values) assert.ok(CD.labelChangeValue(k, v), `${k}=${v}`);
  for (const v of OE.EVENT_META_SCHEMAS.HISTORY_EXPORTED.format.values) assert.ok(CD.labelChangeValue('format', v));
});

test('ChangesChips + HistoryViewer (static): every key passes the filter and every value the label map first', () => {
  for (const f of ['components/modern/ChangesChips.js', 'components/HistoryViewer.js']) {
    const s = src(f);
    assert.match(s, /if \(!isVisibleChangeKey\(key, change\)\) return false;/, f);
    assert.match(s, /const show = \(key, val\) => labelChangeValue\(key, val\) \?\? formatValue\(val\);/, f);
    assert.ok(!/\{formatValue\(change(\.from|\.to)?\)\}/.test(s), f + ': no unlabelled value rendering left');
  }
  assert.match(src('components/HistoryViewer.js'), /approverName: 'מאשר'/);
});

test('attachEmployeeNames: approverId resolved to approverName in the same query; other rows untouched', async () => {
  const rows = [
    { id: 'a', entityType: 'Order', entityId: '501', action: 'MANAGER_APPROVAL', employeeId: 'emp-worker', changesJson: JSON.stringify({ featureKey: 'feature:item_change_approval', approverId: 'emp-mgr' }) },
    { id: 'b', entityType: 'Order', entityId: '501', action: 'EMAIL_SENT', employeeId: null, changesJson: JSON.stringify({ to: 'a@b.c', approverId: 'gone-emp' }) },
    { id: 'c', entityType: 'Order', entityId: '501', action: 'UPDATE_ORDER', employeeId: 'emp-head', changesJson: '{"notes":{"from":"a","to":"b"}}' },
    { id: 'd', entityType: 'Order', entityId: '501', action: 'ORDER_PRINTED', employeeId: null, changesJson: 'not json "approverId"' },
  ];
  globalThis.__MOCK_CALLS = [];
  const out = await attachEmployeeNames(rows);
  assert.equal(globalThis.__MOCK_CALLS.filter((c) => c.model === 'employee').length, 1, 'one batched query');
  assert.equal(JSON.parse(out[0].changesJson).approverName, 'מנהלת סניף');
  assert.equal(JSON.parse(out[0].changesJson).approverId, 'emp-mgr', 'the id stays for the history mapper (hidden in the UI)');
  assert.equal(out[0].employeeName, 'עובדת רגילה');
  assert.equal(JSON.parse(out[1].changesJson).approverName, 'עובד שנמחק');
  assert.equal(out[1].employeeName, null);
  assert.equal(out[2].changesJson, rows[2].changesJson);
  assert.equal(out[2].employeeName, 'הנהלה ראשית');
  assert.equal(out[3].changesJson, rows[3].changesJson);
});

test('lib/apiCache: POST /api/orders/events does not clear order/inventory caches; real order writes still do', () => {
  assert.equal(isMutationSkipped('/api/orders/events'), true);
  assert.equal(isMutationSkipped('/api/orders/501'), false);
  assert.equal(isMutationSkipped('/api/orders/501/items'), false);
  assert.equal(isMutationSkipped('/api/orders'), false);
});

// ======================================================== reviewer round: rendered script, tiers, race, etc.
const vm = await import('node:vm');

// The interceptor is the FIRST `__html: \`...\`` template literal in app/layout.js. Evaluate it exactly the way
// JavaScript does at render time (escape processing included) to get what the browser receives.
function renderedInterceptorScript() {
  const layout = src('app/layout.js');
  const start = layout.indexOf('__html: `') + '__html: `'.length;
  const end = layout.indexOf('\n`', start);
  const raw = layout.slice(start, end + 1);
  assert.ok(!raw.includes('${'), 'the interceptor template has no interpolations');
  return new Function('return `' + raw + '`;')();
}

test('layout interceptor (RENDERED script): AUTH_EP regex is real code identical to the server list, script parses', () => {
  const html = renderedInterceptorScript();
  const serverRe = src('lib/redactSensitive.js').match(/const AUTH_ENDPOINT_RE = (\/.*\/i);/)[1];
  assert.ok(html.includes('var AUTH_EP = ' + serverRe + ';'), 'the browser receives the same regex literal as lib/redactSensitive.js');
  assert.ok(!/var AUTH_EP = \/\//.test(html), 'not collapsed into a // comment');
  assert.doesNotThrow(() => new vm.Script(html), 'rendered script is valid JavaScript');
});

test('layout interceptor (RENDERED script, executed): sanitize drops auth bodies, masks pins, keeps ordinary bodies', () => {
  const html = renderedInterceptorScript();
  const from = html.indexOf('var AUTH_EP');
  const to = html.indexOf('window.__queueVisitLog');
  const sanitize = new Function(html.slice(from, to) + '\nreturn sanitizeRequestQuery;')();
  assert.equal(sanitize(JSON.stringify({ pin: PIN, requiredLevel: 'מנהל' }), '/api/auth/verify-pin'), '');
  assert.equal(sanitize(JSON.stringify({ username: 'a', password: 'b' }), '/api/login'), '');
  assert.equal(sanitize('{"pin":"1"}', '/api/attendance'), '');
  const put = JSON.parse(sanitize(JSON.stringify({ notes: 'x', managerPin: PIN, manualChargeApproverPin: PIN, items: [{ id: 'i1', approverPin: PIN }] }), '/api/orders/501'));
  assert.deepEqual(put, { notes: 'x', managerPin: '[מוסתר]', manualChargeApproverPin: '[מוסתר]', items: [{ id: 'i1', approverPin: '[מוסתר]' }] });
  assert.equal(sanitize('?pin=1234&orderId=5', '/api/x'), '?pin=%5B%D7%9E%D7%95%D7%A1%D7%AA%D7%A8%5D&orderId=5');
  assert.equal(sanitize('?orderId=5', '/api/x'), '?orderId=5');
  assert.equal(sanitize(JSON.stringify({ orderId: 501, action: 'ORDER_PRINTED' }), '/api/orders/events'), JSON.stringify({ orderId: 501, action: 'ORDER_PRINTED' }));
  assert.equal(sanitize('{"pin": "12', '/api/x'), '', 'unparseable JSON is dropped');
});

test('layout interceptor (RENDERED script, whole IIFE in a sandbox): every /api call is still queued, auth bodies empty', async () => {
  const html = renderedInterceptorScript();
  const queued = [];
  const fakeFetch = async () => ({ headers: { get: (h) => (h === 'content-length' ? '12' : null) }, json: async () => ({}), text: async () => '' });
  const win = {
    location: { origin: 'http://localhost', pathname: '/orders/501' },
    addEventListener() {}, dispatchEvent() {}, fetch: fakeFetch,
  };
  const ctx = vm.createContext({
    window: win, document: { addEventListener() {}, visibilityState: 'visible' }, navigator: {},
    performance: { now: () => 0 }, URL, URLSearchParams, Blob, JSON, Date, Math, Array, Object, String,
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
    setTimeout: () => 0, clearTimeout() {},
  });
  vm.runInContext(html, ctx);
  assert.equal(win.__apiInterceptorInstalled, true);
  assert.equal(typeof win.__queueVisitLog, 'function');
  win.__queueVisitLog = (e) => { queued.push(e); };
  await win.fetch('/api/auth/verify-pin', { method: 'POST', body: JSON.stringify({ pin: PIN, requiredLevel: 'מנהל', context: { orderId: 501 } }) });
  await win.fetch('/api/orders/501', { method: 'PUT', body: JSON.stringify({ notes: 'n', managerPin: PIN }) });
  await win.fetch('/api/orders/501?light=0');
  assert.equal(queued.length, 3, 'every /api call is logged (the regression made the whole script dead code)');
  assert.equal(queued[0].pageUrl, '/api/auth/verify-pin');
  assert.ok(!queued[0].requestQuery, 'no auth body');
  assert.equal(JSON.parse(queued[1].requestQuery).managerPin, '[מוסתר]');
  assert.ok(!JSON.stringify(queued).includes(PIN));
});

test('verify-pin + context: 400 for "עובד" / free strings / non-approver catalog keys, before the code is checked', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  for (const level of ['עובד', 'whatever', undefined, 'page:orders', 'feature:export_max_rows', 'feature:nope']) {
    globalThis.__MOCK_CALLS = [];
    const r = await pinReq({ pin: PIN, requiredLevel: level, employeeId: 'emp-mgr', context: { orderId: 501 } });
    assert.equal(r.status, 400, String(level));
    assert.ok(!globalThis.__MOCK_CALLS.some((c) => c.model === 'employee' && c.method === 'findMany'), 'pin not checked: ' + level);
  }
  assert.equal(audit().length, 0);
  // the same level WITHOUT context keeps the legacy behavior ('עובד' = any valid password)
  const legacy = await pinReq({ pin: PIN, requiredLevel: 'עובד', employeeId: 'emp-mgr' });
  assert.equal(legacy.status, 200);
  assert.deepEqual([...OE.MANAGER_APPROVAL_TIERS], ['מנהל', 'מתכנת', 'הנהלה ראשית', 'מנהל סניף ומעלה', 'מאשר הזמנה ללא תשלום']);
  for (const t of OE.MANAGER_APPROVAL_TIERS) assert.ok(src('app/api/auth/verify-pin/route.js').includes(`requiredLevel === '${t}'`), t + ' is a tier the route enforces');
});

test('events: clientEventId is race-safe - two concurrent identical posts write the batch once', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const body = { orderIds: [501, 502], action: 'ORDER_PRINTED', meta: { doc: 'order', batch: true, count: 2 }, clientEventId: 'race-12345678' };
  const [a, b] = await Promise.all([postEvent(body), postEvent(body)]);
  assert.equal(a.status, 200, JSON.stringify(a.__json)); assert.equal(b.status, 200, JSON.stringify(b.__json));
  assert.equal(audit().length, 2, 'one row per order, not two');
  assert.deepEqual([a.__json.duplicate, b.__json.duplicate].sort(), [false, true]);
  assert.deepEqual(audit().map((r) => r.id).sort(), ['oe:ORDER_PRINTED:501:race-12345678', 'oe:ORDER_PRINTED:502:race-12345678']);
  // without a clientEventId rows keep the default random key
  await postEvent({ orderId: 501, action: 'ORDER_PRINTED', meta: { doc: 'order' } });
  assert.ok(!audit().at(-1).id.startsWith('oe:'));
});

test('changesDisplay: a UUID foreign-key reassignment is shown as a placeholder, never hidden and never the ids', () => {
  const U2 = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  assert.equal(CD.isVisibleChangeKey('dressItemId', { from: UUID, to: U2 }), true);
  assert.deepEqual(CD.normalizeChange('dressItemId', { from: UUID, to: U2 }), { from: null, to: 'הוחלף' });
  assert.deepEqual(CD.normalizeChange('dressModelId', { from: null, to: U2 }), { from: null, to: 'נקבע' });
  assert.deepEqual(CD.normalizeChange('customerId', { from: UUID, to: null }), { from: null, to: 'הוסר' });
  assert.equal(CD.isVisibleChangeKey('customerId', { from: UUID, to: null }), true);
  assert.deepEqual(CD.normalizeChange('notes', { from: 'a', to: 'b' }), { from: 'a', to: 'b' });
  assert.equal(CD.isVisibleChangeKey('dressItemId', UUID), false, 'a plain UUID value (CREATE row) stays hidden');
  for (const f of ['components/modern/ChangesChips.js', 'components/HistoryViewer.js']) {
    assert.ok(src(f).includes('const change = normalizeChange(key, changes[key]);'), f);
  }
});

test('admin history filter "עדכון" also matches UPDATE_ORDER (GET /api/audit)', () => {
  assert.ok(src('app/api/audit/route.js').includes("where.action = action === 'UPDATE' ? { in: ['UPDATE', 'UPDATE_ORDER'] } : action;"));
});

// ===================================================================== POST /api/orders/[id]/items: max_items_per_order
const addItemReq = (id = '501') => itemsRoute.POST(req({ dressModelId: 'm1', sizeText: '38' }), { params: Promise.resolve({ id }) });
const withItems = (items) => { globalThis.__MOCK_DB.order.find((o) => o.orderId === 501).items = items; };
const LIMIT_MSG = /לא ניתן לשמור יותר מ-2 פריטים בהזמנה/;
test('POST items: max_items_per_order מלא (פריטים לא מחוקים) -> 400 ruleError, בלי כתיבה', async () => {
  installDb([{ key: 'max_items_per_order', value: '2' }]);
  invalidateSettingsCache();
  globalThis.__AUTH_TOKEN = 'emp-worker';
  withItems([{ id: 'i1', isDeleted: false, cartStatus: 'confirmed' }, { id: 'i2', isDeleted: false, cartStatus: 'pending' }, { id: 'i3', isDeleted: true, cartStatus: 'confirmed' }]);
  const errSpy = console.error; console.error = () => {};
  try {
    const r = await addItemReq();
    assert.equal(r.status, 400, JSON.stringify(r.__json));
    assert.match(r.__json.error, LIMIT_MSG);
    assert.ok(!globalThis.__MOCK_CALLS.some((c) => c.model === 'orderItem' && c.method === 'create'), 'לא נוצר פריט');
    // מעל המגבלה (נתונים ישנים) — גם נחסם
    withItems([{ id: 'i1', isDeleted: false }, { id: 'i2', isDeleted: false }, { id: 'i4', isDeleted: false }]);
    assert.equal((await addItemReq()).status, 400);
  } finally { console.error = errSpy; }
});
test('POST items: מתחת למגבלה / בלי מגבלה / 0 / לא מספר — הבדיקה לא חוסמת (ההמשך מגיע למלאי, לא להודעת המכסה)', async () => {
  const errSpy = console.error; console.error = () => {};
  try {
    for (const [value, items] of [['2', [{ id: 'i1', isDeleted: false }, { id: 'i2', isDeleted: true }]], [undefined, [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }]], ['0', [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }]], ['abc', [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }]]]) {
      installDb(value === undefined ? [] : [{ key: 'max_items_per_order', value }]);
      invalidateSettingsCache();
      globalThis.__AUTH_TOKEN = 'emp-worker';
      withItems(items);
      const r = await addItemReq();
      assert.doesNotMatch(String(r.__json?.error || ''), /יותר מ-\d+ פריטים/, `value=${value}`);
    }
  } finally { console.error = errSpy; }
});
