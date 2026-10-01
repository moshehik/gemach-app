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
  // החלונות לפי הכלל האחיד (main אחרי #200, lib/businessDays.js): יום היציאה = אירוע פחות delivery_days_before
  // ימי עסקים, והחלון הוא ההופכי המלא. חמישי 1.10.2026 + 1 יום עסקים: שישי 2.10 הוא הושענא רבה = ערב שמיני
  // עצרת ושבת 3.10 הוא החג - שניהם לא ימי עבודה (delivery_skip_weekends כבוי כאן, אבל חג/ערב חג מדולגים
  // תמיד), ולכן כל אירוע מ-2.10 עד ראשון 4.10 יוצא ביום חמישי. (לפני #200 החלון היה 2.10 בלבד - אירוע
  // ב-3.10/4.10 לא היה נמצא לעולם, האי-סימטריה שהבעלים אישר לתקן.) חזור: 1.10 פחות יום עסקים = רביעי 30.9.
  assert.deepEqual(q.args.where.OR, [
    { eventDate: { gte: win('2026-10-02').start, lte: win('2026-10-04').end } }, // outbound: every event whose dispatch day is 1.10
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

test('byDispatchDate: dispatchDates are computed with the unified rule (same helper as the schedule and the print pages)', async () => {
  installDb({ settings: SETTINGS_LEGACY });
  const res = await getDeliveriesForDate(D.keyToLocalMidnight(DAY), { byDispatchDate: true, excludeDrafts: true });
  assert.deepEqual(res.data.find((r) => r.orderId === 1009).dispatchDates, { out: '2026-10-01' }, 'event Fri 2.10 (erev chag) - 1 business day = Thu 1.10');
  assert.deepEqual(res.data.find((r) => r.orderId === 1010).dispatchDates, { return: '2026-10-01' }, 'event Wed 30.9 + 1 business day = Thu 1.10');
});

test('owner-marked closed day (non_working_days_extra): no delivery leaves or is collected on it - empty result, no DB query; the dispatches move to the neighbouring working days', async () => {
  const closedThursday = [...SETTINGS_LEGACY, { key: 'non_working_days_extra', value: JSON.stringify({ version: 1, days: [{ date: DAY, note: 'ספירת מלאי' }] }) }];
  installDb({ settings: closedThursday });
  const res = await getDeliveriesForDate(D.keyToLocalMidnight(DAY), { byDispatchDate: true, excludeDrafts: true });
  assert.deepEqual(res.data, []);
  assert.equal(deliveriesQuery(), undefined, 'no deliveries query at all on a closed day');

  // Outbound is counted BACKWARDS from the event (event - delivery_days_before business days), so a delivery that
  // would have left on the closed Thursday leaves EARLIER - on Wed 30.9, the last working day before it. Order 1009
  // (event Fri 2.10, erev chag): 2.10 - 1 business day = Thu 1.10 (closed) -> Wed 30.9.
  invalidateSettingsCache();
  const wednesday = await getDeliveriesForDate(D.keyToLocalMidnight('2026-09-30'), { byDispatchDate: true, excludeDrafts: true });
  assert.deepEqual(ids(wednesday), [1009], 'event 2.10 now goes out on Wed 30.9; no return is collected that day (no delivery event on Tue 29.9)');
  assert.deepEqual(wednesday.data[0].directions, ['out']);
  assert.deepEqual(wednesday.data[0].dispatchDates, { out: '2026-09-30' });
  // the outbound window on 30.9 is the full inverse: every event from the closed Thursday through Sun 4.10
  const win = (k) => D.dayRange(k);
  assert.deepEqual(deliveriesQuery().args.where.OR[0], { eventDate: { gte: win('2026-10-01').start, lte: win('2026-10-04').end } });

  // Returns are counted FORWARDS (event + delivery_days_after), so the collections that were due on the closed
  // Thursday move LATER - to Sun 4.10 (Fri 2.10 erev chag + Sat 3.10 chag are closed anyway). Orders 1010 + 1022
  // (event Wed 30.9, הלוך-חזור): 30.9 + 1 business day = Sun 4.10. 1008 (event Mon 5.10) goes out on Sunday as before.
  invalidateSettingsCache();
  const sunday = await getDeliveriesForDate(D.keyToLocalMidnight('2026-10-04'), { byDispatchDate: true, excludeDrafts: true });
  assert.deepEqual(ids(sunday), [1008, 1010, 1022]);
  assert.deepEqual(sunday.data.find((r) => r.orderId === 1010).directions, ['return']);
  assert.deepEqual(sunday.data.find((r) => r.orderId === 1010).dispatchDates, { return: '2026-10-04' });
  assert.deepEqual(sunday.data.find((r) => r.orderId === 1008).dispatchDates, { out: '2026-10-04' });
  assert.ok(!ids(sunday).includes(1009), 'an outbound delivery never moves to after its event');

  // without the closed Thursday the same Sunday collects nothing from 30.9 (those returns are on Thu 1.10 - see the default-mode test)
  installDb({ settings: SETTINGS_LEGACY });
  invalidateSettingsCache();
  const sundayOpen = await getDeliveriesForDate(D.keyToLocalMidnight('2026-10-04'), { byDispatchDate: true, excludeDrafts: true });
  assert.deepEqual(ids(sundayOpen), [1008]);
});
