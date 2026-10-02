// PP-12 "תעודות משלוח": כל הזמנה בעמוד A4 משלה (perOrderPage 'always'), ברקוד הכותרת DOT-<הזמנה> לכל תעודה, בלי ברקוד בתוך התעודה,
// כל הנתונים של "נתונים לשקית" הישן (PQ-06), שער page:deliveries, toRows. נתוני הדמה (1.10.2026) וסינתטיים.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { installDb } from '../schedule-tests/fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const route = await L('app/api/schedule/print/route.js');
const { invalidatePermissionCache } = await L('lib/permissions.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { invalidateRequireLoginCache } = await L('lib/auth.js');
const mod = await L('lib/schedule/print/pages/PP-12.js');
const { getPrintPage, isPerOrderPage } = await L('lib/schedule/print/registry.js');
const { buildPrintPayload, payloadToRows } = await L('lib/schedule/print/data.js');
const { isValidCode39 } = await L('lib/schedule/print/barcode.js');

const get = (qs = '') => route.GET({ url: 'http://localhost/api/schedule/print' + qs });
beforeEach(() => {
  installDb({});
  invalidateSettingsCache(); invalidateRequireLoginCache(); invalidatePermissionCache();
  globalThis.__AUTH_TOKEN = null;
});

test('registry: ready, every order on its own page (all versions), deliveries gate, DOT page code and NO row barcode', () => {
  const p = getPrintPage('PP-12');
  assert.equal(p.status, 'ready');
  assert.equal(p.perOrderPage, 'always');
  assert.equal(isPerOrderPage(p, null), true);
  assert.deepEqual(p.extraPageKeys, ['page:deliveries']);
  assert.deepEqual(p.barcode, { prefix: 'DOT', page: true, rows: null });
  assert.equal(p.replaces, '/print/delivery-bag');
});

test('route gate: 403 without page:deliveries, 200 for head management', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  assert.equal((await get('?page=PP-12&date=2026-10-01')).status, 403);
  globalThis.__AUTH_TOKEN = 'emp-head';
  assert.equal((await get('?page=PP-12&date=2026-10-01')).status, 200);
});

test('route: one note per outbound delivery of the day with everything the old bag print had (PQ-06)', async () => {
  globalThis.__AUTH_TOKEN = 'emp-head';
  const r = await get('?page=PP-12&date=2026-10-01');
  const d = r.__json.pages[0].data;
  assert.equal(d.title, 'תעודת משלוח');
  assert.deepEqual(d.orders.map((o) => o.orderId), [1009]);
  const o = d.orders[0];
  assert.equal(o.code, 'DOT-1009', 'the delivery itself, in the page header of its own page');
  assert.equal(o.name, 'דבורה חן');
  assert.equal(o.city, 'בית שמש');
  assert.equal(o.phone1, '050-1111111');
  assert.equal(o.eventFull, 'יום שישי כ״א תשרי תשפ״ז');
  assert.equal(o.eventGreg, '02/10/2026');
  assert.equal(o.dispatchFull, 'יום חמישי כ׳ תשרי');
  assert.equal(o.dispatchGreg, '01/10/2026');
  assert.equal(o.dressCount, 2);
  assert.equal('notes' in o, true);
  assert.equal(d.sum, 'תעודה אחת · 2 שמלות');
});

const sd = (items) => ({ date: '2026-10-14', weekday: 'יום רביעי', isToday: false, nonWorkingDay: false, settings: {}, stages: [{ key: 'dout', items }] });
const row = (orderId, name, o = {}) => ({
  orderId, stage: 'dout', customer: { name, firstName: name.split(' ')[0], lastName: name.split(' ')[1] || '', phone1: '050-1111111', phone2: o.phone2 || '' },
  eventKey: o.eventKey || '2026-10-15', eventDateHebrew: null, dressCount: o.n || 1, notes: o.notes || '',
  address: { street: o.street ?? 'הרצל 1', city: o.city ?? 'ירושלים', full: '' }, dispatchDate: o.dispatch || '2026-10-14',
});

test('build: notes sorted by order id, dispatch date from the row (not always the print day), notes text kept, missing address flagged', () => {
  const d = mod.build({ day: sd([row(30, 'ג ד', { notes: 'שער אחורי', dispatch: '2026-10-13' }), row(10, 'א ב', { street: '' })]) });
  assert.deepEqual(d.orders.map((o) => o.orderId), [10, 30]);
  assert.equal(d.orders[0].missingAddress, true);
  assert.equal(d.orders[1].notes, 'שער אחורי');
  assert.equal(d.orders[1].dispatchKey, '2026-10-13');
  assert.equal(d.orders[1].dispatchFull, 'יום שלישי ב׳ חשוון');
  assert.equal(d.sum, '2 תעודות · 2 שמלות');
  assert.equal(mod.build({ day: sd([]) }).empty, true);
});

test('payload: valid Code 39 per note; toRows has name, address, two phones, event + dispatch dates, notes', () => {
  const day = sd([row(40113, 'מרים אברמוביץ', { phone2: '050-5550201', n: 2, notes: 'להתקשר' })]);
  const payload = buildPrintPayload({ day, keys: ['PP-12'], now: new Date('2026-10-14T05:12:00Z') });
  const p = payload.pages[0];
  assert.ok(isValidCode39(p.data.orders[0].code));
  const sheets = payloadToRows(payload);
  assert.equal(sheets[0].sheetName, 'תעודות משלוח');
  assert.deepEqual(Object.keys(sheets[0].rows[0]), ['הזמנה', 'שם מלא', 'כתובת', 'עיר', 'טלפון 1', 'טלפון 2', 'תאריך אירוע', 'תאריך עברי', 'משלוח יוצא', 'שמלות', 'הערות להזמנה']);
  const r = sheets[0].rows[0];
  assert.equal(r['הזמנה'], 40113);
  assert.equal(r['משלוח יוצא'], '14/10/2026');
  assert.equal(r['תאריך אירוע'], '15/10/2026');
  assert.equal(r['הערות להזמנה'], 'להתקשר');
});
