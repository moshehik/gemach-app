// ברקוד בלו״ז - החלטות הבעלים 12.10.2026 (תשובות נווה "כפי ההמלצות", שאלות 4, 5, 8, 10, 11): הקלדה ידנית + התראה למנהלות, דגם/מידה שונים באישור מנהלת,
// שחרור אוטומטי בביטול הזמנה ושחרור ידני באי-הגעה, אישור מנהלת לברקוד שרשום בהכנה בהזמנה אחרת, חסימת "החזרה בוצעה" עד שכל השמלות נסרקו (הגדרה נפרדת),
// ופרופיל neve בסקריפט הזריעה. docs/schedule-barcode-plan.md.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { installDb, NOW, DAY, SETTINGS_ORG2, ORDERS } from './fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { invalidateRequireLoginCache } = await L('lib/auth.js');
const { invalidatePermissionCache } = await L('lib/permissions.js');
const { resolveScheduleSettings } = await L('lib/schedule/settings.js');
const { hashSecret } = await L('lib/passwordAuth.js');
const M = await L('lib/schedule/marks.js');
const S = await L('lib/schedule/barcodeScan.js');
const D = await L('lib/schedule/barcodeData.js');
const barcodesRoute = await L('app/api/schedule/barcodes/route.js');
const marksRoute = await L('app/api/schedule/marks/route.js');
const require = createRequire(import.meta.url);
const read = (rel) => readFileSync(process.env.PROJ + '/' + rel, 'utf8');

const WRITE_METHODS = ['create', 'update', 'updateMany', 'delete', 'createMany', 'upsert'];
const calls = (model, method) => globalThis.__MOCK_CALLS.filter((c) => c.model === model && (method ? c.method === method : WRITE_METHODS.includes(c.method)));
const d = (iso) => new Date(iso);
const TPL = (id) => ORDERS.find((o) => o.orderId === id);
const head = { id: 'emp-head', roleId: 0 };
const PIN = '4321';
let seq = 0;
const it = (orderId, over = {}) => ({
  id: 'ow-' + (++seq), orderId, description: 'שמלה', sizeText: '03', barcodePrefix: 123, barcode: null, barcodeInvalid: false, barcodeInvalidHandled: false,
  isTaken: false, takenDate: null, isReturned: false, returnDate: null, returnedOk: false, isDeleted: false,
  neckAlteration: 0, lengthAlteration: null, sleeveAlteration: 0, alterationDetails: null, alterationDone: false,
  updatedAt: d('2026-10-10T08:00:00Z'), dressItem: null, dressItemId: null, ...over,
});
const pickOrder = (orderId, items, over = {}) => ({ ...TPL(1007), orderId, items: items.map((x) => ({ ...x, orderId })), ...over });
const retOrder = (orderId, items) => ({ ...TPL(1013), orderId, items: items.map((x) => ({ ...x, orderId })) });
const ON = (local = 'prep', extra = []) => [...SETTINGS_ORG2, { key: 'barcode_entry_when_local_pickup', value: local }, ...extra];

let mgrHash;
async function world({ orders, settings = SETTINGS_ORG2 }) {
  mgrHash = mgrHash || await hashSecret(PIN);
  const dress = ['1230301', '1230302', '5550301'].map((b, i) => ({ id: 'dr-' + i, dressBarcode: b, isDeleted: false, notInUse: false, inRepair: false, location: null }));
  installDb({ settings, extra: { scheduleStageMark: [], dressItem: dress, auditLog: [], notification: [] } });
  globalThis.__MOCK_DB.employee.push({ id: 'emp-mgr', roleId: 0, isActive: true, firstName: 'מנהלת', lastName: 'סניף', password: mgrHash });
  globalThis.__MOCK_DB.order = orders;
  globalThis.__MOCK_WRITABLE = ['scheduleStageMark', 'orderItem', 'dressItem', 'auditLog', 'notification'];
  globalThis.__MOCK_BEFORE_WRITE = null;
  globalThis.__AUTH_TOKEN = 'emp-head';
  invalidateSettingsCache();
  M.resetMarksTableState();
  return resolveScheduleSettings(Object.fromEntries(settings.map((r) => [r.key, r.value])));
}
const itemOf = (orderId, idx = 0) => globalThis.__MOCK_DB.order.find((o) => o.orderId === orderId).items[idx];
const notes = () => globalThis.__MOCK_DB.notification;
const reg = (st, p) => S.registerBarcode({ user: head, now: NOW, settings: st, source: 'schedule_dialog', ...p });
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

// ---- (4) הקלדה ידנית + התראה למנהלת ------------------------------------------------------------------------------------------------------------

test('Q4 manual entry: an unknown barcode is refused with canManual; typed twice + signed it is saved with the manual flags and ONE notification per manager - no duplicates on repeat', async () => {
  const st = await world({ settings: ON('prep'), orders: [pickOrder(8001, [it(0, { barcodePrefix: 999, sizeText: '99' })])] });
  const first = await rejects(reg(st, { orderId: 8001, barcode: '9999995', stageKey: 'pick', intent: 'handover' }), 'unknown_barcode', 404);
  assert.equal(first.extra.canManual, true);
  await rejects(reg(st, { orderId: 8001, barcode: '9999995', stageKey: 'pick', intent: 'handover', manual: { second: '9999996', signed: true } }), 'manual_mismatch', 400);
  await rejects(reg(st, { orderId: 8001, barcode: '9999995', stageKey: 'pick', intent: 'handover', manual: { second: '9999995', signed: false } }), 'manual_unsigned', 400);
  assert.equal(calls('orderItem').length, 0);
  assert.equal(notes().length, 0);
  const ok = await reg(st, { orderId: 8001, barcode: '9999995', stageKey: 'pick', intent: 'handover', dayKey: DAY, manual: { second: ' 9999995 ', signed: true } });
  assert.equal(ok.status, 'taken');
  assert.equal(itemOf(8001, 0).barcode, '9999995');
  assert.equal(itemOf(8001, 0).manualBarcodeEntry, true);
  assert.equal(itemOf(8001, 0).manualBarcodeConfirmed, true);
  assert.equal(calls('orderItem', 'update')[0].audit.changes.manualEntry, true);
  const managers = globalThis.__MOCK_DB.employee.filter((e) => e.isActive && [0, 1, 2].includes(e.roleId)).length;
  assert.equal(notes().length, managers, 'exactly one notification per manager');
  assert.match(notes()[0].content, /ידנית/);
  assert.match(notes()[0].content, /#8001/);
  const again = await reg(st, { orderId: 8001, barcode: '9999995', stageKey: 'pick', intent: 'handover', dayKey: DAY, manual: { second: '9999995', signed: true } });
  assert.equal(again.status, 'already');
  assert.equal(notes().length, managers, 'an idempotent repeat does not notify again');
});

test('Q4: a manual barcode still has to match a free slot of the order (prefix + size) - otherwise the normal refusal', async () => {
  const st = await world({ settings: ON('prep'), orders: [pickOrder(8002, [it(0)])] });
  const e = await rejects(reg(st, { orderId: 8002, barcode: '9999995', stageKey: 'pick', intent: 'handover', manual: { second: '9999995', signed: true } }), 'not_in_order', 404);
  assert.equal(e.extra.needsApproval, 'mismatch', 'the manager path is offered instead');
  assert.equal(notes().length, 0);
});

// ---- (5) דגם/מידה שונים: רק מנהלת מאשרת ---------------------------------------------------------------------------------------------------------

test('Q5 mismatch: a different model/size is blocked; a wrong PIN is rejected; a manager PIN + chosen item registers it with an audit trail and a notification', async () => {
  const st = await world({ settings: ON('prep'), orders: [pickOrder(8003, [it(0), it(0, { sizeText: '04' })])] });
  const blocked = await rejects(reg(st, { orderId: 8003, barcode: '5550301', stageKey: 'pick', intent: 'handover' }), 'not_in_order', 404);
  assert.equal(blocked.extra.needsApproval, 'mismatch');
  assert.equal(blocked.extra.options.length, 2);
  assert.equal(calls('orderItem').length, 0);
  await rejects(reg(st, { orderId: 8003, barcode: '5550301', stageKey: 'pick', intent: 'handover', override: { pin: 'wrong' }, itemId: itemOf(8003, 0).id }), 'override_rejected', 409);
  await rejects(reg(st, { orderId: 8003, barcode: '5550301', stageKey: 'pick', intent: 'handover', override: { pin: PIN } }), 'invalid_choice', 409); // two free items - the manager must choose
  assert.equal(calls('orderItem').length, 0);
  assert.equal(notes().length, 0);
  const ok = await reg(st, { orderId: 8003, barcode: '5550301', stageKey: 'pick', intent: 'handover', dayKey: DAY, override: { pin: PIN }, itemId: itemOf(8003, 1).id });
  assert.equal(ok.status, 'taken');
  assert.equal(itemOf(8003, 1).barcode, '5550301');
  const ch = calls('orderItem', 'update')[0].audit.changes;
  assert.equal(ch.mismatchOverride, true);
  assert.equal(ch.approvedById, 'emp-mgr');
  assert.ok(notes().length >= 1);
  assert.match(notes()[0].content, /שונים ממה שהוזמן/);
  assert.match(notes()[0].title, /באישור מנהלת/);
});

test('Q5: a same-model same-size different unit needs no approval (normal path); "all slots of that model already scanned" is still a plain refusal', async () => {
  const st = await world({ settings: ON('prep'), orders: [pickOrder(8004, [it(0, { barcode: '1230301' })])] });
  const e = await rejects(reg(st, { orderId: 8004, barcode: '1230302', stageKey: 'pick', intent: 'handover', override: { pin: PIN } }), 'not_in_order', 404);
  assert.equal(e.extra, null, 'no approval offer: nothing to assign it to');
});

// ---- (11) ברקוד שרשום בהכנה בהזמנה אחרת ---------------------------------------------------------------------------------------------------------

test('Q11: registered at prep in another order => warning + continue only with a manager PIN (both orders then hold it, no rollback); still OUT in another order => hard block even with a PIN', async () => {
  const st = await world({ settings: ON('prep'), orders: [pickOrder(8005, [it(0)]), pickOrder(8006, [it(0, { barcode: '1230301' })]), pickOrder(8007, [it(0, { barcode: '1230302', isTaken: true })]), pickOrder(8008, [it(0), it(0)])] });
  const blocked = await rejects(reg(st, { orderId: 8005, barcode: '1230301', stageKey: 'pick', intent: 'handover' }), 'prepped_elsewhere', 409);
  assert.equal(blocked.extra.needsApproval, 'elsewhere');
  assert.equal(blocked.extra.otherOrderId, 8006);
  await rejects(reg(st, { orderId: 8005, barcode: '1230301', stageKey: 'pick', intent: 'handover', override: { pin: 'nope' } }), 'override_rejected', 409);
  assert.equal(itemOf(8005, 0).barcode, null);
  const ok = await reg(st, { orderId: 8005, barcode: '1230301', stageKey: 'pick', intent: 'handover', dayKey: DAY, override: { pin: PIN } });
  assert.equal(ok.status, 'taken');
  assert.equal(itemOf(8005, 0).barcode, '1230301');
  assert.equal(itemOf(8006, 0).barcode, '1230301', 'the other registration is untouched');
  assert.equal(calls('orderItem', 'update')[0].audit.changes.preppedElsewhereOrder, 8006);
  assert.match(notes()[0].content, /8006/);
  // out right now: no override helps
  const e = await rejects(reg(st, { orderId: 8008, barcode: '1230302', stageKey: 'pick', intent: 'handover', override: { pin: PIN } }), 'taken_elsewhere', 409);
  assert.equal(e.extra.needsApproval, undefined);
});

test('route: manual and override fields travel in the POST body (never the URL), DELETE ?all=1 releases everything', async () => {
  await world({ settings: ON('prep'), orders: [pickOrder(8009, [it(0, { barcodePrefix: 999, sizeText: '99' })])] });
  const post = (b) => barcodesRoute.POST({ url: 'http://x/b', json: async () => b });
  const r = await post({ orderId: 8009, stageKey: 'pick', intent: 'handover', barcode: '9999995', manualSecond: '9999995', manualSigned: true });
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  assert.equal(r.__json.item.barcode, '9999995');
  const bad = await post({ orderId: 8009, stageKey: 'pick', barcode: '1230301', overridePin: 'x' });
  assert.equal(bad.status >= 400, true);
  const rel = await barcodesRoute.DELETE({ url: 'http://x/b?orderId=8009&all=1' });
  assert.equal(rel.status, 200);
  assert.equal(rel.__json.status, 'released_all');
});

// ---- (8) שחרור אוטומטי בביטול הזמנה / בביטול פריט, ושחרור ידני באי-הגעה ------------------------------------------------------------------------

test('Q8 release helpers: only registered-not-taken items are released (also on already-cancelled items), taken ones are never touched, each release is audited and keeps updatedAt', async () => {
  await world({ settings: ON('prep'), orders: [pickOrder(8010, [it(0, { barcode: '1230301', isDeleted: true }), it(0, { barcode: '1230302', isTaken: true }), it(0, { barcode: '5550301', isDeleted: true }), it(0)])] });
  const before = itemOf(8010, 0).updatedAt;
  const r = await D.releaseUntakenBarcodes({ orderId: 8010, note: 'בדיקה', includeDeleted: true });
  assert.equal(r.released.length, 2);
  assert.equal(itemOf(8010, 0).barcode, null);
  assert.equal(itemOf(8010, 2).barcode, null);
  assert.equal(itemOf(8010, 1).barcode, '1230302');
  assert.equal(itemOf(8010, 0).updatedAt, before);
  assert.deepEqual([...new Set(calls('orderItem', 'update').map((c) => c.audit.action))], ['CANCEL_SCAN']);
  // without includeDeleted the cancelled items are skipped
  await world({ settings: ON('prep'), orders: [pickOrder(8011, [it(0, { barcode: '1230301', isDeleted: true })])] });
  assert.equal((await D.releaseUntakenBarcodes({ orderId: 8011, note: 'x' })).released.length, 0);
});

test('Q8 manual one-click release (no-show): releaseAllBarcodes frees every untaken registration; refused while the setting is off', async () => {
  const st = await world({ settings: ON('prep'), orders: [pickOrder(8012, [it(0, { barcode: '1230301' }), it(0, { barcode: '1230302', isTaken: true }), it(0)])] });
  const r = await S.releaseAllBarcodes({ orderId: 8012, user: head, settings: st });
  assert.equal(r.releasedCount, 1);
  assert.equal(itemOf(8012, 0).barcode, null);
  assert.equal(itemOf(8012, 1).barcode, '1230302');
  const off = await world({ orders: [pickOrder(8013, [it(0, { barcode: '1230301' })])] });
  await rejects(S.releaseAllBarcodes({ orderId: 8013, user: head, settings: off }), 'feature_off', 409);
  assert.equal(itemOf(8013, 0).barcode, '1230301');
});

test('source Q8: order DELETE releases registrations after the cancel (feature on only, failure-tolerant); an item cancelled inside a save is released in the same update', () => {
  const s = read('app/api/orders/[id]/route.js');
  assert.match(s, /if \(await barcodeFeatureFor\(parsedOrderId\)\) \{\s*await releaseUntakenBarcodes\(\{ orderId: parsedOrderId, note: `שוחרר אוטומטית בביטול הזמנה #\$\{parsedOrderId\}`, includeDeleted: true \}\);/);
  assert.ok(s.indexOf('releaseUntakenBarcodes({ orderId: parsedOrderId') > s.indexOf("action: 'CANCEL_ORDER'"), 'after the cancel transaction');
  assert.match(s, /\(nowDeleted && !stored\.isDeleted\)/);
  const dlg = read('app/components/schedule/BarcodeDialog.js');
  assert.match(dlg, /all=1/);
  assert.match(read('app/components/schedule/StageRow.js'), /ניהול ברקודים \/ שחרור/);
});

// ---- (10) החזרה: אי אפשר לסמן "החזרה בוצעה" לפני שכל השמלות נסרקו ----------------------------------------------------------------------------

test('Q10 return gate (separate setting, off by default): "return done" is refused while a taken dress was not scanned back; allowed after; mark_all skips; off = old behaviour', async () => {
  const rows = [...SETTINGS_ORG2, { key: 'barcode_return_scan_required', value: 'true' }];
  const st = await world({ settings: rows, orders: [retOrder(8101, [it(0, { barcode: '1230301', isTaken: true }), it(0, { barcode: '1230302', isTaken: true, isReturned: true, returnDate: NOW })]), retOrder(8102, [it(0)])] });
  assert.equal(st.barcodeReturnRequired, true);
  const apply = (input) => M.applyStageMark({ source: 'row', ...input }, { user: head, settings: st, now: NOW });
  const e = await apply({ action: 'mark', stageKey: 'manret', dayKey: DAY, orderId: 8101 }).then(() => null, (x) => x);
  assert.equal(e.status, 409);
  assert.equal(e.extra.needReturnScans, true);
  assert.equal(e.extra.unreturned.length, 1);
  assert.match(e.message, /עוד לא נסרקו בהחזרה/);
  assert.equal(calls('orderItem').length, 0, 'nothing written for the refused order');
  const all = await apply({ action: 'mark_all', stageKey: 'manret', dayKey: DAY, orderIds: [8101, 8102], outcome: 'ok' });
  assert.deepEqual(Object.fromEntries(all.results.map((r) => [r.orderId, r.status])), { 8101: 'needs_return_scan', 8102: 'marked' });
  itemOf(8101, 0).isReturned = true; itemOf(8101, 0).returnDate = NOW;
  assert.equal((await apply({ action: 'mark', stageKey: 'manret', dayKey: DAY, orderId: 8101 })).results[0].status, 'marked');
  // unmark is never gated
  assert.ok(['unmarked', 'unchanged'].includes((await apply({ action: 'unmark', stageKey: 'manret', dayKey: DAY, orderId: 8101 })).results[0].status));
});

test('Q10 default (setting off/missing): "return done" works exactly as before even with unscanned dresses', async () => {
  const st = await world({ orders: [retOrder(8103, [it(0, { barcode: '1230301', isTaken: true })])] });
  assert.equal(st.barcodeReturnRequired, false);
  const r = await M.applyStageMark({ action: 'mark', stageKey: 'manret', dayKey: DAY, orderId: 8103, source: 'row' }, { user: head, settings: st, now: NOW });
  assert.equal(r.results[0].status, 'marked');
  assert.equal(itemOf(8103, 0).isReturned, true, 'old behaviour: the schedule itself returns the items');
});

test('Q10 route: needReturnScans is a 409 body with the reason; mark_all reports the skip reason and count', async () => {
  const rows = [...SETTINGS_ORG2, { key: 'barcode_return_scan_required', value: 'true' }];
  await world({ settings: rows, orders: [retOrder(8104, [it(0, { barcode: '1230301', isTaken: true })])] });
  const post = (b) => marksRoute.POST({ url: 'http://x/m', json: async () => b });
  const r = await post({ action: 'mark', stageKey: 'manret', dayKey: DAY, orderId: 8104 });
  assert.equal(r.status, 409);
  assert.equal(r.__json.needReturnScans, true);
  const all = await post({ action: 'mark_all', stageKey: 'manret', dayKey: DAY, orderIds: [8104] });
  assert.deepEqual(all.__json.skipped, [{ orderId: 8104, reason: 'needs_return_scan', unreturned: 1 }]);
  assert.equal(all.__json.counts.needsReturnScan, 1);
});

// ---- (ג) פרופיל neve בסקריפט הזריעה ---------------------------------------------------------------------------------------------------------------

test('seed script: --profile=neve sets prep for deliveries and pickup for local pickup, leaves the return gate off, refuses org 1 and unknown profiles', () => {
  const seed = require(process.env.PROJ + '/scripts/seed_barcode_entry_settings.js');
  const rows = Object.fromEntries(seed.rowsForProfile('neve').map((r) => [r.key, r]));
  assert.equal(rows.barcode_entry_when_delivery.value, 'prep');
  assert.equal(rows.barcode_entry_when_local_pickup.value, 'pickup');
  assert.equal(rows.barcode_entry_when_delivery.enforce, true);
  assert.equal(rows.barcode_return_scan_required.value, 'false');
  assert.equal(rows.barcode_return_scan_required.enforce, false);
  const plain = Object.fromEntries(seed.rowsForProfile(null).map((r) => [r.key, r]));
  assert.equal(plain.barcode_entry_when_delivery.value, 'off');
  assert.equal(plain.barcode_entry_when_delivery.enforce, false, 'without a profile an existing value is never overwritten');
  assert.throws(() => seed.rowsForProfile('main'), /unknown profile/);
  assert.equal(seed.PROFILES.neve.org, 2);
  const src = read('scripts/seed_barcode_entry_settings.js');
  assert.match(src, /is only for org/);
  assert.match(src, /refusing to write: host/);
});
