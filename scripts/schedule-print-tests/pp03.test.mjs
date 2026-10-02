// PP-03 "דף תיקונים לביצוע": שתי גרסאות (א לפי תאריך והזמנה, ב לפי דגם ומידה), ברקוד פריט, מספר פריט יציב מה-extra itemInfo,
// פריטים שבוצעו לא מודפסים (כמו alterations_pending), שער ההרשאה של התיקונים, יצוא שורות (toRows).
// הנתונים: getScheduleDay האמיתי על מוק Prisma (pp-g2.fixtures.mjs) -> loadExtras -> buildPrintPayload.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { g2Payload, g2Orders, installG2Db, DAY } from './pp-g2.fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const R = await L('lib/schedule/print/registry.js');
const { payloadToRows } = await L('lib/schedule/print/data.js');
const { parseScheduleCode } = await L('lib/schedule/print/barcode.js');
const route = await L('app/api/schedule/print/route.js');
const { invalidatePermissionCache } = await L('lib/permissions.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { invalidateRequireLoginCache } = await L('lib/auth.js');

const get = (qs = '') => route.GET({ url: 'http://localhost/api/schedule/print' + qs });

beforeEach(() => {
  invalidateSettingsCache();
  invalidateRequireLoginCache();
  invalidatePermissionCache();
  globalThis.__AUTH_TOKEN = null;
});

test('registry: ready, alterations gate, item barcode, itemInfo extra, both versions', () => {
  const p = R.getPrintPage('PP-03');
  assert.equal(p.status, 'ready');
  assert.deepEqual(p.versions.map((v) => v.k), ['a', 'b']);
  assert.deepEqual(p.extras, ['itemInfo']);
  assert.deepEqual(p.barcode, { prefix: 'REP', page: true, rows: 'item' });
  assert.ok(p.extraPageKeys.includes('page:alterations'));
  assert.equal(R.isPerOrderPage(p, 'a'), false);
});

test('version a: by event date -> order blocks (customer name order), tallies, header code ALL-REP-YYMMDD', async () => {
  const { payload } = await g2Payload(['PP-03'], { versions: { 'PP-03': 'a' } });
  const pg = payload.pages[0];
  assert.equal(pg.version, 'a');
  assert.equal(pg.pageCode, 'ALL-REP-261001');
  const d = pg.data;
  assert.equal(d.title, 'רשימת תיקונים לביצוע');
  assert.equal(d.sub, 'מקובץ לפי תאריך אירוע, ולפי הזמנה');
  assert.equal(d.days.length, 1, 'repair stage offset 0: one event date = the day');
  assert.equal(d.days[0].key, DAY);
  assert.match(d.days[0].label, /^יום חמישי /);
  assert.equal(d.days[0].greg, '01/10/2026');
  const names = d.days[0].orders.map((o) => o.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'he')), 'customers in Hebrew order inside the date');
  assert.equal(d.totals.orders, 6);
  assert.equal(d.totals.items, 9);
  assert.equal(d.sum, '6 הזמנות · 9 פריטים');
  // block of one order: header data + rows with the order barcode REP-<order>
  const o = d.days[0].orders.find((x) => x.orderId === 40139);
  assert.equal(o.code, 'REP-40139');
  assert.equal(o.name, 'לאה פרידמן');
  assert.equal(o.phone, '053-555-0104');
  assert.equal(o.rows.length, 1);
  assert.equal(o.rows[0].model, 'שיפון פודרה - 3921');
  assert.equal(o.rows[0].neck, 1);
  assert.equal(o.rows[0].len, 'קיצור 2');
  assert.equal(d.days[0].tallyText, 'כמות תיקוני צוואר: 4 | כמות תיקוני אורך: 4 | כמות תיקוני שרוול: 3');
  // notes only on the orders that have them
  assert.equal(d.days[0].orders.find((x) => x.orderId === 40126).notes, 'נא להתקשר לפני ההגעה');
});

test('version b: by model then size then event; one row per item with REP-<order>-<n> (PQ-09); group rows carry the item count', async () => {
  const { payload } = await g2Payload(['PP-03'], { versions: { 'PP-03': 'b' } });
  const d = payload.pages[0].data;
  assert.equal(d.version, 'b');
  assert.equal(d.title, 'רשימת תיקונים לביצוע · לפי דגם ומידה');
  assert.equal(d.sub, 'מקובץ לפי דגם, ובתוכו לפי מידה');
  const labels = d.groups.map((g) => g.label);
  assert.deepEqual(labels, [...labels].sort((a, b) => a.localeCompare(b, 'he', { numeric: true })), 'models in Hebrew order');
  const rows = d.groups.flatMap((g) => g.rows);
  assert.equal(rows.length, 9);
  for (const g of d.groups) {
    const sizes = g.rows.map((r) => r.size);
    assert.deepEqual(sizes, [...sizes].sort((a, b) => a.localeCompare(b, 'he', { numeric: true })), 'sizes ascending inside the model: ' + g.label);
    assert.equal(g.note, g.rows.length === 1 ? 'פריט אחד' : g.rows.length + ' פריטים');
  }
  // every code is a valid item code that parses back to {order, n}
  const seen = new Set();
  for (const r of rows) {
    const c = parseScheduleCode(r.code);
    assert.equal(c.kind, 'item');
    assert.equal(c.stage, 'repair');
    assert.equal(c.orderId, r.orderId);
    assert.equal(c.n, r.n);
    assert.ok(!seen.has(r.code), 'unique code ' + r.code);
    seen.add(r.code);
  }
  assert.equal(d.groups.find((g) => g.model === 'מרמיד שחורה - 5021').rows.length, 2);
});

test('item number n = rank of the item by id among ALL non-deleted items of the order (extras.itemInfo), not the row position', async () => {
  const orders = g2Orders();
  // order 40100 (index 0) has 1 item; build a 3-item order whose items are returned by the loader in a different order than by id
  const o = orders.find((x) => x.orderId === 40113); // index 1, 2 items
  assert.equal(o.items.length, 2);
  const [a, b] = o.items;
  // make the first item (by loader order) sort AFTER the second by id, and give only the first an alteration
  a.id = 'zz-last'; b.id = 'aa-first';
  b.neckAlteration = 0; b.lengthAlteration = null; b.sleeveAlteration = 0; b.alterationDetails = null; // no alteration on 'aa-first'
  const { payload, extras } = await g2Payload(['PP-03'], { versions: { 'PP-03': 'a' }, orders });
  assert.equal(extras.itemInfo[40113]['aa-first'].n, 1);
  assert.equal(extras.itemInfo[40113]['zz-last'].n, 2);
  const blk = payload.pages[0].data.days[0].orders.find((x) => x.orderId === 40113);
  assert.equal(blk.rows.length, 1, 'only the item with an alteration is listed');
  assert.equal(blk.rows[0].n, 2, 'but its number is its place among all items of the order');
  assert.equal(blk.rows[0].code, 'REP-40113-2');
});

test('without extras.itemInfo the number falls back to the position in the stage rows (never crashes)', async () => {
  const { day } = await g2Payload(['PP-03']);
  const mod = (await L('lib/schedule/print/pages/index.js')).getPageModule('PP-03');
  const data = mod.build({ day, page: R.getPrintPage('PP-03'), version: 'b', extras: {} });
  assert.equal(data.groups.flatMap((g) => g.rows).length, 9);
  assert.ok(data.groups.flatMap((g) => g.rows).every((r) => /^REP-\d+-[1-9]$/.test(r.code)));
});

test('done items are not printed (pending only, like /print/alterations); legacy empty / "null" / "0" length is not an alteration', async () => {
  // base fixtures: 1011 has [neck 2 (pending), length 3 (done)]; 1016 has length 'null'
  const { payload } = await g2Payload(['PP-03'], { versions: { 'PP-03': 'b' }, base: true });
  const rows = payload.pages[0].data.groups.flatMap((g) => g.rows);
  const r1011 = rows.filter((r) => r.orderId === 1011);
  assert.equal(r1011.length, 1);
  assert.equal(r1011[0].neck, 2);
  assert.equal(r1011[0].len, '');
  assert.equal(rows.some((r) => r.orderId === 1016), false, "'null' length = no alteration");
  assert.equal(rows.some((r) => r.orderId === 1012), false, 'event-only order is not in the repair stage');
});

test('empty day -> empty page (template shows the empty message), rows export is empty', async () => {
  const { payload } = await g2Payload(['PP-03'], { orders: [] });
  const d = payload.pages[0].data;
  assert.equal(d.empty, true);
  assert.equal(d.totals.items, 0);
  assert.equal(d.sum, '0 הזמנות · 0 פריטים');
  assert.deepEqual(payloadToRows(payload)[0].rows, []);
});

test('toRows: one row per item, Hebrew columns, numbers as numbers, same rows in both versions', async () => {
  const a = await g2Payload(['PP-03'], { versions: { 'PP-03': 'a' } });
  const b = await g2Payload(['PP-03'], { versions: { 'PP-03': 'b' } });
  const ra = payloadToRows(a.payload)[0];
  const rb = payloadToRows(b.payload)[0];
  assert.equal(ra.sheetName, 'דף תיקונים לביצוע');
  assert.deepEqual(Object.keys(ra.rows[0]), ['תאריך אירוע', 'הזמנה', 'לקוחה', 'טלפון', 'דגם', 'מידה', 'תיקון צוואר', 'תיקון אורך', 'תיקון שרוול', 'תיאור תיקון', 'הערות להזמנה', 'ברקוד פריט']);
  assert.equal(ra.rows.length, 9);
  assert.equal(rb.rows.length, 9);
  assert.equal(typeof ra.rows[0]['הזמנה'], 'number');
  assert.equal(typeof ra.rows[0]['טלפון'], 'string');
  assert.deepEqual(ra.rows.map((r) => r['ברקוד פריט']).sort(), rb.rows.map((r) => r['ברקוד פריט']).sort());
  assert.match(ra.rows[0]['תאריך אירוע'], /^01\/10\/2026$/);
});

test('API: alterations gate - 403 when every alterations page key is closed, 200 when one of them is open; one OrderItem query for the extra', async () => {
  const closed = (extra = []) => ({ departmentPermission: [{ roleId: 5, key: 'page:schedule', value: 'true' }, { roleId: 5, key: 'page:alterations', value: 'false' }, { roleId: 5, key: 'page:orders', value: 'false' }, { roleId: 5, key: 'page:board', value: 'false' }, ...extra] });
  installG2Db({ base: false });
  globalThis.__MOCK_DB.departmentPermission = closed().departmentPermission;
  invalidatePermissionCache();
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const denied = await get('?page=PP-03&date=2026-10-01');
  assert.equal(denied.status, 403);
  assert.equal(denied.__json.page, 'PP-03');

  globalThis.__MOCK_DB.departmentPermission = closed().departmentPermission.map((r) => (r.key === 'page:board' ? { ...r, value: 'true' } : r)); // any-of: one open key is enough
  invalidatePermissionCache();
  globalThis.__MOCK_CALLS.length = 0;
  const ok = await get('?page=PP-03&date=2026-10-01&version=b');
  assert.equal(ok.status, 200, JSON.stringify(ok.__json));
  assert.equal(ok.__json.pages[0].version, 'b');
  assert.equal(ok.__json.pages[0].data.totals.items, 9);
  const itemQueries = globalThis.__MOCK_CALLS.filter((c) => c.model === 'orderItem');
  assert.equal(itemQueries.length, 1, 'one flat OrderItem query');
  assert.equal(itemQueries[0].args.take > 0, true, 'capped');
  assert.deepEqual(itemQueries[0].args.select && Object.keys(itemQueries[0].args.select).sort(), ['id', 'lengthAlteration', 'neckAlteration', 'orderId', 'sleeveAlteration'], 'narrow select');
});
