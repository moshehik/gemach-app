// PP-10 "דף משלוח הלוך (למשלוחן)": שער משלוחים (page:deliveries), נתוני שלב 5 בלי שאילתה נוספת, קיבוץ לפי תאריך אירוע עם כותרת
// המשלוחן, "חסרה כתובת", ברקוד DOT-<הזמנה>, צורת courierGroups של מייל השליח, toRows. מול נתוני הדמה (15.10.2026) וסינתטיים.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { installDb } from '../schedule-tests/fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const route = await L('app/api/schedule/print/route.js');
const { invalidatePermissionCache } = await L('lib/permissions.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { invalidateRequireLoginCache } = await L('lib/auth.js');
const mod = await L('lib/schedule/print/pages/PP-10.js');
const { getPrintPage } = await L('lib/schedule/print/registry.js');
const { buildPrintPayload, payloadToRows } = await L('lib/schedule/print/data.js');
const { isValidCode39 } = await L('lib/schedule/print/barcode.js');

const get = (qs = '') => route.GET({ url: 'http://localhost/api/schedule/print' + qs });
function setup(extra = {}) {
  installDb({ extra });
  invalidateSettingsCache(); invalidateRequireLoginCache(); invalidatePermissionCache();
  globalThis.__AUTH_TOKEN = null;
}
beforeEach(() => setup());

test('registry: ready, deliveries gate, DOT barcode on page + rows, replaces the old courier print, no extras', () => {
  const p = getPrintPage('PP-10');
  assert.equal(p.status, 'ready');
  assert.deepEqual(p.extraPageKeys, ['page:deliveries']);
  assert.deepEqual(p.barcode, { prefix: 'DOT', page: true, rows: 'order' });
  assert.deepEqual(p.stages, ['dout']);
  assert.equal(p.extras, undefined, 'everything comes from getScheduleDay (stage 5)');
  assert.equal(p.replaces, '/print/delivery-courier?direction=out');
});

test('route gate: a regular employee without page:deliveries gets 403, with the permission 200, head management 200', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const denied = await get('?page=PP-10&date=2026-10-15');
  assert.equal(denied.status, 403);
  assert.equal(denied.__json.page, 'PP-10');
  setup({ departmentPermission: [{ roleId: 5, key: 'page:schedule', value: 'true' }, { roleId: 5, key: 'page:deliveries', value: 'true' }] });
  globalThis.__AUTH_TOKEN = 'emp-worker';
  assert.equal((await get('?page=PP-10&date=2026-10-15')).status, 200);
  setup();
  globalThis.__AUTH_TOKEN = 'emp-head';
  assert.equal((await get('?page=PP-10&date=2026-10-15')).status, 200);
});

test('route: dispatch-day rows of stage 5 (order 1009, no street -> missing address), courier group title, DOT code, no extra query', async () => {
  globalThis.__AUTH_TOKEN = 'emp-head';
  const r = await get('?page=PP-10&date=2026-10-15');
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  const p = r.__json.pages[0];
  assert.equal(p.pageCode, 'ALL-DOT-261015');
  assert.equal(p.data.title, 'נתוני משלוחים למשלוחן · הלוך');
  assert.equal(p.data.groups.length, 1);
  const g = p.data.groups[0];
  assert.equal(g.title, 'משלוח הלוך אירועים יום שישי ה׳ חשוון תשפ״ז (משלוח יוצא יום חמישי)');
  assert.deepEqual(g.rows.map((x) => x.orderId), [1009]);
  const row = g.rows[0];
  assert.equal(row.code, 'DOT-1009');
  assert.equal(row.missingAddress, true);
  assert.equal(row.city, 'בית שמש');
  assert.equal(row.dressCount, 2);
  assert.equal(row.phone1, '050-1111111');
  assert.equal(p.data.totals.missingAddress, 1);
  assert.equal(p.data.sum, 'משלוח אחד · 2 שמלות');
  // no extra query: the only Order reads are the schedule's own (stage scans + getDeliveriesForDate)
  const extraQ = globalThis.__MOCK_CALLS.filter((c) => c.model === 'order' && c.args && c.args.select && c.args.select.payments && c.args.where && c.args.where.orderId);
  assert.equal(extraQ.length, 0);
  const deliveryQ = globalThis.__MOCK_CALLS.filter((c) => c.model === 'order' && c.args && c.args.where && c.args.where.isDelivery === true);
  assert.equal(deliveryQ.length, 1, 'lib/deliveries.js ran once for the whole request');
});

test('courierGroups keeps the shape of renderCourierDeliveryEmailHtml (title + customerName/address/customerPhone/customerPhone2)', async () => {
  globalThis.__AUTH_TOKEN = 'emp-head';
  const r = await get('?page=PP-10&date=2026-10-15');
  const cg = r.__json.pages[0].data.courierGroups;
  assert.equal(cg.length, 1);
  assert.deepEqual(Object.keys(cg[0]), ['title', 'rows']);
  assert.deepEqual(Object.keys(cg[0].rows[0]), ['customerName', 'address', 'customerPhone', 'customerPhone2']);
  assert.equal(cg[0].rows[0].customerName, 'דבורה חן');
});

const sd = (stageRows) => ({ date: '2026-10-14', weekday: 'יום רביעי', isToday: false, nonWorkingDay: false, settings: {}, stages: [{ key: 'dout', items: stageRows }] });
const row = (orderId, name, o = {}) => ({
  orderId, stage: 'dout', customer: { name, firstName: name.split(' ')[0], lastName: name.split(' ')[1] || '', phone1: '050-1111111', phone2: o.phone2 || '' },
  eventKey: o.eventKey || '2026-10-15', eventDateHebrew: null, dressCount: o.n || 1, notes: o.notes || '',
  address: { street: o.street ?? 'הרצל 1', city: o.city ?? 'ירושלים', full: '' }, dispatchDate: o.dispatch || '2026-10-14', ...o.more,
});

test('build: groups by event date ascending (like groupDeliveryRowsForCourier), rows by order id, two phones, notes, dressCount, flag for missing address', () => {
  const day = sd([
    row(30, 'ל מ', { eventKey: '2026-10-16', street: '', city: 'בני ברק' }),
    row(20, 'ג ד', { eventKey: '2026-10-15', phone2: '052-2222222', n: 3, notes: 'שער אחורי' }),
    row(10, 'א ב', { eventKey: '2026-10-15' }),
  ]);
  const d = mod.build({ day });
  assert.deepEqual(d.groups.map((g) => g.eventKey), ['2026-10-15', '2026-10-16']);
  assert.deepEqual(d.groups[0].rows.map((r) => r.orderId), [10, 20]);
  const r20 = d.groups[0].rows[1];
  assert.equal(r20.phone2, '052-2222222');
  assert.equal(r20.address, 'הרצל 1, ירושלים');
  assert.equal(r20.notes, 'שער אחורי');
  assert.equal(r20.dressCount, 3);
  const r30 = d.groups[1].rows[0];
  assert.equal(r30.missingAddress, true);
  assert.equal(r30.address, 'בני ברק');
  assert.equal(d.sum, '3 משלוחים · 5 שמלות');
  assert.equal(d.groups[1].title, 'משלוח הלוך אירועים יום שישי ה׳ חשוון תשפ״ז (משלוח יוצא יום רביעי)');
  assert.equal(mod.build({ day: sd([]) }).empty, true);
  assert.equal(mod.build({ day: { ...sd([]), stages: [] } }).empty, true);
});

test('payload: valid Code 39 codes; toRows has the courier columns (name, address, two phones) with numbers as numbers', () => {
  const day = sd([row(40113, 'מרים אברמוביץ', { phone2: '050-5550201', n: 2 })]);
  const payload = buildPrintPayload({ day, keys: ['PP-10'], now: new Date('2026-10-14T05:12:00Z') });
  const p = payload.pages[0];
  assert.ok(isValidCode39(p.pageCode) && isValidCode39(p.data.groups[0].rows[0].code));
  const sheets = payloadToRows(payload);
  assert.equal(sheets[0].sheetName, 'דף משלוח הלוך');
  assert.deepEqual(Object.keys(sheets[0].rows[0]), ['תאריך אירוע', 'הזמנה', 'שם מלא', 'כתובת', 'עיר', 'טלפון 1', 'טלפון 2', 'שמלות', 'הערות להזמנה']);
  assert.equal(sheets[0].rows[0]['הזמנה'], 40113);
  assert.equal(sheets[0].rows[0]['שמלות'], 2);
  assert.equal(sheets[0].rows[0]['טלפון 2'], '050-5550201');
  assert.equal(sheets[0].rows[0]['תאריך אירוע'], '15/10/2026');
});
