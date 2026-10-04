// W6 — GET /api/orders/[id]/history (מורחב) ו-GET /api/orders/[id]/journal (חדש) מול Prisma מדומה: lib/auth.js, lib/permissions.js,
// lib/settingsCache.js, app/lib/auditLog.js (attachEmployeeNames) ו-lib/schedule/marks.js האמיתיים; רק next/server, next/headers,
// @prisma/client ו-app/lib/prisma.js מוחלפים (shims של scripts/schedule-tests + עטיפה דקה ל-$queryRaw, כמו scripts/order-events.test.mjs).
// בודק: שער (401 / 403 page:orders / 404), שורות סימון הלו״ז בפיד, שם המאשר (ולא המזהה), החלפת לקוח בשמות, q / category / all=1,
// סינון שלא משנה את הספירות, היומן: שלבים, מי/מתי, משמרת, canMark (page:schedule + טבלה), טבלת סימונים חסרה, אפס UUID ואפס כתיבה.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const PROJ = process.env.PROJ;
const SHIMS = path.join(PROJ, 'scripts', 'schedule-tests', 'shims');
const fileUrl = (p) => pathToFileURL(p).href;
const baseShim = fileUrl(path.join(SHIMS, 'prisma.mjs'));
const prismaShim = 'data:text/javascript,' + encodeURIComponent(`
import base from ${JSON.stringify(baseShim)};
const extra = { async $queryRaw() { (globalThis.__MOCK_CALLS ||= []).push({ model: '$queryRaw', method: 'raw' }); return globalThis.__MOCK_DB.__itemsRaw || []; } };
const proxy = new Proxy({}, { get(_, p) { if (p === 'then') return undefined; return p in extra ? extra[p] : base[p]; } });
export default proxy;
export const prisma = proxy;
export function auditAs(action, args, changes) { return { ...args, __audit: { action, changes } }; }
export async function getActingEmployeeId() { return globalThis.__AUTH_TOKEN || null; }
`);
const prismaClientShim = 'data:text/javascript,' + encodeURIComponent('export const Prisma = { sql: (s, ...v) => ({ s, v }) }; export class PrismaClient {}');
const hooks = `
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const PROJ = ${JSON.stringify(PROJ)};
const NS = ${JSON.stringify(fileUrl(path.join(SHIMS, 'next-server.mjs')))};
const NH = ${JSON.stringify(fileUrl(path.join(SHIMS, 'next-headers.mjs')))};
async function tryResolve(spec, ctx, next) {
  try { return await next(spec, ctx); } catch (e) { for (const suf of ['.js', '/index.js', '.mjs']) { try { return await next(spec + suf, ctx); } catch {} } throw e; }
}
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/server') return { url: NS, shortCircuit: true };
  if (specifier === 'next/headers') return { url: NH, shortCircuit: true };
  if (specifier === '@prisma/client') return { url: ${JSON.stringify(prismaClientShim)}, shortCircuit: true };
  if (specifier.startsWith('@/')) specifier = pathToFileURL(path.join(PROJ, specifier.slice(2))).href;
  const r = await tryResolve(specifier, context, nextResolve);
  if (r.url.endsWith('/app/lib/prisma.js')) return { url: ${JSON.stringify(prismaShim)}, shortCircuit: true };
  return r;
}
`;
register('data:text/javascript,' + encodeURIComponent(hooks));

const { test, beforeEach } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const L = (rel) => import(fileUrl(path.join(PROJ, rel)));
const historyRoute = await L('app/api/orders/[id]/history/route.js');
const journalRoute = await L('app/api/orders/[id]/journal/route.js');
const { invalidatePermissionCache } = await L('lib/permissions.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { invalidateRequireLoginCache } = await L('lib/auth.js');
const { resetMarksTableState } = await L('lib/schedule/marks.js');

const ORDER_UUID = '0b6e7f1c-2a3d-4e5f-8a9b-0c1d2e3f4a5b';
const CUST_A = '99999999-9999-4999-8999-999999999999';
const CUST_B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MARK = '88888888-8888-4888-8888-888888888888';
const IL = (key, hhmm = '00:00') => { const [h, m] = hhmm.split(':').map(Number); const [y, mo, d] = key.split('-').map(Number); return new Date(Date.UTC(y, mo - 1, d, h - 3, m)); };
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function installDb() {
  const items = [{ id: 'it-1', orderId: 53375, sizeText: '38', description: 'שמלה', isDeleted: false, isTaken: false, takenDate: null, isReturned: false, returnDate: null, returnedOk: false, neckAlteration: 0, sleeveAlteration: 0, lengthAlteration: null, alterationDone: false }];
  globalThis.__MOCK_DB = {
    order: [{
      id: ORDER_UUID, orderId: 53375, orderDate: IL('2026-09-23', '10:12'), employeeId: 'emp-worker', customerId: CUST_B, isDeleted: false, deletedAt: null,
      eventDate: IL('2026-10-08'), fromDate: null, toDate: null, returnDate: null, isAbroad: false, isWeekdayEvent: false, isDelivery: false, deliveryDirection: null, deliveryOneDayBefore: false,
      items, payments: [{ id: 'pay-1', amount: 300, paymentDate: IL('2026-09-23', '10:18'), isDeleted: false, isRefund: false }],
    }],
    __itemsRaw: [{ id: 'it-1', sizeText: '38', description: 'שמלה', oi_prefix: 4512, isDeleted: false, isTaken: false, takenDate: null, isReturned: false, returnDate: null, returnedOk: false, di_prefix: null, dm_prefix: 4512, dm_name: 'רוז' }],
    payment: [{ id: 'pay-1', orderId: 53375, amount: 300, paymentMethod: 'מזומן', notes: null, paymentDate: IL('2026-09-23', '10:18'), isDeleted: false, isRefund: false }],
    refund: [], paymentObligation: [], emailLog: [], pageVisitLog: [],
    customer: [{ id: CUST_A, firstName: 'מרים', lastName: 'אברמוביץ' }, { id: CUST_B, firstName: 'רבקה', lastName: 'לוין' }],
    scheduleStageMark: [{ id: MARK, orderId: 53375, stageKey: 'prep', dayKey: '2026-10-05', done: true, outcome: null, source: 'row', markedById: 'emp-mgr', markedAt: IL('2026-10-05', '11:20'), undoneById: null, undoneAt: null }],
    shift: [
      { id: 's1', employeeId: 'emp-worker', entryTime: IL('2026-10-05', '08:00'), exitTime: IL('2026-10-05', '16:00'), isDeleted: false, employee: { firstName: 'עובדת', lastName: 'רגילה' } },
      { id: 's2', employeeId: 'emp-mgr', entryTime: IL('2026-10-05', '09:00'), exitTime: IL('2026-10-05', '13:00'), isDeleted: false, employee: { firstName: 'מנהלת', lastName: 'סניף' } },
    ],
    auditLog: [
      { id: 'a1', entityType: 'Order', entityId: ORDER_UUID, action: 'UPDATE_ORDER', changesJson: JSON.stringify({ customerId: { from: CUST_A, to: CUST_B } }), createdAt: IL('2026-09-24', '09:00'), employeeId: 'emp-worker' },
      { id: 'a2', entityType: 'Order', entityId: '53375', action: 'MANAGER_APPROVAL', changesJson: JSON.stringify({ featureKey: 'feature:locked_order_edit', level: 'feature:locked_order_edit', reason: 'נעולה', approverId: 'emp-mgr' }), createdAt: IL('2026-09-24', '09:05'), employeeId: 'emp-worker' },
      { id: 'a3', entityType: 'ScheduleStageMark', entityId: MARK, action: 'SCHEDULE_STAGE_DONE', changesJson: JSON.stringify({ orderId: 53375, scheduleStage: 'הכנה', scheduleDay: '2026-10-05', done: { from: null, to: true } }), createdAt: IL('2026-10-05', '11:20'), employeeId: 'emp-mgr' },
      { id: 'a4', entityType: 'Order', entityId: '53375', action: 'ORDER_PRINTED', changesJson: JSON.stringify({ doc: 'order', source: 'print-page', batch: false, clientEventId: 'abcdefgh-0' }), createdAt: IL('2026-09-24', '09:10'), employeeId: 'emp-worker' },
      { id: 'a5', entityType: 'Payment', entityId: 'pay-1', action: 'CREATE', changesJson: JSON.stringify({ amount: 300, paymentMethod: 'מזומן' }), createdAt: IL('2026-09-23', '10:18'), employeeId: 'emp-worker' },
      { id: 'a6', entityType: 'Order', entityId: '99999', action: 'ORDER_PRINTED', changesJson: '{"doc":"order"}', createdAt: IL('2026-09-24', '09:10'), employeeId: 'emp-worker' },
    ],
    employee: [
      { id: 'emp-worker', roleId: 5, isActive: true, firstName: 'עובדת', lastName: 'רגילה' },
      { id: 'emp-noorders', roleId: 6, isActive: true, firstName: 'בלי', lastName: 'הזמנות' },
      { id: 'emp-nosched', roleId: 7, isActive: true, firstName: 'בלי', lastName: 'לוז' },
      { id: 'emp-mgr', roleId: 1, isActive: true, firstName: 'מנהלת', lastName: 'סניף' },
    ],
    systemSetting: [{ key: 'require_login', value: 'true' }],
    departmentPermission: [
      { roleId: 5, key: 'page:orders', value: 'true' }, { roleId: 5, key: 'page:schedule', value: 'true' },
      { roleId: 6, key: 'page:orders', value: 'false' },
      { roleId: 7, key: 'page:orders', value: 'true' }, { roleId: 7, key: 'page:schedule', value: 'false' },
    ],
    employeePermissionOverride: [],
  };
  globalThis.__MOCK_CALLS = [];
  globalThis.__MOCK_WRITABLE = [];
}

beforeEach(() => {
  installDb();
  invalidateSettingsCache();
  invalidateRequireLoginCache();
  invalidatePermissionCache();
  resetMarksTableState();
  globalThis.__AUTH_TOKEN = null;
});

const getHistory = (id, qs = '') => historyRoute.GET({ url: `http://localhost/api/orders/${id}/history${qs}` }, { params: Promise.resolve({ id }) });
const getJournal = (id) => journalRoute.GET({ url: `http://localhost/api/orders/${id}/journal` }, { params: Promise.resolve({ id }) });
const noWrites = () => assert.deepEqual(globalThis.__MOCK_CALLS.filter((c) => /create|update|delete|upsert/i.test(String(c.method))), []);

test('history: 401 בלי התחברות, 403 בלי page:orders, 404 למזהה לא תקין / הזמנה שלא קיימת', async () => {
  assert.equal((await getHistory('53375')).status, 401);
  globalThis.__AUTH_TOKEN = 'emp-noorders';
  assert.equal((await getHistory('53375')).status, 403);
  globalThis.__AUTH_TOKEN = 'emp-worker';
  assert.equal((await getHistory('12abc')).status, 404);
  assert.equal((await getHistory('777')).status, 404);
  noWrites();
});

test('history ?all=1: סימון הלו״ז, אישור מנהל בשם המאשר, החלפת לקוח בשמות, הדפסה; אפס UUID ואפס unmapped; רק שורות ההזמנה', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const r = await getHistory('53375', '?all=1');
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  const b = r.__json;
  const texts = b.entries.map((e) => e.text);
  assert.ok(texts.includes("סומן 'בוצע' בלו״ז · הכנה"), texts.join(' | '));
  assert.ok(texts.includes('אישור מנהל: מנהלת סניף · עריכת הזמנה נעולה'));
  assert.ok(texts.includes('הוחלף לקוח'));
  assert.ok(texts.includes('הודפס סיכום הזמנה'));
  const swap = b.entries.find((e) => e.text === 'הוחלף לקוח');
  assert.deepEqual(swap.det, [['לפני', 'מרים אברמוביץ'], ['אחרי', 'רבקה לוין']]);
  assert.equal(b.entries.find((e) => e.text.startsWith("סומן 'בוצע'")).who, 'מנהלת סניף');
  assert.equal(texts.filter((t) => t === 'הודפס סיכום הזמנה').length, 1, 'another order\'s rows never leak in');
  assert.equal(b.unmappedCount, 0);
  assert.equal(b.total, b.entries.length);
  assert.equal(b.exportTruncated, false);
  assert.equal(b.nextCursor, null);
  assert.ok(!UUID_RE.test(JSON.stringify(b.entries.map((e) => ({ ...e, id: '' })))), 'no UUIDs in the answer');
  assert.ok(!/clientEventId|approverId/.test(JSON.stringify(b.entries)));
  noWrites();
});

test('history: q / category מסננים את הרשומות, הספירות נשארות של כל הפיד', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const all = (await getHistory('53375', '?all=1')).__json;
  const q = (await getHistory('53375', `?all=1&q=${encodeURIComponent('אישור מנהל')}`)).__json;
  assert.deepEqual(q.entries.map((e) => e.text), ['אישור מנהל: מנהלת סניף · עריכת הזמנה נעולה']);
  assert.equal(q.total, 1);
  assert.deepEqual(q.counts, all.counts);
  const docs = (await getHistory('53375', '?category=print')).__json;
  assert.ok(docs.entries.length >= 1 && docs.entries.every((e) => e.icon === 'print'));
  assert.equal((await getHistory('53375', '?category=bogus')).status, 400);
  const paged = (await getHistory('53375', '?limit=2')).__json;
  assert.equal(paged.entries.length, 2);
  assert.ok(paged.nextCursor);
});

test('history: טבלת הסימונים חסרה - הפיד עובד בלי שורות הלו״ז', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  delete globalThis.__MOCK_DB.scheduleStageMark;
  const r = await getHistory('53375', '?all=1');
  assert.equal(r.status, 200);
  assert.ok(!r.__json.entries.some((e) => e.text.includes('בלו״ז')));
});

test('journal: 401 / 403 / 404, ואז שלבים + יומן: הכנה בוצעה (סימון) ע״י מנהלת סניף, משמרת עם שמות ושעות, canMark', async () => {
  assert.equal((await getJournal('53375')).status, 401);
  globalThis.__AUTH_TOKEN = 'emp-noorders';
  assert.equal((await getJournal('53375')).status, 403);
  globalThis.__AUTH_TOKEN = 'emp-worker';
  assert.equal((await getJournal('x')).status, 404);
  const r = await getJournal(ORDER_UUID);
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  const b = r.__json;
  assert.deepEqual(b.stages.map((s) => s.key), ['order', 'prep', 'pick', 'event', 'manret']);
  const prep = b.stages.find((s) => s.key === 'prep');
  assert.equal(prep.done, true);
  assert.equal(prep.doneVia, 'mark');
  assert.deepEqual(Object.keys(prep.mark).sort(), ['dayKey', 'markedAt', 'markedBy', 'outcome']);
  assert.equal(prep.mark.markedBy, 'מנהלת סניף');
  assert.equal(b.canMark, true);
  assert.equal(b.marksAvailable, true);
  const n = Object.fromEntries(b.journal.map((x) => [x.key, x]));
  assert.equal(n.prep.who, 'מנהלת סניף');
  assert.equal(n.prep.when.time, '11:20');
  assert.equal(n.prep.shift.title, 'משמרת · 08:00–16:00');
  assert.deepEqual(n.prep.shift.names, ['עובדת רגילה', 'מנהלת סניף']);
  assert.equal(n.order.who, 'עובדת רגילה');
  assert.equal(n.pay.paidText, 'שולם ₪300');
  assert.equal(n.pay.who, 'עובדת רגילה');
  assert.ok(!UUID_RE.test(JSON.stringify(b)), 'no employee / order ids in the journal');
  assert.equal(globalThis.__MOCK_CALLS.filter((c) => c.model === 'shift').length, 1, 'one Shift query');
  noWrites();
});

test('journal: בלי page:schedule - אין לחצן סימון; טבלת סימונים חסרה - marksAvailable=false, עדיין 200', async () => {
  globalThis.__AUTH_TOKEN = 'emp-nosched';
  const a = (await getJournal('53375')).__json;
  assert.equal(a.canMark, false);
  assert.equal(a.stages.find((s) => s.key === 'prep').done, true, 'still shows the done state');
  globalThis.__AUTH_TOKEN = 'emp-worker';
  delete globalThis.__MOCK_DB.scheduleStageMark;
  resetMarksTableState();
  const r = await getJournal('53375');
  assert.equal(r.status, 200);
  assert.equal(r.__json.marksAvailable, false);
  assert.equal(r.__json.canMark, false);
  assert.equal(r.__json.stages.find((s) => s.key === 'prep').done, false);
});
