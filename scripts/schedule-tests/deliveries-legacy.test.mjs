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
// opt-in only (includeInternalNotes / withScheduleFields): never on a legacy row (review 2.10, blocker 3 -
// scripts/business-days-tests/deliveries-parity.test.mjs test D checks the row shape byte-for-byte against the old code)
const NEW_OPTIONAL_KEYS = ['internalNotes', 'street', 'dressCount', 'branch', 'pickupBranch', 'isAbroad', 'isWeekdayEvent', 'extraDay', 'customSpacing', 'fromDate', 'toDate', 'returnCondition'];
const SCHEDULE_KEYS = NEW_OPTIONAL_KEYS.filter((k) => k !== 'internalNotes');
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
  // 1009 out (event 16.10), 1010 + 1022 return (event 14.10), 9001 = DRAFT delivery - the legacy route showed drafts and still does
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
  // ימי עסקים, והחלון הוא ההופכי המלא. delivery_skip_weekends כבוי כאן, ולכן שישי/שבת רגילים נספרים כימי משלוח:
  // חמישי 15.10 + 1 = שישי 16.10, והחלון מתכווץ ליום אחד. חזור: 15.10 פחות יום עסקים = רביעי 14.10.
  assert.deepEqual(q.args.where.OR, [
    { eventDate: { gte: win('2026-10-16').start, lte: win('2026-10-16').end } }, // outbound: every event whose dispatch day is 15.10
    { eventDate: { gte: win('2026-10-14').start, lte: win('2026-10-14').end } }, // return: date - delivery_days_after
  ]);
  assert.deepEqual(q.args.orderBy, { eventDate: 'asc' });
  assert.deepEqual(q.args.include.items, { where: { isDeleted: false }, select: { description: true } }, 'legacy item select, byte-for-byte');
  assert.deepEqual(q.args.include.obligations, { where: { isDeleted: false }, select: { description: true } });
  assert.deepEqual(Object.keys(res.data[0]).sort(), [...LEGACY_ROW_KEYS].sort(), 'no key beyond the legacy contract');

  // חג / חול המועד / ערב חג מדולגים תמיד, גם כש-delivery_skip_weekends כבוי (אין משלוח ביום טוב; חול המועד סגור מגרסה 2,
  // NWD-Q02). חמישי 24.9.2026 הוא יום העבודה האחרון לפני סוכות: שישי 25.9 ערב סוכות, שבת 26.9 סוכות, 27.9-1.10 חול המועד,
  // שישי 2.10 הושענא רבה = ערב שמיני עצרת, שבת 3.10 שמיני עצרת - ולכן כל אירוע מ-25.9 עד ראשון 4.10 יוצא ב-24.9.
  // (לפני #200 החלון היה יום האירוע הראשון בלבד - אירוע בחג לא היה נמצא לעולם, האי-סימטריה שהבעלים אישר לתקן.)
  installDb({ settings: SETTINGS_LEGACY });
  invalidateSettingsCache();
  await getDeliveriesForDate(D.keyToLocalMidnight('2026-09-24'));
  assert.deepEqual(deliveriesQuery().args.where.OR, [
    { eventDate: { gte: win('2026-09-25').start, lte: win('2026-10-04').end } }, // outbound: 24.9 + 1 delivery day = Sun 4.10
    { eventDate: { gte: win('2026-09-23').start, lte: win('2026-09-23').end } }, // return: Wed 23.9 + 1 = Thu 24.9
  ]);
});

test('withScheduleFields (only lib/schedule/loaders.js passes it): adds the schedule fields + the return-state item columns; byDispatchDate alone does not', async () => {
  installDb({ settings: SETTINGS_LEGACY });
  const plain = await getDeliveriesForDate(D.keyToLocalMidnight(DAY), { byDispatchDate: true, excludeDrafts: true });
  for (const row of plain.data) for (const k of SCHEDULE_KEYS) assert.equal(k in row, false, `${k} must stay opt-in (order ${row.orderId})`);
  assert.deepEqual(deliveriesQuery().args.include.items.select, { description: true });
  invalidateSettingsCache();
  globalThis.__MOCK_CALLS = [];
  const sched = await getDeliveriesForDate(D.keyToLocalMidnight(DAY), { byDispatchDate: true, excludeDrafts: true, withScheduleFields: true });
  for (const row of sched.data) for (const k of SCHEDULE_KEYS) assert.ok(k in row, `${k} missing on order ${row.orderId}`);
  assert.deepEqual(deliveriesQuery().args.include.items.select, { description: true, isReturned: true, returnDate: true, returnedOk: true });
  assert.equal(sched.data.find((r) => r.orderId === 1022).returnCondition, 'ok');
  assert.equal(sched.data.find((r) => r.orderId === 1009).street, '', 'missing street is visible to the schedule alert');
  assert.deepEqual(ids(sched), ids(plain), 'same rows either way');
});

test('"select by event date" mode (org2 setting), NO options: event-day query, dispatchDates kept (legacy behaviour of that mode), drafts included', async () => {
  installDb({ settings: SETTINGS_ORG2 });
  const res = await getDeliveriesForDate(D.keyToLocalMidnight('2026-10-16'));
  assert.equal(res.selectByEventDate, true);
  assert.deepEqual(ids(res), [1009, 9001], 'orders whose EVENT is on 16.10 (incl. the draft, as before)');
  const row = res.data.find((r) => r.orderId === 1009);
  assert.deepEqual(row.directions, ['out']);
  assert.deepEqual(row.dispatchDates, { out: '2026-10-15' }, 'this mode always sent dispatchDates');
  assert.equal('internalNotes' in row, false);
  const q = deliveriesQuery();
  assert.deepEqual(Object.keys(q.args.where).sort(), ['OR', 'isDeleted', 'isDelivery']);
  assert.deepEqual(q.args.where.OR, [{ eventDate: { gte: D.dayRange('2026-10-16').start, lte: D.dayRange('2026-10-16').end } }]);
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
  assert.deepEqual(res.data.find((r) => r.orderId === 1009).dispatchDates, { out: '2026-10-15' }, 'event Fri 16.10 - 1 business day = Thu 15.10');
  assert.deepEqual(res.data.find((r) => r.orderId === 1010).dispatchDates, { return: '2026-10-15' }, 'event Wed 14.10 + 1 business day = Thu 15.10');
});

test('owner-marked closed day (non_working_days_extra): no delivery leaves or is collected on it - empty result, no DB query; the dispatches move to the neighbouring working days', async () => {
  const closedThursday = [...SETTINGS_LEGACY, { key: 'non_working_days_extra', value: JSON.stringify({ version: 1, days: [{ date: DAY, note: 'ספירת מלאי' }] }) }];
  installDb({ settings: closedThursday });
  const res = await getDeliveriesForDate(D.keyToLocalMidnight(DAY), { byDispatchDate: true, excludeDrafts: true });
  assert.deepEqual(res.data, []);
  assert.equal(deliveriesQuery(), undefined, 'no deliveries query at all on a closed day');

  // Outbound is counted BACKWARDS from the event (event - delivery_days_before business days), so a delivery that
  // would have left on the closed Thursday leaves EARLIER - on Wed 14.10, the last working day before it. Order 1009
  // (event Fri 16.10): 16.10 - 1 business day = Thu 15.10 (closed) -> Wed 14.10.
  invalidateSettingsCache();
  const wednesday = await getDeliveriesForDate(D.keyToLocalMidnight('2026-10-14'), { byDispatchDate: true, excludeDrafts: true });
  assert.deepEqual(ids(wednesday), [1009], 'event 16.10 now goes out on Wed 14.10; no return is collected that day (no delivery event on Tue 13.10)');
  assert.deepEqual(wednesday.data[0].directions, ['out']);
  assert.deepEqual(wednesday.data[0].dispatchDates, { out: '2026-10-14' });
  // the outbound window on 14.10 is the full inverse: the closed Thursday + Fri 16.10 (a delivery day here, weekends are not skipped)
  const win = (k) => D.dayRange(k);
  assert.deepEqual(deliveriesQuery().args.where.OR[0], { eventDate: { gte: win('2026-10-15').start, lte: win('2026-10-16').end } });

  // Returns are counted FORWARDS (event + delivery_days_after), so the collections that were due on the closed
  // Thursday move LATER - to the next delivery day. delivery_skip_weekends is off in these settings, so that is Fri 16.10
  // (only chag / chol hamoed / erev chag / owner days are always skipped). Orders 1010 + 1022 (event Wed 14.10, הלוך-חזור):
  // 14.10 + 1 business day = Fri 16.10.
  invalidateSettingsCache();
  const friday = await getDeliveriesForDate(D.keyToLocalMidnight('2026-10-16'), { byDispatchDate: true, excludeDrafts: true });
  assert.deepEqual(ids(friday), [1010, 1022]);
  assert.deepEqual(friday.data.find((r) => r.orderId === 1010).directions, ['return']);
  assert.deepEqual(friday.data.find((r) => r.orderId === 1010).dispatchDates, { return: '2026-10-16' });
  assert.ok(!ids(friday).includes(1009), 'an outbound delivery never moves to after its event');
  // 1008 (event Mon 19.10) goes out on Sunday 18.10 as before; nothing is collected on Sunday (no delivery event on Sat 17.10)
  invalidateSettingsCache();
  const sunday = await getDeliveriesForDate(D.keyToLocalMidnight('2026-10-18'), { byDispatchDate: true, excludeDrafts: true });
  assert.deepEqual(ids(sunday), [1008]);
  assert.deepEqual(sunday.data[0].dispatchDates, { out: '2026-10-18' });

  // without the closed Thursday the same Friday collects nothing from 14.10 (those returns are on Thu 15.10 - see the default-mode test)
  installDb({ settings: SETTINGS_LEGACY });
  invalidateSettingsCache();
  const fridayOpen = await getDeliveriesForDate(D.keyToLocalMidnight('2026-10-16'), { byDispatchDate: true, excludeDrafts: true });
  assert.deepEqual(ids(fridayOpen), []);
});
