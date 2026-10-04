// lib/deliveries.js before/after on an in-memory DB. "Before" = legacy/deliveries.before.mjs (frozen copy of
// origin/main 4cd89a6f). For every settings combination (delivery_skip_weekends x deliveries_select_by_event_date
// x days before/after) and every requested day over ~10 months, both implementations run on the same ~1,100
// orders. Claims proven:
//  A. With every holiday marked "open" (= the old Fri/Sat-only rule):
//     - delivery_skip_weekends OFF (main gemach today): byte-identical results in both display modes.
//     - delivery_skip_weekends ON + select-by-event-date ON (Neve Yaakov today): byte-identical (dispatchDates included).
//     - delivery_skip_weekends ON + select-by-event-date OFF: identical except the symmetry fix, which only
//       ever ADDS orders whose event falls on Fri/Sat, or EMPTIES a Fri/Sat page. Nothing else changes.
//  B. With the default rule, every remaining difference has a holiday/erev chag between the requested day and
//     the event (or on one of them). Differences are counted and printed for the report.
//  C. Known-answer scenarios (Yom Kippur week, Shabbat events, chag page).
//  D. Result/row shape and the Prisma where clause are unchanged when nothing is skipped.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { L, eachKey, localMidnight, allHolidaysOpen, isFriSat, installDb } from './fixtures.mjs';

const B = await L('lib/businessDays.js');
const { getDeliveriesForDate: NEW } = await L('lib/deliveries.js');
const { getDeliveriesForDate: OLD } = await import(pathToFileURL(path.join(process.env.SPDIR, 'legacy', 'deliveries.before.mjs')).href);
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { getIsraelDayRange } = await L('lib/hebrewDate.js');

// ---- fixtures: one event per day, 3 order variants per day ----
const EVENTS = ['2026-08-01', '2027-07-31'];
const DAYS = ['2026-09-01', '2027-06-30'];
function buildOrders() {
  const orders = [];
  let id = 1000;
  for (const k of eachKey(...EVENTS)) {
    const common = { isDeleted: false, isDelivery: true, status: null, deliveryAddress: 'רחוב 1', deliveryCity: 'ירושלים',
      customer: { firstName: 'א', lastName: 'ב', phone1: '050', phone2: '', city: 'ירושלים', street: 'רחוב', houseNum: '1' },
      items: [{ description: 'דגם', isDeleted: false }], obligations: [{ description: 'משלוח הלוך', isDeleted: false }] };
    orders.push({ ...common, orderId: id++, eventDate: new Date(`${k}T00:00:00.000Z`), deliveryDirection: 'הלוך-חזור', deliveryOneDayBefore: false, eventKey: k });
    orders.push({ ...common, orderId: id++, eventDate: new Date(`${k}T00:00:00.000Z`), deliveryDirection: 'הלוך-חזור', deliveryOneDayBefore: true, eventKey: k });
    // Access-import storage form (true Israel midnight of the day: previous day 21:00Z in summer, 22:00Z in winter) + one-way order
    orders.push({ ...common, orderId: id++, eventDate: new Date(getIsraelDayRange(k).start), deliveryDirection: 'חזור', deliveryOneDayBefore: false, eventKey: k });
  }
  return orders;
}
const ORDERS = buildOrders();
const BY_ID = new Map(ORDERS.map((o) => [o.orderId, o]));

function settings({ skip, byEvent, before, after, extra }) {
  const rows = [
    { key: 'delivery_days_before', value: String(before) },
    { key: 'delivery_days_after', value: String(after) },
    { key: 'deliveries_select_by_event_date', value: byEvent ? 'true' : 'false' },
    { key: 'delivery_skip_weekends', value: skip ? 'true' : 'false' },
  ];
  if (extra !== undefined) rows.push({ key: B.NON_WORKING_DAYS_SETTING_KEY, value: extra });
  return rows;
}
const sig = (res) => res.data.map((r) => `${r.orderId}:${r.directions.join('+')}${r.dispatchDates ? ':' + (r.dispatchDates.out || '-') + '/' + (r.dispatchDates.return || '-') : ''}`).sort();
const COMBOS = [];
for (const skip of [false, true]) for (const byEvent of [false, true]) for (const [before, after] of [[1, 1], [2, 1], [0, 1], [2, 2]]) COMBOS.push({ skip, byEvent, before, after });

async function runBoth(combo, day, extra) {
  installDb({ settings: settings({ ...combo, extra }), orders: ORDERS });
  invalidateSettingsCache();
  const a = await OLD(localMidnight(day));
  invalidateSettingsCache();
  const b = await NEW(localMidnight(day));
  return [a, b];
}

function diffSets(a, b) {
  const sa = new Set(a), sb = new Set(b);
  return { removed: a.filter((x) => !sb.has(x)), added: b.filter((x) => !sa.has(x)) };
}
// "old rule" emulation: skip_weekends OFF compares against plain calendar days (open everything);
// skip_weekends ON compares against the Fri/Sat rule (holidays on Fri/Sat stay closed as weekend days)
const OPEN_ALL = B.serializeNonWorkingDaysSetting(allHolidaysOpen(B.isHolidayKey, '2026-06-01', '2027-09-30'));
const OPEN_W = B.serializeNonWorkingDaysSetting(allHolidaysOpen(B.isHolidayKey, '2026-06-01', '2027-09-30', { keepWeekend: true }));

beforeEach(() => invalidateSettingsCache());

test('A. holidays opened: skip_weekends OFF => identical in both display modes (main gemach configuration)', async () => {
  let checks = 0;
  for (const combo of COMBOS.filter((c) => !c.skip)) {
    for (const day of eachKey(...DAYS)) {
      const [a, b] = await runBoth(combo, day, OPEN_ALL);
      assert.deepEqual(sig(b), sig(a), `${JSON.stringify(combo)} ${day}`);
      assert.deepEqual({ daysBefore: b.daysBefore, daysAfter: b.daysAfter, selectByEventDate: b.selectByEventDate }, { daysBefore: a.daysBefore, daysAfter: a.daysAfter, selectByEventDate: a.selectByEventDate });
      checks++;
    }
  }
  console.log(`# INFO deliveries A1 (skip off, holidays opened): ${checks} day/combo runs identical`);
});

test('A. holidays opened: skip_weekends ON + select-by-event-date ON => identical incl. dispatchDates (Neve Yaakov configuration)', async () => {
  let checks = 0;
  for (const combo of COMBOS.filter((c) => c.skip && c.byEvent)) {
    for (const day of eachKey(...DAYS)) {
      const [a, b] = await runBoth(combo, day, OPEN_W);
      assert.deepEqual(sig(b), sig(a), `${JSON.stringify(combo)} ${day}`);
      checks++;
    }
  }
  console.log(`# INFO deliveries A2 (skip on, by-event on, holidays opened): ${checks} runs identical`);
});

test('A. holidays opened: skip_weekends ON + select-by-event-date OFF => only the symmetry fix (Fri/Sat events added; Fri/Sat page emptied)', async () => {
  let identical = 0, changed = 0, added = 0, removed = 0;
  for (const combo of COMBOS.filter((c) => c.skip && !c.byEvent)) {
    for (const day of eachKey(...DAYS)) {
      const [a, b] = await runBoth(combo, day, OPEN_W);
      const d = diffSets(sig(a), sig(b));
      if (!d.added.length && !d.removed.length) { identical++; continue; }
      changed++;
      if (isFriSat(day)) {
        // the page of a non-working day is now empty (the old code showed the next business day's events here) -
        // except "0 days before" = the event day itself, which stays on its own page exactly as before
        assert.ok(b.data.every((r) => combo.before === 0 && r.directions.join() === 'out'), `${day} is Fri/Sat: new result must be empty (got ${sig(b).join(',')})`);
        assert.equal(d.added.length, 0, `${day} is Fri/Sat: nothing may be added`);
        removed += d.removed.length;
        continue;
      }
      assert.equal(d.removed.length, 0, `${JSON.stringify(combo)} ${day}: a working day must never LOSE an order (${d.removed.join(',')})`);
      for (const s of d.added) {
        const o = BY_ID.get(Number(s.split(':')[0]));
        assert.ok(isFriSat(o.eventKey), `${day}: added order ${o.orderId} has event ${o.eventKey}, expected Fri/Sat`);
        // and its dispatch day computed BACKWARD from the event (as print/email do) really is this day
        const dir = s.split(':')[1];
        const n = dir.includes('out') ? -(o.deliveryOneDayBefore ? 1 : combo.before) : combo.after;
        assert.equal(B.addBusinessDays(o.eventKey, n, OPEN_W), day, `${day}: ${o.orderId} ${dir}`);
      }
      added += d.added.length;
    }
  }
  console.log(`# INFO deliveries A3 (skip on, by-event off, holidays opened): ${identical} identical runs, ${changed} runs changed by the symmetry fix (+${added} Fri/Sat-event rows on working days, -${removed} rows on Fri/Sat pages)`);
  assert.ok(added > 0 && removed > 0);
});

test('B. default rule: every difference from the old code involves a holiday (or the symmetry fix); counts for the report', async () => {
  const stats = {};
  for (const combo of COMBOS) {
    const key = `skip=${combo.skip ? 'on' : 'off'} byEvent=${combo.byEvent ? 'on' : 'off'} ${combo.before}/${combo.after}`;
    const st = { runs: 0, changed: 0, added: 0, removed: 0, dispatchMoved: 0 };
    for (const day of eachKey(...DAYS)) {
      const [a, b] = await runBoth(combo, day, undefined);
      st.runs++;
      const d = diffSets(sig(a), sig(b));
      if (!d.added.length && !d.removed.length) continue;
      st.changed++;
      const holidayBetween = (k1, k2) => { const lo = k1 < k2 ? k1 : k2, hi = k1 < k2 ? k2 : k1; for (const k of eachKey(lo, hi)) if (B.isHolidayKey(k)) return true; return false; };
      if (combo.byEvent) {
        // by-event mode: the SAME orders and directions, only dispatchDates move - and each move has a
        // holiday between the event and the farther of the two dispatch dates
        assert.deepEqual(b.data.map((r) => r.orderId), a.data.map((r) => r.orderId), `${key} ${day}: by-event mode must list the same orders`);
        for (let i = 0; i < a.data.length; i++) {
          assert.deepEqual(b.data[i].directions, a.data[i].directions);
          for (const dir of ['out', 'return']) {
            const oldD = a.data[i].dispatchDates[dir], newD = b.data[i].dispatchDates[dir];
            if (oldD === newD) continue;
            st.dispatchMoved++;
            const ev = BY_ID.get(a.data[i].orderId).eventKey;
            assert.ok(holidayBetween(ev, oldD) || holidayBetween(ev, newD), `${key} ${day}: order ${a.data[i].orderId} ${dir} moved ${oldD} -> ${newD} without a holiday`);
            // moved AWAY from the event, never closer
            assert.ok(dir === 'out' ? newD <= oldD : newD >= oldD, `${key} ${day}: ${dir} must move away from the event (${oldD} -> ${newD})`);
          }
        }
        continue;
      }
      const explain = (s, what) => {
        const o = BY_ID.get(Number(s.split(':')[0]));
        const symmetry = combo.skip && (isFriSat(o.eventKey) || isFriSat(day));
        assert.ok(holidayBetween(o.eventKey, day) || symmetry, `${key} ${day}: ${what} ${s} (event ${o.eventKey}) - no holiday between and not a symmetry case`);
        if (what === 'added') st.added++; else st.removed++;
      };
      for (const s of d.removed) explain(s, 'removed');
      for (const s of d.added) explain(s, 'added');
      if (!combo.byEvent && B.isNonWorkingDay(day, null, { skipWeekend: combo.skip }) && combo.before !== 0) {
        assert.equal(b.data.length, 0, `${key} ${day}: non-working day page must be empty`);
      }
    }
    stats[key] = st;
  }
  for (const [k, st] of Object.entries(stats)) console.log(`# INFO deliveries B ${k}: ${st.runs} days, ${st.changed} changed${st.dispatchMoved ? `, ${st.dispatchMoved} dispatch dates moved` : `, +${st.added} rows / -${st.removed} rows`}`);
  assert.ok(Object.values(stats).every((s) => s.changed > 0), 'holiday handling is active in every combination');
});

test('C. known answers: Yom Kippur week (Neve Yaakov: skip on, 2 days before, 1 after)', async () => {
  const combo = { skip: true, byEvent: false, before: 2, after: 1 };
  // event Tue 22.9.2026 (day after YK): dispatch Wed 16.9 (Thu 17 = 1, then Fri, Sat, erev YK, YK skipped)
  let [a, b] = await runBoth(combo, '2026-09-16');
  const tue = ORDERS.find((o) => o.eventKey === '2026-09-22' && !o.deliveryOneDayBefore && o.deliveryDirection === 'הלוך-חזור');
  assert.ok(b.data.some((r) => r.orderId === tue.orderId && r.directions.includes('out')), 'new: 22.9 event goes out on 16.9');
  assert.ok(!a.data.some((r) => r.orderId === tue.orderId), 'old: 22.9 event was not on the 16.9 page');
  // old code dispatched it Sunday 20.9 = erev Yom Kippur; the new page for 20.9 is empty
  [a, b] = await runBoth(combo, '2026-09-20');
  assert.ok(a.data.some((r) => r.orderId === tue.orderId), 'old: dispatched on erev YK');
  assert.equal(b.data.length, 0, 'new: nothing dispatches on erev Yom Kippur');
  // by-event mode: the same order carries the corrected dispatch date
  [a, b] = await runBoth({ ...combo, byEvent: true }, '2026-09-22');
  assert.equal(a.data.find((r) => r.orderId === tue.orderId).dispatchDates.out, '2026-09-20');
  assert.equal(b.data.find((r) => r.orderId === tue.orderId).dispatchDates.out, '2026-09-16');
  assert.equal(b.data.find((r) => r.orderId === tue.orderId).dispatchDates.return, '2026-09-23');
  // Thursday 24.9 event: return pickup Sun 27.9 (Fri = erev Sukkot, Sat = Sukkot) - same as the old Fri/Sat rule here
  [a, b] = await runBoth({ ...combo, byEvent: true }, '2026-09-24');
  const thu = ORDERS.find((o) => o.eventKey === '2026-09-24' && !o.deliveryOneDayBefore && o.deliveryDirection === 'הלוך-חזור');
  assert.equal(b.data.find((r) => r.orderId === thu.orderId).dispatchDates.return, '2026-09-27');
  assert.equal(a.data.find((r) => r.orderId === thu.orderId).dispatchDates.return, '2026-09-27');
});

test('C. known answers: Shabbat event (symmetry fix) and owner-closed days', async () => {
  const combo = { skip: true, byEvent: false, before: 1, after: 1 };
  // event Shabbat 7.11.2026: dispatch Thu 5.11, return Sun 8.11 - the old code never listed it anywhere
  const sat = ORDERS.find((o) => o.eventKey === '2026-11-07' && !o.deliveryOneDayBefore && o.deliveryDirection === 'הלוך-חזור');
  let found = 0;
  for (const day of eachKey('2026-11-01', '2026-11-14')) {
    const [a, b] = await runBoth(combo, day);
    assert.ok(!a.data.some((r) => r.orderId === sat.orderId), `old: Shabbat event never shown (${day})`);
    const row = b.data.find((r) => r.orderId === sat.orderId);
    if (row) { found++; assert.deepEqual(row.directions, day === '2026-11-05' ? ['out'] : ['return']); assert.ok(day === '2026-11-05' || day === '2026-11-08', day); }
  }
  assert.equal(found, 2);
  // owner closes Thu 5.11 + Sun 8.11: Shabbat event now dispatches Wed 4.11 and returns Mon 9.11
  const extra = '[{"date":"2026-11-05"},{"date":"2026-11-08"}]';
  let [, b] = await runBoth(combo, '2026-11-04', extra);
  assert.ok(b.data.some((r) => r.orderId === sat.orderId && r.directions.includes('out')));
  [, b] = await runBoth(combo, '2026-11-05', extra);
  assert.equal(b.data.length, 0, 'closed day: empty page');
  [, b] = await runBoth(combo, '2026-11-09', extra);
  assert.ok(b.data.some((r) => r.orderId === sat.orderId && r.directions.includes('return')));
  // owner opens Friday 6.11: Fri becomes a dispatch day
  [, b] = await runBoth(combo, '2026-11-06', '[{"date":"2026-11-06","status":"open"}]');
  assert.ok(b.data.some((r) => r.orderId === sat.orderId && r.directions.includes('out')), 'Friday opened: Shabbat event goes out Friday');
  // broken setting value = ignored (defaults only)
  const [a2, b2] = await runBoth(combo, '2026-11-05', '{broken');
  assert.ok(b2.data.some((r) => r.orderId === sat.orderId));
  assert.ok(a2.data.length > 0);
});

test('E. a huge delivery_days_before/after setting (100000000) does not hang: capped at 366 business days, answers in well under a second', async () => {
  for (const skip of [false, true]) {
    for (const byEvent of [false, true]) {
      installDb({ settings: settings({ skip, byEvent, before: 100000000, after: 100000000 }), orders: ORDERS });
      invalidateSettingsCache();
      const t0 = Date.now();
      const res = await NEW(localMidnight('2026-11-03'));
      assert.ok(Date.now() - t0 < 1000, `skip=${skip} byEvent=${byEvent} took ${Date.now() - t0}ms`);
      assert.equal(res.daysBefore, 100000000, 'the setting value itself is echoed unchanged');
      assert.equal(res.daysAfter, 100000000);
      if (byEvent) {
        // the 3.11 events are listed, with dispatch dates 366 business days away
        assert.ok(res.data.length > 0);
        const row = res.data.find((r) => r.directions.includes('out'));
        assert.equal(row.dispatchDates.out, B.addBusinessDays('2026-11-03', -366, null, { skipWeekend: skip }));
        assert.equal(row.dispatchDates.return, B.addBusinessDays('2026-11-03', 366, null, { skipWeekend: skip }));
      } else {
        // windows 366 business days away from 3.11 fall outside the fixture range (events 1.8.2026-31.7.2027):
        // outbound ~ early 2028, return ~ mid 2025 => nothing from them. Only the separate "one day before" window
        // (daysBefore != 1 => n=-1 => Wed 4.11) still matches: the deliveryOneDayBefore orders of 4.11, as before.
        assert.ok(res.data.length > 0);
        for (const r of res.data) {
          assert.deepEqual(r.directions, ['out']);
          const o = BY_ID.get(r.orderId);
          assert.equal(o.deliveryOneDayBefore, true);
          assert.equal(o.eventKey, '2026-11-04');
        }
      }
    }
  }
});

test('D. result/row shape and the Prisma where clause are unchanged when nothing is skipped', async () => {
  const combo = { skip: false, byEvent: false, before: 1, after: 1 };
  const [a, b] = await runBoth(combo, '2026-11-03');
  assert.deepEqual(Object.keys(b), Object.keys(a));
  assert.deepEqual(Object.keys(b.data[0]), Object.keys(a.data[0]));
  assert.deepEqual(sig(b), sig(a));
  const q = globalThis.__MOCK_CALLS.filter((c) => c.model === 'order');
  assert.equal(q.length, 2);
  assert.deepEqual(q[1].args, q[0].args, 'identical findMany arguments (old vs new) on a plain Tuesday');
  assert.deepEqual(q[1].args.where.OR, [
    { eventDate: { gte: getIsraelDayRange('2026-11-04').start, lte: getIsraelDayRange('2026-11-04').end } },
    { eventDate: { gte: getIsraelDayRange('2026-11-02').start, lte: getIsraelDayRange('2026-11-02').end } },
  ]);
  // skip on, Thursday: the outbound window now spans Fri..Sun (one contiguous range), return Wed only
  await runBoth({ ...combo, skip: true }, '2026-11-05');
  const q2 = globalThis.__MOCK_CALLS.filter((c) => c.model === 'order').at(-1);
  assert.deepEqual(q2.args.where.OR, [
    { eventDate: { gte: getIsraelDayRange('2026-11-06').start, lte: getIsraelDayRange('2026-11-08').end } },
    { eventDate: { gte: getIsraelDayRange('2026-11-04').start, lte: getIsraelDayRange('2026-11-04').end } },
  ]);
  // Shabbat page in default mode: no query at all
  installDb({ settings: settings({ ...combo, skip: true }), orders: ORDERS });
  invalidateSettingsCache();
  const res = await NEW(localMidnight('2026-11-07'));
  assert.deepEqual(res, { daysBefore: 1, daysAfter: 1, selectByEventDate: false, data: [] });
  assert.equal(globalThis.__MOCK_CALLS.filter((c) => c.model === 'order').length, 0);
  // daysBefore=0: the event day itself, even on Shabbat (n=0 is the day itself)
  installDb({ settings: settings({ ...combo, skip: true, before: 0 }), orders: ORDERS });
  invalidateSettingsCache();
  const res0 = await NEW(localMidnight('2026-11-07'));
  assert.ok(res0.data.some((r) => r.directions.includes('out')));
  assert.ok(!res0.data.some((r) => r.directions.includes('return')), 'return window (n=1) still empty on Shabbat');
});

// F. SCH-DELIV-0 (owner decision 4.10.2026, option B): delivery_days_after = 0 is NOT a parity case any more. The old
// code collected on the event day itself even when it was closed; now a closed event day (Fri / Shabbat / chag / erev
// chag / owner-closed - the full rule, like manual returns, whatever delivery_skip_weekends says) rolls the return
// pick-up to the next working day. The outbound direction must be untouched by the return setting, and on a working
// day with no closed day right before it the result equals the old code exactly.
const D_PREV = (k) => { const [y, m, d] = k.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d - 1)); return t.toISOString().slice(0, 10); };
test('F. days_after=0 (SCH-DELIV-0): returns follow rollForwardToWorkingDay; outbound untouched; working days without a closed run before them = old code', async () => {
  const dirSet = (res, dir) => res.data.filter((r) => r.directions.includes(dir)).map((r) => r.orderId).sort((x, y) => x - y);
  let checks = 0, rolled = 0;
  for (const skip of [false, true]) {
    for (const byEvent of [false, true]) {
      const combo0 = { skip, byEvent, before: 1, after: 0 };
      for (const day of eachKey(...DAYS)) {
        const [a, b] = await runBoth(combo0, day);
        installDb({ settings: settings({ ...combo0, after: 1 }), orders: ORDERS });
        invalidateSettingsCache();
        const b1 = await NEW(localMidnight(day));
        const tag = `${JSON.stringify(combo0)} ${day}`;
        assert.deepEqual(dirSet(b, 'out'), dirSet(b1, 'out'), `${tag}: outbound must not depend on delivery_days_after`);
        if (byEvent) {
          // by-event page = the event day: same orders/directions as the old code, only the return pick-up day may move
          assert.deepEqual(b.data.map((r) => r.orderId), a.data.map((r) => r.orderId), tag);
          for (const r of b.data) {
            if (!r.directions.includes('return')) continue;
            const ev = BY_ID.get(r.orderId).eventKey;
            assert.equal(r.dispatchDates.return, B.rollForwardToWorkingDay(ev), `${tag} order ${r.orderId}`);
            if (r.dispatchDates.return !== ev) { rolled++; assert.ok(B.isNonWorkingDay(ev), `${tag}: only a closed event day moves`); }
          }
        } else {
          const want = ORDERS.filter((o) => o.deliveryDirection !== 'הלוך' && B.rollForwardToWorkingDay(o.eventKey) === day).map((o) => o.orderId).sort((x, y) => x - y);
          assert.deepEqual(dirSet(b, 'return'), want, `${tag}: return = every event whose rolled pick-up day is this day`);
          if (B.isNonWorkingDay(day)) assert.equal(dirSet(b, 'return').length, 0, `${tag}: a closed day collects nothing`);
          else if (!B.isNonWorkingDay(D_PREV(day))) assert.deepEqual(dirSet(b, 'return'), dirSet(a, 'return'), `${tag}: no closed day before -> same as the old code`);
          else rolled++;
        }
        checks++;
      }
    }
  }
  console.log(`# INFO deliveries F (days_after=0): ${checks} day/combo runs checked, ${rolled} roll-forward cases`);
  assert.ok(rolled > 0);
});
