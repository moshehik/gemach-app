// ברקוד בלו״ז - המסלולים הישנים שמסביב (docs/schedule-barcode-plan.md ה'.1, H1-H8, H11): rentals/confirm (POST + DELETE), rentals/scan, rentals/toggle,
// rentals/cancel. בכל אחד: בלי הגדרה = בדיוק התנהגות היום; עם הגדרה = ההגנות החדשות.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { installDb, NOW, SETTINGS_ORG2, ORDERS } from './fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { invalidateRequireLoginCache } = await L('lib/auth.js');
const { invalidatePermissionCache } = await L('lib/permissions.js');
const Mk = await L('lib/schedule/marks.js');
const confirmRoute = await L('app/api/rentals/confirm/route.js');
const scanRoute = await L('app/api/rentals/scan/route.js');
const toggleRoute = await L('app/api/rentals/toggle/route.js');
const cancelRoute = await L('app/api/rentals/cancel/route.js');

const WRITE_METHODS = ['create', 'update', 'updateMany', 'delete', 'createMany', 'upsert'];
const calls = (model, method) => globalThis.__MOCK_CALLS.filter((c) => c.model === model && (method ? c.method === method : WRITE_METHODS.includes(c.method)));
const d = (iso) => new Date(iso);
const TPL = (id) => ORDERS.find((o) => o.orderId === id);
let seq = 0;
const it = (orderId, over = {}) => ({
  id: 'lg-' + (++seq), orderId, description: 'שמלה', sizeText: '03', barcodePrefix: 123, barcode: null, barcodeInvalid: false, barcodeInvalidHandled: false,
  isTaken: false, takenDate: null, isReturned: false, returnDate: null, returnedOk: false, isDeleted: false,
  neckAlteration: 0, lengthAlteration: null, sleeveAlteration: 0, alterationDetails: null, alterationDone: false,
  updatedAt: d('2026-10-10T08:00:00Z'), dressItem: null, dressItemId: null, ...over,
});
const pickOrder = (orderId, items, over = {}) => ({ ...TPL(1007), orderId, items: items.map((x) => ({ ...x, orderId })), ...over });
const ON = (local = 'pickup') => [...SETTINGS_ORG2, { key: 'barcode_entry_when_local_pickup', value: local }];

function world({ orders, settings = SETTINGS_ORG2, audit = [], dress = null }) {
  const dressRows = dress || ['1230301', '1230302', '1230303', '1230304'].map((b, i) => ({ id: 'dr-' + i, dressBarcode: b, isDeleted: false, notInUse: false, inRepair: false, location: null, dressModelId: null }));
  installDb({ settings, extra: { scheduleStageMark: [], dressItem: dressRows, auditLog: audit } });
  globalThis.__MOCK_DB.order = orders;
  globalThis.__MOCK_WRITABLE = ['scheduleStageMark', 'orderItem', 'dressItem', 'auditLog'];
  globalThis.__MOCK_BEFORE_WRITE = null;
  globalThis.__AUTH_TOKEN = 'emp-head';
  invalidateSettingsCache();
  Mk.resetMarksTableState();
}
const itemOf = (orderId, idx = 0) => globalThis.__MOCK_DB.order.find((o) => o.orderId === orderId).items[idx];
const json = async (r) => (r.__json !== undefined ? r.__json : r.json());
const jreq = (url, body, method = 'POST') => ({ url, method, json: async () => body });

beforeEach(() => {
  installDb();
  globalThis.__MOCK_WRITABLE = [];
  globalThis.__MOCK_BEFORE_WRITE = null;
  globalThis.__AUTH_TOKEN = null;
  invalidateSettingsCache();
  invalidateRequireLoginCache();
  invalidatePermissionCache();
  Mk.resetMarksTableState();
});

// ---- rentals/confirm --------------------------------------------------------------------------------------------------------------------------------

test('confirm POST (default): takes the pending items BY ID (H2) and keeps the old response; no barcode gate', async () => {
  world({ orders: [pickOrder(6001, [it(0, { barcode: '1230301' }), it(0)])] });
  const r = await confirmRoute.POST(jreq('http://x/api/rentals/confirm', { orderId: 6001 }));
  assert.equal(r.status, 200);
  assert.equal((await json(r)).count, 1);
  const um = calls('orderItem', 'updateMany')[0];
  assert.deepEqual(um.args.where.id.in, [itemOf(6001, 0).id], 'the write targets the ids that were read, not "everything with a barcode in the order"');
  assert.equal(um.args.where.isTaken, false);
  assert.equal(itemOf(6001, 0).isTaken, true);
  assert.equal(itemOf(6001, 1).isTaken, false);
});

test('confirm POST (setting on): refused with the missing items while a required item has no barcode; passes and marks the handover when complete', async () => {
  world({ settings: ON('pickup'), orders: [pickOrder(6002, [it(0, { barcode: '1230301' }), it(0)])] });
  const r = await confirmRoute.POST(jreq('http://x/api/rentals/confirm', { orderId: 6002 }));
  assert.equal(r.status, 409);
  const body = await json(r);
  assert.equal(body.needBarcodes, true);
  assert.equal(body.missing.length, 1);
  assert.equal(calls('orderItem').length, 0, 'nothing written');
  itemOf(6002, 1).barcode = '1230302';
  const ok = await confirmRoute.POST(jreq('http://x/api/rentals/confirm', { orderId: 6002 }));
  assert.equal(ok.status, 200);
  assert.ok(itemOf(6002, 0).isTaken && itemOf(6002, 1).isTaken);
  assert.equal(globalThis.__MOCK_DB.scheduleStageMark.filter((m) => m.orderId === 6002 && m.stageKey === 'pick').length, 1, 'handover marked after the confirm');
});

test('confirm DELETE (H1): registrations made from the schedule survive "cancel scans"; legacy pending scans are cleared; the audit row is written for the cleared ones only', async () => {
  const a = it(0, { barcode: '1230301' });
  const b = it(0, { barcode: '1230302' });
  const c = it(0, { barcode: '1230303' });
  const audit = [
    { id: 'al-1', entityType: 'OrderItem', entityId: a.id, action: 'REGISTER_BARCODE', changesJson: JSON.stringify({ barcode: { from: null, to: '1230301' } }) },
    // c was registered from the schedule with a DIFFERENT barcode earlier, then released and re-scanned in the old modal: not protected
    { id: 'al-2', entityType: 'OrderItem', entityId: c.id, action: 'REGISTER_BARCODE', changesJson: JSON.stringify({ barcode: { from: null, to: '1230399' } }) },
  ];
  world({ settings: ON('prep'), orders: [pickOrder(6003, [a, b, c])], audit });
  const r = await confirmRoute.DELETE(jreq('http://x/api/rentals/confirm?orderId=6003', null, 'DELETE'));
  assert.equal(r.status, 200);
  assert.equal((await json(r)).kept, 1);
  const o = globalThis.__MOCK_DB.order.find((x) => x.orderId === 6003);
  assert.equal(o.items[0].barcode, '1230301', 'schedule registration kept');
  assert.equal(o.items[1].barcode, null);
  assert.equal(o.items[2].barcode, null);
  const logged = globalThis.__MOCK_DB.auditLog.filter((x) => x.action === 'CANCEL_SCAN').map((x) => x.entityId).sort();
  assert.deepEqual(logged, [b.id, c.id].sort());
});

test('confirm DELETE when everything pending was registered from the schedule: nothing is cleared', async () => {
  const a = it(0, { barcode: '1230301' });
  world({ orders: [pickOrder(6004, [a])], audit: [{ id: 'al-3', entityType: 'OrderItem', entityId: a.id, action: 'REGISTER_BARCODE', changesJson: JSON.stringify({ barcode: { from: null, to: '1230301' } }) }] });
  const r = await confirmRoute.DELETE(jreq('http://x/api/rentals/confirm?orderId=6004', null, 'DELETE'));
  assert.deepEqual(await json(r), { success: true, kept: 1 });
  assert.equal(calls('orderItem').length, 0);
});

// ---- rentals/scan -----------------------------------------------------------------------------------------------------------------------------------

test('scan POST: the barcode is written only if the slot is still empty (H3) - a competing scan is not silently overwritten', async () => {
  world({ orders: [pickOrder(6010, [it(0)])] });
  globalThis.__MOCK_BEFORE_WRITE = (model, method) => { if (model === 'orderItem' && method === 'update' && !itemOf(6010, 0).barcode) itemOf(6010, 0).barcode = '1230302'; };
  const r = await scanRoute.POST(jreq('http://x/api/rentals/scan', { orderId: 6010, barcode: '1230301' }));
  assert.equal(r.status, 409);
  assert.equal((await json(r)).raced, true);
  assert.equal(itemOf(6010, 0).barcode, '1230302', 'the first scan keeps its barcode');
  // the same barcode raced in = idempotent success
  world({ orders: [pickOrder(6011, [it(0)])] });
  globalThis.__MOCK_BEFORE_WRITE = (model, method) => { if (model === 'orderItem' && method === 'update' && !itemOf(6011, 0).barcode) itemOf(6011, 0).barcode = '1230301'; };
  const same = await scanRoute.POST(jreq('http://x/api/rentals/scan', { orderId: 6011, barcode: '1230301' }));
  assert.equal(same.status, 200);
});

test('scan POST (default): the normal assignment is unchanged (barcode set, isTaken false)', async () => {
  world({ orders: [pickOrder(6012, [it(0), it(0, { barcodePrefix: 555 })])] });
  const r = await scanRoute.POST(jreq('http://x/api/rentals/scan', { orderId: 6012, barcode: '1230301' }));
  assert.equal(r.status, 200);
  assert.equal(itemOf(6012, 0).barcode, '1230301');
  assert.equal(itemOf(6012, 0).isTaken, false);
  assert.equal(itemOf(6012, 1).barcode, null);
});

test('scan POST (H4): itemIdToForce must be an active item of THIS order - a foreign / deleted item is never written', async () => {
  const foreign = it(0, { barcode: '1111111' });
  world({
    settings: [...SETTINGS_ORG2, { key: 'barcode_invalid_list', value: 'true' }],
    orders: [pickOrder(6013, [it(0)]), pickOrder(6014, [foreign])],
  });
  // 9999999 is not in the dress table => the "invalid barcode" branch; a forged itemIdToForce of another order must not be touched
  const r = await scanRoute.POST(jreq('http://x/api/rentals/scan', { orderId: 6013, barcode: '9999999', itemIdToForce: foreign.id }));
  assert.equal(r.status, 404);
  assert.equal(itemOf(6014, 0).barcode, '1111111');
  assert.equal(itemOf(6014, 0).barcodeInvalid, false);
  assert.equal(calls('orderItem').length, 0);
  // the legitimate forced item of this order is still flagged
  const ok = await scanRoute.POST(jreq('http://x/api/rentals/scan', { orderId: 6013, barcode: '9999999', itemIdToForce: itemOf(6013, 0).id }));
  assert.equal(ok.status, 404);
  assert.equal(itemOf(6013, 0).barcodeInvalid, true);
});

test('scan POST (H11, setting on): a barcode already registered in another open order is refused; with the setting off the old behaviour stays', async () => {
  world({ settings: ON('prep'), orders: [pickOrder(6015, [it(0)]), pickOrder(6016, [it(0, { barcode: '1230301' })])] });
  const r = await scanRoute.POST(jreq('http://x/api/rentals/scan', { orderId: 6015, barcode: '1230301' }));
  assert.equal(r.status, 409);
  const b = await json(r);
  assert.equal(b.preppedElsewhere, true);
  assert.equal(b.otherOrderId, 6016);
  assert.equal(itemOf(6015, 0).barcode, null);
  world({ orders: [pickOrder(6015, [it(0)]), pickOrder(6016, [it(0, { barcode: '1230301' })])] });
  const off = await scanRoute.POST(jreq('http://x/api/rentals/scan', { orderId: 6015, barcode: '1230301' }));
  assert.equal(off.status, 200, 'default: no new check');
});

// ---- rentals/toggle ---------------------------------------------------------------------------------------------------------------------------------

const toggle = (body) => toggleRoute.POST(jreq('http://x/api/rentals/toggle', body));

test('toggle (default): rent over a different registered barcode / return of a never-taken item behave exactly as before', async () => {
  world({ orders: [pickOrder(6020, [it(0, { barcode: '1230301' }), it(0)])] });
  const r1 = await toggle({ itemId: itemOf(6020, 0).id, action: 'rent', barcode: '1230302' });
  assert.equal(r1.status, 200);
  assert.equal(itemOf(6020, 0).barcode, '1230302', 'old behaviour: the barcode is replaced');
  const r2 = await toggle({ itemId: itemOf(6020, 1).id, action: 'return' });
  assert.equal(r2.status, 200, 'old behaviour: a never-taken item can be marked returned');
});

test('toggle (setting on): rent keeps the registered barcode (H6), refuses deleted items and barcodes open elsewhere; return needs a taken item (H7)', async () => {
  world({
    settings: ON('prep'),
    orders: [
      pickOrder(6021, [it(0, { barcode: '1230301' }), it(0, { isDeleted: true }), it(0)]),
      pickOrder(6022, [it(0, { barcode: '1230303' })]),
    ],
  });
  const a = itemOf(6021, 0);
  const diff = await toggle({ itemId: a.id, action: 'rent', barcode: '1230302' });
  assert.equal(diff.status, 409);
  assert.equal((await json(diff)).barcodeAlreadyRegistered, true);
  assert.equal(a.barcode, '1230301');
  assert.equal(a.isTaken, false);
  const del = await toggle({ itemId: itemOf(6021, 1).id, action: 'rent', barcode: '1230302' });
  assert.equal(del.status, 409);
  const elsewhere = await toggle({ itemId: itemOf(6021, 2).id, action: 'rent', barcode: '1230303' });
  assert.equal(elsewhere.status, 409);
  assert.equal((await json(elsewhere)).barcodeElsewhere, true);
  const ret = await toggle({ itemId: itemOf(6021, 2).id, action: 'return' });
  assert.equal(ret.status, 409);
  assert.equal((await json(ret)).notTaken, true);
  // the legitimate flows still work: take the registered item with its own barcode (or none)
  const ok = await toggle({ itemId: a.id, action: 'rent', barcode: '1230301' });
  assert.equal(ok.status, 200);
  assert.equal(a.isTaken, true);
  const back = await toggle({ itemId: a.id, action: 'return' });
  assert.equal(back.status, 200);
});

test('toggle (setting on): taking the last item marks the handover; undoRent clears the barcode and undoes the handover mark (H8)', async () => {
  world({ settings: ON('pickup'), orders: [pickOrder(6023, [it(0, { barcode: '1230301' }), it(0, { barcode: '1230302' })])] });
  const marks = () => globalThis.__MOCK_DB.scheduleStageMark.filter((m) => m.orderId === 6023 && m.stageKey === 'pick');
  await toggle({ itemId: itemOf(6023, 0).id, action: 'rent', barcode: '1230301' });
  assert.equal(marks().length, 0, 'not all taken yet');
  await toggle({ itemId: itemOf(6023, 1).id, action: 'rent', barcode: '1230302' });
  assert.equal(marks().length, 1);
  assert.equal(marks()[0].done, true);
  const u = await toggle({ itemId: itemOf(6023, 1).id, action: 'undoRent' });
  assert.equal(u.status, 200);
  assert.equal(itemOf(6023, 1).isTaken, false);
  assert.equal(itemOf(6023, 1).barcode, null, 'no ghost registration after an undo');
  assert.equal(marks()[0].done, false, 'the order is no longer fully handed over');
});

test('toggle (default): undoRent keeps the barcode as today and never touches the marks table', async () => {
  world({ orders: [pickOrder(6024, [it(0, { barcode: '1230301', isTaken: true, takenDate: NOW })])] });
  await toggle({ itemId: itemOf(6024, 0).id, action: 'undoRent' });
  assert.equal(itemOf(6024, 0).barcode, '1230301');
  assert.equal(calls('scheduleStageMark').length, 0);
});

// ---- rentals/cancel ---------------------------------------------------------------------------------------------------------------------------------

test('cancel (setting on): clears the item and undoes the handover mark; default: only the item', async () => {
  world({ settings: ON('pickup'), orders: [pickOrder(6030, [it(0, { barcode: '1230301', isTaken: true, takenDate: NOW })])] });
  globalThis.__MOCK_DB.scheduleStageMark.push({ id: 'mk', orderId: 6030, stageKey: 'pick', dayKey: '2026-10-15', done: true, markedAt: NOW });
  const r = await cancelRoute.PUT(jreq('http://x/api/rentals/cancel', { orderItemId: itemOf(6030, 0).id }, 'PUT'));
  assert.equal(r.status, 200);
  assert.equal(itemOf(6030, 0).isTaken, false);
  assert.equal(itemOf(6030, 0).barcode, null);
  assert.equal(globalThis.__MOCK_DB.scheduleStageMark[0].done, false);
  world({ orders: [pickOrder(6031, [it(0, { barcode: '1230301', isTaken: true, takenDate: NOW })])] });
  await cancelRoute.PUT(jreq('http://x/api/rentals/cancel', { orderItemId: itemOf(6031, 0).id }, 'PUT'));
  assert.equal(itemOf(6031, 0).isTaken, false);
  assert.equal(calls('scheduleStageMark').length, 0);
});

// ---- בדיקות מקור (הראוטים האלה כבדים מדי לדמה בזיכרון; נעילת הקוד שמטפל ב-H5 / D11 כדי שלא יימחק בשקט) ---------------------------------------------

import { readFileSync } from 'node:fs';
const read = (rel) => readFileSync(process.env.PROJ + '/' + rel, 'utf8');

test('source: PUT items/[itemId] cancels a not-yet-taken registration when the model/size changes, inside the same update, with an audit note (H5)', () => {
  const s = read('app/api/orders/[id]/items/[itemId]/route.js');
  assert.match(s, /!freshItem\.isTaken && !freshItem\.takenDate && freshItem\.barcode/);
  assert.match(s, /updateData\.barcode = null/);
  assert.match(s, /itemChanges\.barcode = \{ from: freshItem\.barcode, to: null \}/);
  // the clear sits after buildUpdateData and before the audited update of that very transaction
  assert.ok(s.indexOf('buildUpdateData(itemData, dressItemIdToUse)') < s.indexOf('updateData.barcode = null'));
  assert.ok(s.indexOf('updateData.barcode = null') < s.indexOf("tx.orderItem.update(auditAs('UPDATE'"));
});

test('source: PUT orders/[id] never changes a registered barcode from a (possibly stale) card, and cancels an untaken registration on size change / item restore - only when the setting is on (D11)', () => {
  const s = read('app/api/orders/[id]/route.js');
  assert.match(s, /const barcodeEntryOn = !!\(await barcodeFeatureFor\(parsedOrderId\)\);/);
  assert.match(s, /if \(barcodeEntryOn && stored && stored\.barcode/);
  assert.match(s, /normalizedBarcode = undefined; \/\/ לא משנים ברקוד רשום/);
  assert.match(s, /item\.sizeText !== stored\.sizeText \|\| \(stored\.isDeleted && !nowDeleted\)/);
  // the feature lookup happens outside the interactive transaction
  assert.ok(s.indexOf('barcodeFeatureFor(parsedOrderId)') < s.indexOf('prisma.$transaction(async (tx)'));
  // the stored items now carry the taken state the guard needs
  assert.match(s, /barcode: true, isTaken: true, takenDate: true/);
});

test('source: the legacy routes import the LIGHT feature module (not the schedule marks stack) where they only need the setting check', () => {
  for (const f of ['app/api/orders/[id]/route.js', 'app/api/rentals/scan/route.js']) {
    assert.match(read(f), /from '@\/lib\/schedule\/barcodeFeature'/, f);
    assert.ok(!/from '@\/lib\/schedule\/barcodeScan'/.test(read(f)), f + ' must not pull barcodeScan -> marks -> loaders');
  }
});
