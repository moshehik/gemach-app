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
  assert.deepEqual(res.dayFlags, { isFridayOrShabbat: false, isChag: false });
  assert.equal(res.truncated, false);
  assert.deepEqual(res.stages.map((s) => s.number), [1, 2, 4, 5, 6, 7, 8, 9]);
  const r2 = await getScheduleDay({ user: manager, now: new Date('2026-10-01T21:30:00Z'), settings: resolveScheduleSettings({}) });
  assert.equal(r2.date, '2026-10-02', 'no date param + 00:30 Israel => tomorrow\'s Israeli date, not the UTC date');
  assert.equal(r2.dayFlags.isFridayOrShabbat, true);
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
  const r1014 = s.items.find((r) => r.orderId === 1014);
  assert.equal(r1014.done, true);
  assert.equal(r1014.returnCondition, 'not_ok');
  assert.equal(s.counts.done, 1);
  assert.equal(s.counts.pending, 2);
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
  assert.equal(globalThis.__MOCK_CALLS.filter((c) => c.model === 'order').length, 3, 'orderDate query + event query + deliveries query');
});

test('branch filter: applies only when branches are enabled; pickup uses pickupBranch', async () => {
  const res = await day(DAY, { branch: 'גב״ש' });
  assert.deepEqual(ids(res, 'prep'), [1006]);
  assert.deepEqual(ids(res, 'pick'), [1007]);
  assert.deepEqual(ids(res, 'event'), []);
  assert.equal(res.settings.branchFilter, 'גב״ש');
  const off = await getScheduleDay({ date: DAY, branch: 'גב״ש', user: manager, now: NOW, settings: resolveScheduleSettings({ ...settingsMap(SETTINGS_ORG2), branches_enabled: 'false' }) });
  assert.deepEqual(ids(off, 'prep'), [1005, 1006], 'filter ignored when branches_enabled is not true');
  assert.equal(off.settings.branchFilter, null);
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
  assert.equal((await day('2029-10-01')).date, '2029-10-01', 'exactly 3 years ahead works');
  assert.equal((await day('2023-10-01')).date, '2023-10-01');
  assert.equal(globalThis.__MOCK_CALLS.filter((c) => c.model === 'order').length, 6, 'rejected dates never reach the DB');
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
