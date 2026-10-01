// getScheduleDay על נתוני דמה: כל שלב, מונים, התראות, סינון סניף, מי במשמרת, חלונות השאילתות.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { installDb, NOW, DAY, SETTINGS_ORG2 } from './fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const { getScheduleDay } = await L('lib/schedule/index.js');
const { resolveScheduleSettings } = await L('lib/schedule/settings.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const D = await L('lib/schedule/dates.js');

const settingsMap = (rows) => Object.fromEntries(rows.map((r) => [r.key, r.value]));
const stageOf = (res, key) => res.stages.find((s) => s.key === key);
const ids = (res, key) => stageOf(res, key).items.map((r) => r.orderId).sort();

beforeEach(() => { installDb(); invalidateSettingsCache(); });

const manager = { id: 'emp-head', roleId: 0 };
const worker = { id: 'emp-worker', roleId: 5 };

async function day(date = DAY, over = {}) {
  return getScheduleDay({ date, user: manager, now: NOW, settings: resolveScheduleSettings(settingsMap(SETTINGS_ORG2)), ...over });
}

test('header: date, hebrew label, today/tomorrow computed in Israel time', async () => {
  const res = await day();
  assert.equal(res.date, DAY);
  assert.equal(res.isToday, true);
  assert.equal(res.today, '2026-10-01');
  assert.equal(res.tomorrow, '2026-10-02');
  assert.equal(res.weekday, 'יום חמישי');
  assert.match(res.dateHebrew, /תשרי/);
  assert.equal(res.nonWorkingDay, false);
  assert.deepEqual(res.dayStatus, { working: true, reasons: [], titles: [], note: null });
  assert.equal('dayFlags' in res, false, 'the old Fri/Sat + chag pair is gone - one unified flag with reasons');
  assert.equal(res.truncated, false);
  assert.deepEqual(res.stages.map((s) => s.number), [1, 2, 4, 5, 6, 7, 8, 9]);
  for (const s of res.stages) assert.equal('skipChag' in s, false, 'no per-stage calendar switch (unified rule)');
  assert.equal('skipChagAllStages' in res.settings, false);
  const r2 = await getScheduleDay({ user: manager, now: new Date('2026-10-01T21:30:00Z'), settings: resolveScheduleSettings({}) });
  assert.equal(r2.date, '2026-10-02', 'no date param + 00:30 Israel => tomorrow\'s Israeli date, not the UTC date');
  assert.equal(r2.nonWorkingDay, true, 'Fri 2.10.2026 = Hoshana Raba = erev Shmini Atzeret');
  assert.deepEqual(r2.dayStatus.reasons, ['friday', 'erev_chag']);
  assert.match(r2.dayStatus.titles[0], /שמיני עצרת/);
  assert.equal(r2.dayStatus.note, null);
});

test('owner-marked closed day (non_working_days_extra): flagged with reason "closed" + note; no prep/pickup/returns/deliveries on it; registrations, repairs (offset 0) and events still listed', async () => {
  const closed = JSON.stringify({ version: 1, days: [{ date: DAY, note: 'ספירת מלאי' }] });
  // The owner's list is ONE SystemSetting row: stages 2/4/6/8 get it through the resolved settings (ctx.nonWorkingDays),
  // stages 5/9 through lib/deliveries.js, which reads the same row from the settings cache itself. So the row must be
  // in the (mock) DB as well as in the injected settings - injecting it into the schedule settings alone would leave
  // the deliveries on the closed day (and would not represent production, where both read the same cache).
  const closedSettings = [...SETTINGS_ORG2, { key: 'non_working_days_extra', value: closed }];
  installDb({ settings: closedSettings });
  invalidateSettingsCache();
  const res = await day(DAY, { settings: resolveScheduleSettings(settingsMap(closedSettings)) });
  assert.equal(res.nonWorkingDay, true);
  assert.deepEqual(res.dayStatus, { working: false, reasons: ['closed'], titles: [], note: 'ספירת מלאי' });
  assert.deepEqual(ids(res, 'prep'), [], 'nothing is prepared on a closed day');
  assert.deepEqual(ids(res, 'pick'), []);
  // event-based returns (1013/1015, event 30.9) move to the next working day, and so does 1014 whose EXPLICIT toDate
  // is the closed Thursday: owner decision 2.10.2026 - a return never lands on a closed day (lib/lateReturn.js still
  // shows the explicit date unshifted on the order card - documented divergence, pending the owner's yes).
  assert.deepEqual(ids(res, 'manret'), [], 'nothing comes back on a closed day, not even an explicit toDate');
  assert.deepEqual(ids(res, 'dout'), [], 'lib/deliveries.js: no dispatch window on a closed day');
  assert.deepEqual(ids(res, 'dback'), []);
  assert.deepEqual(ids(res, 'order'), [1001, 1002], 'orders registered that day are a fact, not a plan');
  assert.deepEqual(ids(res, 'event'), [1011, 1012, 1014, 1016], 'events are the customer\'s dates');
  assert.deepEqual(ids(res, 'repair'), [1011], 'repair offset 0 = the event day itself');
  // the returns that were due on the closed Thursday are due on Sunday 4.10 (Fri/Sat closed anyway), together with Thu-Sat events
  invalidateSettingsCache();
  const sunday = await day('2026-10-04', { settings: resolveScheduleSettings(settingsMap(closedSettings)) });
  assert.equal(sunday.nonWorkingDay, false);
  // 1013/1015 (event 30.9, moved from the closed Thursday) + 1011/1016 (event 1.10) + 1009 (event Fri 2.10, outbound-only
  // delivery => comes back by hand; due Sunday with or without the closed Thursday) + the explicit dates that rolled
  // forward: 1014 (toDate = the closed Thursday) and 1012 (toDate Fri 2.10, erev chag).
  assert.deepEqual(ids(sunday, 'manret'), [1009, 1011, 1012, 1013, 1014, 1015, 1016]);
  const r1014 = stageOf(sunday, 'manret').items.find((r) => r.orderId === 1014);
  assert.equal(r1014.dueKey, '2026-10-04');
  assert.equal(r1014.dueKeyRaw, DAY, 'the original (explicit) date is kept for display');
  assert.ok(!ids(sunday, 'dback').includes(1009) && !ids(sunday, 'dout').includes(1009), '1009 is a manual return, not a courier row');
  // stages 5/9 follow the same rule through lib/deliveries.js: the courier collections of Thursday (1010/1022, event 30.9)
  // move to Sunday too; the outbound of 1009 (event Fri 2.10) moved EARLIER, to Wed 30.9 (see deliveries-legacy.test.mjs)
  assert.deepEqual(ids(sunday, 'dback'), [1010, 1022]);
  assert.deepEqual(ids(sunday, 'dout'), [1008], 'event Mon 5.10 goes out on Sunday as before; 1009 never moves past its event');
  for (const row of stageOf(sunday, 'dback').items) assert.equal(row.dispatchDate, '2026-10-04');
});

test('owner-marked closed Monday 5.10 shifts the pickup (stage 6) and prep (stage 4) windows of Thu 1.10 through the helper', async () => {
  const closed = JSON.stringify({ version: 1, days: ['2026-10-05'] });
  const res = await day(DAY, { settings: resolveScheduleSettings({ ...settingsMap(SETTINGS_ORG2), non_working_days_extra: closed }) });
  assert.equal(res.nonWorkingDay, false, 'Thursday itself is open');
  // pickup 2 business days before: events on the closed Monday AND on Tuesday are both picked up on Thursday
  assert.deepEqual(ids(res, 'pick'), [1005, 1006, 1007]);
  // prep 3 business days before: Wed 7.10 events - none in the fixture
  assert.deepEqual(ids(res, 'prep'), []);
  const monday = await day('2026-10-05', { settings: resolveScheduleSettings({ ...settingsMap(SETTINGS_ORG2), non_working_days_extra: closed }) });
  assert.equal(monday.nonWorkingDay, true);
  assert.deepEqual(monday.dayStatus.reasons, ['closed']);
  assert.deepEqual(ids(monday, 'pick'), []);
  assert.deepEqual(ids(monday, 'manret'), []);
});

test('stage 1: orders registered on the Israeli day only; drafts/deleted excluded; registered-by name without wage', async () => {
  const res = await day();
  const s = stageOf(res, 'order');
  assert.deepEqual(ids(res, 'order'), [1001, 1002]);
  assert.equal(s.infoOnly, true);
  assert.equal(s.counts.total, 2);
  const row = s.items.find((r) => r.orderId === 1002);
  assert.equal(row.registeredBy, 'רחלי לוי');
  assert.equal(row.done, null);
  assert.equal(JSON.stringify(row).includes('hourlyWage'), false);
  assert.equal(row.internalNotes, 'פנימי', 'manager sees internal notes');
  assert.equal(row.customer.name, 'רבקה ברק');
  // the DB window itself is the Israeli day (UTC+3 in October)
  const q = globalThis.__MOCK_CALLS.find((c) => c.model === 'order' && c.args.where.orderDate);
  assert.equal(q.args.where.orderDate.gte.toISOString(), '2026-09-30T21:00:00.000Z');
  assert.equal(q.args.where.orderDate.lte.toISOString(), '2026-10-01T20:59:59.999Z');
  assert.deepEqual(q.args.where.OR, [{ status: null }, { status: { not: 'טיוטה' } }], 'NULL-safe draft filter, never notIn');
});

test('stage 4 prep: 3 business days before the event (both storage forms), model name resolved by prefix', async () => {
  const res = await day();
  assert.deepEqual(ids(res, 'prep'), [1005, 1006]);
  const s = stageOf(res, 'prep');
  assert.equal(s.offsetBusinessDays, -3);
  assert.equal(s.doneSource, null);
  assert.equal(s.counts.unknown, 2, 'no done field => unknown, not pending');
  const r1005 = s.items.find((r) => r.orderId === 1005);
  assert.equal(r1005.items[0].model, 'ורד');
  assert.equal(r1005.items[0].location, 'מדף 3');
  assert.equal(r1005.dressCount, 1);
  const r1006 = s.items.find((r) => r.orderId === 1006);
  assert.equal(r1006.items[0].model, 'לילך', 'resolved via dressModel.findMany by barcodePrefix');
  assert.equal(r1006.dressCount, 2);
  assert.ok(res.warnings.some((w) => w.includes('שלב 4')), 'warns that stage 4 has no done field');
  assert.equal(globalThis.__MOCK_CALLS.filter((c) => c.model === 'dressModel').length, 1, 'one model lookup, no N+1');
});

test('stage 6 pickup: 2 business days before, delivery-out orders excluded, done = all items taken', async () => {
  const res = await day();
  assert.deepEqual(ids(res, 'pick'), [1007]);
  const row = stageOf(res, 'pick').items[0];
  assert.equal(row.done, false);
  assert.equal(row.doneSource, 'isTaken');
  assert.deepEqual(row.items.map((i) => i.taken), [true, false]);
  assert.deepEqual(row.alerts, [], 'today is not late');
  assert.equal(stageOf(res, 'pick').counts.pending, 1);
});

test('stage 5 delivery out: by dispatch day even when deliveries_select_by_event_date is on; missing address alert; no model', async () => {
  const res = await day();
  assert.deepEqual(ids(res, 'dout'), [1009]);
  const row = stageOf(res, 'dout').items[0];
  assert.equal(row.address.city, 'בית שמש');
  assert.equal(row.address.street, '');
  assert.deepEqual(row.alerts.map((a) => a.code), ['missing_delivery_address']);
  assert.equal(row.chargeExists, true);
  assert.equal(row.dispatchDate, '2026-10-01');
  assert.equal(row.dressCount, 2);
  assert.equal(row.items, undefined, 'no dress model details on delivery rows');
  assert.equal(res.settings.deliveryDaysBefore, 1);
  assert.equal(stageOf(res, 'dout').counts.alerts, 1);
});

test('stage 9 delivery return: event + delivery_days_after; excluded from manual return; return condition (A4)', async () => {
  const res = await day();
  assert.deepEqual(ids(res, 'dback'), [1010, 1022]);
  const row = stageOf(res, 'dback').items.find((r) => r.orderId === 1010);
  assert.equal(row.address.full, 'הרצל 5, בית שמש');
  assert.deepEqual(row.alerts, []);
  assert.equal(row.chargeExists, true);
  assert.equal(row.returnCondition, null, 'not returned yet => no condition');
  assert.equal(row.items, undefined, 'no dress model details');
  assert.ok(!ids(res, 'manret').includes(1010));
  const returned = stageOf(res, 'dback').items.find((r) => r.orderId === 1022);
  assert.equal(returned.returnCondition, 'ok', 'all items returned (flag or date) and returnedOk => ok');
  assert.equal(returned.dressCount, 2);
  assert.ok(!ids(res, 'manret').includes(1022), 'delivery-return order never lands in manual return');
  // stage 5 rows do not carry a return condition at all
  assert.equal('returnCondition' in stageOf(res, 'dout').items[0], false);
});

test('WP1 review #1: a DRAFT delivery order (autosaved cart) is NOT a delivery in stages 5/9, and the query filters it NULL-safely', async () => {
  const res = await day();
  assert.ok(!ids(res, 'dout').includes(9001), 'draft 9001 (event 2.10, delivery out 1.10) must not appear');
  assert.ok(!ids(res, 'dback').includes(9001));
  assert.equal(stageOf(res, 'dout').counts.alerts, 1, 'the draft (no street) must not add a missing-address alert');
  const q = globalThis.__MOCK_CALLS.find((c) => c.model === 'order' && c.args.where.isDelivery === true);
  assert.ok(q, 'deliveries query found');
  assert.deepEqual(q.args.where.AND, [{ OR: [{ status: null }, { status: { not: 'טיוטה' } }] }], 'NULL-safe draft filter, never notIn');
  // the existing /api/deliveries behaviour (no option) is unchanged: drafts still come back there
  const { getDeliveriesForDate } = await L('lib/deliveries.js');
  const plain = await getDeliveriesForDate(D.keyToLocalMidnight(DAY), { byDispatchDate: true });
  assert.ok(plain.data.some((d) => d.orderId === 9001), 'without excludeDrafts the legacy behaviour is kept');
  const filtered = await getDeliveriesForDate(D.keyToLocalMidnight(DAY), { byDispatchDate: true, excludeDrafts: true });
  assert.ok(!filtered.data.some((d) => d.orderId === 9001));
  assert.ok(filtered.data.some((d) => d.orderId === 1009));
});

test('A7: an order that is not paid yet still appears in stage 1 (only drafts/deleted are filtered); amount + paid flag on the row', async () => {
  const res = await day('2026-09-29');
  assert.deepEqual(ids(res, 'order'), [1021]);
  const row = stageOf(res, 'order').items[0];
  assert.equal(row.isPaid, false);
  assert.equal(row.totalAmount, 500);
  assert.equal(row.customer.name, 'לא שולם');
  // the where clause never touches isPaid / a non-draft status
  const q = globalThis.__MOCK_CALLS.find((c) => c.model === 'order' && c.args.where.orderDate);
  assert.equal(q.args.where.isPaid, undefined);
  assert.deepEqual(q.args.where.OR, [{ status: null }, { status: { not: 'טיוטה' } }]);
  // and a paid order's row carries the flag too
  const today = await day();
  assert.equal(stageOf(today, 'order').items.find((r) => r.orderId === 1001).isPaid, false);
  assert.equal(stageOf(today, 'order').items.find((r) => r.orderId === 1001).totalAmount, null);
});

test('A3: stage 8 rows carry the dress COUNT (number only), never the models', async () => {
  const res = await day();
  for (const row of stageOf(res, 'manret').items) {
    assert.equal(typeof row.dressCount, 'number', 'order ' + row.orderId);
    assert.equal(row.items, undefined);
  }
  assert.equal(stageOf(res, 'manret').items.find((r) => r.orderId === 1013).dressCount, 1);
  assert.equal(stageOf(res, 'manret').items.find((r) => r.orderId === 1014).dressCount, 1);
  assert.equal(stageOf(res, 'manret').showModel, false);
});

test('A2: stage 1 is "registered that day" only - an order registered 29.9 is not on 30.9 or 1.10, whatever its event date', async () => {
  assert.ok(!ids(await day('2026-09-30'), 'order').includes(1021));
  assert.ok(!ids(await day(), 'order').includes(1021));
  assert.deepEqual(ids(await day('2026-09-29'), 'order'), [1021]);
});

test('stage 7 event: event day + abroad period spanning the day; info only', async () => {
  const res = await day();
  // 1012: abroad 28.9-2.10 spans the day; 1014: abroad 29.9-1.10 ends on the day (still "away" that day)
  assert.deepEqual(ids(res, 'event'), [1011, 1012, 1014, 1016]);
  const s = stageOf(res, 'event');
  assert.equal(s.infoOnly, true);
  const abroad = s.items.find((r) => r.orderId === 1012);
  assert.equal(abroad.flags.isAbroad, true);
  assert.equal(abroad.eventKey, '2026-09-28');
  assert.equal(s.counts.total, 4);
  assert.equal(s.counts.done + s.counts.pending + s.counts.unknown, 0, 'info-only: no done counters');
  const r1011 = s.items.find((r) => r.orderId === 1011);
  assert.equal(r1011.eventDateHebrew, 'כ תשרי');
  assert.equal(r1011.items[0].model, 'ורד');
});

test('stage 2 repairs: offset 0 = event day, only items with a real alteration, done = all alteration items done', async () => {
  const res = await day();
  assert.deepEqual(ids(res, 'repair'), [1011], "1016 has lengthAlteration 'null' (legacy junk) => no repair");
  const row = stageOf(res, 'repair').items[0];
  assert.equal(row.items.length, 2);
  assert.equal(row.done, false);
  assert.deepEqual(row.items.map((i) => i.done), [false, true]);
  assert.equal(row.items[0].neckAlteration, 2);
});

test('stage 8 manual return: due day, delivery-return orders excluded, return condition ok/not_ok', async () => {
  const res = await day();
  assert.deepEqual(ids(res, 'manret'), [1013, 1014, 1015]);
  const s = stageOf(res, 'manret');
  const r1013 = s.items.find((r) => r.orderId === 1013);
  assert.equal(r1013.done, false);
  assert.equal(r1013.returnCondition, null);
  assert.equal(r1013.address.full, 'יפו 10, ירושלים');
  assert.equal(r1013.items, undefined, 'no model on manual-return rows');
  assert.deepEqual(r1013.alerts, [], 'due today: 0 days late');
  assert.equal(r1013.dueKey, DAY);
  assert.equal(r1013.dueKeyRaw, DAY, 'event 30.9 + 1 business day = Thu 1.10, a working day: no roll');
  const r1014 = s.items.find((r) => r.orderId === 1014);
  assert.equal(r1014.done, true);
  assert.equal(r1014.returnCondition, 'not_ok');
  assert.equal(r1014.dueKeyRaw, DAY, 'explicit toDate on a working day stays');
  assert.equal(s.counts.done, 1);
  assert.equal(s.counts.pending, 2);
});

// החלטת הבעלים 2.10.2026: "ההחזרה של אירוע בחמישי תהיה בראשון" - שלב 8 נוחת תמיד על יום עובד
test('owner decision 2.10: explicit toDate/returnDate on Fri/Shabbat/erev chag roll forward to the next working day (stage 8 only)', async () => {
  // Fri 16.10 (2002 toDate) and Shabbat 17.10 (2003 returnDate): nothing on the closed days themselves
  for (const closed of ['2026-10-16', '2026-10-17']) {
    const r = await day(closed);
    assert.equal(r.nonWorkingDay, true, closed);
    assert.deepEqual(ids(r, 'manret'), [], 'no manual return on ' + closed);
    const q = globalThis.__MOCK_CALLS.find((c) => c.model === 'order' && c.args.where.AND && c.args.where.isDelivery === undefined);
    assert.ok(q, 'event query still runs (prep/pick/event stages)');
    assert.ok(!q.args.where.AND[2].OR.some((o) => o.toDate || o.returnDate), 'no toDate/returnDate clause at all on a closed day');
  }
  // Sunday 18.10 collects them, together with 2006 (event Fri 16.10 + 1 business day) and 1001 (event Thu 15.10 + 1
  // business day - the owner's own example: "the return of a Thursday event is on Sunday")
  globalThis.__MOCK_CALLS = []; // look at Sunday's query only, not the closed days' queries above
  const sun = await day('2026-10-18');
  assert.equal(sun.nonWorkingDay, false);
  assert.deepEqual(ids(sun, 'manret'), [1001, 2002, 2003, 2006]);
  const rows = Object.fromEntries(stageOf(sun, 'manret').items.map((r) => [r.orderId, r]));
  assert.equal(rows[2002].dueKey, '2026-10-18');
  assert.equal(rows[2002].dueKeyRaw, '2026-10-16', 'original explicit date kept for the UI');
  assert.equal(rows[2003].dueKeyRaw, '2026-10-17');
  assert.equal(rows[2006].dueKeyRaw, '2026-10-18', 'event-based: already a working day, raw = due');
  // the explicit-date window of the query = Sunday + the closed run before it (Fri + Shabbat)
  const q = globalThis.__MOCK_CALLS.find((c) => c.model === 'order' && c.args.where.AND && c.args.where.isDelivery === undefined);
  const or = q.args.where.AND[2].OR;
  assert.deepEqual(or.find((o) => o.toDate), { toDate: { gte: D.dayRange('2026-10-16').start, lte: D.dayRange('2026-10-18').end } });
  assert.deepEqual(or.find((o) => o.returnDate), { returnDate: { gte: D.dayRange('2026-10-16').start, lte: D.dayRange('2026-10-18').end } });
  // erev Yom Kippur (Sun 20.9, 2004 toDate) -> Tue 22.9, not 20.9
  assert.deepEqual(ids(await day('2026-09-20'), 'manret'), []);
  assert.deepEqual(ids(await day('2026-09-22'), 'manret'), [2004]);
  // courier returns (stage 9) are untouched by this rule - they already land on a working day via lib/deliveries.js
  assert.deepEqual(ids(await day(), 'dback'), [1010, 1022]);
});

test('owner decision 2.10: schedule_stage_manret_days=0 (return on the event day) also rolls an event on Friday to Sunday', async () => {
  const settings = resolveScheduleSettings({ ...settingsMap(SETTINGS_ORG2), schedule_stage_manret_days: '0' });
  assert.equal(settings.stages.manret.offset, 0);
  const fri = await day('2026-10-16', { settings });
  assert.deepEqual(ids(fri, 'manret'), [], 'Friday itself: nothing');
  const sun = await day('2026-10-18', { settings });
  assert.deepEqual(ids(sun, 'manret'), [2002, 2003, 2006], '2006 (event Fri 16.10) rolls to Sunday with offset 0; 2002/2003 explicit');
  assert.equal(stageOf(sun, 'manret').items.find((r) => r.orderId === 2006).dueKeyRaw, '2026-10-16');
  // a working day with offset 0 = the event day itself (and nothing from the days before it)
  const thu = await day('2026-10-15', { settings });
  assert.deepEqual(ids(thu, 'manret'), [1001], 'offset 0 on a working day = the event day itself (1001, event Thu 15.10); 2003 (event 15.10) has an explicit returnDate on Shabbat -> Sunday; 2006 (event 16.10) is not due on 15.10');
});

test('owner decision 2.10: an explicit toDate on an owner-closed day moves to the day after', async () => {
  const closed = JSON.stringify({ version: 1, days: [{ date: '2026-10-13', note: 'ספירת מלאי' }] });
  const closedSettings = [...SETTINGS_ORG2, { key: 'non_working_days_extra', value: closed }];
  installDb({ settings: closedSettings });
  invalidateSettingsCache();
  const settings = resolveScheduleSettings(settingsMap(closedSettings));
  assert.deepEqual(ids(await day('2026-10-13', { settings }), 'manret'), []);
  const wed = await day('2026-10-14', { settings });
  assert.ok(ids(wed, 'manret').includes(2005), '2005 (toDate Tue 13.10) is due Wed 14.10');
  assert.equal(stageOf(wed, 'manret').items.find((r) => r.orderId === 2005).dueKeyRaw, '2026-10-13');
  // without the owner list the same order is due on Tuesday
  installDb();
  invalidateSettingsCache();
  assert.ok(ids(await day('2026-10-13'), 'manret').includes(2005));
  assert.ok(!ids(await day('2026-10-14'), 'manret').includes(2005));
});

test('owner decision 2.10: late_not_done counts from the ROLLED due day (documented divergence from lib/lateReturn.js, which counts from the explicit date)', async () => {
  // 2002: toDate Fri 16.10 -> due Sun 18.10. Seen on 25.10: 7 days late (threshold 7) => alert; on 24.10: 6 days => none.
  const late = await day('2026-10-18', { now: new Date('2026-10-25T06:00:00Z') });
  const row = stageOf(late, 'manret').items.find((r) => r.orderId === 2002);
  assert.deepEqual(row.alerts.map((a) => a.code), ['late_not_done']);
  assert.equal(row.alerts[0].daysLate, 7);
  const notYet = await day('2026-10-18', { now: new Date('2026-10-24T06:00:00Z') });
  assert.deepEqual(stageOf(notYet, 'manret').items.find((r) => r.orderId === 2002).alerts, []);
  // lib/lateReturn.js (order card / late list / cron) still counts from the explicit Friday: 9 days on 25.10
  const LR = await L('lib/lateReturn.js');
  const info = LR.getLateReturnInfo({ eventDate: '2026-10-14T00:00:00.000Z', toDate: '2026-10-16T00:00:00.000Z' }, 7, new Date('2026-10-25T06:00:00Z'));
  assert.equal(info.daysLate, 9, 'documented gap: the order card counts 9, the schedule 7 - pending the owner\'s decision on rolling there too');
});

test('review 2.10 blocker 2: an abroad/weekday order whose fromDate differs from eventDate is found by prep/pickup/repair (fromDate in the SQL window)', async () => {
  // 1023: fromDate Tue 13.10 (effective start), eventDate 27.10. prep = 13.10 - 3 business days = Thu 8.10; pickup = Sun 11.10
  assert.equal(D.addBusinessDays('2026-10-13', -3), '2026-10-08');
  assert.equal(D.addBusinessDays('2026-10-13', -2), '2026-10-11');
  const prep = await day('2026-10-08');
  assert.ok(ids(prep, 'prep').includes(1023), 'prep on Thu 8.10');
  assert.equal(stageOf(prep, 'prep').items.find((r) => r.orderId === 1023).eventKey, '2026-10-13', 'eventKey = effective start');
  const pick = await day('2026-10-11');
  assert.ok(ids(pick, 'pick').includes(1023), 'pickup on Sun 11.10');
  // repair on the effective start day, even when the event stage (whose period-overlap clause used to pull the row by accident) is off
  globalThis.__MOCK_CALLS = [];
  const noEvent = await day('2026-10-13', { settings: resolveScheduleSettings({ ...settingsMap(SETTINGS_ORG2), schedule_stage_event_enabled: 'false' }) });
  assert.ok(ids(noEvent, 'repair').includes(1023), 'repair on 13.10 without the event stage');
  // and the SQL window itself carries fromDate next to eventDate
  const q = globalThis.__MOCK_CALLS.find((c) => c.model === 'order' && c.args.where.AND && c.args.where.isDelivery === undefined);
  const or = q.args.where.AND[2].OR;
  assert.ok(or[0].eventDate && or[1].fromDate, 'eventDate range + fromDate range');
  assert.deepEqual(or[1].fromDate, or[0].eventDate, 'same union window on both columns');
});

test('late alerts on a past day (2026-09-24): return 7 days late, pickup not done', async () => {
  const res = await day('2026-09-24');
  assert.equal(res.isToday, false);
  assert.deepEqual(ids(res, 'manret'), [1017]);
  const ret = stageOf(res, 'manret').items[0];
  assert.deepEqual(ret.alerts.map((a) => a.code), ['late_not_done']);
  assert.equal(ret.alerts[0].daysLate, 7);
  // 1012 (abroad, period starts Mon 28.9) and 1018 (event Mon 28.9): pickup Thu 24.9 (25-27.9 = Fri, Shabbat/Sukkot, Sun... -> 2 business days back)
  assert.deepEqual(ids(res, 'pick'), [1012, 1018]);
  for (const pick of stageOf(res, 'pick').items) assert.deepEqual(pick.alerts.map((a) => a.code), ['late_not_done'], 'order ' + pick.orderId);
  assert.equal(res.totals.alerts, 3);
});

test('totals exclude info-only stages', async () => {
  const res = await day();
  // repair 1 + prep 2 + dout 1 + pick 1 + manret 3 + dback 2 = 10
  assert.equal(res.totals.total, 10);
  assert.equal(res.totals.done, 1);
  assert.equal(res.totals.pending, 4); // repair 1, pick 1, manret 2
  assert.equal(res.totals.unknown, 5); // prep 2, dout 1, dback 2
});

test('event-based query: one Order query with a union window + the NULL-safe draft filter', async () => {
  await day();
  // (the deliveries query also carries an AND now - the draft filter - but it is keyed by isDelivery)
  const eventQueries = globalThis.__MOCK_CALLS.filter((c) => c.model === 'order' && c.args.where.AND && c.args.where.isDelivery === undefined);
  assert.equal(eventQueries.length, 1);
  const where = eventQueries[0].args.where;
  assert.deepEqual(where.AND[0], { isDeleted: false });
  assert.deepEqual(where.AND[1], { OR: [{ status: null }, { status: { not: 'טיוטה' } }] });
  const or = where.AND[2].OR;
  assert.equal(or[0].eventDate.gte.toISOString(), '2026-09-29T21:00:00.000Z', 'earliest source day: Sep 30 (manual return +1)');
  assert.equal(or[0].eventDate.lte.toISOString(), '2026-10-06T20:59:59.999Z', 'latest source day: Oct 6 (prep -3)');
  assert.deepEqual(or[1], { fromDate: or[0].eventDate }, 'the same window on fromDate (abroad/weekday orders start on fromDate)');
  assert.equal(or.length, 5, 'eventDate, fromDate, period overlap (stage 7), toDate, returnDate');
  assert.equal(globalThis.__MOCK_CALLS.filter((c) => c.model === 'order').length, 3, 'orderDate query + event query + deliveries query');
});

test('branch filter: applies only when branches are enabled; pickup uses pickupBranch; branch list comes with the response', async () => {
  const res = await day(DAY, { branch: 'גב״ש', settings: resolveScheduleSettings({ ...settingsMap(SETTINGS_ORG2), branch_list: 'נווה יעקב, גב״ש ,' }) });
  assert.deepEqual(ids(res, 'prep'), [1006]);
  assert.deepEqual(ids(res, 'pick'), [1007]);
  assert.deepEqual(ids(res, 'event'), []);
  assert.equal(res.settings.branchFilter, 'גב״ש');
  assert.deepEqual(res.settings.branches, ['נווה יעקב', 'גב״ש'], 'branch_list parsed and trimmed, no extra /api/settings call needed by the page');
  assert.deepEqual((await day()).settings.branches, [], 'no branch_list row => empty list');
  const off = await getScheduleDay({ date: DAY, branch: 'גב״ש', user: manager, now: NOW, settings: resolveScheduleSettings({ ...settingsMap(SETTINGS_ORG2), branches_enabled: 'false' }) });
  assert.deepEqual(ids(off, 'prep'), [1005, 1006], 'filter ignored when branches_enabled is not true');
  assert.equal(off.settings.branchFilter, null);
  assert.deepEqual(off.settings.branches, [], 'no branch list when branches are off');
});

test('org1-style settings (deliveries off): stages 5/9 disabled and empty, no deliveries query', async () => {
  const res = await getScheduleDay({ date: DAY, user: manager, now: NOW, settings: resolveScheduleSettings({}) });
  assert.equal(stageOf(res, 'dout').enabled, false);
  assert.deepEqual(ids(res, 'dout'), []);
  assert.equal(res.settings.deliveryDaysBefore, null);
  assert.equal(globalThis.__MOCK_CALLS.filter((c) => c.model === 'order').length, 2);
  // 1008 is a delivery order but deliveries are off for this org: it still is NOT a local pickup (isDelivery is on the order itself)
  assert.deepEqual(ids(res, 'pick'), [1007]);
});

test('settings loaded from the (mock) DB through the settings cache when not injected', async () => {
  const res = await getScheduleDay({ date: DAY, user: manager, now: NOW });
  assert.equal(res.settings.deliveriesEnabled, true);
  assert.deepEqual(ids(res, 'dout'), [1009]);
});

test('stage offsets from settings: prep 1 business day before', async () => {
  const res = await getScheduleDay({ date: DAY, user: manager, now: NOW, settings: resolveScheduleSettings({ ...settingsMap(SETTINGS_ORG2), schedule_stage_prep_days: '1' }) });
  // 1 business day before Oct 1 (Thu) <- events on Fri Oct 2, Sat Oct 3, Sun Oct 4: fixture events are Oct 2 (1009, delivery) only
  assert.deepEqual(ids(res, 'prep'), [1009]);
  assert.equal(stageOf(res, 'prep').offsetBusinessDays, -1);
});

test('disabled stage returns no rows and no warning', async () => {
  const res = await getScheduleDay({ date: DAY, user: manager, now: NOW, settings: resolveScheduleSettings({ ...settingsMap(SETTINGS_ORG2), schedule_stage_prep_enabled: 'false' }) });
  assert.equal(stageOf(res, 'prep').enabled, false);
  assert.deepEqual(ids(res, 'prep'), []);
  assert.ok(!res.warnings.some((w) => w.includes('שלב 4')));
});

test('internal notes hidden from a regular employee and from a guest', async () => {
  const w = await day(DAY, { user: worker });
  assert.equal(stageOf(w, 'order').items[0].internalNotes, undefined);
  assert.equal(w.settings.includeInternalNotes, false);
  const g = await day(DAY, { user: null });
  assert.equal(stageOf(g, 'dout').items[0].internalNotes, undefined);
});

test('staff on shift (today): names only, open shift from last night included, closed/deleted excluded', async () => {
  const res = await day();
  assert.equal(res.isToday, true);
  assert.deepEqual(res.staff.map((s) => s.name), ['פייגי ברוך', 'רחלי לוי', 'שרה גולד']);
  assert.deepEqual(res.staff.map((s) => s.open), [true, true, false]);
  const json = JSON.stringify(res.staff);
  assert.equal(json.includes('hourlyWage'), false);
  assert.equal(json.includes('totalCalculated'), false);
  const q = globalThis.__MOCK_CALLS.find((c) => c.model === 'shift');
  assert.equal(q.args.where.isDeleted, false);
  assert.equal(q.args.where.OR[0].entryTime.gte.toISOString(), '2026-09-30T21:00:00.000Z');
  assert.equal(q.args.select.employee.select.hourlyWage, undefined);
});

test('invalid date rejected', async () => {
  await assert.rejects(() => day('2026-13-01'), (e) => e.status === 400);
  await assert.rejects(() => day('01/10/2026'), (e) => e.status === 400);
});

test('WP1 review #4: a well-formed date far outside +-3 years is a 400, not a RangeError/500', async () => {
  await assert.rejects(() => day('9999-12-31'), (e) => e.status === 400 && /מחוץ לטווח/.test(e.message));
  await assert.rejects(() => day('0100-01-01'), (e) => e.status === 400);
  await assert.rejects(() => day('2023-09-30'), (e) => e.status === 400, '3 years + 1 day back');
  await assert.rejects(() => day('2029-10-02'), (e) => e.status === 400, '3 years + 1 day ahead');
  assert.equal(globalThis.__MOCK_CALLS.filter((c) => c.model === 'order').length, 0, 'rejected dates never reach the DB');
  const edgeAhead = await day('2029-10-01');
  assert.equal(edgeAhead.date, '2029-10-01', 'exactly 3 years ahead works');
  // 1.10.2029 = 22 Tishrei 5790 = Shmini Atzeret: the unified rule flags it, and lib/deliveries.js skips its query
  // on a non-working day (2 order queries instead of 3) - the schedule still answers, it is just empty of plans.
  assert.equal(edgeAhead.nonWorkingDay, true);
  assert.deepEqual(edgeAhead.dayStatus.reasons, ['chag']);
  assert.equal(globalThis.__MOCK_CALLS.filter((c) => c.model === 'order').length, 2, 'orderDate query + event query; no deliveries query on a chag');
  const edgeBack = await day('2023-10-01');
  assert.equal(edgeBack.date, '2023-10-01');
  assert.equal(edgeBack.nonWorkingDay, false, 'Sun 1.10.2023 = chol hamoed Sukkot, a working day under rule v1');
  assert.equal(globalThis.__MOCK_CALLS.filter((c) => c.model === 'order').length, 5, 'a working day adds all 3 queries');
});

test('WP1 review #5: "who is on shift" for a FUTURE or PAST day never includes today\'s open shifts', async () => {
  const tomorrow = await day('2026-10-02');
  assert.deepEqual(tomorrow.staff, [], 'nobody has entered on 2.10 yet; s1/s2 (open today) must not leak into tomorrow');
  const q = globalThis.__MOCK_CALLS.find((c) => c.model === 'shift');
  assert.equal(q.args.where.OR.length, 1, 'no "open shift from yesterday" clause on a non-today day');
  const yesterday = await day('2026-09-30');
  assert.deepEqual(yesterday.staff.map((s) => s.name), ['אתמול סגורה', 'פייגי ברוך'], 'only shifts that entered on 30.9 (s3 closed, s2 entered 23:00 IL)');
  assert.deepEqual(yesterday.staff.map((s) => s.open), [false, true]);
  const nextWeek = await day('2026-10-08');
  assert.deepEqual(nextWeek.staff, []);
});

test('scan cap: truncated flag + warning when more orders than schedule_max_scan_rows', async () => {
  const res = await getScheduleDay({ date: DAY, user: manager, now: NOW, settings: { ...resolveScheduleSettings(settingsMap(SETTINGS_ORG2)), maxScanRows: 2 } });
  assert.equal(res.truncated, true);
  assert.ok(res.warnings.some((w) => w.includes('נסרקו רק 2')));
});

test('same answers regardless of the process timezone (sanity: TZ=' + (process.env.TZ || 'default') + ')', async () => {
  const res = await day();
  assert.equal(D.todayKey(NOW), '2026-10-01');
  assert.deepEqual(ids(res, 'prep'), [1005, 1006]);
  assert.deepEqual(ids(res, 'manret'), [1013, 1014, 1015]);
  assert.deepEqual(ids(res, 'order'), [1001, 1002]);
});
