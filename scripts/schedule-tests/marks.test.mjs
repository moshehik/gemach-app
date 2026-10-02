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
  installDb({ ...opts, extra: { scheduleStageMark: [], dressItem: [], ...(opts.extra || {}) } });
  globalThis.__MOCK_WRITABLE = ['scheduleStageMark', 'orderItem', 'dressItem'];
  M.resetMarksTableState(); // a "missing table" seen earlier in the same test is memoised for 5 minutes
}
const d = (iso) => new Date(iso);
const bareItem = (over = {}) => ({ id: 'it-' + Math.random().toString(36).slice(2, 8), isTaken: true, takenDate: null, isReturned: false, returnDate: null, returnedOk: false, isDeleted: false, neckAlteration: 0, lengthAlteration: null, sleeveAlteration: 0, alterationDone: false, dressItem: null, dressItemId: null, ...over });
// an extra order that lands in stage 8 (manual return) on DAY: event Tue 29.9 -> due Thu 1.10
const manretOrder = (orderId, items) => ({ ...ORDERS.find((o) => o.orderId === 1013), orderId, customer: { firstName: 'בדיקה', lastName: String(orderId), phone1: '050', city: 'ירושלים', street: 'א', houseNum: 1 }, items });

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
  // the cap is enforced BEFORE the ids are mapped: a huge list of garbage fails on the cap, not on item validation
  assert.throws(() => M.validateMarkInput({ action: 'mark_all', stageKey: 'prep', dayKey: DAY, orderIds: Array.from({ length: 5000 }, () => 'abc') }, { today: DAY }), (e) => e.status === 400 && /עד 200/.test(e.message));
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
  // flipping to "בוצע" (ok) on a row that is already marked: refused (409 alreadyMarked) - a rewrite would orphan the
  // undo (markedAt moves) and lose the "not OK" (review 2.10, MUST-FIX 1). The way to change it: undo, then mark again.
  globalThis.__MOCK_CALLS = [];
  await assert.rejects(
    () => apply({ action: 'mark', stageKey: 'manret', dayKey: DAY, orderId: 1013, outcome: 'ok', source: 'row' }),
    (e) => e.status === 409 && e.extra && e.extra.alreadyMarked === true && /כבר סומן ע״י הנהלה ראשית/.test(e.message),
  );
  assert.equal(writes('orderItem').length + writes('scheduleStageMark').length, 0, 'nothing written');
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

test('late_not_done for stages without an existing field (4/5/9): only from the Israel day of the EARLIEST mark in the table (self-activating, no flood of old days)', async () => {
  // Thu 24.9.2026 viewed from 1.10: prep rows of that day (events Tue 29.9 -> 3 business days back over Sukkot)
  let res = await day('2026-09-24');
  const prepAbsent = stageOf(res, 'prep').items;
  assert.ok(prepAbsent.length > 0);
  assert.ok(prepAbsent.every((r) => r.done === null && !r.alerts.some((a) => a.code === 'late_not_done')), 'table absent: unknown, no late alert');
  const noLate = (r) => !r.alerts.some((a) => a.code === 'late_not_done');
  // empty table: nothing was ever marked -> no "late" on past days
  installWithTable();
  res = await day('2026-09-24');
  let prep = stageOf(res, 'prep').items;
  assert.ok(prep.every((r) => r.done === false && noLate(r)), 'empty table: not done, but no late alert');
  assert.equal(globalThis.__MOCK_CALLS.filter((c) => c.model === 'scheduleStageMark' && c.method === 'findFirst').length, 1, 'min(markedAt) asked once (past day only)');
  globalThis.__MOCK_CALLS = [];
  await day(DAY);
  assert.equal(globalThis.__MOCK_CALLS.filter((c) => c.model === 'scheduleStageMark' && c.method === 'findFirst').length, 0, 'today: no min(markedAt) query');
  // first mark ever on 28.9 (Israel) -> 24.9 is before that -> still no alerts
  const mk = (id, markedAt) => ({ id, orderId: 9999, stageKey: 'dout', dayKey: '2026-09-28', done: true, outcome: null, source: 'row', markedById: 'emp-head', markedAt: d(markedAt), undoneById: null, undoneAt: null });
  installWithTable({ extra: { scheduleStageMark: [mk('m1', '2026-09-27T21:30:00Z')] } }); // 00:30 Israel 28.9
  res = await day('2026-09-24');
  assert.ok(stageOf(res, 'prep').items.every(noLate), 'marks exist only from 28.9: the 24.9 is not flagged');
  // first mark on 20.9 -> 24.9 >= 20.9 -> late (7 days from 1.10)
  installWithTable({ extra: { scheduleStageMark: [mk('m2', '2026-09-20T10:00:00Z'), mk('m1', '2026-09-27T21:30:00Z')] } });
  res = await day('2026-09-24');
  prep = stageOf(res, 'prep').items;
  assert.ok(prep.every((r) => r.done === false && r.alerts.some((a) => a.code === 'late_not_done' && a.daysLate === 7)), 'from the first mark on: not marked on a past day = late');
  // the boundary day itself counts (>=), stages with an existing field are unaffected by the rule
  assert.equal(M.marksSinceKey(d('2026-09-20T10:00:00Z')), '2026-09-20');
  assert.equal(M.marksSinceKey(null), null);
  const A = await L('lib/schedule/alerts.js');
  const prepStage = STAGE_BY_KEY.prep;
  const base = { done: false, canMark: true };
  assert.equal(A.alertsForRow(base, prepStage, { dayKey: '2026-09-20', todayKey: DAY, lateReturnThresholdDays: 7, marksSinceKey: '2026-09-20' }).length, 1);
  assert.equal(A.alertsForRow(base, prepStage, { dayKey: '2026-09-19', todayKey: DAY, lateReturnThresholdDays: 7, marksSinceKey: '2026-09-20' }).length, 0);
  assert.equal(A.alertsForRow(base, prepStage, { dayKey: '2026-09-19', todayKey: DAY, lateReturnThresholdDays: 7, marksSinceKey: null }).length, 0);
  assert.equal(A.alertsForRow({ done: false }, STAGE_BY_KEY.pick, { dayKey: '2026-09-19', todayKey: DAY, lateReturnThresholdDays: 7, marksSinceKey: null }).length, 1, 'stage 6 (isTaken) keeps its late rule regardless');
  // marking clears it (patch == reload)
  const r = await apply({ action: 'mark', stageKey: 'prep', dayKey: '2026-09-24', orderId: prep[0].orderId, outcome: null, source: 'row' });
  assert.deepEqual(r.results[0].row.alerts, []);
  res = await day('2026-09-24');
  assert.deepEqual(rowOf(res, 'prep', prep[0].orderId).alerts, []);
  assert.equal(stageOf(res, 'prep').counts.alerts, prep.length - 1);
  // unmarking it again on that past day brings the alert back, in the patch and on reload
  const u = await apply({ action: 'unmark', stageKey: 'prep', dayKey: '2026-09-24', orderId: prep[0].orderId, outcome: null, source: 'row' });
  assert.equal(u.results[0].row.alerts[0].code, 'late_not_done');
  res = await day('2026-09-24');
  assert.equal(rowOf(res, 'prep', prep[0].orderId).alerts[0].code, 'late_not_done');
});

// ---- קליינט Prisma מיושן (המודל לא בקליינט) ---------------------------------------------------------

test('stale Prisma client (prisma.scheduleStageMark === undefined): day loads, POST 503, GET available:false, /api/audit 200 - no TypeError', async () => {
  installWithTable({ extra: { auditLog: [] } });
  globalThis.__MOCK_NO_MODEL = ['scheduleStageMark'];
  try {
    assert.equal(M.isMarksModelAvailable(), false);
    const warned = [];
    const orig = console.warn;
    console.warn = (...a) => warned.push(a.join(' '));
    let res;
    try { res = await day(); } finally { console.warn = orig; }
    assert.deepEqual(res.marks, { available: false, canMark: false, canMarkAll: false });
    assert.equal(rowOf(res, 'prep', 1005).done, null);
    assert.ok(warned.some((w) => /generated Prisma client/.test(w)));
    globalThis.__AUTH_TOKEN = 'emp-head';
    const p = await post({ action: 'mark', stageKey: 'prep', dayKey: DAY, orderId: 1005 });
    assert.equal(p.status, 503);
    M.resetMarksTableState();
    const g = await marksRoute.GET({ url: 'http://localhost/api/schedule/marks?orderId=1005' });
    assert.equal(g.status, 200);
    assert.deepEqual(g.__json, { available: false, marks: [] });
    M.resetMarksTableState();
    globalThis.__MOCK_DB.order = ORDERS.map((o) => ({ ...o, id: 'uuid-' + o.orderId }));
    const a = await auditRoute.GET({ url: 'http://localhost/api/audit?entityType=Order&entityId=1005' });
    assert.equal(a.status, 200, JSON.stringify(a.__json));
    assert.deepEqual(await M.listOrderMarkIds(1005), []);
  } finally {
    globalThis.__MOCK_NO_MODEL = null;
  }
});

// ---- ביטול = מה שטעינה מחדש תראה ---------------------------------------------------------------------

test('unmark on stage 9 (dback): the patch equals a reload - returnCondition back to the items (null), done false', async () => {
  installWithTable();
  await apply({ action: 'mark', stageKey: 'dback', dayKey: DAY, orderId: 1010, outcome: 'not_ok', source: 'row' });
  const u = await apply({ action: 'unmark', stageKey: 'dback', dayKey: DAY, orderId: 1010, outcome: null, source: 'row' });
  const patch = u.results[0].row;
  const res = await day();
  const row = rowOf(res, 'dback', 1010);
  for (const k of ['done', 'doneVia', 'doneBy', 'doneAt', 'outcome', 'returnCondition']) assert.deepEqual(patch[k], row[k], k);
  assert.equal(patch.returnCondition, null);
  assert.equal(patch.done, false);
  assert.equal('fact' in JSON.parse(JSON.stringify(row)), false, 'row.fact is internal, not in the JSON');
});

test('unmark on a fact-done row (stage 6, all items taken): the mark is undone but the row stays done via isTaken, with a note - equal to a reload', async () => {
  const order = ORDERS.find((o) => o.orderId === 1007);
  const was = order.items.map((it) => it.isTaken);
  order.items.forEach((it) => { it.isTaken = true; });
  try {
    installWithTable();
    await apply({ action: 'mark', stageKey: 'pick', dayKey: DAY, orderId: 1007, outcome: null, source: 'row' });
    const u = await apply({ action: 'unmark', stageKey: 'pick', dayKey: DAY, orderId: 1007, outcome: null, source: 'row' });
    const patch = u.results[0].row;
    assert.equal(u.results[0].status, 'unmarked');
    assert.equal(patch.done, true);
    assert.equal(patch.doneVia, 'isTaken');
    assert.match(patch.note, /נלקחו בהשכרה/);
    const row = rowOf(await day(), 'pick', 1007);
    for (const k of ['done', 'doneVia', 'doneBy', 'doneAt', 'outcome']) assert.deepEqual(patch[k], row[k], k);
    assert.equal(row.mark.done, false);
    assert.equal(writes('orderItem').length, 0, 'C2: isTaken is never touched from the schedule');
  } finally {
    order.items.forEach((it, i) => { it.isTaken = was[i]; });
  }
});

test('stage 8 unmark cancels ONLY the items the schedule itself returned (returnDate == markedAt); scan-returned items keep their state; DressItem.location follows /api/returns/scan', async () => {
  const byScan = bareItem({ id: 'it-scan', isReturned: true, returnedOk: true, returnDate: d('2026-09-30T10:00:00Z'), dressItemId: 'di-scan' });
  const pending = bareItem({ id: 'it-pend', dressItemId: 'di-pend' });
  const noDress = bareItem({ id: 'it-nodress' }); // before a barcode was assigned: no DressItem to move
  installWithTable({ extra: {
    order: [...ORDERS, manretOrder(3002, [byScan, pending, noDress]), manretOrder(3003, [bareItem({ id: 'it-s1', isReturned: true, returnedOk: true, returnDate: d('2026-09-30T10:00:00Z') })])],
    dressItem: [{ id: 'di-scan', location: 'חנות' }, { id: 'di-pend', location: 'מושכר' }],
  } });
  const di = (id) => globalThis.__MOCK_DB.dressItem.find((x) => x.id === id);
  // mark: only the two pending items are returned; their dresses move to the store
  const r = await apply({ action: 'mark', stageKey: 'manret', dayKey: DAY, orderId: 3002, outcome: 'ok', source: 'row' });
  assert.equal(r.results[0].status, 'marked');
  assert.deepEqual(writes('orderItem', 'update').map((c) => c.args.where.id).sort(), ['it-nodress', 'it-pend']);
  assert.deepEqual(writes('dressItem', 'update').map((c) => [c.args.where.id, c.args.data.location]), [['di-pend', 'חנות']]);
  assert.equal(di('di-pend').location, 'חנות');
  assert.equal(r.results[0].row.done, true);
  assert.equal(r.results[0].row.returnCondition, 'ok');
  let row = rowOf(await day(), 'manret', 3002);
  assert.equal(row.done, true); assert.equal(row.returnCondition, 'ok'); assert.equal(row.returnedCount, 3);
  // unmark: only it-pend / it-nodress (returnDate == markedAt) go back; it-scan stays returned; di-pend -> מושכר, di-scan untouched
  globalThis.__MOCK_CALLS = [];
  const u = await apply({ action: 'unmark', stageKey: 'manret', dayKey: DAY, orderId: 3002, outcome: null, source: 'row' });
  assert.deepEqual(writes('orderItem', 'update').map((c) => c.args.where.id).sort(), ['it-nodress', 'it-pend']);
  assert.ok(writes('orderItem', 'update').every((c) => c.audit.action === 'CANCEL_RETURN'));
  assert.deepEqual(writes('dressItem', 'update').map((c) => [c.args.where.id, c.args.data.location]), [['di-pend', 'מושכר']]);
  assert.equal(di('di-scan').location, 'חנות');
  assert.equal(byScan.isReturned, true, 'returned by scan earlier: untouched');
  assert.equal(pending.isReturned, false);
  const patch = u.results[0].row;
  assert.equal(patch.done, false);
  assert.equal(patch.returnCondition, null);
  row = rowOf(await day(), 'manret', 3002);
  for (const k of ['done', 'doneVia', 'doneBy', 'doneAt', 'outcome', 'returnCondition']) assert.deepEqual(patch[k], row[k], k);
  assert.equal(row.returnedCount, 1);
  // a row that is done only by facts (all returned by scan, no mark): unmark cancels nothing, the row stays done, note explains
  globalThis.__MOCK_CALLS = [];
  const f = await apply({ action: 'unmark', stageKey: 'manret', dayKey: DAY, orderId: 3003, outcome: null, source: 'row' });
  assert.equal(writes('orderItem').length, 0);
  assert.equal(writes('dressItem').length, 0);
  assert.equal(f.results[0].row.done, true);
  assert.equal(f.results[0].row.doneVia, 'isReturned');
  assert.equal(f.results[0].row.returnCondition, 'ok');
  assert.match(f.results[0].row.note, /הוחזרו בסריקה/);
  row = rowOf(await day(), 'manret', 3003);
  for (const k of ['done', 'doneVia', 'returnCondition']) assert.deepEqual(f.results[0].row[k], row[k], k);
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

test('stage 8 stale screen: A marks OK, B (old screen) marks "not OK" -> 409 with A\'s name, nothing changes, undo still cancels the return', async () => {
  installWithTable();
  const order = ORDERS.find((o) => o.orderId === 1013);
  const a = await apply({ action: 'mark', stageKey: 'manret', dayKey: DAY, orderId: 1013, outcome: 'ok', source: 'row' }, { user: worker });
  assert.equal(a.results[0].status, 'marked');
  assert.equal(order.items[0].returnedOk, true);
  globalThis.__MOCK_CALLS = [];
  await assert.rejects(
    () => apply({ action: 'mark', stageKey: 'manret', dayKey: DAY, orderId: 1013, outcome: 'not_ok', source: 'row' }, { user: head, now: new Date(NOW.getTime() + 60000) }),
    (e) => e.status === 409 && e.extra.alreadyMarked && e.extra.markedBy === 'עובדת רגילה' && e.message === 'כבר סומן ע״י עובדת רגילה - רעננו את הדף',
  );
  assert.equal(writes('orderItem').length + writes('scheduleStageMark').length, 0);
  // the route answers the same 409 with alreadyMarked in the body
  globalThis.__AUTH_TOKEN = 'emp-head';
  const r = await post({ action: 'mark', stageKey: 'manret', dayKey: DAY, orderId: 1013, outcome: 'not_ok', source: 'row' });
  assert.equal(r.status, 409);
  assert.equal(r.__json.alreadyMarked, true);
  // undo (by B, after a refresh) still finds the items the schedule returned (returnDate == markedAt)
  const u = await apply({ action: 'unmark', stageKey: 'manret', dayKey: DAY, orderId: 1013, outcome: null, source: 'row' });
  assert.equal(u.results[0].status, 'unmarked');
  assert.equal(writes('orderItem', 'update').filter((c) => c.audit.action === 'CANCEL_RETURN').length, 1);
  assert.equal(order.items[0].isReturned, false);
});

test('stage 8 stale screen, reverse order: A marks "not OK", B marks OK -> 409, the "not OK" is kept, undo works', async () => {
  installWithTable();
  const order = ORDERS.find((o) => o.orderId === 1013);
  await apply({ action: 'mark', stageKey: 'manret', dayKey: DAY, orderId: 1013, outcome: 'not_ok', source: 'row' }, { user: worker });
  assert.equal(order.items[0].returnedOk, false);
  await assert.rejects(
    () => apply({ action: 'mark', stageKey: 'manret', dayKey: DAY, orderId: 1013, outcome: 'ok', source: 'row' }, { user: head }),
    (e) => e.status === 409 && e.extra.alreadyMarked && e.extra.outcome === 'not_ok',
  );
  assert.equal(order.items[0].returnedOk, false, 'damage flag kept');
  const res = await day();
  assert.equal(rowOf(res, 'manret', 1013).returnCondition, 'not_ok');
  globalThis.__MOCK_CALLS = [];
  const u = await apply({ action: 'unmark', stageKey: 'manret', dayKey: DAY, orderId: 1013, outcome: null, source: 'row' });
  assert.equal(u.results[0].status, 'unmarked');
  assert.equal(order.items[0].isReturned, false);
});

test('writeMark: rewriting a done mark keeps its original markedAt / markedById (stage-8 undo stays linked)', async () => {
  installWithTable();
  const t1 = new Date('2026-10-01T08:00:00Z');
  const t2 = new Date('2026-10-01T09:00:00Z');
  const first = await M.writeMark({ orderId: 1013, stageKey: 'manret', dayKey: DAY, wanted: true, outcome: 'ok', source: 'row', userId: 'emp-worker', now: t1, stageLabel: 'x' });
  assert.equal(first.mark.markedAt.getTime(), t1.getTime());
  const second = await M.writeMark({ orderId: 1013, stageKey: 'manret', dayKey: DAY, wanted: true, outcome: 'not_ok', source: 'row', userId: 'emp-head', now: t2, stageLabel: 'x' });
  assert.equal(second.unchanged, false);
  assert.equal(new Date(second.mark.markedAt).getTime(), t1.getTime(), 'markedAt not moved');
  assert.equal(second.mark.markedById, 'emp-worker');
});

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

test('client: a patch for another day is ignored (the user switched days while the request was in flight)', () => {
  const data = { date: '2026-10-02', stages: [{ key: 'prep', infoOnly: false, items: [{ orderId: 1005, done: false, alerts: [] }] }] };
  assert.equal(H.applyRowPatches(data, 'prep', [{ orderId: 1005, done: true }], '2026-10-01'), data, 'other day: untouched');
  assert.equal(H.applyRowPatches(data, 'prep', [{ orderId: 1005, done: true }], '2026-10-02').stages[0].items[0].done, true);
  assert.equal(H.applyRowPatches(data, 'prep', [{ orderId: 1005, done: true }]).stages[0].items[0].done, true, 'no day given: applied');
});

test('client source: 409 alreadyMarked -> rollback + refresh of the day + a toast; ScheduleDay passes refresh', async () => {
  const fs = await import('node:fs');
  const hook = fs.readFileSync(process.env.PROJ + '/app/components/schedule/useStageMarks.js', 'utf8');
  assert.match(hook, /e\.status === 409 && e\.body && e\.body\.alreadyMarked/);
  assert.match(hook, /refresh\(\)/);
  const page = fs.readFileSync(process.env.PROJ + '/app/components/schedule/ScheduleDay.js', 'utf8');
  assert.match(page, /useStageMarks\(\{ data, setData, refresh: refreshDay \}\)/);
});

test('repair (stage 2) undo without a schedule mark: alterations marked on the alterations screen are NOT cleared - unchanged + note, nothing written', async () => {
  installWithTable();
  const order = ORDERS.find((o) => o.orderId === 1011);
  const saved = order.items.map((it) => it.alterationDone);
  for (const it of order.items) it.alterationDone = true; // the seamstress finished both on the alterations screen
  try {
    const res = await day();
    assert.equal(rowOf(res, 'repair', 1011).done, true, 'done via the existing field');
    globalThis.__MOCK_CALLS = [];
    const u = await apply({ action: 'unmark', stageKey: 'repair', dayKey: DAY, orderId: 1011, outcome: null, source: 'row' });
    assert.equal(u.results[0].status, 'unchanged');
    assert.equal(u.results[0].row.done, true);
    assert.match(u.results[0].row.note, /לא סומן מהלו״ז/);
    assert.equal(writes('orderItem').length + writes('scheduleStageMark').length, 0, 'nothing written');
    assert.ok(order.items.every((it) => it.alterationDone === true), 'alterations kept');
    // with a schedule mark, undo still reverts (the existing behaviour)
    for (const it of order.items) it.alterationDone = false;
    await apply({ action: 'mark', stageKey: 'repair', dayKey: DAY, orderId: 1011, outcome: null, source: 'row' });
    globalThis.__MOCK_CALLS = [];
    const u2 = await apply({ action: 'unmark', stageKey: 'repair', dayKey: DAY, orderId: 1011, outcome: null, source: 'row' });
    assert.equal(u2.results[0].status, 'unmarked');
    assert.ok(writes('orderItem', 'update').length > 0);
    // an UNDONE mark (marked then undone earlier) is not a schedule "done" either
    for (const it of order.items) it.alterationDone = true;
    globalThis.__MOCK_CALLS = [];
    const u3 = await apply({ action: 'unmark', stageKey: 'repair', dayKey: DAY, orderId: 1011, outcome: null, source: 'row' });
    assert.equal(u3.results[0].status, 'unchanged');
    assert.equal(writes('orderItem').length, 0);
  } finally {
    order.items.forEach((it, i) => { it.alterationDone = saved[i]; });
  }
});
