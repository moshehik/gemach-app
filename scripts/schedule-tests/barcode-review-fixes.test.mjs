// ברקוד בלו״ז - תיקוני הסקירה העצמאית של הקוד (12.10.2026): כל ממצא עם בדיקה שנכשלת על הקוד לפני התיקון. docs/schedule-barcode-plan.md ה'.1.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { installDb, NOW, DAY, SETTINGS_ORG2, ORDERS } from './fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { invalidateRequireLoginCache } = await L('lib/auth.js');
const { invalidatePermissionCache } = await L('lib/permissions.js');
const { resolveScheduleSettings } = await L('lib/schedule/settings.js');
const M = await L('lib/schedule/marks.js');
const S = await L('lib/schedule/barcodeScan.js');
const F = await L('lib/schedule/barcodeFeature.js');
const toggleRoute = await L('app/api/rentals/toggle/route.js');
const scanRoute = await L('app/api/rentals/scan/route.js');
const confirmRoute = await L('app/api/rentals/confirm/route.js');
const marksRoute = await L('app/api/schedule/marks/route.js');
const read = (rel) => readFileSync(process.env.PROJ + '/' + rel, 'utf8');

const WRITE_METHODS = ['create', 'update', 'updateMany', 'delete', 'createMany', 'upsert'];
const calls = (model, method) => globalThis.__MOCK_CALLS.filter((c) => c.model === model && (method ? c.method === method : WRITE_METHODS.includes(c.method)));
const d = (iso) => new Date(iso);
const TPL = (id) => ORDERS.find((o) => o.orderId === id);
const head = { id: 'emp-head', roleId: 0 };
let seq = 0;
const it = (orderId, over = {}) => ({
  id: 'rf-' + (++seq), orderId, description: 'שמלה', sizeText: '03', barcodePrefix: 123, barcode: null, barcodeInvalid: false, barcodeInvalidHandled: false,
  isTaken: false, takenDate: null, isReturned: false, returnDate: null, returnedOk: false, isDeleted: false,
  neckAlteration: 0, lengthAlteration: null, sleeveAlteration: 0, alterationDetails: null, alterationDone: false,
  updatedAt: d('2026-10-10T08:00:00Z'), dressItem: null, dressItemId: null, ...over,
});
const pickOrder = (orderId, items, over = {}) => ({ ...TPL(1007), orderId, items: items.map((x) => ({ ...x, orderId })), ...over });
const ON = (local = 'pickup', extra = []) => [...SETTINGS_ORG2, { key: 'barcode_entry_when_local_pickup', value: local }, ...extra];

function world({ orders, settings = SETTINGS_ORG2, audit = [], marks = [] }) {
  const dress = ['1230301', '1230302', '1230303', '1230304'].map((b, i) => ({ id: 'dr-' + i, dressBarcode: b, isDeleted: false, notInUse: false, inRepair: false, location: null }));
  installDb({ settings, extra: { scheduleStageMark: marks.map((m) => ({ done: true, markedAt: NOW, ...m })), dressItem: dress, auditLog: audit } });
  globalThis.__MOCK_DB.order = orders;
  globalThis.__MOCK_WRITABLE = ['scheduleStageMark', 'orderItem', 'dressItem', 'auditLog'];
  globalThis.__MOCK_BEFORE_WRITE = null;
  globalThis.__AUTH_TOKEN = 'emp-head';
  invalidateSettingsCache();
  M.resetMarksTableState();
  return resolveScheduleSettings(Object.fromEntries(settings.map((r) => [r.key, r.value])));
}
const itemOf = (orderId, idx = 0) => globalThis.__MOCK_DB.order.find((o) => o.orderId === orderId).items[idx];
const marksOf = (orderId, stageKey) => globalThis.__MOCK_DB.scheduleStageMark.filter((m) => m.orderId === orderId && (!stageKey || m.stageKey === stageKey));
const jreq = (url, body, method = 'POST') => ({ url, method, json: async () => body });
const json = async (r) => (r.__json !== undefined ? r.__json : r.json());
const rejects = async (promise, code, status) => {
  try { await promise; } catch (e) { assert.equal(e.code, code, e.message); if (status) assert.equal(e.status, status); return e; }
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

test('toggle rent (setting on): a required item cannot be marked taken without any barcode; an item exempt from a barcode still can', async () => {
  world({ settings: ON('pickup'), orders: [pickOrder(7001, [it(0), it(0, { barcodePrefix: null }), it(0, { barcode: '1230301' })])] });
  const none = await toggleRoute.POST(jreq('http://x/t', { itemId: itemOf(7001, 0).id, action: 'rent' }));
  assert.equal(none.status, 409);
  assert.equal((await json(none)).needBarcode, true);
  assert.equal(itemOf(7001, 0).isTaken, false);
  assert.equal((await toggleRoute.POST(jreq('http://x/t', { itemId: itemOf(7001, 1).id, action: 'rent' }))).status, 200, 'exempt item');
  assert.equal((await toggleRoute.POST(jreq('http://x/t', { itemId: itemOf(7001, 2).id, action: 'rent' }))).status, 200, 'registered item: its own barcode is used');
  // default: unchanged (rent without a barcode works as always)
  world({ orders: [pickOrder(7002, [it(0)])] });
  assert.equal((await toggleRoute.POST(jreq('http://x/t', { itemId: itemOf(7002, 0).id, action: 'rent' }))).status, 200);
});

test('rentals/scan H4: correcting a typo in the manual-entry flow still works (the item holds the flagged "invalid" barcode from the first scan)', async () => {
  const settings = [...SETTINGS_ORG2, { key: 'barcode_invalid_list', value: 'true' }, { key: 'manual_barcode_double_entry', value: 'true' }];
  world({ settings, orders: [pickOrder(7003, [it(0)])] });
  const bad = await scanRoute.POST(jreq('http://x/s', { orderId: 7003, barcode: '9999998', itemIdToForce: itemOf(7003, 0).id }));
  assert.equal(bad.status, 404);
  assert.equal(itemOf(7003, 0).barcode, '9999998');
  assert.equal(itemOf(7003, 0).barcodeInvalid, true);
  // the operator fixes the digit: manual entry with the corrected value onto the very same item
  const fixed = await scanRoute.POST(jreq('http://x/s', { orderId: 7003, barcode: '9999997', itemIdToForce: itemOf(7003, 0).id, manualEntry: true, manualConfirm: true, manualSignature: true }));
  assert.equal(fixed.status, 200, JSON.stringify(await json(fixed)));
  assert.equal(itemOf(7003, 0).barcode, '9999997');
  assert.equal(itemOf(7003, 0).manualBarcodeEntry, true);
});

test('H1 refined: only the LATEST barcode-affecting audit row decides - register, cancel, re-scan in the old modal => the discard button works again', async () => {
  const a = it(0, { barcode: '1230301' });
  const b = it(0, { barcode: '1230302' });
  const audit = [
    { id: 'l1', entityType: 'OrderItem', entityId: a.id, action: 'REGISTER_BARCODE', changesJson: JSON.stringify({ barcode: { from: null, to: '1230301' } }), createdAt: d('2026-10-12T08:00:00Z') },
    { id: 'l2', entityType: 'OrderItem', entityId: a.id, action: 'CANCEL_SCAN', changesJson: JSON.stringify({ barcode: { from: '1230301', to: null } }), createdAt: d('2026-10-12T08:05:00Z') },
    // b: registered, never cancelled
    { id: 'l3', entityType: 'OrderItem', entityId: b.id, action: 'REGISTER_BARCODE', changesJson: JSON.stringify({ barcode: { from: null, to: '1230302' } }), createdAt: d('2026-10-12T08:01:00Z') },
  ];
  world({ orders: [pickOrder(7004, [a, b])], audit });
  const r = await confirmRoute.DELETE(jreq('http://x/c?orderId=7004', null, 'DELETE'));
  assert.deepEqual(await json(r), { success: true, kept: 1 });
  assert.equal(itemOf(7004, 0).barcode, null, 'the old-modal re-scan of the same barcode is a pending scan again');
  assert.equal(itemOf(7004, 1).barcode, '1230302');
});

test('a stale "done" mark by another employee does not block marking a handover row that shows "not done" (the row follows the facts)', async () => {
  const st = world({
    settings: ON('pickup'),
    orders: [pickOrder(7005, [it(0, { barcode: '1230301' }), it(0, { barcode: '1230302' })])],
    marks: [{ id: 'old', orderId: 7005, stageKey: 'pick', dayKey: DAY, markedById: 'emp-other', source: 'row' }],
  });
  const r = await M.applyStageMark({ action: 'mark', stageKey: 'pick', dayKey: DAY, orderId: 7005, source: 'row' }, { user: head, settings: st, now: NOW });
  assert.ok(['marked', 'unchanged'].includes(r.results[0].status), r.results[0].status); // the old mark row already says done: idempotent, no second row
  assert.ok(globalThis.__MOCK_DB.order.find((o) => o.orderId === 7005).items.every((x) => x.isTaken), 'the items were taken - the row is now done by the facts');
  assert.equal(marksOf(7005, 'pick').length, 1);
  assert.equal(r.results[0].row.done, true);
  // without the barcode setting the old "already marked by X" protection is untouched
  const st2 = world({ orders: [pickOrder(7006, [it(0)])], marks: [{ id: 'old2', orderId: 7006, stageKey: 'pick', dayKey: DAY, markedById: 'emp-other', source: 'row' }] });
  await assert.rejects(M.applyStageMark({ action: 'mark', stageKey: 'pick', dayKey: DAY, orderId: 7006, source: 'row' }, { user: head, settings: st2, now: NOW }), (e) => e.status === 409 && e.extra && e.extra.alreadyMarked);
});

test('empty-string barcodes: an item whose barcode is "" is registered / taken like a null one (no silent P2025 -> false race)', async () => {
  const st = world({ settings: ON('prep'), orders: [pickOrder(7007, [it(0, { barcode: '' }), it(0, { barcode: '', barcodePrefix: null })])] });
  const r = await S.registerBarcode({ orderId: 7007, barcode: '1230301', stageKey: 'pick', intent: 'handover', dayKey: DAY, user: head, now: NOW, settings: st });
  assert.equal(r.status, 'taken');
  assert.equal(itemOf(7007, 0).barcode, '1230301');
  assert.ok(itemOf(7007, 1).isTaken, 'the exempt item with "" is taken together with the order');
  assert.equal(marksOf(7007, 'pick').length, 1);
});

test('release: refused while the setting is off; padded barcodes release for real; an unchanged item is never reported as released', async () => {
  const st = world({ settings: ON('prep'), orders: [pickOrder(7008, [it(0, { barcode: ' 1230301 ' })])] });
  const rel = await S.releaseBarcode({ orderId: 7008, itemId: itemOf(7008, 0).id, user: head, settings: st });
  assert.equal(rel.status, 'released');
  assert.equal(itemOf(7008, 0).barcode, null);
  const off = world({ orders: [pickOrder(7009, [it(0, { barcode: '1230301' })])] });
  await rejects(S.releaseBarcode({ orderId: 7009, itemId: itemOf(7009, 0).id, user: head, settings: off }), 'feature_off', 409);
  assert.equal(itemOf(7009, 0).barcode, '1230301');
  // the write lost a race (a competing registration landed) => no false "released"
  const st3 = world({ settings: ON('prep'), orders: [pickOrder(7010, [it(0, { barcode: '1230301' })])] });
  globalThis.__MOCK_BEFORE_WRITE = (model, method, args) => { if (model === 'orderItem' && method === 'update' && args.where.id === itemOf(7010, 0).id) itemOf(7010, 0).isTaken = true; };
  await rejects(S.releaseBarcode({ orderId: 7010, itemId: itemOf(7010, 0).id, user: head, settings: st3 }), 'already_taken', 409);
});

test('duplicate-registration rollback (handover mode): the take is undone as CANCEL_RENTAL, not as a scan cancel', async () => {
  const st = world({ settings: ON('pickup'), orders: [pickOrder(7011, [it(0)]), pickOrder(7012, [it(0)])] });
  globalThis.__MOCK_BEFORE_WRITE = (model, method, args) => {
    if (model === 'orderItem' && method === 'update' && args.where.id === itemOf(7011, 0).id && !itemOf(7012, 0).barcode) itemOf(7012, 0).barcode = '1230301';
  };
  await rejects(S.registerBarcode({ orderId: 7011, barcode: '1230301', stageKey: 'pick', intent: 'handover', dayKey: DAY, user: head, now: NOW, settings: st }), 'race', 409);
  assert.equal(itemOf(7011, 0).isTaken, false);
  assert.equal(itemOf(7011, 0).barcode, null);
  const actions = calls('orderItem', 'update').map((c) => c.audit && c.audit.action);
  assert.ok(actions.includes('CANCEL_RENTAL'), actions.join(','));
  assert.equal(marksOf(7011).length, 0);
});

test('a client dayKey far from today is ignored for the automatic handover mark (the scheduled day is used)', async () => {
  const st = world({ settings: ON('pickup'), orders: [pickOrder(7013, [it(0)])] });
  const r = await S.registerBarcode({ orderId: 7013, barcode: '1230301', stageKey: 'pick', intent: 'handover', dayKey: '2099-01-01', user: head, now: NOW, settings: st });
  assert.equal(r.handover.marked, true);
  assert.equal(r.handover.dayKey, DAY, 'pick for an event on 19.10 is scheduled on 15.10');
});

test('marks route: items taken before a post-check 409 still get the "rented = prepared" follow-up (not lost with the error)', async () => {
  world({ settings: ON('pickup'), orders: [pickOrder(7014, [it(0, { barcode: '1230301' })])] });
  let fired = false;
  globalThis.__MOCK_BEFORE_WRITE = (model, method) => { if (!fired && model === 'orderItem' && method === 'update') { fired = true; globalThis.__MOCK_DB.order.find((o) => o.orderId === 7014).items.push(it(7014)); } };
  const r = await marksRoute.POST(jreq('http://x/m', { action: 'mark', stageKey: 'pick', dayKey: DAY, orderId: 7014 }));
  assert.equal(r.status, 409);
  assert.equal((await json(r)).needBarcodes, true);
  assert.equal(itemOf(7014, 0).isTaken, true);
  assert.equal(marksOf(7014, 'pick').length, 0, 'no handover mark');
  assert.equal(marksOf(7014, 'prep').length, 1, 'but the taken item still marked the prep (autoMarkPrepForOrder)');
});

test('lazy wrappers: setting off => "off" without loading the schedule stack; on => the real work', async () => {
  world({ orders: [pickOrder(7015, [it(0, { barcode: '1230301', isTaken: true })])] });
  assert.deepEqual(await F.lazyAutoMarkHandover(7015, { userId: 'u' }), { status: 'off' });
  assert.deepEqual(await F.lazyAutoUnmarkHandover(7015, { userId: 'u' }), { status: 'off' });
  assert.equal(await F.lazyCheckHandoverGate(7015), null);
  assert.equal(await F.isBarcodeEntryOn(), false);
  world({ settings: ON('pickup'), orders: [pickOrder(7016, [it(0, { barcode: '1230301', isTaken: true })])] });
  assert.equal(await F.isBarcodeEntryOn(), true);
  assert.equal((await F.lazyAutoMarkHandover(7016, { userId: 'u' })).status, 'marked');
});

test('source: the hot legacy routes use only lazy wrappers (barcodeScan / marks stack is not imported statically); the dialog guards against stale responses and clears its close timer', () => {
  for (const f of ['app/api/rentals/toggle/route.js', 'app/api/rentals/confirm/route.js', 'app/api/rentals/cancel/route.js', 'app/api/rentals/scan/route.js', 'app/api/orders/[id]/route.js', 'app/api/orders/[id]/items/[itemId]/route.js']) {
    assert.ok(!/from '@\/lib\/schedule\/barcodeScan'/.test(read(f)), f);
  }
  const dlg = read('app/components/schedule/BarcodeDialog.js');
  assert.match(dlg, /const gen = useRef\(0\)/);
  assert.match(dlg, /if \(g !== gen\.current\) return/);
  assert.match(dlg, /closeTimer\.current = setTimeout/);
  assert.match(dlg, /clearTimeout\(closeTimer\.current\)/);
  const day = read('app/components/schedule/ScheduleDay.js');
  assert.match(day, /lastScanOrder\.current = null; setBcTarget\(null\)/, 'a closed dialog forgets the last order');
  assert.match(day, /row\.barcodeInfo && !row\.barcodeInfo\.complete\) \{ openBarcodes/, 'a bare dress scan only re-opens an order that still needs barcodes');
});
