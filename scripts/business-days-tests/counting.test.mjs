// addBusinessDays / nextWorkingDay / inverseBusinessDays: against an independent reference walk (fixtures.makeRef,
// built on the EXISTING isChagDay + hebcal chol hamoed), against the frozen origin/main copy (every difference
// must be explained by a chol-hamoed day on the path), and brute-force inverse checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { L, LM, eachKey, addKey, makeRef, isFriSat, isCholHamoed } from './fixtures.mjs';

const B = await L('lib/businessDays.js');
const M = await LM('businessDays');
const { isChagDay } = await L('lib/hebrewDate.js');
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

test('main vs v2: the ONLY differences involve a chol-hamoed day on the walked path; v2 always lands further out, never closer', () => {
  let diffs = 0, same = 0;
  for (const k of eachKey(...RANGE)) {
    for (const n of [-2, -1, 1, 2]) {
      for (const o of [{}, { skipWeekend: false }]) {
        const before = M.addBusinessDays(k, n, null, o);
        const after = B.addBusinessDays(k, n, null, o);
        if (before === after) { same++; continue; }
        diffs++;
        // a chol-hamoed day must lie strictly after k up to (and including) main's result in the walking direction
        const lo = n > 0 ? addKey(k, 1) : after, hi = n > 0 ? after : addKey(k, -1);
        let chm = false;
        for (const d of eachKey(lo, hi)) if (isCholHamoed(d)) chm = true;
        assert.ok(chm, `${k} n=${n} ${JSON.stringify(o)}: main ${before} v2 ${after} but no chol hamoed between`);
        assert.ok(n > 0 ? after > before : after < before, `${k} n=${n}: v2 result must move away from the day`);
      }
    }
  }
  console.log(`# INFO addBusinessDays main vs v2: ${same} identical, ${diffs} differ (each explained by chol hamoed)`);
  assert.ok(diffs > 0);
});

test('n=0 returns the day itself even when it is not a working day; invalid input => null', () => {
  assert.equal(B.addBusinessDays('2026-09-21', 0), '2026-09-21');
  assert.equal(B.addBusinessDays('2026-09-28', 0), '2026-09-28', 'chol hamoed event date stays the event date');
  assert.equal(B.addBusinessDays('2026-11-07', 0), '2026-11-07');
  assert.equal(B.addBusinessDays('garbage', 1), null);
  assert.equal(B.addBusinessDays(null, 1), null);
  assert.equal(B.addBusinessDays('2026-11-03', 'x'), '2026-11-03', 'non-numeric n behaves like 0');
});

test('nextWorkingDay examples (return due date): Thursday -> Sunday; around Yom Kippur; across chol hamoed; owner-closed/range/recurring days', () => {
  assert.equal(B.nextWorkingDay('2026-11-05'), '2026-11-08'); // Thu -> Sun
  assert.equal(B.nextWorkingDay('2026-11-08'), '2026-11-09'); // Sun -> Mon
  assert.equal(B.nextWorkingDay('2026-09-19'), '2026-09-22'); // Sat -> (Sun erev YK, Mon YK) -> Tue
  assert.equal(B.nextWorkingDay('2026-09-17'), '2026-09-22'); // Thu 17.9 -> Fri, Sat, erev YK, YK -> Tue 22.9
  // Sukkot 5787: Thu 24.9 -> Fri 25.9 erev Sukkot, Sat 26.9 Sukkot, Sun-Thu 27.9-1.10 chol hamoed, Fri 2.10 Hoshana
  // Rabba / erev Shmini Atzeret, Sat 3.10 Shmini Atzeret -> Sun 4.10. (main said Sun 27.9: chol hamoed was open)
  assert.equal(B.nextWorkingDay('2026-09-24'), '2026-10-04');
  assert.equal(M.nextWorkingDay('2026-09-24'), '2026-09-27');
  assert.equal(B.nextWorkingDay('2026-09-28'), '2026-10-04', 'event during chol hamoed -> first day after the chag');
  assert.equal(B.nextWorkingDay('2026-10-01'), '2026-10-04'); // Thu 1.10 (chm) -> Fri HR, Sat ShA -> Sun 4.10 (same as main)
  assert.equal(M.nextWorkingDay('2026-10-01'), '2026-10-04');
  // Pesach 5787: Wed 21.4.2027 (erev) -> Thu 22.4 Pesach, Fri-Tue chol hamoed, Wed 28.4 Pesach VII -> Thu 29.4
  assert.equal(B.nextWorkingDay('2027-04-20'), '2027-04-29');
  assert.equal(M.nextWorkingDay('2027-04-20'), '2027-04-25', 'main: Sun 25.4 (chol hamoed)');
  const cfg = B.parseNonWorkingDaysSetting('[{"date":"2026-11-09"},{"date":"2026-11-10"}]');
  assert.equal(B.nextWorkingDay('2026-11-08', cfg), '2026-11-11');
  const range = B.parseNonWorkingDaysSetting('{"ranges":[{"from":"2026-11-08","to":"2026-11-12"}]}');
  assert.equal(B.nextWorkingDay('2026-11-05', range), '2026-11-15', 'Thu 5.11 -> Fri, Sat, vacation Sun-Thu, Fri, Sat -> Sun 15.11');
  const rec = B.parseNonWorkingDaysSetting('{"recurringHebrew":[{"month":"Shvat","day":26}]}');
  assert.equal(B.nextWorkingDay('2027-02-02', rec), '2027-02-04', 'Tue 2.2.2027 -> Wed 3.2 = 26 Shvat closed -> Thu 4.2');
  // instant input (eventDate from the DB) is mapped to the Israeli day first
  assert.equal(B.nextWorkingDay('2026-11-05T00:00:00.000Z'), '2026-11-08');
  assert.equal(B.nextWorkingDay('2026-11-04T22:00:00.000Z'), '2026-11-08', 'Israel-midnight storage of 5.11 (winter = UTC+2)');
  assert.equal(B.nextWorkingDay('2026-11-04T21:59:59.000Z'), '2026-11-05', '23:59:59 Israel on 4.11 is still 4.11');
});

test('inverseBusinessDays == brute-force inverse for every day 2026-2027 and n in -3..3, with and without weekends, with owner days/ranges/recurring', () => {
  const cfg = B.parseNonWorkingDaysSetting('{"days":[{"date":"2026-11-09"},{"date":"2026-11-10"},{"date":"2026-11-11"}],"ranges":[{"from":"2027-01-10","to":"2027-01-14"}],"recurringHebrew":[{"month":"Shvat","day":26}]}');
  const closedRef = new Set([...cfg.closed, '2026-02-13', '2027-02-03']); // 26 Shvat 5786 / 5787 for the reference
  const variants = [[null, {}], [cfg, {}], [null, { skipWeekend: false }], [cfg, { skipWeekend: false }]];
  let checks = 0, nulls = 0;
  for (const k of eachKey(...RANGE)) {
    for (const n of [-3, -2, -1, 0, 1, 2, 3]) {
      for (const [c, o] of variants) {
        const expected = REF.inverse(k, n, c ? closedRef : undefined, o);
        const got = B.inverseBusinessDays(k, n, c, o);
        if (expected.length === 0) { assert.equal(got, null, `${k} n=${n}: expected no sources`); nulls++; }
        else {
          assert.ok(got, `${k} n=${n}: expected ${expected[0]}..${expected.at(-1)}`);
          assert.equal(got.startKey, expected[0], `${k} n=${n} start`);
          assert.equal(got.endKey, expected.at(-1), `${k} n=${n} end`);
          assert.equal(expected.length, Math.round((Date.parse(got.endKey) - Date.parse(got.startKey)) / 86400000) + 1, `${k} n=${n} contiguous`);
        }
        checks++;
      }
    }
  }
  console.log(`# INFO inverseBusinessDays brute-force parity: ${checks} checks (${nulls} non-working targets => null)`);
});

test('inverse examples from the contract (incl. the Sukkot 5787 week)', () => {
  assert.deepEqual(B.inverseBusinessDays('2026-11-05', -1), { startKey: '2026-11-06', endKey: '2026-11-08' }); // Thu: Fri, Sat, Sun events dispatch Thursday
  assert.deepEqual(B.inverseBusinessDays('2026-11-05', -2), { startKey: '2026-11-09', endKey: '2026-11-09' });
  assert.deepEqual(B.inverseBusinessDays('2026-11-08', 1), { startKey: '2026-11-05', endKey: '2026-11-07' });  // Sun collects Thu/Fri/Sat events
  assert.deepEqual(B.inverseBusinessDays('2026-11-04', -1), { startKey: '2026-11-05', endKey: '2026-11-05' }); // Wed -> Thu only
  assert.equal(B.inverseBusinessDays('2026-11-07', -1), null, 'Shabbat: nothing dispatches');
  assert.equal(B.inverseBusinessDays('2026-09-21', 1), null, 'Yom Kippur: nothing is collected');
  assert.equal(B.inverseBusinessDays('2026-09-29', 1), null, 'chol hamoed: nothing is collected');
  assert.equal(B.inverseBusinessDays('2026-09-29', -2), null, 'chol hamoed: nothing dispatches');
  assert.deepEqual(B.inverseBusinessDays('2026-09-21', 0), { startKey: '2026-09-21', endKey: '2026-09-21' });
  // Yom Kippur week, daysBefore=2: event Tue 22.9 (day after YK) dispatches Wed 16.9
  assert.equal(B.addBusinessDays('2026-09-22', -2), '2026-09-16');
  assert.deepEqual(B.inverseBusinessDays('2026-09-16', -2), { startKey: '2026-09-18', endKey: '2026-09-22' });
  // Sukkot week, daysBefore=2: the working days are ... Wed 23.9, Thu 24.9, [closed 25.9-3.10], Sun 4.10, Mon 5.10.
  // "2 business days before E" = Wed 23.9 for every event from Fri 25.9 through Sun 4.10; = Thu 24.9 only for Mon 5.10.
  assert.deepEqual(B.inverseBusinessDays('2026-09-23', -2), { startKey: '2026-09-25', endKey: '2026-10-04' });
  assert.deepEqual(B.inverseBusinessDays('2026-09-24', -2), { startKey: '2026-10-05', endKey: '2026-10-05' });
  assert.equal(B.addBusinessDays('2026-10-04', -2), '2026-09-23');
  // main (chol hamoed open): Thu 24.9 served Mon 28.9 only (27.9 Sun was a working day there)
  assert.deepEqual(M.inverseBusinessDays('2026-09-24', -2), { startKey: '2026-09-28', endKey: '2026-09-28' });
  assert.equal(M.addBusinessDays('2026-10-04', -2), '2026-09-30');
  // Sun 4.10 collects (daysAfter=1) every event from Thu 24.9 to Sat 3.10
  assert.deepEqual(B.inverseBusinessDays('2026-10-04', 1), { startKey: '2026-09-24', endKey: '2026-10-03' });
  // calendar-day mode (skipWeekend:false) still skips the chag: Sun 20.9 (erev YK) -> nothing; Sat 19.9 (working in that mode), n=-1 -> events 20.9..22.9
  assert.equal(B.inverseBusinessDays('2026-09-20', -1, null, { skipWeekend: false }), null);
  assert.deepEqual(B.inverseBusinessDays('2026-09-19', -1, null, { skipWeekend: false }), { startKey: '2026-09-20', endKey: '2026-09-22' });
  assert.equal(B.inverseBusinessDays('garbage', 1), null);
});

test('offset cap: n is clamped to +-366 (100000000, -1e8, Infinity, 1e308, strings) and returns within milliseconds', () => {
  assert.equal(B.MAX_BUSINESS_DAY_OFFSET, 366);
  const base = '2026-11-03';
  const plus366 = B.addBusinessDays(base, 366);
  const minus366 = B.addBusinessDays(base, -366);
  assert.ok(plus366 > '2027-11-01' && plus366 < '2028-05-01', `366 business days ahead = ${plus366}`);
  assert.ok(minus366 < '2025-12-01' && minus366 > '2025-04-01', `366 business days back = ${minus366}`);
  for (const huge of [100000000, 1e8 + 1, Number.MAX_SAFE_INTEGER, 1e308, '100000000', 367, 1000]) {
    const t0 = Date.now();
    assert.equal(B.addBusinessDays(base, huge), plus366, `n=${huge}`);
    assert.equal(B.addBusinessDays(base, -huge), minus366, `n=-${huge}`);
    assert.ok(Date.now() - t0 < 500, `n=${huge} took too long`);
  }
  for (const bad of [Infinity, -Infinity, NaN, 'abc', null, undefined, {}]) {
    assert.equal(B.addBusinessDays(base, bad), base, `n=${String(bad)} behaves like 0`);
    assert.deepEqual(B.inverseBusinessDays(base, bad), { startKey: base, endKey: base });
  }
  assert.equal(B.addBusinessDays(base, 1.9), B.addBusinessDays(base, 1), 'fractions truncated');
  assert.equal(B.addBusinessDays(base, -1.9), B.addBusinessDays(base, -1));
  const t1 = Date.now();
  const invOut = B.inverseBusinessDays(base, -100000000);
  const invRet = B.inverseBusinessDays(base, 100000000);
  assert.ok(Date.now() - t1 < 500);
  assert.deepEqual(invOut, B.inverseBusinessDays(base, -366));
  assert.deepEqual(invRet, B.inverseBusinessDays(base, 366));
  assert.equal(invOut.endKey, plus366);
  assert.equal(invRet.startKey, minus366);
  assert.equal(B.inverseBusinessDays('2026-11-07', 100000000), null, 'non-working target stays null');
});

test('runaway guard: 400+ consecutive closed days (via ranges) do not hang; counting resumes afterwards', () => {
  const ranges = [];
  for (let i = 0; i < 2; i++) ranges.push({ from: addKey('2026-01-02', i * 300), to: addKey('2026-01-02', i * 300 + 299) });
  const cfg = B.parseNonWorkingDaysSetting(JSON.stringify({ ranges }));
  assert.equal(cfg.invalid, 0);
  const r = B.addBusinessDays('2026-01-01', 1, cfg);
  assert.ok(r >= '2027-02-05' && r <= '2027-03-02', `landed on ${r}`);
  assert.ok(!isFriSat('2026-01-01') || true);
});
