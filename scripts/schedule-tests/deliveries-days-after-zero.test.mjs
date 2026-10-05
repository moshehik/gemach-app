// SCH-DELIV-0 (החלטת הבעלים 4.10.2026, אפשרות ב' "ליום העבודה הבא"): delivery_days_after = 0 -> משלוח החזרה ביום
// האירוע עצמו, אבל אירוע שנופל על יום סגור (שישי / שבת / חג / ערב חג / יום שהבעלים סגר) נאסף ביום העבודה הבא -
// כמו החזרה ידנית (rollForwardToWorkingDay ב-lib/businessDays.js). days_after > 0 - בלי שינוי.
// רץ ב-3 אזורי זמן (run.mjs). בלי DB אמיתי (prisma בזיכרון, shims/prisma.mjs).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { installDb, NOW, SETTINGS_ORG2 } from './fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const { getDeliveriesForDate, returnDispatchKey, returnEventKeyRange } = await L('lib/deliveries.js');
const B = await L('lib/businessDays.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const D = await L('lib/schedule/dates.js');
const { getScheduleDay } = await L('lib/schedule/index.js');
const { resolveScheduleSettings } = await L('lib/schedule/settings.js');

function eachKey(a, b) { const out = []; for (let k = a; k <= b; k = D.addCalendarDays(k, 1)) out.push(k); return out; }

// 2026-10: שישי 2.10 ערב שמיני עצרת, שבת 3.10 שמיני עצרת (חג), שישי 9.10 / שבת 10.10 סוף שבוע רגיל
const CLOSED_TUE = JSON.stringify({ version: 1, days: [{ date: '2026-10-13', note: 'ספירת מלאי' }] });
const NW = B.parseNonWorkingDaysSetting(CLOSED_TUE);

beforeEach(() => invalidateSettingsCache());

test('returnDispatchKey(…, 0): a working event day stays; Fri / Shabbat / chag / erev chag / owner-closed roll to the next working day - whatever delivery_skip_weekends says', () => {
  for (const countOpts of [{ skipWeekend: false }, { skipWeekend: true }]) {
    const at = (k) => returnDispatchKey(k, 0, NW, countOpts);
    assert.equal(at('2026-10-07'), '2026-10-07', 'Wed: same day');
    assert.equal(at('2026-10-08'), '2026-10-08', 'Thu: same day');
    assert.equal(at('2026-10-09'), '2026-10-11', 'Fri -> Sun');
    assert.equal(at('2026-10-10'), '2026-10-11', 'Shabbat -> Sun');
    assert.equal(at('2026-10-02'), '2026-10-04', 'erev Shemini Atzeret (Fri) -> Sun');
    assert.equal(at('2026-10-03'), '2026-10-04', 'Shemini Atzeret (Shabbat) -> Sun');
    assert.equal(at('2026-10-13'), '2026-10-14', 'owner-closed Tue -> Wed');
    assert.equal(at('2026-09-21'), '2026-09-22', 'Yom Kippur (Mon) -> Tue');
    assert.equal(at('2026-09-20'), '2026-09-22', 'erev Yom Kippur (Sun) -> Tue');
    // identical to the manual-return helper (stage 8) for every day of a year
    for (const k of eachKey('2026-09-01', '2027-08-31')) assert.equal(at(k), B.rollForwardToWorkingDay(k, NW), k);
  }
});

test('days_after > 0 is unchanged: returnDispatchKey === addBusinessDays and returnEventKeyRange === inverseBusinessDays (both weekend settings, with an owner list)', () => {
  for (const countOpts of [{ skipWeekend: false }, { skipWeekend: true }]) {
    for (const n of [1, 2, 3]) {
      for (const k of eachKey('2026-09-01', '2027-03-31')) {
        assert.equal(returnDispatchKey(k, n, NW, countOpts), B.addBusinessDays(k, n, NW, countOpts), `${n} ${k}`);
        assert.deepEqual(returnEventKeyRange(k, n, NW, countOpts), B.inverseBusinessDays(k, n, NW, countOpts), `${n} ${k}`);
      }
    }
  }
});

test('returnEventKeyRange(…, 0) is the exact inverse of returnDispatchKey(…, 0) (brute force over a year); a closed day collects nothing', () => {
  const events = eachKey('2026-08-20', '2027-09-10');
  for (const countOpts of [{ skipWeekend: false }, { skipWeekend: true }]) {
    for (const day of eachKey('2026-09-01', '2027-08-31')) {
      const want = events.filter((e) => returnDispatchKey(e, 0, NW, countOpts) === day);
      const r = returnEventKeyRange(day, 0, NW, countOpts);
      if (!want.length) { assert.equal(r, null, `${day}: nothing lands here, the window must be null`); continue; }
      assert.ok(r, `${day}: window expected`);
      assert.deepEqual(eachKey(r.startKey, r.endKey), want, day);
    }
  }
  assert.equal(returnEventKeyRange('2026-10-10', 0, NW, {}), null, 'Shabbat collects nothing');
  assert.deepEqual(returnEventKeyRange('2026-10-11', 0, NW, {}), { startKey: '2026-10-09', endKey: '2026-10-11' }, 'Sun collects Fri + Shabbat + Sun');
});

// ---- דרך getDeliveriesForDate (הלו״ז, דף המשלוחים, מייל השליח - אותה פונקציה) ----
const cust = { firstName: 'א', lastName: 'ב', phone1: '050', phone2: '', city: 'ירושלים', street: 'הרצל', houseNum: 5 };
const ilMidnight = (k) => new Date(D.dayRange(k).start); // צורת האחסון של הייבוא מ-Access (21:00Z / 22:00Z)
const utcMidnight = (k) => new Date(`${k}T00:00:00.000Z`);
const delivery = (orderId, eventDate) => ({
  orderId, status: null, isDeleted: false, orderDate: new Date('2026-09-01T08:00:00Z'), eventDate, eventDateHebrew: null,
  fromDate: null, toDate: null, returnDate: null, isAbroad: false, extraDay: null, customSpacing: null,
  branch: null, pickupBranch: null, notes: '', internalNotes: '', isDelivery: true, deliveryDirection: 'חזור',
  deliveryAddress: 'הרצל 5', deliveryCity: 'ירושלים', deliveryOneDayBefore: false, customer: cust,
  employee: null, items: [{ id: 'i' + orderId, description: 'שמלה', isDeleted: false, isTaken: true, isReturned: false, returnDate: null, returnedOk: false }],
  obligations: [{ description: 'משלוח חזור', isDeleted: false }],
});
const ORDERS = [
  delivery(7001, ilMidnight('2026-10-07')), // Wed
  delivery(7002, utcMidnight('2026-10-09')), // Fri (UTC-midnight storage form)
  delivery(7003, ilMidnight('2026-10-10')), // Shabbat (Israel-midnight storage form)
  delivery(7004, ilMidnight('2026-10-11')), // Sun
  delivery(7005, ilMidnight('2026-10-13')), // Tue - owner-closed in some runs
  delivery(7006, utcMidnight('2026-10-03')), // Shemini Atzeret (Shabbat)
];
function settings({ after = 0, skip = false, byEvent = false, closed = null } = {}) {
  return [
    { key: 'enable_deliveries', value: 'true' },
    { key: 'delivery_days_before', value: '1' },
    { key: 'delivery_days_after', value: String(after) },
    { key: 'deliveries_select_by_event_date', value: byEvent ? 'true' : 'false' },
    { key: 'delivery_skip_weekends', value: skip ? 'true' : 'false' },
    ...(closed ? [{ key: B.NON_WORKING_DAYS_SETTING_KEY, value: closed }] : []),
  ];
}
const ids = (res) => res.data.map((r) => r.orderId).sort();
async function run(dayKey, opts, s) {
  installDb({ settings: settings(s), extra: { order: ORDERS } });
  invalidateSettingsCache();
  return getDeliveriesForDate(D.keyToLocalMidnight(dayKey), opts);
}

test('days_after=0, schedule mode (byDispatchDate): Fri + Shabbat events are collected on Sunday, not on their own closed day', async () => {
  for (const skip of [false, true]) {
    const sun = await run('2026-10-11', { byDispatchDate: true, excludeDrafts: true }, { skip });
    assert.deepEqual(ids(sun), [7002, 7003, 7004], `skip=${skip}`);
    for (const r of sun.data) assert.deepEqual(r.dispatchDates, { return: '2026-10-11' }, `${r.orderId}`);
    assert.equal(sun.daysAfter, 0);
    assert.deepEqual(ids(await run('2026-10-09', { byDispatchDate: true }, { skip })), [], `Fri collects nothing (skip=${skip})`);
    assert.deepEqual(ids(await run('2026-10-10', { byDispatchDate: true }, { skip })), [], `Shabbat collects nothing (skip=${skip})`);
    const wed = await run('2026-10-07', { byDispatchDate: true }, { skip });
    assert.deepEqual(ids(wed), [7001], 'a working event day is collected on the event day itself, as before');
    assert.deepEqual(wed.data[0].dispatchDates, { return: '2026-10-07' });
    const chagSun = await run('2026-10-04', { byDispatchDate: true }, { skip });
    assert.deepEqual(ids(chagSun), [7006], 'chag (Shemini Atzeret on Shabbat) -> Sun 4.10');
  }
});

test('days_after=0, owner-closed Tue 13.10: that event is collected on Wed 14.10; Tue itself collects nothing', async () => {
  assert.deepEqual(ids(await run('2026-10-13', { byDispatchDate: true }, { closed: CLOSED_TUE })), []);
  const wed = await run('2026-10-14', { byDispatchDate: true }, { closed: CLOSED_TUE });
  assert.deepEqual(ids(wed), [7005]);
  assert.deepEqual(wed.data[0].dispatchDates, { return: '2026-10-14' });
  // without the owner list Tue 13.10 is a normal day
  assert.deepEqual(ids(await run('2026-10-13', { byDispatchDate: true }, {})), [7005]);
});

test('days_after=0, legacy callers: /api/deliveries default mode uses the same window (no dispatchDates there); "select by event date" mode shows the rolled pick-up day', async () => {
  const sun = await run('2026-10-11', undefined, {});
  assert.deepEqual(ids(sun), [7002, 7003, 7004]);
  for (const r of sun.data) assert.equal('dispatchDates' in r, false, 'legacy default-mode contract kept');
  const fri = await run('2026-10-09', undefined, { byEvent: true });
  assert.deepEqual(ids(fri), [7002], 'by-event mode: the event day page');
  assert.deepEqual(fri.data[0].dispatchDates, { return: '2026-10-11' }, 'pick-up shown on Sunday, not on the Friday event');
  const wed = await run('2026-10-07', undefined, { byEvent: true });
  assert.deepEqual(wed.data[0].dispatchDates, { return: '2026-10-07' });
});

test('days_after=1 is unchanged by the decision (skip_weekends ON: Fri event -> Sun; skip OFF: counted as before)', async () => {
  const sunOn = await run('2026-10-11', { byDispatchDate: true }, { after: 1, skip: true });
  assert.deepEqual(ids(sunOn), [7002, 7003], 'skip ON: Fri + Sat events -> Sun (1 business day)');
  const thuOff = await run('2026-10-08', { byDispatchDate: true }, { after: 1, skip: false });
  assert.deepEqual(ids(thuOff), [7001], 'Wed + 1 = Thu');
  for (const r of (await run('2026-10-10', { byDispatchDate: true }, { after: 1, skip: false })).data) {
    assert.equal(r.dispatchDates.return, B.addBusinessDays(D.instantToKey(r.eventDate), 1, null, { skipWeekend: false }), 'skip OFF: plain addBusinessDays, as before');
  }
});

test('the daily schedule (stage 9, משלוח חזור) follows the same rule with days_after=0', async () => {
  const s = settings({});
  installDb({ settings: [...SETTINGS_ORG2.filter((r) => !s.some((x) => x.key === r.key)), ...s], extra: { order: ORDERS } });
  invalidateSettingsCache();
  const map = Object.fromEntries([...SETTINGS_ORG2.filter((r) => !s.some((x) => x.key === r.key)), ...s].map((r) => [r.key, r.value]));
  const res = await getScheduleDay({ date: '2026-10-11', user: { id: 'emp-head', roleId: 0 }, now: NOW, settings: resolveScheduleSettings(map) });
  const dback = res.stages.find((x) => x.key === 'dback');
  assert.deepEqual(dback.items.map((r) => r.orderId).sort(), [7002, 7003, 7004]);
  for (const r of dback.items) assert.equal(r.dispatchDate, '2026-10-11');
  assert.equal(res.settings.deliveryDaysAfter, 0);
  invalidateSettingsCache();
  const sat = await getScheduleDay({ date: '2026-10-10', user: { id: 'emp-head', roleId: 0 }, now: NOW, settings: resolveScheduleSettings(map) });
  assert.equal(sat.stages.find((x) => x.key === 'dback').items.length, 0, 'nothing on Shabbat');
});
