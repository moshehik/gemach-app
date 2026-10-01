// אי-שבירה של /api/deliveries: getDeliveriesForDate בלי אפשרויות (כמו שהנתיב הקיים, מייל השליח ודפי ההדפסה
// קוראים לה) חייבת להתנהג בדיוק כמו לפני הלו״ז - אותה שאילתה, אותן שורות (כולל טיוטות), אותם שדות ישנים,
// בלי dispatchDates במצב הרגיל ובלי internalNotes לעולם. האפשרויות החדשות (byDispatchDate / includeInternalNotes /
// excludeDrafts) הן opt-in בלבד. תוכנית V1, חבילה 1.C.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { installDb, DAY, SETTINGS_ORG2 } from './fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const { getDeliveriesForDate } = await L('lib/deliveries.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const D = await L('lib/schedule/dates.js');

// השדות שהצרכנים הקיימים קוראים (app/deliveries, print/delivery-*, courier-email, lib/deliveryCourier.js, a5/adv-b)
const LEGACY_ROW_KEYS = [
  'orderId', 'customerFirstName', 'customerLastName', 'customerName', 'customerPhone', 'customerPhone2',
  'address', 'city', 'eventDate', 'eventDateHebrew', 'dressModelNames', 'directions', 'notes', 'chargeExists',
];
const NEW_OPTIONAL_KEYS = ['internalNotes'];
const SETTINGS_LEGACY = SETTINGS_ORG2.map((s) => (s.key === 'deliveries_select_by_event_date' ? { ...s, value: 'false' } : s));
const ids = (res) => res.data.map((r) => r.orderId).sort();
const deliveriesQuery = () => globalThis.__MOCK_CALLS.find((c) => c.model === 'order' && c.args?.where?.isDelivery === true);

beforeEach(() => { invalidateSettingsCache(); });

test('default mode (deliveries_select_by_event_date off), NO options: same query, same rows (drafts included), legacy fields, no dispatchDates', async () => {
  installDb({ settings: SETTINGS_LEGACY });
  const res = await getDeliveriesForDate(D.keyToLocalMidnight(DAY));
  assert.deepEqual(Object.keys(res), ['daysBefore', 'daysAfter', 'selectByEventDate', 'data'], 'result shape unchanged');
  assert.equal(res.daysBefore, 1);
  assert.equal(res.daysAfter, 1);
  assert.equal(res.selectByEventDate, false);
  // 1009 out (event 2.10), 1010 + 1022 return (event 30.9), 9001 = DRAFT delivery - the legacy route showed drafts and still does
  assert.deepEqual(ids(res), [1009, 1010, 1022, 9001]);
  assert.deepEqual(res.data.find((r) => r.orderId === 1009).directions, ['out']);
  assert.deepEqual(res.data.find((r) => r.orderId === 1010).directions, ['return']);
  assert.deepEqual(res.data.find((r) => r.orderId === 1009).chargeExists, { out: true, return: false });
  assert.equal(res.data.find((r) => r.orderId === 1009).customerName, 'דבורה חן');
  for (const row of res.data) {
    for (const k of LEGACY_ROW_KEYS) assert.ok(k in row, `legacy field "${k}" missing on order ${row.orderId}`);
    assert.equal('dispatchDates' in row, false, 'dispatchDates is never sent in the default mode (legacy contract)');
    for (const k of NEW_OPTIONAL_KEYS) assert.equal(k in row, false, `${k} must stay opt-in (order ${row.orderId})`);
  }
  // the Prisma where clause is byte-for-byte the legacy one: no draft filter (AND) was added
  const q = deliveriesQuery();
  assert.ok(q, 'deliveries query found');
  assert.deepEqual(Object.keys(q.args.where).sort(), ['OR', 'isDeleted', 'isDelivery'], 'no extra where keys without options');
  assert.equal(q.args.where.isDeleted, false);
  assert.equal(q.args.where.isDelivery, true);
  const win = (k) => D.dayRange(k);
  assert.deepEqual(q.args.where.OR, [
    { eventDate: { gte: win('2026-10-02').start, lte: win('2026-10-02').end } }, // outbound: date + delivery_days_before
    { eventDate: { gte: win('2026-09-30').start, lte: win('2026-09-30').end } }, // return: date - delivery_days_after
  ]);
  assert.deepEqual(q.args.orderBy, { eventDate: 'asc' });
  assert.deepEqual(q.args.include.items.where, { isDeleted: false });
  assert.equal(q.args.include.items.select.description, true, 'legacy item field still selected');
  assert.deepEqual(q.args.include.obligations, { where: { isDeleted: false }, select: { description: true } });
});

test('"select by event date" mode (org2 setting), NO options: event-day query, dispatchDates kept (legacy behaviour of that mode), drafts included', async () => {
  installDb({ settings: SETTINGS_ORG2 });
  const res = await getDeliveriesForDate(D.keyToLocalMidnight('2026-10-02'));
  assert.equal(res.selectByEventDate, true);
  assert.deepEqual(ids(res), [1009, 9001], 'orders whose EVENT is on 2.10 (incl. the draft, as before)');
  const row = res.data.find((r) => r.orderId === 1009);
  assert.deepEqual(row.directions, ['out']);
  assert.deepEqual(row.dispatchDates, { out: '2026-10-01' }, 'this mode always sent dispatchDates');
  assert.equal('internalNotes' in row, false);
  const q = deliveriesQuery();
  assert.deepEqual(Object.keys(q.args.where).sort(), ['OR', 'isDeleted', 'isDelivery']);
  assert.deepEqual(q.args.where.OR, [{ eventDate: { gte: D.dayRange('2026-10-02').start, lte: D.dayRange('2026-10-02').end } }]);
});

test('calling with an empty options object equals calling with no options at all', async () => {
  installDb({ settings: SETTINGS_LEGACY });
  const a = await getDeliveriesForDate(D.keyToLocalMidnight(DAY));
  invalidateSettingsCache();
  const b = await getDeliveriesForDate(D.keyToLocalMidnight(DAY), {});
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('the options are opt-in: only byDispatchDate changes the mode, only includeInternalNotes adds the field, only excludeDrafts filters the query', async () => {
  installDb({ settings: SETTINGS_ORG2 });
  const byDispatch = await getDeliveriesForDate(D.keyToLocalMidnight(DAY), { byDispatchDate: true });
  assert.equal(byDispatch.selectByEventDate, false, 'schedule mode ignores the org2 setting');
  assert.deepEqual(ids(byDispatch), [1009, 1010, 1022, 9001]);
  assert.equal('internalNotes' in byDispatch.data[0], false);
  invalidateSettingsCache();
  const withNotes = await getDeliveriesForDate(D.keyToLocalMidnight(DAY), { byDispatchDate: true, includeInternalNotes: true });
  assert.equal(withNotes.data.find((r) => r.orderId === 1009).internalNotes, 'פנימי');
  invalidateSettingsCache();
  globalThis.__MOCK_CALLS = [];
  const noDrafts = await getDeliveriesForDate(D.keyToLocalMidnight(DAY), { byDispatchDate: true, excludeDrafts: true });
  assert.deepEqual(ids(noDrafts), [1009, 1010, 1022]);
  assert.deepEqual(deliveriesQuery().args.where.AND, [{ OR: [{ status: null }, { status: { not: 'טיוטה' } }] }]);
});
