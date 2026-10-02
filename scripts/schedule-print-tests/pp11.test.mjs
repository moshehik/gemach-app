// PP-11 "רשימת שליח לפי עיר": קיבוץ לפי עיר (הכי הרבה עצירות קודם, "ללא עיר" אחרון), מספור עצירות רציף, תיבת "נמסר", ברקוד DOT,
// שער page:deliveries, toRows. נתוני הדמה (1.10.2026: 1009 בית שמש בלי רחוב) וסינתטיים.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { installDb } from '../schedule-tests/fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const route = await L('app/api/schedule/print/route.js');
const { invalidatePermissionCache } = await L('lib/permissions.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { invalidateRequireLoginCache } = await L('lib/auth.js');
const mod = await L('lib/schedule/print/pages/PP-11.js');
const { getPrintPage } = await L('lib/schedule/print/registry.js');
const { buildPrintPayload, payloadToRows } = await L('lib/schedule/print/data.js');

const get = (qs = '') => route.GET({ url: 'http://localhost/api/schedule/print' + qs });
beforeEach(() => {
  installDb({});
  invalidateSettingsCache(); invalidateRequireLoginCache(); invalidatePermissionCache();
  globalThis.__AUTH_TOKEN = null;
});

test('registry: ready, deliveries gate, DOT barcode', () => {
  const p = getPrintPage('PP-11');
  assert.equal(p.status, 'ready');
  assert.deepEqual(p.extraPageKeys, ['page:deliveries']);
  assert.deepEqual(p.barcode, { prefix: 'DOT', page: true, rows: 'order' });
  assert.equal(p.replaces, undefined);
});

test('route: 403 without page:deliveries; 200 for head management with the city grouping of order 1009', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  assert.equal((await get('?page=PP-11&date=2026-10-01')).status, 403);
  globalThis.__AUTH_TOKEN = 'emp-head';
  const r = await get('?page=PP-11&date=2026-10-01');
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  const p = r.__json.pages[0];
  assert.equal(p.data.title, 'רשימת שליח לפי עיר');
  assert.deepEqual(p.data.groups.map((g) => g.city), ['בית שמש']);
  assert.equal(p.data.groups[0].rows[0].stop, 1);
  assert.equal(p.data.groups[0].rows[0].missingAddress, true);
  assert.equal(p.data.sum, 'עיר אחת · עצירה אחת · 2 שמלות');
});

const sd = (items) => ({ date: '2026-10-14', weekday: 'יום רביעי', isToday: false, nonWorkingDay: false, settings: {}, stages: [{ key: 'dout', items }] });
const row = (orderId, city, o = {}) => ({
  orderId, stage: 'dout', customer: { name: 'ל' + orderId, firstName: 'ל', lastName: String(orderId), phone1: '050-1111111', phone2: o.phone2 || '' },
  eventKey: '2026-10-15', eventDateHebrew: null, dressCount: o.n || 1, notes: '', address: { street: o.street ?? 'הרצל ' + orderId, city, full: '' }, dispatchDate: '2026-10-14',
});

test('build: cities by stop count desc then name, no-city last; stops numbered 1..N across the whole page; orders by id inside a city', () => {
  const day = sd([
    row(9, 'רחובות'), row(8, 'בני ברק'), row(7, 'ירושלים'), row(6, ''), row(5, 'ירושלים'), row(4, 'בני ברק'), row(3, 'ירושלים', { n: 2 }), row(2, 'אלעד'),
  ]);
  const d = mod.build({ day });
  assert.deepEqual(d.groups.map((g) => g.city), ['ירושלים', 'בני ברק', 'אלעד', 'רחובות', 'ללא עיר']);
  assert.deepEqual(d.groups.map((g) => g.rows.length), [3, 2, 1, 1, 1]);
  assert.deepEqual(d.groups[0].rows.map((r) => r.orderId), [3, 5, 7]);
  const stops = d.groups.flatMap((g) => g.rows.map((r) => r.stop));
  assert.deepEqual(stops, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(d.groups[0].dresses, 4);
  assert.equal(d.sum, '5 ערים · 8 עצירות · 9 שמלות');
  assert.equal(d.totals.stops, 8);
  assert.equal(mod.build({ day: sd([]) }).empty, true);
});

test('payload + toRows: one row per stop with stop number, city, street, two phones (cities with equal stop counts: by name)', () => {
  const day = sd([row(40113, 'ירושלים', { phone2: '052-2222222', n: 2 }), row(40100, 'בני ברק')]);
  const payload = buildPrintPayload({ day, keys: ['PP-11'], now: new Date('2026-10-14T05:12:00Z') });
  assert.equal(payload.pages[0].pageCode, 'ALL-DOT-261014');
  const sheets = payloadToRows(payload);
  assert.equal(sheets[0].sheetName, 'רשימת שליח לפי עיר');
  assert.deepEqual(Object.keys(sheets[0].rows[0]), ['עצירה', 'עיר', 'הזמנה', 'שם', 'רחוב ומספר', 'טלפון 1', 'טלפון 2', 'שמלות', 'הערות להזמנה']);
  assert.deepEqual(sheets[0].rows.map((r) => [r['עצירה'], r['עיר'], r['הזמנה']]), [[1, 'בני ברק', 40100], [2, 'ירושלים', 40113]]);
  assert.equal(sheets[0].rows[1]['טלפון 2'], '052-2222222');
});
