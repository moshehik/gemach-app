// Behavioural test of GET /api/orders/print-prep ("הכנות להיום") - the REAL route handler, with the in-memory
// prisma shim (scripts/business-days-tests/shims) and an always-logged-in lib/auth shim. Claim proven:
// the forward event window is derived from the rule + the owner's closed days, so closed weeks never drop orders
// (the fixed +12-day window used to). Regression guard for a regex typo that once made the derived window dead code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { L, eachKey, addKey, installDb } from './fixtures.mjs';

const B = await L('lib/businessDays.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const route = await L('app/api/orders/print-prep/route.js');

// The route compares machine-local midnights (parseDateOnly, same convention as before this PR), so the
// route-level test only makes sense where production runs. The pure-function tests below run in every zone.
const PROD_TZ = process.env.TZ === 'UTC' || process.env.TZ === 'Asia/Jerusalem';

const closedDays = (...ranges) => {
  const days = [];
  for (const [a, b] of ranges) for (const k of eachKey(a, b ?? a)) days.push({ date: k });
  return JSON.stringify(days);
};
const TWO_WEEKS = closedDays(['2026-11-02', '2026-11-08'], ['2026-11-09', '2026-11-15']); // two closed weeks
const CLOSED_WEEK = closedDays(['2026-11-02', '2026-11-08']);

const EVENTS = [...eachKey('2026-08-15', '2027-03-31')];
const orders = EVENTS.map((k, i) => ({ orderId: 5000 + i, isDeleted: false, status: null, eventDate: new Date(`${k}T00:00:00.000Z`), eventKey: k }));
const idOf = new Map(orders.map((o) => [o.eventKey, o.orderId]));

function setup(settingValue) {
  installDb({ settings: settingValue === null ? [] : [{ key: B.NON_WORKING_DAYS_SETTING_KEY, value: settingValue }], orders });
  invalidateSettingsCache();
}
const call = async (qs) => {
  const res = await route.GET(new Request(`http://test.local/api/orders/print-prep?${qs}`));
  return { status: res.status, body: await res.json() };
};
// independent expectation: events whose prep day (3 business days before) is within [from, to]
const expected = (from, to, cfg) => {
  const parsed = cfg === null ? null : B.parseNonWorkingDaysSetting(cfg);
  return orders.filter((o) => { const p = B.addBusinessDays(o.eventKey, -3, parsed); return p >= from && p <= to; }).map((o) => o.orderId).sort((a, b) => a - b);
};

test('pure function: valid keys give a derived end, invalid ones fall back to null (no regex involved)', () => {
  const cfg = B.parseNonWorkingDaysSetting(TWO_WEEKS);
  assert.ok(B.printPrepWindowEndKey('2026-10-01', '2026-10-01', null), 'valid key must be accepted');
  assert.equal(B.printPrepWindowEndKey('2026-10-01', '2026-10-01', null), B.eventRangeForOffset('2026-10-01', '2026-10-01', -3, null).endKey);
  for (const bad of ['dddd-dd-dd', 'garbage', '', null, undefined, '2026-02-30', '2026-10-01T05:00:00Z', '26-10-01']) {
    assert.equal(B.printPrepWindowEndKey(bad, '2026-10-01', cfg), null, `from=${bad}`);
    assert.equal(B.printPrepWindowEndKey('2026-10-01', bad, cfg), null, `to=${bad}`);
  }
  // the derived end really grows with closed days: target Thu 29.10.2026 -> events up to ...
  const plain = B.printPrepWindowEndKey('2026-10-29', '2026-10-29', null);
  const closed = B.printPrepWindowEndKey('2026-10-29', '2026-10-29', cfg);
  assert.ok(closed > plain, `two closed weeks push the end from ${plain} to ${closed}`);
  assert.ok((Date.parse(closed) - Date.parse('2026-10-29')) / 86400000 > 12, 'beyond the old fixed 12-day window');
  // end key is the latest matching event (brute force)
  for (const [from, to] of [['2026-10-29', '2026-10-29'], ['2026-10-26', '2026-10-30'], ['2026-11-16', '2026-11-16'], ['2026-09-10', '2026-09-10']]) {
    const matching = EVENTS.filter((e) => { const p = B.addBusinessDays(e, -3, cfg); return p >= from && p <= to; });
    const end = B.printPrepWindowEndKey(from, to, cfg);
    assert.ok(matching.length === 0 || end >= matching[matching.length - 1], `${from}..${to}: end ${end} covers ${matching[matching.length - 1]}`);
  }
});

test('print-prep route: with two closed weeks every order of the requested prep day is returned (derived window is live)', { skip: !PROD_TZ && 'route compares machine-local midnights (pre-existing convention)' }, async () => {
  setup(TWO_WEEKS);
  let beyondOld = 0, checks = 0;
  for (const d of eachKey('2026-10-05', '2026-12-20')) {
    const { status, body } = await call(`date=${d}`);
    assert.equal(status, 200, d);
    const want = expected(d, d, TWO_WEEKS);
    assert.deepEqual([...body.orderIds].sort((a, b) => a - b), want, `prep day ${d}`);
    assert.equal(body.count, want.length);
    // how many matching events lie beyond the OLD fixed window (target + 12 days)?
    for (const id of want) { const ev = orders.find((o) => o.orderId === id).eventKey; if (ev > addKey(d, 12)) beyondOld++; }
    checks++;
  }
  assert.ok(beyondOld >= 5, `the scenario must exercise the derived window (${beyondOld} orders lie beyond +12 days; the old fixed window dropped them)`);
  console.log(`# INFO print-prep route: ${checks} prep days, ${beyondOld} orders beyond the old +12 day window all returned`);
});

test('print-prep route: ranges, a single closed week and no owner list', { skip: !PROD_TZ && 'see above' }, async () => {
  for (const cfg of [null, CLOSED_WEEK, TWO_WEEKS]) {
    setup(cfg);
    for (const [from, to] of [['2026-10-26', '2026-10-30'], ['2026-11-16', '2026-11-20'], ['2026-09-01', '2026-09-30'], ['2026-12-20', '2027-01-10'], ['2026-11-04', '2026-11-04']]) {
      const { status, body } = await call(`from=${from}&to=${to}`);
      assert.equal(status, 200);
      assert.deepEqual([...body.orderIds].sort((a, b) => a - b), expected(from, to, cfg), `cfg=${cfg === null ? 'none' : cfg.length} ${from}..${to}`);
    }
  }
  // no setting row: same as the default rule (a few normal days)
  setup(null);
  for (const d of ['2026-09-10', '2026-11-05', '2026-12-31']) {
    assert.deepEqual([...(await call(`date=${d}`)).body.orderIds].sort((a, b) => a - b), expected(d, d, null), d);
  }
});

test('print-prep route: bad input is rejected / event mode untouched', { skip: !PROD_TZ && 'see above' }, async () => {
  setup(TWO_WEEKS);
  assert.equal((await call('')).status, 400);
  assert.equal((await call('date=garbage')).status, 400);
  const ev = await call('mode=event&date=2026-11-05');
  assert.deepEqual(ev.body.orderIds, [idOf.get('2026-11-05')]);
});
