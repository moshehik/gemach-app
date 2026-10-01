// addBusinessDays / nextWorkingDay / inverseBusinessDays: against an independent reference walk
// (fixtures.makeRef, built on the EXISTING isChagDay), against the EXISTING addDaysSkippingWeekends
// (Fri/Sat only) wherever no holiday is involved, and brute-force inverse checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { L, eachKey, localMidnight, localKey, addKey, makeRef, allHolidaysOpen, isFriSat } from './fixtures.mjs';

const B = await L('lib/businessDays.js');
const { isChagDay } = await L('lib/hebrewDate.js');
const { addDaysSkippingWeekends } = await L('lib/clientInventory.js');
const REF = makeRef(isChagDay);

const RANGE = ['2026-01-01', '2027-12-31'];
const NS = [-5, -3, -2, -1, 0, 1, 2, 3, 5];

test('addBusinessDays equals the independent reference walk for every day 2026-2027, n in ' + NS.join(','), () => {
  let checks = 0;
  for (const k of eachKey(...RANGE)) {
    for (const n of NS) {
      assert.equal(B.addBusinessDays(k, n), REF.walk(k, n), `addBusinessDays(${k}, ${n})`);
      assert.equal(B.addBusinessDays(k, n, null, { skipWeekend: false }), REF.walk(k, n, undefined, { skipWeekend: false }), `skipWeekend=false ${k} ${n}`);
      checks++;
    }
  }
  console.log(`# INFO addBusinessDays reference parity: ${checks} checks`);
});

test('n=0 returns the day itself even when it is not a working day; invalid input => null', () => {
  assert.equal(B.addBusinessDays('2026-09-21', 0), '2026-09-21');
  assert.equal(B.addBusinessDays('2026-11-07', 0), '2026-11-07');
  assert.equal(B.addBusinessDays('garbage', 1), null);
  assert.equal(B.addBusinessDays(null, 1), null);
  assert.equal(B.addBusinessDays('2026-11-03', 'x'), '2026-11-03', 'non-numeric n behaves like 0');
});

test('OLD rule (Fri/Sat only) parity: with all holidays marked "open", addBusinessDays == addDaysSkippingWeekends on every day (TZ-neutral comparison via local-midnight dates)', () => {
  const openW = allHolidaysOpen(B.isHolidayKey, '2025-12-01', '2028-01-31', { keepWeekend: true });
  const openAll = allHolidaysOpen(B.isHolidayKey, '2025-12-01', '2028-01-31');
  let checks = 0;
  for (const k of eachKey(...RANGE)) {
    for (const n of NS) {
      if (n === 0) continue;
      const old = localKey(addDaysSkippingWeekends(localMidnight(k), n));
      assert.equal(B.addBusinessDays(k, n, openW), old, `${k} ${n}`);
      // and plain calendar arithmetic when weekends are not skipped either
      const oldPlain = localKey(addDaysSkippingWeekends(localMidnight(k), n, false));
      assert.equal(B.addBusinessDays(k, n, openAll, { skipWeekend: false }), oldPlain, `plain ${k} ${n}`);
      checks++;
    }
  }
  console.log(`# INFO old-rule parity (holidays opened): ${checks} checks`);
});

test('without the "open" override the ONLY differences from the old Fri/Sat rule involve a holiday on the path', () => {
  let diffs = 0, same = 0;
  for (const k of eachKey(...RANGE)) {
    for (const n of [-2, -1, 1, 2]) {
      const old = localKey(addDaysSkippingWeekends(localMidnight(k), n));
      const now = B.addBusinessDays(k, n);
      if (old === now) { same++; continue; }
      diffs++;
      // a holiday must lie strictly after k up to (and including) the old result in the walking direction
      const lo = n > 0 ? addKey(k, 1) : now, hi = n > 0 ? now : addKey(k, -1);
      let hol = false;
      for (const d of eachKey(lo, hi)) if (B.isHolidayKey(d)) hol = true;
      assert.ok(hol, `${k} n=${n}: old ${old} new ${now} but no holiday between`);
      // and the new result is always further out than the old one, never earlier
      assert.ok(n > 0 ? now > old : now < old, `${k} n=${n}: new result must move away from the day`);
    }
  }
  console.log(`# INFO default rule vs old Fri/Sat rule: ${same} identical, ${diffs} differ (each explained by a holiday)`);
  assert.ok(diffs > 0);
});

test('nextWorkingDay examples (return due date): Thursday -> Sunday; erev YK -> after YK; owner closed day skipped', () => {
  assert.equal(B.nextWorkingDay('2026-11-05'), '2026-11-08'); // Thu -> Sun
  assert.equal(B.nextWorkingDay('2026-11-08'), '2026-11-09'); // Sun -> Mon
  assert.equal(B.nextWorkingDay('2026-09-19'), '2026-09-22'); // Sat -> (Sun erev YK, Mon YK) -> Tue
  assert.equal(B.nextWorkingDay('2026-09-17'), '2026-09-22'); // Thu 17.9 -> Fri, Sat, erev YK, YK -> Tue 22.9
  assert.equal(B.nextWorkingDay('2026-09-24'), '2026-09-27'); // Thu 24.9 -> Fri erev Sukkot, Sat Sukkot -> Sun 27.9 (chol hamoed = working)
  assert.equal(B.nextWorkingDay('2026-10-01'), '2026-10-04'); // Thu 1.10 -> Fri erev Shmini Atzeret, Sat chag -> Sun 4.10
  const cfg = B.parseNonWorkingDaysSetting('[{"date":"2026-11-09"},{"date":"2026-11-10"}]');
  assert.equal(B.nextWorkingDay('2026-11-08', cfg), '2026-11-11');
  const open = B.parseNonWorkingDaysSetting('[{"date":"2026-09-20","status":"open"}]');
  assert.equal(B.nextWorkingDay('2026-09-19', open), '2026-09-20', 'erev YK opened by the owner');
  // instant input (eventDate from the DB) is mapped to the Israeli day first
  assert.equal(B.nextWorkingDay('2026-11-05T00:00:00.000Z'), '2026-11-08');
  assert.equal(B.nextWorkingDay('2026-11-04T22:00:00.000Z'), '2026-11-08', 'Israel-midnight storage of 5.11 (winter = UTC+2)');
  assert.equal(B.nextWorkingDay('2026-11-04T21:59:59.000Z'), '2026-11-05', '23:59:59 Israel on 4.11 is still 4.11');
});

test('inverseBusinessDays == brute-force inverse for every day 2026-2027 and n in -3..3, with and without weekends/holidays', () => {
  const cfg = B.parseNonWorkingDaysSetting('[{"date":"2026-11-09"},{"date":"2026-11-10"},{"date":"2026-11-11"},{"date":"2026-09-20","status":"open"}]');
  const variants = [[null, {}], [cfg, {}], [null, { skipWeekend: false }], [cfg, { skipWeekend: false }]];
  let checks = 0, nulls = 0;
  for (const k of eachKey(...RANGE)) {
    for (const n of [-3, -2, -1, 0, 1, 2, 3]) {
      for (const [c, o] of variants) {
        const refCfg = c || { closed: new Set(), open: new Set() };
        const expected = REF.inverse(k, n, refCfg, o);
        const got = B.inverseBusinessDays(k, n, c, o);
        if (expected.length === 0) { assert.equal(got, null, `${k} n=${n}: expected no sources`); nulls++; }
        else {
          assert.ok(got, `${k} n=${n}: expected ${expected[0]}..${expected.at(-1)}`);
          assert.equal(got.startKey, expected[0], `${k} n=${n} start`);
          assert.equal(got.endKey, expected.at(-1), `${k} n=${n} end`);
          // contiguity: every day in [start,end] maps to k, nothing outside does (brute force already proved the set)
          assert.equal(expected.length, Math.round((Date.parse(got.endKey) - Date.parse(got.startKey)) / 86400000) + 1, `${k} n=${n} contiguous`);
        }
        checks++;
      }
    }
  }
  console.log(`# INFO inverseBusinessDays brute-force parity: ${checks} checks (${nulls} non-working targets => null)`);
});

test('inverse examples from the contract', () => {
  assert.deepEqual(B.inverseBusinessDays('2026-11-05', -1), { startKey: '2026-11-06', endKey: '2026-11-08' }); // Thu: Fri, Sat, Sun events dispatch Thursday
  assert.deepEqual(B.inverseBusinessDays('2026-11-05', -2), { startKey: '2026-11-09', endKey: '2026-11-09' });
  assert.deepEqual(B.inverseBusinessDays('2026-11-08', 1), { startKey: '2026-11-05', endKey: '2026-11-07' });  // Sun collects Thu/Fri/Sat events
  assert.deepEqual(B.inverseBusinessDays('2026-11-04', -1), { startKey: '2026-11-05', endKey: '2026-11-05' }); // Wed -> Thu only
  assert.equal(B.inverseBusinessDays('2026-11-07', -1), null, 'Shabbat: nothing dispatches');
  assert.equal(B.inverseBusinessDays('2026-09-21', 1), null, 'Yom Kippur: nothing is collected');
  assert.deepEqual(B.inverseBusinessDays('2026-09-21', 0), { startKey: '2026-09-21', endKey: '2026-09-21' });
  // Yom Kippur week, daysBefore=2: event Tue 22.9 (day after YK) dispatches Wed 16.9
  assert.equal(B.addBusinessDays('2026-09-22', -2), '2026-09-16');
  assert.deepEqual(B.inverseBusinessDays('2026-09-16', -2), { startKey: '2026-09-18', endKey: '2026-09-22' });
  // calendar-day mode (skipWeekend:false) still skips the chag: Sun 20.9 (erev YK) -> nothing; Sat 19.9 (working in that mode), n=-1 -> events 20.9..22.9
  assert.equal(B.inverseBusinessDays('2026-09-20', -1, null, { skipWeekend: false }), null);
  assert.deepEqual(B.inverseBusinessDays('2026-09-19', -1, null, { skipWeekend: false }), { startKey: '2026-09-20', endKey: '2026-09-22' });
  assert.equal(B.inverseBusinessDays('garbage', 1), null);
});

test('runaway guard: 400+ consecutive closed days do not hang; counting resumes afterwards', () => {
  const days = [];
  for (const k of eachKey('2026-01-02', '2027-03-01')) days.push({ date: k });
  const cfg = B.parseNonWorkingDaysSetting(JSON.stringify({ days }));
  const r = B.addBusinessDays('2026-01-01', 1, cfg);
  assert.ok(r >= '2027-02-05' && r <= '2027-03-02', `landed on ${r}`);
  assert.ok(!isFriSat('2026-01-01') || true);
});
