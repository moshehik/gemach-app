// ברקוד בלו״ז - הזרימות מול DB בזיכרון (shims/prisma.mjs): חסימת "בוצע" לפי המטריצה, מסירה (לקיחת פריטים + סימון), ביטול מסירה, "הכל בוצע",
// רישום / ביטול רישום ברקוד (כל מקרי הקצה ב-docs/schedule-barcode-plan.md ה'.2), מסירה אוטומטית, ועובדה-גוברת בשורות. ללא הגדרה = אין שינוי כלל.
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
const M = await L('lib/schedule/marks.js');
const S = await L('lib/schedule/barcodeScan.js');
const D = await L('lib/schedule/barcodeData.js');
const barcodesRoute = await L('app/api/schedule/barcodes/route.js');
const marksRoute = await L('app/api/schedule/marks/route.js');

const WRITE_METHODS = ['create', 'update', 'updateMany', 'delete', 'createMany', 'upsert'];
const calls = (model, method) => globalThis.__MOCK_CALLS.filter((c) => c.model === model && (method ? c.method === method : WRITE_METHODS.includes(c.method)));
const d = (iso) => new Date(iso);
const head = { id: 'emp-head', roleId: 0 };

// ---- בניית עולם -------------------------------------------------------------------------------------------------------------------------------
const TPL = (id) => ORDERS.find((o) => o.orderId === id);
let seq = 0;
const it = (orderId, over = {}) => ({
  id: 'bi-' + (++seq), orderId, description: 'שמלה', sizeText: '03', barcodePrefix: 123, barcode: null, barcodeInvalid: false, barcodeInvalidHandled: false,
  isTaken: false, takenDate: null, isReturned: false, returnDate: null, returnedOk: false, isDeleted: false,
  neckAlteration: 0, lengthAlteration: null, sleeveAlteration: 0, alterationDetails: null, alterationDone: false,
  updatedAt: d('2026-10-10T08:00:00Z'), dressItem: null, dressItemId: null, ...over,
});
// הזמנה מקומית שה-prep שלה ביום DAY (אירוע ג' 20.10)
const prepOrder = (orderId, items, over = {}) => ({ ...TPL(1005), orderId, items: items.map((x) => ({ ...x, orderId })), ...over });
// הזמנה מקומית שה-pick שלה ביום DAY (אירוע ב' 19.10)
const pickOrder = (orderId, items, over = {}) => ({ ...TPL(1007), orderId, items: items.map((x) => ({ ...x, orderId })), ...over });
// משלוח הלוך: dout ביום DAY (אירוע ו' 16.10), prep באותו יום כמו prepOrder? אירוע 16.10 -> הכנה 3 ימי עסקים לפני = ב' 12.10
const doutOrder = (orderId, items, over = {}) => ({ ...TPL(1009), orderId, items: items.map((x) => ({ ...x, orderId })), obligations: [], ...over });

const BARCODE_ON = (local, delivery = 'off') => [
  ...SETTINGS_ORG2,
  { key: 'barcode_entry_when_local_pickup', value: local },
  { key: 'barcode_entry_when_delivery', value: delivery },
];
const settingsMap = (rows) => Object.fromEntries(rows.map((r) => [r.key, r.value]));
const resolveFrom = (rows) => resolveScheduleSettings(settingsMap(rows));

function world({ orders, settings = SETTINGS_ORG2, dress = null, marks = [], audit = [] }) {
  const dressRows = dress || ['1230301', '1230302', '1230303', '1230304', '5550301', '1750301', '9990301'].map((b, i) => ({ id: 'dr-' + i, dressBarcode: b, isDeleted: false, notInUse: false, inRepair: false, location: null }));
  installDb({ settings, extra: { scheduleStageMark: marks.map((m) => ({ done: true, markedAt: NOW, ...m })), dressItem: dressRows, auditLog: audit } });
  globalThis.__MOCK_DB.order = orders;
  globalThis.__MOCK_WRITABLE = ['scheduleStageMark', 'orderItem', 'dressItem'];
  globalThis.__MOCK_BEFORE_WRITE = null;
  invalidateSettingsCache();
  M.resetMarksTableState();
  return resolveFrom(settings);
}
const orderOf = (id) => globalThis.__MOCK_DB.order.find((o) => o.orderId === id);
const itemOf = (id, idx = 0) => orderOf(id).items[idx];
const marksOf = (orderId, stageKey) => globalThis.__MOCK_DB.scheduleStageMark.filter((m) => m.orderId === orderId && (!stageKey || m.stageKey === stageKey));
const auditActions = () => calls('orderItem', 'update').map((c) => c.audit && c.audit.action).filter(Boolean);
const apply = (settings, input, over = {}) => M.applyStageMark(input, { user: head, settings, now: NOW, ...over });
const mark = (settings, stageKey, orderId, over = {}) => apply(settings, { action: 'mark', stageKey, dayKey: DAY, orderId, source: 'row', ...over });
const reg = (settings, p) => S.registerBarcode({ user: head, now: NOW, settings, source: 'schedule_dialog', ...p });
const rejects = async (promise, code, status) => {
  try { await promise; } catch (e) {
    assert.equal(e.code ?? e.extra?.code, code, `${e.message}`);
    if (status) assert.equal(e.status, status);
    return e;
  }
  assert.fail('expected a rejection with ' + code);
};

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

// ---- ברירת מחדל: אפס שינוי --------------------------------------------------------------------------------------------------------------------

test('default (no barcode settings): rows carry no barcodeInfo, "done" works without barcodes and never touches items, register is refused', async () => {
  const st = world({ orders: [prepOrder(5101, [it(0), it(0)]), pickOrder(5102, [it(0), it(0)])] });
  assert.deepEqual(st.barcode, { delivery: 'off', local: 'off' });
  const res = await getScheduleDay({ date: DAY, user: head, now: NOW, settings: st });
  const json = JSON.stringify(res);
  assert.ok(!json.includes('barcodeInfo'), 'no new field in the payload');
  assert.ok(!('barcodeEntry' in res.settings), 'no new settings key when the barcode setting is off (the page uses its absence to refuse dress barcodes with a clear message)');
  const r1 = await mark(st, 'prep', 5101);
  assert.equal(r1.results[0].status, 'marked');
  const r2 = await mark(st, 'pick', 5102);
  assert.equal(r2.results[0].status, 'marked');
  assert.equal(calls('orderItem').length, 0, 'marking prep/pick without the setting never writes an item (today\'s behaviour)');
  assert.ok(itemOf(5102, 0).isTaken === false);
  await rejects(reg(st, { orderId: 5101, barcode: '1230301', stageKey: 'prep' }), 'feature_off', 409);
});

// ---- שורות: barcodeInfo + עובדה גוברת ---------------------------------------------------------------------------------------------------------

test('rows: barcodeInfo only where a gate applies (local=pickup => pick yes, prep no); items of gated rows show barcode/taken', async () => {
  const st = world({ settings: BARCODE_ON('pickup'), orders: [prepOrder(5103, [it(0, { barcode: '1230301' }), it(0)]), pickOrder(5104, [it(0, { barcode: '1230301' }), it(0)])] });
  const res = await getScheduleDay({ date: DAY, user: head, now: NOW, settings: st });
  assert.equal(res.settings.barcodeEntry, true, 'the page learns the feature is on (enables the scan field)');
  const row = (key, id) => res.stages.find((s) => s.key === key).items.find((r) => r.orderId === id);
  assert.equal(row('prep', 5103).barcodeInfo, undefined);
  const info = row('pick', 5104).barcodeInfo;
  assert.deepEqual(info, { gate: 'handover', when: 'pickup', required: 2, registered: 1, taken: 0, missing: 1, complete: false, allRequiredTaken: false });
  assert.equal(row('pick', 5104).items[0].barcode, '1230301');
  assert.equal(row('pick', 5104).items[1].barcode, null);
  assert.ok(!('barcode' in (row('prep', 5103).items[0])), 'ungated rows keep today\'s item shape');
});

test('rows: for a handover stage "done" follows the FACT (all required items taken); a stale mark never shows done, taken items show done without a mark', async () => {
  const st = world({
    settings: BARCODE_ON('pickup'),
    orders: [
      pickOrder(5105, [it(0, { barcode: '1230301', isTaken: true }), it(0, { barcode: '1230302', isTaken: true })]),            // all taken, no mark
      pickOrder(5106, [it(0, { barcode: '1230303', isTaken: true }), it(0)]),                                                    // stale mark, one item not taken
    ],
    marks: [{ id: 'm1', orderId: 5106, stageKey: 'pick', dayKey: DAY, markedById: 'emp-head' }],
  });
  const res = await getScheduleDay({ date: DAY, user: head, now: NOW, settings: st });
  const pick = res.stages.find((s) => s.key === 'pick');
  const r5 = pick.items.find((r) => r.orderId === 5105);
  const r6 = pick.items.find((r) => r.orderId === 5106);
  assert.equal(r5.done, true);
  assert.equal(r5.doneVia, 'isTaken');
  assert.equal(r6.done, false, 'mark exists but an item is not taken: the order is not handed over');
  assert.equal(r6.doneVia, null);
});

// ---- חסימת "בוצע" -------------------------------------------------------------------------------------------------------------------------------

test('prep (local=prep): "done" is refused with the missing items until every required item has a barcode; then it marks WITHOUT taking items', async () => {
  const st = world({ settings: BARCODE_ON('prep'), orders: [prepOrder(5110, [it(0, { barcode: '1230301' }), it(0, { description: 'שמלה ב' })])] });
  const e = await mark(st, 'prep', 5110).then(() => null, (x) => x);
  assert.ok(e instanceof M.MarkError);
  assert.equal(e.status, 409);
  assert.equal(e.extra.needBarcodes, true);
  assert.equal(e.extra.gate, 'register');
  assert.equal(e.extra.required, 2);
  assert.equal(e.extra.registered, 1);
  assert.equal(e.extra.missing.length, 1);
  assert.equal(e.extra.missing[0].orderItemId, itemOf(5110, 1).id);
  assert.equal(marksOf(5110).length, 0, 'nothing written');
  // register the second one, then mark
  itemOf(5110, 1).barcode = '1230302';
  const ok = await mark(st, 'prep', 5110);
  assert.equal(ok.results[0].status, 'marked');
  assert.equal(ok.results[0].row.barcodeInfo.complete, true);
  assert.equal(itemOf(5110, 0).isTaken, false, 'prep never takes items');
  assert.equal(itemOf(5110, 1).isTaken, false);
  assert.equal(marksOf(5110, 'prep').length, 1);
});

test('prep with local=pickup is NOT gated (barcode is entered at handover)', async () => {
  const st = world({ settings: BARCODE_ON('pickup'), orders: [prepOrder(5111, [it(0), it(0)])] });
  const r = await mark(st, 'prep', 5111);
  assert.equal(r.results[0].status, 'marked');
});

test('prep stage disabled + local=prep behaves as pickup: nothing to gate at prep, the handover is gated', async () => {
  const rows = [...BARCODE_ON('prep'), { key: 'schedule_stage_prep_enabled', value: 'false' }];
  const st = world({ settings: rows, orders: [pickOrder(5112, [it(0), it(0)])] });
  assert.equal(st.barcode.local, 'pickup');
  const e = await mark(st, 'pick', 5112).then(() => null, (x) => x);
  assert.equal(e.extra.needBarcodes, true);
  assert.equal(e.extra.when, 'pickup');
});

test('handover (local, either mode): refused while a barcode is missing; when all registered it TAKES the items first and then writes the mark', async () => {
  for (const when of ['prep', 'pickup']) {
    const id = when === 'prep' ? 5120 : 5121;
    const st = world({ settings: BARCODE_ON(when), orders: [pickOrder(id, [it(0, { barcode: '1230301' }), it(0)])] });
    const refused = await mark(st, 'pick', id).then(() => null, (x) => x);
    assert.equal(refused.extra.gate, 'handover', when);
    assert.equal(marksOf(id).length, 0);
    assert.equal(calls('orderItem').length, 0, 'a refused mark writes nothing');
    itemOf(id, 1).barcode = '1230302';
    const r = await mark(st, 'pick', id);
    const res = r.results[0];
    assert.equal(res.status, 'marked', when);
    assert.equal(res.tookItemIds.length, 2);
    assert.ok(orderOf(id).items.every((x) => x.isTaken && x.takenDate && x.takenDate.getTime() === NOW.getTime()));
    assert.ok(orderOf(id).items.every((x) => x.barcode), 'barcodes stay registered');
    assert.equal(marksOf(id, 'pick').length, 1);
    assert.equal(res.row.done, true);
    assert.equal(res.row.barcodeInfo.taken, 2);
    // order of writes: item updates before the mark create
    const seqCalls = globalThis.__MOCK_CALLS.filter((c) => WRITE_METHODS.includes(c.method)).map((c) => c.model + '.' + c.method);
    assert.ok(seqCalls.lastIndexOf('orderItem.update') < seqCalls.indexOf('scheduleStageMark.create'), 'items first, the visible success marker last: ' + seqCalls.join(','));
    assert.deepEqual([...new Set(auditActions())], ['CONFIRM_RENTAL']);
  }
});

test('handover also takes items exempt from a barcode (no model identity) so the order is not left half-taken', async () => {
  const st = world({ settings: BARCODE_ON('pickup'), orders: [pickOrder(5122, [it(0, { barcode: '1230301' }), it(0, { barcodePrefix: null })])] });
  const r = await mark(st, 'pick', 5122);
  assert.equal(r.results[0].status, 'marked');
  assert.ok(orderOf(5122).items.every((x) => x.isTaken));
});

test('handover: an item added to the order between the check and the write stops the mark (taken items stay, no mark), the dialog reopens', async () => {
  const st = world({ settings: BARCODE_ON('pickup'), orders: [pickOrder(5123, [it(0, { barcode: '1230301' })])] });
  let fired = false;
  globalThis.__MOCK_BEFORE_WRITE = (model, method) => {
    if (!fired && model === 'orderItem' && method === 'update') { fired = true; orderOf(5123).items.push(it(5123)); }
  };
  const e = await mark(st, 'pick', 5123).then(() => null, (x) => x);
  assert.equal(e.extra.needBarcodes, true);
  assert.equal(marksOf(5123).length, 0);
  assert.equal(itemOf(5123, 0).isTaken, true, 'the registered item was taken; the new one blocks the order-level mark');
  assert.equal(itemOf(5123, 1).isTaken, false);
});

test('delivery order (dout): gated with the delivery setting only; items are loaded separately (the delivery rows carry none)', async () => {
  const st = world({ settings: BARCODE_ON('off', 'pickup'), orders: [doutOrder(5130, [it(0, { barcode: '1230301' }), it(0)])] });
  const res = await getScheduleDay({ date: DAY, user: head, now: NOW, settings: st });
  const row = res.stages.find((s) => s.key === 'dout').items.find((r) => r.orderId === 5130);
  assert.ok(row, 'the delivery row exists');
  assert.equal(row.barcodeInfo.gate, 'handover');
  assert.equal(row.barcodeInfo.missing, 1);
  const e = await mark(st, 'dout', 5130).then(() => null, (x) => x);
  assert.equal(e.extra.needBarcodes, true);
  itemOf(5130, 1).barcode = '1230302';
  const ok = await mark(st, 'dout', 5130);
  assert.equal(ok.results[0].status, 'marked');
  assert.ok(orderOf(5130).items.every((x) => x.isTaken));
  // the local setting does not gate a delivery order
  const st2 = world({ settings: BARCODE_ON('pickup', 'off'), orders: [doutOrder(5131, [it(0), it(0)])] });
  assert.equal((await mark(st2, 'dout', 5131)).results[0].status, 'marked');
  assert.equal(calls('orderItem').length, 0);
});

test('mark_all: complete rows are marked, incomplete rows are skipped as needs_barcode (never marked, never touched)', async () => {
  const st = world({ settings: BARCODE_ON('prep'), orders: [prepOrder(5140, [it(0, { barcode: '1230301' })]), prepOrder(5141, [it(0)]), prepOrder(5142, [it(0, { barcode: '1230302' })])] });
  const r = await apply(st, { action: 'mark_all', stageKey: 'prep', dayKey: DAY, orderIds: [5140, 5141, 5142], source: 'all' });
  const by = Object.fromEntries(r.results.map((x) => [x.orderId, x.status]));
  assert.deepEqual(by, { 5140: 'marked', 5141: 'needs_barcode', 5142: 'marked' });
  assert.equal(marksOf(5141).length, 0);
  assert.equal(r.results.find((x) => x.orderId === 5141).needs.missing.length, 1);
});

test('unmark a handover: mark first, then items back to "not taken" (barcodes stay); blocked when an item was already returned', async () => {
  const st = world({ settings: BARCODE_ON('pickup'), orders: [pickOrder(5150, [it(0, { barcode: '1230301' }), it(0, { barcode: '1230302' })]), pickOrder(5151, [it(0, { barcode: '1230303' })])] });
  await mark(st, 'pick', 5150);
  assert.ok(orderOf(5150).items.every((x) => x.isTaken));
  globalThis.__MOCK_CALLS = [];
  const u = await apply(st, { action: 'unmark', stageKey: 'pick', dayKey: DAY, orderId: 5150 });
  assert.equal(u.results[0].status, 'unmarked');
  assert.equal(u.results[0].row.done, false);
  assert.ok(orderOf(5150).items.every((x) => !x.isTaken && x.takenDate === null && x.barcode));
  const seqCalls = globalThis.__MOCK_CALLS.filter((c) => WRITE_METHODS.includes(c.method)).map((c) => c.model + '.' + c.method);
  assert.ok(seqCalls.indexOf('scheduleStageMark.update') < seqCalls.indexOf('orderItem.update'), 'unmark: the mark first, then the items');
  assert.deepEqual([...new Set(auditActions())], ['CANCEL_RENTAL']);
  // returned item blocks
  await mark(st, 'pick', 5151);
  itemOf(5151, 0).isReturned = true;
  const e = await apply(st, { action: 'unmark', stageKey: 'pick', dayKey: DAY, orderId: 5151 }).then(() => null, (x) => x);
  assert.equal(e.status, 409);
  assert.equal(e.extra.handoverReturned, true);
  assert.equal(itemOf(5151, 0).isTaken, true);
});

// ---- רישום ברקוד --------------------------------------------------------------------------------------------------------------------------------

test('register at prep: only the barcode is written (isTaken stays false, updatedAt untouched), audit REGISTER_BARCODE with stage/source, second scan is idempotent', async () => {
  const st = world({ settings: BARCODE_ON('prep'), orders: [prepOrder(5200, [it(0), it(0)])] });
  const before = itemOf(5200, 0).updatedAt;
  const r = await reg(st, { orderId: 5200, barcode: '1230301', stageKey: 'prep', intent: 'register' });
  assert.equal(r.status, 'registered');
  assert.equal(itemOf(5200, 0).barcode, '1230301');
  assert.equal(itemOf(5200, 0).isTaken, false);
  assert.equal(itemOf(5200, 0).updatedAt, before, 'a registration does not re-arm the 15-minute edit window / "updated orders"');
  const c = calls('orderItem', 'update')[0];
  assert.equal(c.audit.action, 'REGISTER_BARCODE');
  assert.equal(c.audit.changes.stage, 'prep');
  assert.equal(c.audit.changes.source, 'schedule_dialog');
  assert.deepEqual(c.audit.changes.barcode, { from: null, to: '1230301' });
  assert.equal(r.summary.registered, 1);
  assert.equal(r.summary.missing, 1);
  const n = calls('orderItem', 'update').length;
  const again = await reg(st, { orderId: 5200, barcode: '1230301', stageKey: 'prep' });
  assert.equal(again.status, 'already');
  assert.equal(calls('orderItem', 'update').length, n, 'no write, no second audit row');
  // second distinct barcode fills the second slot
  const r2 = await reg(st, { orderId: 5200, barcode: '1230302', stageKey: 'prep' });
  assert.equal(r2.status, 'registered');
  assert.equal(r2.summary.complete, true);
});

test('register at handover: registers AND takes; the last required scan completes the handover (mark written automatically); exempt items are taken with it', async () => {
  const st = world({ settings: BARCODE_ON('pickup'), orders: [pickOrder(5201, [it(0), it(0), it(0, { barcodePrefix: null })])] });
  const a = await reg(st, { orderId: 5201, barcode: '1230301', stageKey: 'pick', intent: 'handover', dayKey: DAY });
  assert.equal(a.status, 'taken');
  assert.equal(itemOf(5201, 0).isTaken, true);
  assert.equal(a.handover, undefined, 'not complete yet');
  assert.equal(marksOf(5201).length, 0);
  assert.equal(calls('orderItem', 'update')[0].audit.action, 'CONFIRM_RENTAL');
  const b = await reg(st, { orderId: 5201, barcode: '1230302', stageKey: 'pick', intent: 'handover', dayKey: DAY });
  assert.equal(b.handover.marked, true);
  assert.equal(b.handover.stageKey, 'pick');
  assert.equal(marksOf(5201, 'pick').length, 1);
  assert.equal(marksOf(5201, 'pick')[0].source, 'auto');
  assert.ok(orderOf(5201).items.every((x) => x.isTaken), 'the exempt item was taken with the order');
  assert.equal(calls('scheduleStageMark', 'create')[0].audit.changes.trigger, 'barcode_complete');
  assert.ok(b.takenIds.length >= 2);
});

test('handover scan of a barcode registered earlier (prep mode) takes that item ("verification scan")', async () => {
  const st = world({ settings: BARCODE_ON('prep'), orders: [pickOrder(5202, [it(0, { barcode: '1230301' }), it(0, { barcode: '1230302' })])] });
  const r = await reg(st, { orderId: 5202, barcode: '1230301', stageKey: 'pick', intent: 'handover', dayKey: DAY });
  assert.equal(r.status, 'taken');
  assert.equal(itemOf(5202, 0).isTaken, true);
  assert.equal(itemOf(5202, 1).isTaken, false);
  const again = await reg(st, { orderId: 5202, barcode: '1230301', stageKey: 'pick', intent: 'handover', dayKey: DAY });
  assert.equal(again.status, 'already');
});

test('intent / stage mismatches are refused (the cached setting may differ between instances)', async () => {
  const st = world({ settings: BARCODE_ON('pickup'), orders: [pickOrder(5203, [it(0)]), prepOrder(5204, [it(0)])] });
  await rejects(reg(st, { orderId: 5203, barcode: '1230301', stageKey: 'pick', intent: 'register' }), 'mode_changed', 409);
  assert.equal(itemOf(5203, 0).barcode, null, 'a prep-style scan must never set isTaken on an instance that thinks handover');
  await rejects(reg(st, { orderId: 5204, barcode: '1230301', stageKey: 'prep', intent: 'register' }), 'stage_mismatch', 409);
  await rejects(reg(st, { orderId: 5203, barcode: '1230301', stageKey: 'dout' }), 'stage_mismatch', 409);
  assert.equal(calls('orderItem').length, 0);
});

test('input validation and closed orders', async () => {
  const st = world({ settings: BARCODE_ON('prep'), orders: [prepOrder(5205, [it(0)]), prepOrder(5206, [it(0)], { isDeleted: true }), prepOrder(5207, [it(0)], { status: 'טיוטה' })] });
  for (const bad of ['', '   ', 'PRP-5205', '12', 'abc1234', '1230 301x']) await rejects(reg(st, { orderId: 5205, barcode: bad, stageKey: 'prep' }), 'invalid_format', 400);
  await rejects(reg(st, { orderId: 99999, barcode: '1230301', stageKey: 'prep' }), 'order_not_found', 404);
  await rejects(reg(st, { orderId: 5206, barcode: '1230301', stageKey: 'prep' }), 'order_closed', 409);
  await rejects(reg(st, { orderId: 5207, barcode: '1230301', stageKey: 'prep' }), 'order_closed', 409);
  await rejects(S.registerBarcode({ orderId: 5205, barcode: '1230301', stageKey: 'prep', user: null, settings: st }), 'unauthorized', 401);
  // invisible direction marks from a RTL screen are stripped
  const ok = await reg(st, { orderId: 5205, barcode: '‏1230301‎ ', stageKey: 'prep' });
  assert.equal(ok.status, 'registered');
  assert.equal(itemOf(5205, 0).barcode, '1230301');
  assert.equal(calls('orderItem', 'update').length, 1, 'only the valid scan wrote');
});

test('dress unit rules: unknown barcode, deleted / not in use / in repair, reserve and warehouse (no manager override in the dialog)', async () => {
  const dress = [
    { id: 'a', dressBarcode: '1230301', isDeleted: false, notInUse: false, inRepair: false, location: null },
    { id: 'b', dressBarcode: '1230302', isDeleted: false, notInUse: true, inRepair: false, location: null },
    { id: 'c', dressBarcode: '1230303', isDeleted: false, notInUse: false, inRepair: true, location: null },
    { id: 'd', dressBarcode: '1230304', isDeleted: false, notInUse: false, inRepair: false, location: 'רזרבה' },
    { id: 'e', dressBarcode: '1230305', isDeleted: false, notInUse: false, inRepair: false, location: 'מחסן ראשי' },
    { id: 'f', dressBarcode: '1230306', isDeleted: true, notInUse: false, inRepair: false, location: null },
  ];
  const st = world({ settings: BARCODE_ON('prep'), dress, orders: [prepOrder(5210, [it(0), it(0), it(0), it(0), it(0)])] });
  await rejects(reg(st, { orderId: 5210, barcode: '1230399', stageKey: 'prep' }), 'unknown_barcode', 404);
  await rejects(reg(st, { orderId: 5210, barcode: '1230302', stageKey: 'prep' }), 'dress_unavailable', 409);
  await rejects(reg(st, { orderId: 5210, barcode: '1230303', stageKey: 'prep' }), 'dress_unavailable', 409);
  await rejects(reg(st, { orderId: 5210, barcode: '1230304', stageKey: 'prep' }), 'reserved_location', 409);
  await rejects(reg(st, { orderId: 5210, barcode: '1230305', stageKey: 'prep' }), 'reserved_location', 409);
  await rejects(reg(st, { orderId: 5210, barcode: '1230306', stageKey: 'prep' }), 'dress_unavailable', 409);
  assert.equal(calls('orderItem').length, 0, 'nothing written for any refused barcode');
  // allow_renting_reserve_items lifts the pure reserve block
  invalidateSettingsCache();
  globalThis.__MOCK_DB.systemSetting.push({ key: 'allow_renting_reserve_items', value: 'true' });
  const ok = await reg(st, { orderId: 5210, barcode: '1230304', stageKey: 'prep' });
  assert.equal(ok.status, 'registered');
});

test('the same barcode open in another order: taken => taken_elsewhere; registered => prepped_elsewhere (+ stale hint); deleted / returned / cancelled holders do not count', async () => {
  const st = world({
    settings: BARCODE_ON('prep'),
    orders: [
      prepOrder(5220, [it(0), it(0), it(0), it(0), it(0)]),
      prepOrder(5221, [it(0, { barcode: '1230301', isTaken: true })]),                                       // out right now
      prepOrder(5222, [it(0, { barcode: '1230302' })]),                                                     // prepped, event 20.10 (not stale)
      prepOrder(5223, [it(0, { barcode: '1230303' })], { eventDate: d('2026-10-01T00:00:00Z') }),            // prepped, event long gone
      prepOrder(5224, [it(0, { barcode: '5550301', isDeleted: true }), it(0, { barcode: '1750301', isReturned: true })]),
      prepOrder(5225, [it(0, { barcode: '9990301' })], { isDeleted: true }),                                  // cancelled order
    ],
  });
  const e1 = await rejects(reg(st, { orderId: 5220, barcode: '1230301', stageKey: 'prep' }), 'taken_elsewhere', 409);
  assert.equal(e1.extra.otherOrderId, 5221);
  const e2 = await rejects(reg(st, { orderId: 5220, barcode: '1230302', stageKey: 'prep' }), 'prepped_elsewhere', 409);
  assert.equal(e2.extra.otherOrderId, 5222);
  assert.equal(e2.extra.stale, false);
  const e3 = await rejects(reg(st, { orderId: 5220, barcode: '1230303', stageKey: 'prep' }), 'prepped_elsewhere', 409);
  assert.equal(e3.extra.stale, true);
  assert.match(e3.message, /אפשר לשחרר/);
  // deleted item, returned item and a cancelled order's item do not own their barcode
  for (const bc of ['5550301', '1750301', '9990301']) {
    const orderItems = orderOf(5220).items;
    orderItems.push(it(5220, { barcodePrefix: Number(bc.slice(0, bc.length - 4)), sizeText: bc.slice(bc.length - 4, bc.length - 2) }));
    const ok = await reg(st, { orderId: 5220, barcode: bc, stageKey: 'prep' });
    assert.equal(ok.status, 'registered', bc);
  }
});

test('matching: no free slot / ambiguity by alterations / explicit choice / invalid choice', async () => {
  const st = world({
    settings: BARCODE_ON('prep'),
    orders: [
      prepOrder(5230, [it(0, { barcodePrefix: 555 })]),                                                                                       // only model 555
      prepOrder(5231, [it(0, { neckAlteration: 1 }), it(0, { neckAlteration: 0 })]),                                                        // two 123/03 with different alterations
      prepOrder(5232, [it(0, { barcode: '1230303' })]),                                                                                       // slot already filled
    ],
  });
  const e = await rejects(reg(st, { orderId: 5230, barcode: '1230302', stageKey: 'prep' }), 'not_in_order', 404);
  assert.match(e.message, /כרטיס ההזמנה/);
  const full = await rejects(reg(st, { orderId: 5232, barcode: '1230304', stageKey: 'prep' }), 'not_in_order', 404);
  assert.match(full.message, /כבר נסרקו/);
  const amb = await reg(st, { orderId: 5231, barcode: '1230301', stageKey: 'prep' });
  assert.equal(amb.status, 'ambiguous');
  assert.equal(amb.options.length, 2);
  assert.equal(calls('orderItem').length, 0, 'ambiguity writes nothing');
  await rejects(reg(st, { orderId: 5231, barcode: '1230301', stageKey: 'prep', itemId: 'not-an-item' }), 'invalid_choice', 409);
  const chosen = await reg(st, { orderId: 5231, barcode: '1230301', stageKey: 'prep', itemId: itemOf(5231, 1).id });
  assert.equal(chosen.status, 'registered');
  assert.equal(itemOf(5231, 1).barcode, '1230301');
  assert.equal(itemOf(5231, 0).barcode, null);
});

test('race 1: another worker fills the same slot first - same barcode = idempotent success, different barcode = 409 race (nothing overwritten)', async () => {
  for (const [other, expected] of [['1230301', 'already'], ['1230302', 'race']]) {
    const st = world({ settings: BARCODE_ON('prep'), orders: [prepOrder(5240, [it(0)])] });
    globalThis.__MOCK_BEFORE_WRITE = (model, method) => {
      if (model === 'orderItem' && method === 'update' && !itemOf(5240, 0).barcode) itemOf(5240, 0).barcode = other;
    };
    if (expected === 'already') {
      const r = await reg(st, { orderId: 5240, barcode: '1230301', stageKey: 'prep' });
      assert.equal(r.status, 'already');
    } else {
      await rejects(reg(st, { orderId: 5240, barcode: '1230301', stageKey: 'prep' }), 'race', 409);
    }
    assert.equal(itemOf(5240, 0).barcode, other, 'the first writer wins, nothing is silently overwritten');
  }
});

test('race 2: the same barcode is registered into two orders at the same moment - the late writer rolls its own registration back (409), the first keeps it', async () => {
  const st = world({ settings: BARCODE_ON('prep'), orders: [prepOrder(5250, [it(0)]), prepOrder(5251, [it(0)])] });
  globalThis.__MOCK_BEFORE_WRITE = (model, method, args) => {
    // a competitor lands its write on order 5251 right before ours on 5250
    if (model === 'orderItem' && method === 'update' && args.where.id === itemOf(5250, 0).id && !itemOf(5251, 0).barcode) itemOf(5251, 0).barcode = '1230301';
  };
  await rejects(reg(st, { orderId: 5250, barcode: '1230301', stageKey: 'prep' }), 'race', 409);
  assert.equal(itemOf(5250, 0).barcode, null, 'my registration was rolled back');
  assert.equal(itemOf(5251, 0).barcode, '1230301', 'the competitor keeps its registration');
  assert.ok(auditActions().includes('CANCEL_SCAN'));
});

test('an "invalid barcode" item is replaced by a valid scan (flag cleared); release clears a registration but never a taken item', async () => {
  const st = world({ settings: BARCODE_ON('prep'), orders: [prepOrder(5260, [it(0, { barcode: '8888888', barcodeInvalid: true }), it(0, { barcode: '1230302', isTaken: true })])] });
  const r = await reg(st, { orderId: 5260, barcode: '1230301', stageKey: 'prep' });
  assert.equal(r.status, 'registered');
  assert.equal(itemOf(5260, 0).barcode, '1230301');
  assert.equal(itemOf(5260, 0).barcodeInvalid, false);
  const rel = await S.releaseBarcode({ orderId: 5260, itemId: itemOf(5260, 0).id, user: head, settings: st });
  assert.equal(rel.status, 'released');
  assert.equal(itemOf(5260, 0).barcode, null);
  assert.equal(auditActions().filter((a) => a === 'CANCEL_SCAN').length, 1);
  await rejects(S.releaseBarcode({ orderId: 5260, itemId: itemOf(5260, 1).id, user: head, settings: st }), 'already_taken', 409);
  assert.equal(itemOf(5260, 1).barcode, '1230302');
  const none = await S.releaseBarcode({ orderId: 5260, itemId: itemOf(5260, 0).id, user: head, settings: st });
  assert.equal(none.status, 'already', 'idempotent');
  await rejects(S.releaseBarcode({ orderId: 5260, itemId: 'nope', user: head, settings: st }), 'item_not_found', 404);
});

test('getBarcodeState: the dialog payload (items with registered / taken / needsBarcode, gate, intent)', async () => {
  const st = world({ settings: BARCODE_ON('prep'), orders: [prepOrder(5270, [it(0, { barcode: '1230301' }), it(0, { barcodePrefix: null }), it(0, { isDeleted: true })])] });
  const s = await S.getBarcodeState({ orderId: 5270, stageKey: 'prep' }, { settings: st });
  assert.equal(s.gate, 'register');
  assert.equal(s.intent, 'register');
  assert.equal(s.items.length, 2, 'deleted items are not shown');
  assert.deepEqual(s.items.map((x) => [x.registered, x.needsBarcode, x.taken]), [[true, true, false], [false, false, false]]);
  assert.equal(s.summary.complete, true, 'the exempt item does not need a barcode');
  assert.equal((await S.getBarcodeState({ orderId: 5270, stageKey: 'pick' }, { settings: st })).gate, 'handover');
});

// ---- מסירה אוטומטית ----------------------------------------------------------------------------------------------------------------------------

test('autoMarkHandoverForOrder: off = no reads of the order at all; on + all taken = mark; on + not all taken = nothing; unmark after an item is untaken', async () => {
  world({ orders: [pickOrder(5300, [it(0, { barcode: '1230301', isTaken: true })])] });
  globalThis.__MOCK_CALLS = [];
  assert.deepEqual(await S.autoMarkHandoverForOrder(5300, { now: NOW, userId: 'emp-head' }), { status: 'off' });
  assert.equal(globalThis.__MOCK_CALLS.filter((c) => c.model === 'order' || c.model === 'orderItem').length, 0, 'default: not a single order query');

  world({ settings: BARCODE_ON('pickup'), orders: [pickOrder(5301, [it(0, { barcode: '1230301', isTaken: true }), it(0, { barcode: '1230302' })])] });
  invalidateSettingsCache();
  assert.equal((await S.autoMarkHandoverForOrder(5301, { now: NOW, userId: 'emp-head' })).status, 'not-all-taken');
  itemOf(5301, 1).isTaken = true;
  assert.equal((await S.autoMarkHandoverForOrder(5301, { now: NOW, userId: 'emp-head' })).status, 'marked');
  assert.equal(marksOf(5301, 'pick').length, 1);
  assert.equal((await S.autoMarkHandoverForOrder(5301, { now: NOW, userId: 'emp-head' })).status, 'exists');
  assert.equal(marksOf(5301, 'pick').length, 1, 'idempotent');
  // an item is un-taken in the order card => the mark is undone
  itemOf(5301, 1).isTaken = false;
  assert.equal((await S.autoUnmarkHandoverForOrder(5301, { now: NOW, userId: 'emp-head' })).status, 'unmarked');
  assert.equal(marksOf(5301, 'pick')[0].done, false);
  assert.equal((await S.autoUnmarkHandoverForOrder(5301, { now: NOW, userId: 'emp-head' })).status, 'none');
});

test('auto handover with a missing mark table never throws and keeps the facts (row stays done by the items)', async () => {
  world({ settings: BARCODE_ON('pickup'), orders: [pickOrder(5302, [it(0, { barcode: '1230301', isTaken: true })])] });
  delete globalThis.__MOCK_DB.scheduleStageMark; // P2021
  invalidateSettingsCache();
  const r = await S.autoMarkHandoverForOrder(5302, { now: NOW, userId: 'emp-head' });
  assert.ok(['no-table', 'error'].includes(r.status), r.status);
  assert.equal(itemOf(5302, 0).isTaken, true);
});

// ---- ה-API ---------------------------------------------------------------------------------------------------------------------------------------

const bpost = (body) => barcodesRoute.POST({ url: 'http://localhost/api/schedule/barcodes', json: async () => body });

test('route /api/schedule/barcodes: 401 / 403 gates, validation, full happy path with after-response work, GET state, DELETE release', async () => {
  world({ settings: BARCODE_ON('prep'), orders: [prepOrder(5400, [it(0), it(0)])] });
  assert.equal((await bpost({ orderId: 5400, barcode: '1230301', stageKey: 'prep' })).status, 401);
  globalThis.__AUTH_TOKEN = 'emp-worker-blocked';
  assert.equal((await bpost({ orderId: 5400, barcode: '1230301', stageKey: 'prep' })).status, 403);
  globalThis.__AUTH_TOKEN = 'emp-head';
  assert.equal((await bpost({ orderId: 'x', barcode: '1230301', stageKey: 'prep' })).status, 400);
  assert.equal((await bpost({ orderId: 5400, barcode: '1230301', stageKey: 'repair' })).status, 400);
  const ok = await bpost({ orderId: 5400, barcode: '1230301', stageKey: 'prep', intent: 'register' });
  assert.equal(ok.status, 200, JSON.stringify(ok.__json));
  assert.equal(ok.__json.ok, true);
  assert.equal(ok.__json.status, 'registered');
  assert.equal(ok.headers['Cache-Control'], 'no-store');
  const dup = await bpost({ orderId: 5400, barcode: '1230301', stageKey: 'prep' });
  assert.equal(dup.__json.status, 'already');
  const bad = await bpost({ orderId: 5400, barcode: '99', stageKey: 'prep' });
  assert.equal(bad.status, 400);
  assert.equal(bad.__json.code, 'invalid_format');
  const st = await barcodesRoute.GET({ url: 'http://localhost/api/schedule/barcodes?orderId=5400&stageKey=prep' });
  assert.equal(st.status, 200);
  assert.equal(st.__json.items.filter((x) => x.registered).length, 1);
  assert.equal((await barcodesRoute.GET({ url: 'http://localhost/api/schedule/barcodes?orderId=5400&stageKey=nope' })).status, 400);
  const rel = await barcodesRoute.DELETE({ url: `http://localhost/api/schedule/barcodes?orderId=5400&itemId=${itemOf(5400, 0).id}` });
  assert.equal(rel.status, 200);
  assert.equal(itemOf(5400, 0).barcode, null);
  assert.equal((await barcodesRoute.DELETE({ url: 'http://localhost/api/schedule/barcodes?orderId=5400' })).status, 400);
});

test('route /api/schedule/marks: needBarcodes arrives as a 409 body the client can act on; mark_all reports skipped reason needs_barcode; the default response shape is unchanged', async () => {
  world({ settings: BARCODE_ON('prep'), orders: [prepOrder(5410, [it(0)]), prepOrder(5411, [it(0, { barcode: '1230301' })])] });
  globalThis.__AUTH_TOKEN = 'emp-head';
  const post = (body) => marksRoute.POST({ url: 'http://localhost/api/schedule/marks', json: async () => body });
  const r = await post({ action: 'mark', stageKey: 'prep', dayKey: DAY, orderId: 5410 });
  assert.equal(r.status, 409);
  assert.equal(r.__json.needBarcodes, true);
  assert.equal(r.__json.missing.length, 1);
  assert.match(r.__json.error, /ברקודים/);
  const all = await post({ action: 'mark_all', stageKey: 'prep', dayKey: DAY, orderIds: [5410, 5411] });
  assert.equal(all.status, 200);
  assert.deepEqual(all.__json.skipped, [{ orderId: 5410, reason: 'needs_barcode', missing: 1 }]);
  assert.equal(all.__json.counts.marked, 1);
  assert.equal(all.__json.counts.needsBarcode, 1);
  assert.equal(all.__json.rows.length, 1);
});

test('route /api/schedule/marks handover: items are taken, the mark is written, and prep is marked automatically after the response ("rented = prepared")', async () => {
  world({ settings: BARCODE_ON('pickup'), orders: [pickOrder(5420, [it(0, { barcode: '1230301' })])] });
  globalThis.__AUTH_TOKEN = 'emp-head';
  const r = await marksRoute.POST({ url: 'http://localhost/api/schedule/marks', json: async () => ({ action: 'mark', stageKey: 'pick', dayKey: DAY, orderId: 5420 }) });
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  assert.equal(r.__json.row.done, true);
  assert.equal(r.__json.row.barcodeInfo.taken, 1);
  assert.equal(itemOf(5420, 0).isTaken, true);
  assert.equal(marksOf(5420, 'pick').length, 1);
  assert.equal(marksOf(5420, 'prep').length, 1, 'autoMarkPrepForOrder ran (inline in tests: no request scope)');
  assert.equal(marksOf(5420, 'prep')[0].source, 'auto');
});
