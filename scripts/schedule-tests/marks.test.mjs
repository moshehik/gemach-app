// סימון "בוצע" בלו״ז (lib/schedule/marks.js + POST/GET /api/schedule/marks + השילוב ב-getScheduleDay):
// הטבלה חסרה -> הכל ממשיך לעבוד בלי 500 והסימון מוסתר; הטבלה קיימת -> סימון / ביטול / "הכל בוצע" לפי
// ההחלטות (C1, C2, A4, JDG-04), אידמפוטנטיות, תפיסת P2002, הגנת החזרה מוקדמת, אימות בשרת שההזמנה בשלב/יום,
// AuditLog דרך auditAs בלבד (בלי כתיבה ידנית), והיסטוריית ההזמנה (/api/audit) רואה את הסימונים.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { installDb, NOW, DAY, SETTINGS_ORG2, ORDERS } from './fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const { getScheduleDay } = await L('lib/schedule/index.js');
const { resolveScheduleSettings } = await L('lib/schedule/settings.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { invalidateRequireLoginCache } = await L('lib/auth.js');
const { invalidatePermissionCache } = await L('lib/permissions.js');
const { getCatalogItem } = await L('lib/permissionsMetadata.js');
const M = await L('lib/schedule/marks.js');
const { STAGE_BY_KEY } = await L('lib/schedule/stages.js');
const marksRoute = await L('app/api/schedule/marks/route.js');
const auditRoute = await L('app/api/audit/route.js');
const H = await L('app/components/schedule/useStageMarks.js');

const settingsMap = (rows) => Object.fromEntries(rows.map((r) => [r.key, r.value]));
const SETTINGS = resolveScheduleSettings(settingsMap(SETTINGS_ORG2));
const stageOf = (res, key) => res.stages.find((s) => s.key === key);
const rowOf = (res, key, orderId) => stageOf(res, key).items.find((r) => r.orderId === orderId);
const WRITE_METHODS = ['create', 'update', 'updateMany', 'delete', 'createMany', 'upsert'];
const writes = (model, method) => globalThis.__MOCK_CALLS.filter((c) => c.model === model && (method ? c.method === method : WRITE_METHODS.includes(c.method)));

const head = { id: 'emp-head', roleId: 0 };
const worker = { id: 'emp-worker', roleId: 5 };

function installWithTable(opts = {}) {
  installDb({ ...opts, extra: { scheduleStageMark: [], ...(opts.extra || {}) } });
  globalThis.__MOCK_WRITABLE = ['scheduleStageMark', 'orderItem'];
}

beforeEach(() => {
  installDb();
  globalThis.__MOCK_WRITABLE = [];
  globalThis.__MOCK_BEFORE_WRITE = null;
  globalThis.__AUTH_TOKEN = null;
  invalidateSettingsCache();
  invalidateRequireLoginCache();
  invalidatePermissionCache();
  M.resetMarksTableState();
});

const day = (date = DAY, over = {}) => getScheduleDay({ date, user: head, now: NOW, settings: SETTINGS, ...over });
const apply = (input, over = {}) => M.applyStageMark(input, { user: head, settings: SETTINGS, now: NOW, ...over });
const post = (body) => marksRoute.POST({ url: 'http://localhost/api/schedule/marks', json: async () => body });

// ---- הטבלה חסרה: הכל ממשיך לעבוד -------------------------------------------------------------

test('table absent (P2021): the day loads without an error, marks hidden, no-source stages stay unknown, warning kept', async () => {
  const warned = [];
  const orig = console.warn;
  console.warn = (...a) => warned.push(a.join(' '));
  let res;
  try { res = await day(); } finally { console.warn = orig; }
  assert.deepEqual(res.marks, { available: false, canMark: false, canMarkAll: false });
  assert.equal(rowOf(res, 'prep', 1005).done, null, 'no mark table + no existing field => unknown, not "not done"');
  assert.equal(rowOf(res, 'prep', 1005).canMark, false);
  assert.equal(rowOf(res, 'pick', 1007).done, false, 'existing field (isTaken) still answers');
  assert.equal(stageOf(res, 'prep').counts.unknown, 2);
  assert.ok(res.warnings.some((w) => w.includes('שלב 4')));
  assert.ok(warned.some((w) => /ScheduleStageMark/.test(w)), 'one calm console.warn, not an exception');
  // memoised: the second load does not query the missing table again
  globalThis.__MOCK_CALLS = [];
  await day();
  assert.equal(writes('scheduleStageMark').length, 0);
  assert.equal(globalThis.__MOCK_CALLS.filter((c) => c.model === 'scheduleStageMark').length, 0);
});

test('table absent: POST -> 503 with unavailable:true (no 500), GET -> available:false', async () => {
  globalThis.__AUTH_TOKEN = 'emp-head';
  const r = await post({ action: 'mark', stageKey: 'prep', dayKey: DAY, orderId: 1005 });
  assert.equal(r.status, 503);
  assert.equal(r.__json.unavailable, true);
  const g = await marksRoute.GET({ url: 'http://localhost/api/schedule/marks?orderId=1005' });
  assert.equal(g.status, 200);
  assert.deepEqual(g.__json, { available: false, marks: [] });
});

test('a DB error that is NOT "missing table" is not swallowed', async () => {
  installDb({ extra: { scheduleStageMark: null } }); // table(model) -> rows null -> TypeError (any other failure)
  await assert.rejects(() => day(), /filter|null/);
});

// ---- הטבלה קיימת: קריאה -------------------------------------------------------------------------

test('table present: every markable row is false (not unknown), info stages untouched, canMark/canMarkAll by role', async () => {
  installWithTable();
  const res = await day();
  assert.deepEqual(res.marks, { available: true, canMark: true, canMarkAll: true }, 'head management: mark + mark-all');
  for (const key of ['prep', 'dout', 'dback', 'pick', 'repair', 'manret']) {
    for (const r of stageOf(res, key).items) {
      assert.notEqual(r.done, null, key + ' #' + r.orderId);
      assert.equal(r.canMark, true);
      assert.equal(typeof r.mark, 'object');
    }
  }
  for (const key of ['order', 'event']) for (const r of stageOf(res, key).items) assert.equal(r.done, null);
  assert.equal(stageOf(res, 'prep').counts.unknown, 0);
  assert.equal(stageOf(res, 'prep').counts.pending, 2);
  assert.equal(res.totals.unknown, 0);
  assert.equal(res.warnings.some((w) => w.includes('שלב 4')), false, 'no "no done field" warning once the table exists');
  // existing facts still count as done without any mark (C2: pick keeps isTaken; manret keeps isReturned)
  const r1014 = rowOf(res, 'manret', 1014);
  assert.equal(r1014.done, true);
  assert.equal(r1014.doneVia, 'isReturned');
  assert.equal(r1014.returnCondition, 'not_ok');
  // regular worker: can mark, no mark-all (JDG-04); guest (no user): neither
  const w = await day(DAY, { user: worker });
  assert.deepEqual(w.marks, { available: true, canMark: true, canMarkAll: false });
  const g = await day(DAY, { user: null });
  assert.deepEqual(g.marks, { available: true, canMark: false, canMarkAll: false });
  // branch manager (roleId 1) gets mark-all by catalog default
  const item = getCatalogItem('feature:schedule_mark_all_done');
  assert.ok(item && item.enforced && item.group === 'features');
  assert.equal(item.defaultForRoleId(1), true);
  assert.equal(item.defaultForRoleId(5), false);
  assert.equal(item.defaultForRoleId(0), true);
});

test('decorateRowWithMark: mark wins, then the existing fact, then false; undone mark + fact true stays done via the fact', () => {
  const marks = { available: true, names: new Map([['e1', 'רחלי לוי']]), byKey: new Map([
    ['prep:1', { done: true, outcome: null, markedById: 'e1', markedAt: NOW, undoneById: null, undoneAt: null }],
    ['pick:2', { done: false, outcome: null, markedById: 'e1', markedAt: NOW, undoneById: 'e1', undoneAt: NOW }],
    ['dback:3', { done: true, outcome: 'not_ok', markedById: null, markedAt: NOW }],
  ]) };
  const a = M.decorateRowWithMark({ orderId: 1, done: null }, STAGE_BY_KEY.prep, marks);
  assert.equal(a.done, true); assert.equal(a.doneVia, 'mark'); assert.equal(a.doneBy, 'רחלי לוי'); assert.equal(a.doneAt, NOW);
  const b = M.decorateRowWithMark({ orderId: 2, done: true }, STAGE_BY_KEY.pick, marks);
  assert.equal(b.done, true); assert.equal(b.doneVia, 'isTaken'); assert.equal(b.mark.undoneBy, 'רחלי לוי');
  const c = M.decorateRowWithMark({ orderId: 3, done: null, returnCondition: null }, STAGE_BY_KEY.dback, marks);
  assert.equal(c.done, true); assert.equal(c.returnCondition, 'not_ok', 'A4: stage 9 outcome comes from the mark when the items are not back yet');
  const d = M.decorateRowWithMark({ orderId: 4, done: null }, STAGE_BY_KEY.dout, marks);
  assert.equal(d.done, false); assert.equal(d.doneVia, null);
  const e = M.decorateRowWithMark({ orderId: 5, done: null }, STAGE_BY_KEY.prep, { available: false, byKey: new Map(), names: new Map() });
  assert.equal(e.done, null); assert.equal(e.canMark, false);
  const info = M.decorateRowWithMark({ orderId: 6, done: null }, STAGE_BY_KEY.order, marks);
  assert.equal(info.done, null, 'info stages are never decorated');
});

// ---- כתיבה: שלב 4 (סימון בלבד) ----------------------------------------------------------------

test('mark prep (stage 4): create via auditAs(SCHEDULE_STAGE_DONE), readable changes, patch + the day shows who/when; second mark is unchanged', async () => {
  installWithTable();
  const r = await apply({ action: 'mark', stageKey: 'prep', dayKey: DAY, orderId: 1005, outcome: null, source: 'row' });
  assert.equal(r.results.length, 1);
  assert.equal(r.results[0].status, 'marked');
  const patch = r.results[0].row;
  assert.equal(patch.done, true);
  assert.equal(patch.doneVia, 'mark');
  assert.equal(patch.doneBy, 'הנהלה ראשית');
  assert.equal(patch.doneAt, NOW);
  assert.deepEqual(patch.alerts, []);
  assert.equal(patch.mark.markedBy, 'הנהלה ראשית');
  const creates = writes('scheduleStageMark', 'create');
  assert.equal(creates.length, 1);
  assert.equal(creates[0].audit.action, 'SCHEDULE_STAGE_DONE');
  assert.deepEqual(creates[0].audit.changes, { orderId: 1005, scheduleStage: 'הכנה', scheduleDay: DAY, done: { from: null, to: true } });
  assert.equal(creates[0].args.data.markedById, 'emp-head');
  assert.equal(creates[0].args.data.outcome, null);
  assert.equal(writes('orderItem').length, 0, 'stage 4 touches no OrderItem');
  assert.equal(writes('auditLog').length, 0, 'no manual AuditLog writes - the Prisma extension does it');
  // the day now shows it
  const res = await day();
  const row = rowOf(res, 'prep', 1005);
  assert.equal(row.done, true);
  assert.equal(row.doneBy, 'הנהלה ראשית');
  assert.equal(row.doneAt, NOW);
  assert.equal(stageOf(res, 'prep').counts.done, 1);
  assert.equal(stageOf(res, 'prep').counts.pending, 1);
  // idempotent
  globalThis.__MOCK_CALLS = [];
  const again = await apply({ action: 'mark', stageKey: 'prep', dayKey: DAY, orderId: 1005, outcome: null, source: 'row' });
  assert.equal(again.results[0].status, 'unchanged');
  assert.equal(writes('scheduleStageMark', 'create').length + writes('scheduleStageMark', 'update').length, 0);
});

test('unmark prep: update via auditAs(SCHEDULE_STAGE_UNDONE), row kept with undoneBy/undoneAt, done=false (no existing field)', async () => {
  installWithTable();
  await apply({ action: 'mark', stageKey: 'prep', dayKey: DAY, orderId: 1005, outcome: null, source: 'row' });
  globalThis.__MOCK_CALLS = [];
  const r = await apply({ action: 'unmark', stageKey: 'prep', dayKey: DAY, orderId: 1005, outcome: null, source: 'row' });
  assert.equal(r.results[0].status, 'unmarked');
  assert.equal(r.results[0].row.done, false);
  assert.equal(r.results[0].row.doneBy, null);
  assert.equal(r.results[0].row.mark.undoneBy, 'הנהלה ראשית');
  const ups = writes('scheduleStageMark', 'update');
  assert.equal(ups.length, 1);
  assert.equal(ups[0].audit.action, 'SCHEDULE_STAGE_UNDONE');
  assert.deepEqual(ups[0].audit.changes.done, { from: true, to: false });
  assert.equal(globalThis.__MOCK_DB.scheduleStageMark.length, 1, 'undo keeps the row (history), it does not delete');
  assert.equal(globalThis.__MOCK_DB.scheduleStageMark[0].done, false);
  const res = await day();
  assert.equal(rowOf(res, 'prep', 1005).done, false);
  assert.equal(rowOf(res, 'prep', 1005).mark.undoneBy, 'הנהלה ראשית');
  // re-mark = update back to done (same row)
  await apply({ action: 'mark', stageKey: 'prep', dayKey: DAY, orderId: 1005, outcome: null, source: 'row' });
  assert.equal(globalThis.__MOCK_DB.scheduleStageMark.length, 1);
  assert.equal(globalThis.__MOCK_DB.scheduleStageMark[0].done, true);
});

test('server re-runs the classification: an order that is not in that stage on that day is refused (409), nothing written', async () => {
  installWithTable();
  await assert.rejects(() => apply({ action: 'mark', stageKey: 'prep', dayKey: DAY, orderId: 1013, outcome: null, source: 'row' }), (e) => e instanceof M.MarkError && e.status === 409 && e.extra.notInStage);
  await assert.rejects(() => apply({ action: 'mark', stageKey: 'prep', dayKey: '2026-10-07', orderId: 1005, outcome: null, source: 'row' }), (e) => e.status === 409, 'right order, wrong day');
  await assert.rejects(() => apply({ action: 'mark', stageKey: 'dout', dayKey: DAY, orderId: 1005, outcome: null, source: 'row' }), (e) => e.status === 409, 'not a delivery');
  assert.equal(writes('scheduleStageMark').length, 0);
  // disabled stage (org1: deliveries off) -> 409
  const org1 = resolveScheduleSettings({});
  await assert.rejects(() => apply({ action: 'mark', stageKey: 'dout', dayKey: DAY, orderId: 1009, outcome: null, source: 'row' }, { settings: org1 }), (e) => e.status === 409);
});

test('validateMarkInput: whitelist of stages/actions/outcomes, day format and range, order ids', () => {
  const ok = M.validateMarkInput({ action: 'mark', stageKey: 'prep', dayKey: DAY, orderId: '1005' }, { today: DAY });
  assert.deepEqual([ok.action, ok.stageKey, ok.dayKey, ok.orderId, ok.outcome, ok.source], ['mark', 'prep', DAY, 1005, null, 'row']);
  const bad = (body) => assert.throws(() => M.validateMarkInput(body, { today: DAY }), (e) => e instanceof M.MarkError && e.status === 400, JSON.stringify(body));
  bad({ action: 'mark', stageKey: 'order', dayKey: DAY, orderId: 1 });   // info stage
  bad({ action: 'mark', stageKey: 'event', dayKey: DAY, orderId: 1 });
  bad({ action: 'mark', stageKey: 'transfer', dayKey: DAY, orderId: 1 }); // stage 3 does not exist
  bad({ action: 'delete', stageKey: 'prep', dayKey: DAY, orderId: 1 });
  bad({ action: 'mark', stageKey: 'prep', dayKey: '2026-10-1', orderId: 1 });
  bad({ action: 'mark', stageKey: 'prep', dayKey: '9999-12-31', orderId: 1 });
  bad({ action: 'mark', stageKey: 'prep', dayKey: DAY, orderId: 'abc' });
  bad({ action: 'mark', stageKey: 'prep', dayKey: DAY, orderId: 0 });
  bad({ action: 'mark', stageKey: 'prep', dayKey: DAY, orderId: 1, outcome: 'ok' });      // outcome only for return stages
  bad({ action: 'mark', stageKey: 'manret', dayKey: DAY, orderId: 1, outcome: 'broken' });
  bad({ action: 'mark_all', stageKey: 'prep', dayKey: DAY, orderIds: 'x' });
  bad({ action: 'mark_all', stageKey: 'prep', dayKey: DAY, orderIds: Array.from({ length: 201 }, (_, i) => i + 1) });
  bad(null);
  const ret = M.validateMarkInput({ action: 'mark', stageKey: 'manret', dayKey: DAY, orderId: 7 }, { today: DAY });
  assert.equal(ret.outcome, 'ok', '"בוצע" on a return stage = returned OK (A4)');
  const un = M.validateMarkInput({ action: 'unmark', stageKey: 'manret', dayKey: DAY, orderId: 7 }, { today: DAY });
  assert.equal(un.outcome, null);
  const all = M.validateMarkInput({ action: 'mark_all', stageKey: 'dback', dayKey: DAY, orderIds: [3, '3', 4] }, { today: DAY });
  assert.deepEqual(all.orderIds, [3, 4]);
  assert.equal(all.source, 'all');
});

// ---- שלב 2 תיקונים: גם alterationDone ----------------------------------------------------------

test('repair (stage 2): mark sets alterationDone on the pending alteration items (ALTERATION_DONE), unmark clears all (ALTERATION_UNDONE)', async () => {
  installWithTable();
  const r = await apply({ action: 'mark', stageKey: 'repair', dayKey: DAY, orderId: 1011, outcome: null, source: 'row' });
  assert.equal(r.results[0].status, 'marked');
  const ups = writes('orderItem', 'update');
  assert.equal(ups.length, 1, 'only the item that was not done yet (the other was already alterationDone)');
  assert.equal(ups[0].audit.action, 'ALTERATION_DONE');
  assert.deepEqual(ups[0].args.data, { alterationDone: true });
  assert.deepEqual(ups[0].audit.changes.alterationDone, { from: false, to: true });
  assert.ok(r.results[0].row.items.every((it) => it.done === true));
  const order = ORDERS.find((o) => o.orderId === 1011);
  assert.ok(order.items.every((it) => it.alterationDone === true), 'mock DB updated in place');
  globalThis.__MOCK_CALLS = [];
  const u = await apply({ action: 'unmark', stageKey: 'repair', dayKey: DAY, orderId: 1011, outcome: null, source: 'row' });
  assert.equal(u.results[0].status, 'unmarked');
  assert.equal(u.results[0].row.done, false);
  const downs = writes('orderItem', 'update');
  assert.equal(downs.length, 2);
  assert.ok(downs.every((c) => c.audit.action === 'ALTERATION_UNDONE'));
  assert.ok(order.items.every((it) => it.alterationDone === false));
  for (const it of order.items) it.alterationDone = false; // leave the shared fixtures clean
  order.items[1].alterationDone = true;
});

// ---- שלב 8 החזרה ידנית: isReturned + תקין/לא תקין + הגנת החזרה מוקדמת ----------------------------

test('manret (stage 8): "בוצע" returns the taken items OK (RETURN_RENTAL), "הוחזר לא תקין" with returnedOk=false; unmark = CANCEL_RETURN', async () => {
  installWithTable();
  const r = await apply({ action: 'mark', stageKey: 'manret', dayKey: DAY, orderId: 1013, outcome: 'not_ok', source: 'row' });
  assert.equal(r.results[0].status, 'marked');
  const ups = writes('orderItem', 'update');
  assert.equal(ups.length, 1);
  assert.equal(ups[0].audit.action, 'RETURN_RENTAL');
  assert.deepEqual(ups[0].args.data, { isReturned: true, returnedOk: false, returnDate: NOW });
  assert.equal(r.results[0].row.returnCondition, 'not_ok');
  assert.equal(r.results[0].row.outcome, 'not_ok');
  assert.equal(writes('scheduleStageMark', 'create')[0].args.data.outcome, 'not_ok');
  const res = await day();
  const row = rowOf(res, 'manret', 1013);
  assert.equal(row.done, true);
  assert.equal(row.returnCondition, 'not_ok');
  assert.equal(row.returnedCount, 1);
  assert.equal(row.doneBy, 'הנהלה ראשית');
  // flipping to "בוצע" (ok) on an order whose items are already back: no item write, the mark outcome changes
  globalThis.__MOCK_CALLS = [];
  const flip = await apply({ action: 'mark', stageKey: 'manret', dayKey: DAY, orderId: 1013, outcome: 'ok', source: 'row' });
  assert.equal(flip.results[0].status, 'marked');
  assert.equal(writes('orderItem').length, 0, 'an item returned earlier keeps the condition set then');
  assert.equal(flip.results[0].row.returnCondition, 'not_ok', 'the row condition still reflects the items');
  assert.equal(writes('scheduleStageMark', 'update')[0].args.data.outcome, 'ok');
  // unmark = cancel the return of every returned item
  globalThis.__MOCK_CALLS = [];
  const u = await apply({ action: 'unmark', stageKey: 'manret', dayKey: DAY, orderId: 1013, outcome: null, source: 'row' });
  assert.equal(u.results[0].status, 'unmarked');
  const downs = writes('orderItem', 'update');
  assert.equal(downs.length, 1);
  assert.equal(downs[0].audit.action, 'CANCEL_RETURN');
  assert.deepEqual(downs[0].args.data, { isReturned: false, returnedOk: false, returnDate: null });
  assert.equal(u.results[0].row.done, false);
  assert.equal(u.results[0].row.returnCondition, null);
  const order = ORDERS.find((o) => o.orderId === 1013);
  assert.equal(order.items[0].isReturned, false);
});

test('manret: the early-return guard blocks (409, earlyReturn:true) when require_approval_for_early_return is on and the event is still ahead - nothing written', async () => {
  const D = await L('lib/schedule/dates.js');
  const realToday = D.todayKey(new Date());
  const eventKey = D.addCalendarDays(realToday, 400);
  const due = D.addBusinessDays(eventKey, 1, null);
  const future = { ...ORDERS[0], orderId: 3001, orderDate: new Date('2026-01-01T08:00:00Z'), eventDate: D.keyToLocalMidnight(eventKey), toDate: null, returnDate: null, isDelivery: false, deliveryDirection: null, customer: { firstName: 'עתיד', lastName: 'רחוק', phone1: '050', city: 'ירושלים', street: 'א', houseNum: 1 }, items: [{ id: 'it-future', isTaken: true, takenDate: null, isReturned: false, returnDate: null, returnedOk: false, isDeleted: false, neckAlteration: 0, lengthAlteration: null, sleeveAlteration: 0, alterationDone: false, dressItem: null }] };
  installWithTable({ settings: [...SETTINGS_ORG2, { key: 'require_approval_for_early_return', value: 'true' }], extra: { order: [...ORDERS, future] } });
  invalidateSettingsCache();
  const r = await apply({ action: 'mark', stageKey: 'manret', dayKey: due, orderId: 3001, outcome: 'ok', source: 'row' }, { now: new Date() });
  assert.equal(r.results[0].status, 'blocked');
  assert.equal(r.results[0].blocked.status, 409);
  assert.equal(r.results[0].blocked.__json.earlyReturn, true);
  assert.equal(writes('orderItem').length, 0);
  assert.equal(writes('scheduleStageMark').length, 0, 'no mark row when the return itself was refused');
  // the route passes the guard's response through as-is
  globalThis.__AUTH_TOKEN = 'emp-head';
  const resp = await post({ action: 'mark', stageKey: 'manret', dayKey: due, orderId: 3001 });
  assert.equal(resp.status, 409);
  assert.equal(resp.__json.earlyReturn, true);
  // mark_all skips it instead of failing the batch
  const all = await post({ action: 'mark_all', stageKey: 'manret', dayKey: due });
  assert.equal(all.status, 200);
  assert.deepEqual(all.__json.skipped, [{ orderId: 3001, reason: 'early_return' }]);
  assert.equal(all.__json.counts.blocked, 1);
});

// ---- שלב 6 / 9: סימון בלבד ---------------------------------------------------------------------

test('pick (stage 6, C2) and dback (stage 9, A4): mark-only - no OrderItem write; dback keeps the outcome on the mark', async () => {
  installWithTable();
  const p = await apply({ action: 'mark', stageKey: 'pick', dayKey: DAY, orderId: 1007, outcome: null, source: 'row' });
  assert.equal(p.results[0].status, 'marked');
  assert.equal(writes('orderItem').length, 0, 'isTaken stays with the rental/barcode flow');
  const order1007 = ORDERS.find((o) => o.orderId === 1007);
  assert.equal(order1007.items[1].isTaken, false);
  const d = await apply({ action: 'mark', stageKey: 'dback', dayKey: DAY, orderId: 1010, outcome: 'not_ok', source: 'row' });
  assert.equal(d.results[0].status, 'marked');
  assert.equal(d.results[0].row.returnCondition, 'not_ok');
  assert.equal(writes('orderItem').length, 0, 'the courier collected; the physical return is scanned later');
  const res = await day();
  assert.equal(rowOf(res, 'pick', 1007).done, true);
  assert.equal(rowOf(res, 'pick', 1007).doneVia, 'mark');
  assert.equal(rowOf(res, 'dback', 1010).returnCondition, 'not_ok');
  assert.equal(rowOf(res, 'dback', 1022).returnCondition, 'ok', 'items already back: the item condition wins');
  // unmark pick: the row is not done (items not all taken)
  const u = await apply({ action: 'unmark', stageKey: 'pick', dayKey: DAY, orderId: 1007, outcome: null, source: 'row' });
  assert.equal(u.results[0].row.done, false);
});

// ---- "הכל בוצע" -----------------------------------------------------------------------------------

test('mark_all prep: only pending rows, optional orderIds restrict to what the user saw, source=all, idempotent on repeat', async () => {
  installWithTable();
  const r = await apply({ action: 'mark_all', stageKey: 'prep', dayKey: DAY, orderId: null, orderIds: null, outcome: null, source: 'all' });
  assert.deepEqual(r.results.map((x) => [x.orderId, x.status]), [[1005, 'marked'], [1006, 'marked']]);
  assert.ok(writes('scheduleStageMark', 'create').every((c) => c.args.data.source === 'all'));
  globalThis.__MOCK_CALLS = [];
  const again = await apply({ action: 'mark_all', stageKey: 'prep', dayKey: DAY, orderId: null, orderIds: null, outcome: null, source: 'all' });
  assert.deepEqual(again.results, [], 'nothing pending => nothing to do');
  assert.equal(writes('scheduleStageMark').length, 0);
  // restricted list
  installWithTable();
  const only = await apply({ action: 'mark_all', stageKey: 'prep', dayKey: DAY, orderId: null, orderIds: [1006, 4242], outcome: null, source: 'all' });
  assert.deepEqual(only.results.map((x) => x.orderId), [1006]);
});

// ---- מרוץ בין שתי עובדות: P2002 -------------------------------------------------------------------

test('two people mark the same row at once: the second create hits P2002 and continues as an update of the first row - one row, no error', async () => {
  installWithTable();
  let injected = false;
  globalThis.__MOCK_BEFORE_WRITE = (model, method) => {
    if (model === 'scheduleStageMark' && method === 'create' && !injected) {
      injected = true;
      globalThis.__MOCK_DB.scheduleStageMark.push({ id: 'other', orderId: 1005, stageKey: 'prep', dayKey: DAY, done: true, outcome: null, source: 'row', markedById: 'emp-worker', markedAt: new Date('2026-10-01T05:59:00Z'), undoneById: null, undoneAt: null });
    }
  };
  const r = await apply({ action: 'mark', stageKey: 'prep', dayKey: DAY, orderId: 1005, outcome: null, source: 'row' });
  assert.equal(r.results[0].status, 'unchanged', 'the other person already marked it - same state, nothing overwritten');
  assert.equal(globalThis.__MOCK_DB.scheduleStageMark.length, 1);
  assert.equal(globalThis.__MOCK_DB.scheduleStageMark[0].markedById, 'emp-worker', 'the first writer is kept as the one who marked');
  // a competing UNDO instead: the create fails, the state differs -> update the existing row
  installWithTable();
  injected = false;
  globalThis.__MOCK_BEFORE_WRITE = (model, method) => {
    if (model === 'scheduleStageMark' && method === 'create' && !injected) {
      injected = true;
      globalThis.__MOCK_DB.scheduleStageMark.push({ id: 'other2', orderId: 1005, stageKey: 'prep', dayKey: DAY, done: false, outcome: null, source: 'row', markedById: null, markedAt: NOW, undoneById: 'emp-worker', undoneAt: NOW });
    }
  };
  const r2 = await apply({ action: 'mark', stageKey: 'prep', dayKey: DAY, orderId: 1005, outcome: null, source: 'row' });
  assert.equal(r2.results[0].status, 'marked');
  assert.equal(globalThis.__MOCK_DB.scheduleStageMark.length, 1);
  assert.equal(globalThis.__MOCK_DB.scheduleStageMark[0].done, true);
  assert.equal(writes('scheduleStageMark', 'update').length, 1);
});

// ---- התראות: סימון ביום שעבר מסיר "באיחור" ---------------------------------------------------------

test('late alerts follow the mark: marking a past-day return clears late_not_done in the patch, unmarking brings it back', async () => {
  installWithTable();
  const r = await apply({ action: 'mark', stageKey: 'manret', dayKey: '2026-09-24', orderId: 1017, outcome: 'ok', source: 'row' });
  assert.deepEqual(r.results[0].row.alerts, []);
  const u = await apply({ action: 'unmark', stageKey: 'manret', dayKey: '2026-09-24', orderId: 1017, outcome: null, source: 'row' });
  assert.equal(u.results[0].row.alerts[0].code, 'late_not_done');
  assert.equal(u.results[0].row.alerts[0].daysLate, 7);
  const order = ORDERS.find((o) => o.orderId === 1017);
  order.items[0].isReturned = false; order.items[0].returnDate = null; order.items[0].returnedOk = false;
});

// ---- הנתיב: שערים -----------------------------------------------------------------------------------

test('POST: 401 without login, 403 for a department closed from page:schedule, 200 for a regular worker, 403 on mark_all for a worker, 200 for head', async () => {
  installWithTable();
  let r = await post({ action: 'mark', stageKey: 'prep', dayKey: DAY, orderId: 1005 });
  assert.equal(r.status, 401);
  globalThis.__AUTH_TOKEN = 'emp-worker-blocked';
  r = await post({ action: 'mark', stageKey: 'prep', dayKey: DAY, orderId: 1005 });
  assert.equal(r.status, 403);
  globalThis.__AUTH_TOKEN = 'emp-worker';
  r = await post({ action: 'mark', stageKey: 'prep', dayKey: DAY, orderId: 1005 });
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  assert.equal(r.__json.status, 'marked');
  assert.equal(r.__json.row.doneBy, 'עובדת רגילה');
  assert.equal(r.headers['Cache-Control'], 'no-store');
  r = await post({ action: 'mark_all', stageKey: 'prep', dayKey: DAY });
  assert.equal(r.status, 403, 'JDG-04: a regular worker has no "הכל בוצע"');
  globalThis.__AUTH_TOKEN = 'emp-head';
  r = await post({ action: 'mark_all', stageKey: 'prep', dayKey: DAY });
  assert.equal(r.status, 200);
  assert.deepEqual(r.__json.counts, { marked: 1, unchanged: 0, blocked: 0 });
  assert.deepEqual(r.__json.rows.map((x) => x.orderId), [1006]);
  r = await post({ action: 'mark', stageKey: 'prep', dayKey: DAY, orderId: 1013 });
  assert.equal(r.status, 409);
  assert.equal(r.__json.notInStage, true);
  r = await post({ action: 'mark', stageKey: 'order', dayKey: DAY, orderId: 1001 });
  assert.equal(r.status, 400);
  r = await post(null);
  assert.equal(r.status, 400);
});

test('POST: open mode (require_login off) - an anonymous visitor can read the schedule but cannot mark (401)', async () => {
  installWithTable({ settings: [{ key: 'require_login', value: 'false' }] });
  invalidateSettingsCache();
  invalidateRequireLoginCache();
  const r = await post({ action: 'mark', stageKey: 'prep', dayKey: DAY, orderId: 1005 });
  assert.equal(r.status, 401);
  assert.equal(writes('scheduleStageMark').length, 0);
});

test('GET /api/schedule/marks?orderId=: the marks of one order with names (for the order card), 400 on a bad id', async () => {
  installWithTable();
  globalThis.__AUTH_TOKEN = 'emp-head';
  await post({ action: 'mark', stageKey: 'prep', dayKey: DAY, orderId: 1005 });
  const g = await marksRoute.GET({ url: 'http://localhost/api/schedule/marks?orderId=1005' });
  assert.equal(g.status, 200);
  assert.equal(g.__json.available, true);
  assert.equal(g.__json.marks.length, 1);
  const m = g.__json.marks[0];
  assert.equal(m.stageKey, 'prep'); assert.equal(m.stageNumber, 4); assert.equal(m.stageLabel, 'הכנה');
  assert.equal(m.dayKey, DAY); assert.equal(m.done, true); assert.equal(m.markedBy, 'הנהלה ראשית');
  assert.equal('markedById' in m, false, 'ids never reach the UI');
  const bad = await marksRoute.GET({ url: 'http://localhost/api/schedule/marks?orderId=x' });
  assert.equal(bad.status, 400);
});

// ---- היסטוריית ההזמנה (טאב "מידע") ------------------------------------------------------------------

test('/api/audit?entityType=Order&entityId=<orderId> also returns the ScheduleStageMark rows of that order; table absent -> plain Order history', async () => {
  installWithTable({ extra: { auditLog: [], scheduleStageMark: [{ id: 'mk-1', orderId: 1005, stageKey: 'prep', dayKey: DAY, done: true }] } });
  globalThis.__AUTH_TOKEN = 'emp-head';
  globalThis.__MOCK_DB.order = ORDERS.map((o) => ({ ...o, id: 'uuid-' + o.orderId }));
  const r = await auditRoute.GET({ url: 'http://localhost/api/audit?entityType=Order&entityId=1005' });
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  const q = globalThis.__MOCK_CALLS.find((c) => c.model === 'auditLog' && c.method === 'findMany');
  assert.deepEqual(q.args.where.OR, [
    { entityType: 'Order', entityId: { in: ['uuid-1005', '1005'] } },
    { entityType: 'ScheduleStageMark', entityId: { in: ['mk-1'] } },
  ]);
  assert.equal('entityType' in q.args.where, false);
  // no marks for this order -> the where is unchanged (no OR)
  globalThis.__MOCK_CALLS = [];
  await auditRoute.GET({ url: 'http://localhost/api/audit?entityType=Order&entityId=1006' });
  const q2 = globalThis.__MOCK_CALLS.find((c) => c.model === 'auditLog' && c.method === 'findMany');
  assert.equal(q2.args.where.entityType, 'Order');
  assert.equal('OR' in q2.args.where, false);
  // table absent -> the lookup fails quietly, the history still loads
  installDb({ extra: { auditLog: [] } });
  globalThis.__MOCK_DB.order = ORDERS.map((o) => ({ ...o, id: 'uuid-' + o.orderId }));
  const r3 = await auditRoute.GET({ url: 'http://localhost/api/audit?entityType=Order&entityId=1005' });
  assert.equal(r3.status, 200);
});

// ---- הלוגיקה בלקוח (useStageMarks.js): פונקציות טהורות --------------------------------------------

test('client: applyRowPatches merges a server patch into the right stage/row and recounts done/pending/alerts/totals', () => {
  const data = {
    stages: [
      { key: 'prep', infoOnly: false, items: [{ orderId: 1, done: false, alerts: [] }, { orderId: 2, done: false, alerts: [{ code: 'late_not_done' }] }], counts: {} },
      { key: 'order', infoOnly: true, items: [{ orderId: 3, done: null, alerts: [] }], counts: {} },
    ],
  };
  const next = H.applyRowPatches(data, 'prep', [{ orderId: 2, stage: 'prep', done: true, doneBy: 'x', alerts: [] }]);
  assert.notEqual(next, data);
  assert.equal(data.stages[0].items[1].done, false, 'immutable: the previous state is untouched (rollback keeps working)');
  assert.deepEqual(next.stages[0].items[1], { orderId: 2, done: true, doneBy: 'x', alerts: [] });
  assert.deepEqual(next.stages[0].counts, { total: 2, done: 1, pending: 1, unknown: 0, alerts: 0 });
  assert.deepEqual(next.stages[1].counts, { total: 1, done: 0, pending: 0, unknown: 0, alerts: 0 });
  assert.deepEqual(next.totals, { total: 2, done: 1, pending: 1, unknown: 0, alerts: 0 });
  assert.equal(H.applyRowPatches(null, 'prep', []), null);
});
