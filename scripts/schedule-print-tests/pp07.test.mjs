// PP-07 "דף הכנה": שתי הגרסאות (א מרוכז, ב הזמנה בעמוד), בלי שדה "יעד", משלוחים קודם, ברקוד PRP-<הזמנה>, תיקונים מה-extra 'prepInfo'
// (שאילתה אחת, בלי תשלומים), הרשאה (page:schedule מספיק), toRows (שורה לשמלה), גיליון Excel. מול נתוני הדמה של הלו״ז (15.10.2026) ונתוני סינתטיים.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { installDb } from '../schedule-tests/fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const require = createRequire(process.env.PROJ + '/package.json');
const route = await L('app/api/schedule/print/route.js');
const { invalidatePermissionCache } = await L('lib/permissions.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { invalidateRequireLoginCache } = await L('lib/auth.js');
const mod = await L('lib/schedule/print/pages/PP-07.js');
const { getPrintPage, isPerOrderPage } = await L('lib/schedule/print/registry.js');
const { buildPrintPayload, loadExtras, payloadToRows } = await L('lib/schedule/print/data.js');
const { isValidCode39 } = await L('lib/schedule/print/barcode.js');
const { buildScheduleWorkbook } = await L('lib/schedule/print/xlsx.js');

const get = (qs = '') => route.GET({ url: 'http://localhost/api/schedule/print' + qs });
beforeEach(() => {
  installDb({});
  invalidateSettingsCache(); invalidateRequireLoginCache(); invalidatePermissionCache();
  globalThis.__AUTH_TOKEN = null;
});

test('registry: ready, versions א/ב, per-order only in version ב, no extra page permission, lean prepInfo extra', () => {
  const p = getPrintPage('PP-07');
  assert.equal(p.status, 'ready');
  assert.deepEqual(p.versions.map((v) => v.k), ['a', 'b']);
  assert.equal(isPerOrderPage(p, 'a'), false);
  assert.equal(isPerOrderPage(p, 'b'), true);
  assert.deepEqual(p.extraPageKeys, []);
  assert.deepEqual(p.extras, ['prepInfo']);
  assert.deepEqual(p.barcode, { prefix: 'PRP', page: true, rows: 'order' });
});

test('route: any employee with page:schedule gets 200; prep stage rows of 15.10 (1005, 1006); one lean extras query', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const r = await get('?page=PP-07&date=2026-10-15');
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  const p = r.__json.pages[0];
  assert.equal(p.version, 'a');
  assert.equal(p.pageCode, 'ALL-PRP-261015');
  assert.deepEqual(p.data.rows.map((x) => x.orderId), [1005, 1006]);
  assert.equal(p.data.rows[1].dresses.length, 2);
  assert.equal(p.data.rows[0].dresses[0].model, 'ורד');
  assert.equal(p.data.rows[0].code, 'PRP-1005');
  // fixtures orders are pickups (isDelivery false) -> only the pickup group
  assert.deepEqual(p.data.groups.map((g) => g.label), ['איסוף עצמי']);
  // one extras query, on the Order table, only for the page's orders, without payments (no money on this page)
  const calls = globalThis.__MOCK_CALLS.filter((c) => c.model === 'order' && c.args && c.args.select && c.args.select.items && c.args.select.isDelivery && !c.args.select.customer);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args.where.orderId.in.sort(), [1005, 1006]);
  assert.equal('payments' in calls[0].args.select, false);
  assert.ok(calls[0].args.take >= 2, 'take cap');
});

test('no "יעד" (destination) field anywhere - not in version א, not in version ב', async () => {
  globalThis.__AUTH_TOKEN = 'emp-head';
  for (const v of ['a', 'b']) {
    const r = await get('?page=PP-07&date=2026-10-15&version=' + v);
    assert.equal(r.status, 200);
    assert.equal(r.__json.pages[0].version, v);
    const json = JSON.stringify(r.__json.pages[0].data);
    assert.equal(/(^|[^א-ת])יעד([^א-ת]|$)/.test(json), false, 'version ' + v);
    assert.equal('dest' in r.__json.pages[0].data.rows[0], false);
  }
});

const sd = (stages) => ({ date: '2026-10-14', weekday: 'יום רביעי', isToday: false, nonWorkingDay: false, settings: {}, stages });
const prepRow = (orderId, name, items, extra = {}) => ({
  orderId, stage: 'prep', customer: { name, firstName: name.split(' ')[0], lastName: name.split(' ')[1] || '', phone1: '050-1234567', phone2: '' },
  eventKey: '2026-10-19', eventDateHebrew: null, dressCount: items.length, notes: '', items, ...extra,
});
const it = (id, model, size) => ({ orderItemId: id, model, size, modelPrefix: 1, location: null, inRepair: false });

test('build: deliveries first, then pickups; direction "חזור" only is a pickup; repairs from prepInfo; legacy length "null" is no repair', () => {
  const day = sd([{ key: 'prep', items: [
    prepRow(10, 'א ב', [it('a1', 'ורד', '38')]),
    prepRow(11, 'ג ד', [it('b1', 'לילך', '40'), it('b2', 'ורד', '42')]),
    prepRow(12, 'ה ו', [it('c1', 'שושן', '36')], { notes: 'להתקשר' }),
  ] }]);
  const extras = { prepInfo: {
    10: { isDelivery: false, direction: null, items: { a1: { neck: 0, length: '', sleeve: 0, details: '' } } },
    11: { isDelivery: true, direction: 'הלוך-חזור', items: { b1: { neck: 2, length: 'קיצור 4', sleeve: 0, details: 'לשמור על התחרה' }, b2: { neck: 0, length: 'null', sleeve: 0, details: 'x' } } },
    12: { isDelivery: true, direction: 'חזור', items: { c1: { neck: 0, length: '0', sleeve: 3, details: '' } } },
  } };
  const d = mod.build({ day, version: 'a', extras });
  assert.deepEqual(d.rows.map((r) => r.orderId), [11, 10, 12], 'delivery (11) first; 12 is return-only -> pickup; then by order id');
  assert.deepEqual(d.groups.map((g) => [g.key, g.orders, g.dresses]), [['delivery', 1, 2], ['pickup', 2, 2]]);
  const r11 = d.rows[0];
  assert.equal(r11.type, 'משלוח');
  assert.equal(r11.dresses[0].repair, 'צוואר: הצרה 2 | אורך: קיצור 4');
  assert.equal(r11.dresses[0].details, 'לשמור על התחרה');
  assert.equal(r11.dresses[1].repair, '', 'length "null" = no repair');
  assert.equal(r11.dresses[1].details, '', 'details only shown with a repair');
  assert.equal(r11.hasRepair, true);
  assert.equal(d.rows[2].type, 'איסוף עצמי');
  assert.equal(d.rows[2].dresses[0].repair, 'שרוול: הארכה 3');
  assert.equal(d.rows[2].notes, 'להתקשר');
  assert.equal(d.sum, '3 הזמנות · 4 שמלות');
  assert.equal(d.empty, false);
  // empty day
  assert.equal(mod.build({ day: sd([{ key: 'prep', items: [] }]), version: 'a', extras: {} }).empty, true);
  assert.equal(mod.build({ day: sd([]), version: 'b', extras: {} }).empty, true);
});

test('barcodes are valid Code 39 and per order; version ב titles', () => {
  const day = sd([{ key: 'prep', items: [prepRow(40113, 'מרים א', [it('x', 'ורד', '38')])] }]);
  const payload = buildPrintPayload({ day, keys: ['PP-07'], versions: { 'PP-07': 'b' }, extras: { prepInfo: {} }, now: new Date('2026-10-14T05:12:00Z') });
  const p = payload.pages[0];
  assert.equal(p.version, 'b');
  assert.equal(p.data.rows[0].code, 'PRP-40113');
  assert.ok(isValidCode39(p.data.rows[0].code));
  assert.ok(isValidCode39(p.pageCode));
  assert.equal(p.data.sub, 'הזמנה אחת בכל עמוד');
  assert.equal(p.def.perOrderPage.version, 'b');
});

test('toRows: one row per dress with Hebrew columns; xlsx sheet is RTL with numbers as numbers', () => {
  const day = sd([{ key: 'prep', items: [prepRow(11, 'ג ד', [it('b1', 'לילך', '40'), it('b2', 'ורד', '42')])] }]);
  const extras = { prepInfo: { 11: { isDelivery: true, direction: 'הלוך', items: { b1: { neck: 2, length: '', sleeve: 0, details: 'פירוט' }, b2: { neck: 0, length: '', sleeve: 0, details: '' } } } } };
  const payload = buildPrintPayload({ day, keys: ['PP-07'], extras, now: new Date('2026-10-14T05:12:00Z') });
  const sheets = payloadToRows(payload);
  assert.equal(sheets[0].sheetName, 'דף הכנה');
  const rows = sheets[0].rows;
  assert.equal(rows.length, 2);
  assert.deepEqual(Object.keys(rows[0]), ['הזמנה', 'לקוחה', 'טלפון', 'תאריך אירוע', 'תאריך עברי', 'סוג', 'שמלה', 'דגם', 'מידה', 'תיקון', 'פירוט תיקון', 'הערה להזמנה']);
  assert.equal(rows[0]['הזמנה'], 11);
  assert.equal(rows[0]['שמלה'], 1);
  assert.equal(rows[0]['תיקון'], 'צוואר: הצרה 2');
  assert.equal(rows[0]['סוג'], 'משלוח');
  assert.equal(rows[0]['תאריך אירוע'], '19/10/2026');
  const XLSX = require('xlsx');
  const wb = buildScheduleWorkbook(XLSX, sheets);
  assert.equal(wb.Workbook.Views[0].RTL, true);
  assert.equal(wb.Sheets['דף הכנה'].A2.t, 'n');
  assert.equal(wb.Sheets['דף הכנה'].C2.t, 's');
});

test('loadExtras prepInfo: nothing queried for a day without prep rows', async () => {
  const calls = [];
  const client = { order: { findMany: async (a) => { calls.push(a); return []; } } };
  const e = await loadExtras(sd([{ key: 'prep', items: [] }]), [getPrintPage('PP-07')], { client });
  assert.deepEqual(e.prepInfo, {});
  assert.equal(calls.length, 0);
});
