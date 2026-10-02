// PP-18 "דף משלוח חזור (למשלוחן)": אותו דף כמו 10 בכיוון חזור - שלב 9 (dback), ברקוד DBK, כותרת "משלוח נאסף", שער page:deliveries,
// נתוני הדמה (1.10.2026: 1010 ו-1022) ו-toRows.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { installDb } from '../schedule-tests/fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const route = await L('app/api/schedule/print/route.js');
const { invalidatePermissionCache } = await L('lib/permissions.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { invalidateRequireLoginCache } = await L('lib/auth.js');
const mod = await L('lib/schedule/print/pages/PP-18.js');
const { getPrintPage } = await L('lib/schedule/print/registry.js');
const { buildPrintPayload, payloadToRows } = await L('lib/schedule/print/data.js');

const get = (qs = '') => route.GET({ url: 'http://localhost/api/schedule/print' + qs });
beforeEach(() => {
  installDb({});
  invalidateSettingsCache(); invalidateRequireLoginCache(); invalidatePermissionCache();
  globalThis.__AUTH_TOKEN = null;
});

test('registry: ready, deliveries gate, DBK barcode, stage 9', () => {
  const p = getPrintPage('PP-18');
  assert.equal(p.status, 'ready');
  assert.deepEqual(p.extraPageKeys, ['page:deliveries']);
  assert.deepEqual(p.barcode, { prefix: 'DBK', page: true, rows: 'order' });
  assert.deepEqual(p.stages, ['dback']);
});

test('route gate: 403 without page:deliveries, 200 for head management', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  assert.equal((await get('?page=PP-18&date=2026-10-01')).status, 403);
  globalThis.__AUTH_TOKEN = 'emp-head';
  assert.equal((await get('?page=PP-18&date=2026-10-01')).status, 200);
});

test('route: pick-up stops of 1.10 (1010, 1022) grouped under one event date, DBK codes, "נאסף" in the title', async () => {
  globalThis.__AUTH_TOKEN = 'emp-head';
  const r = await get('?page=PP-18&date=2026-10-01');
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  const p = r.__json.pages[0];
  assert.equal(p.pageCode, 'ALL-DBK-261001');
  assert.equal(p.data.title, 'נתוני משלוחים למשלוחן · חזור');
  assert.equal(p.data.sub, 'שם, כתובת ושני טלפונים לכל איסוף');
  assert.equal(p.data.groups.length, 1);
  assert.equal(p.data.groups[0].title, 'משלוח חזור אירועים יום רביעי י״ט תשרי תשפ״ז (משלוח נאסף יום חמישי)');
  assert.deepEqual(p.data.groups[0].rows.map((x) => x.orderId), [1010, 1022]);
  assert.deepEqual(p.data.groups[0].rows.map((x) => x.code), ['DBK-1010', 'DBK-1022']);
  assert.equal(p.data.groups[0].rows[0].address, 'הרצל 5, בית שמש');
  assert.equal(p.data.sum, '2 איסופים · 3 שמלות');
  assert.deepEqual(Object.keys(p.data.courierGroups[0].rows[0]), ['customerName', 'address', 'customerPhone', 'customerPhone2']);
});

test('the outbound stage does not leak into the return page (1009 is outbound only)', async () => {
  globalThis.__AUTH_TOKEN = 'emp-head';
  const r = await get('?page=PP-18&date=2026-10-01');
  const ids = r.__json.pages[0].data.groups.flatMap((g) => g.rows.map((x) => x.orderId));
  assert.equal(ids.includes(1009), false);
  assert.equal(ids.includes(9001), false, 'draft excluded');
});

test('toRows + empty day', () => {
  const day = { date: '2026-10-14', weekday: 'יום רביעי', isToday: false, nonWorkingDay: false, settings: {}, stages: [{ key: 'dback', items: [{
    orderId: 7, stage: 'dback', customer: { name: 'ר ש', phone1: '050-1', phone2: '' }, eventKey: '2026-10-13', dressCount: 2, notes: '', address: { street: 'א 1', city: 'ב', full: 'א 1, ב' }, dispatchDate: '2026-10-14',
  }] }] };
  const payload = buildPrintPayload({ day, keys: ['PP-18'], now: new Date('2026-10-14T05:12:00Z') });
  const sheets = payloadToRows(payload);
  assert.equal(sheets[0].sheetName, 'דף משלוח חזור');
  assert.equal(sheets[0].rows[0]['הזמנה'], 7);
  assert.equal(sheets[0].rows[0]['תאריך אירוע'], '13/10/2026');
  assert.equal(mod.build({ day: { ...day, stages: [{ key: 'dback', items: [] }] } }).empty, true);
});
