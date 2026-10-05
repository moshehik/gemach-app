// The holiday rule (v2): chag + erev chag exactly as the EXISTING isChagDay (lib/hebrewDate.js), PLUS chol
// hamoed (Pesach/Sukkot intermediate days, Israel calendar). Proven on every day 2024-2031, in every TZ, and
// against the frozen origin/main copy: the ONLY days whose status changes between main and v2 are chol-hamoed
// days that were not already closed (Fri/Sat or erev chag).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { L, LM, eachKey, localMidnight, addKey, isCholHamoed, isFriSat } from './fixtures.mjs';

const B = await L('lib/businessDays.js');
const M = await LM('businessDays');
const { isChagDay } = await L('lib/hebrewDate.js');

test('chag/erev parity with isChagDay, chol hamoed from an independent hebcal path: every day 2024-01-01 .. 2031-12-31', () => {
  let holidays = 0, chm = 0, days = 0;
  for (const k of eachKey('2024-01-01', '2031-12-31')) {
    days++;
    const chagOrErev = isChagDay(localMidnight(k));
    assert.equal(B.isChagKey(k) || B.isErevChagKey(k), chagOrErev, `chag/erev mismatch on ${k} (TZ=${process.env.TZ})`);
    assert.equal(B.isCholHamoedKey(k), isCholHamoed(k), `chol hamoed mismatch on ${k}`);
    assert.equal(B.isHolidayKey(k), chagOrErev || isCholHamoed(k), `holiday mismatch on ${k}`);
    // main's rule == chag/erev only
    assert.equal(M.isHolidayKey(k), chagOrErev, `main oracle drifted on ${k}`);
    if (B.isHolidayKey(k)) holidays++;
    if (isCholHamoed(k)) chm++;
  }
  assert.equal(days, 2922);
  assert.equal(chm, 8 * 11, 'Israel: 5 chol hamoed Pesach + 6 chol hamoed Sukkot (incl. Hoshana Rabba) per year');
  console.log(`# INFO holiday rule v2: ${days} days checked, ${holidays} closed-by-calendar days, ${chm} chol hamoed days`);
});

test('main vs v2 with no owner list: the only days that change are chol hamoed days that were still open (not Fri/Sat, not erev chag)', () => {
  const changed = [];
  for (const k of eachKey('2024-01-01', '2031-12-31')) {
    const before = M.isNonWorkingDay(k), after = B.isNonWorkingDay(k);
    if (before === after) continue;
    assert.equal(before, false, `${k}: a day may only become closed, never opened`);
    assert.ok(isCholHamoed(k), `${k} changed but is not chol hamoed`);
    assert.ok(!isFriSat(k) && !M.isErevChagKey(k), `${k} was already closed in main`);
    changed.push(k);
  }
  // sanity: every chol hamoed day that is not Fri/Sat/erev chag IS in the changed list
  for (const k of eachKey('2024-01-01', '2031-12-31')) {
    if (isCholHamoed(k) && !isFriSat(k) && !M.isErevChagKey(k)) assert.ok(changed.includes(k), `${k} should have changed`);
  }
  assert.ok(changed.length >= 8 * 5 && changed.length <= 8 * 9, `changed ${changed.length}`);
  console.log(`# INFO main->v2 newly closed days 2024-2031: ${changed.length}: ${changed.join(' ')}`);
});

test('known Israel calendar dates 5787 (Sep 2026 - Jun 2027): chag, erev chag, chol hamoed; NOT purim/fasts/chanukah/modern', () => {
  const chag = ['2026-09-12', '2026-09-13', '2026-09-21', '2026-09-26', '2026-10-03', '2027-04-22', '2027-04-28', '2027-06-11'];
  for (const k of chag) {
    assert.equal(B.isChagKey(k), true, `${k} should be chag`);
    assert.equal(B.isCholHamoedKey(k), false);
    assert.equal(B.isNonWorkingDay(k), true);
  }
  // eves (day before each chag); RH I (12.9) is also the eve of RH II
  for (const k of ['2026-09-11', '2026-09-20', '2026-09-25', '2026-10-02', '2027-04-21', '2027-04-27', '2027-06-10']) {
    assert.equal(B.isErevChagKey(k), true, `${k} should be erev chag`);
    assert.equal(B.isNonWorkingDay(k), true);
  }
  assert.equal(B.isErevChagKey('2026-09-12'), true, 'RH I is the eve of RH II');
  // chol hamoed Sukkot 5787: Sun 27.9 .. Fri 2.10.2026 (Hoshana Rabba) - ALL closed now
  for (const k of eachKey('2026-09-27', '2026-10-02')) {
    assert.equal(B.isCholHamoedKey(k), true, `${k} chol hamoed`);
    assert.equal(B.isNonWorkingDay(k), true, `${k} chol hamoed is closed in v2`);
    assert.equal(M.isNonWorkingDay(k), isFriSat(k) || M.isErevChagKey(k), `${k}: main closed it only as Fri/Sat/erev`);
  }
  // chol hamoed Pesach 5787: Fri 23.4 .. Tue 27.4.2027
  for (const k of eachKey('2027-04-23', '2027-04-27')) {
    assert.equal(B.isCholHamoedKey(k), true, `${k} chol hamoed`);
    assert.equal(B.isNonWorkingDay(k), true);
  }
  // the two "extra erev" days the owner asked about (NWD-Q03) were ALREADY closed in main via the erev-chag rule:
  // Hoshana Rabba (21 Tishrei = erev Shmini Atzeret) and 20 Nisan (erev Pesach VII)
  for (const k of ['2026-10-02', '2027-04-27', '2027-10-22', '2026-04-07']) {
    assert.equal(M.isErevChagKey(k), true, `${k} erev chag in main`);
    assert.equal(M.isNonWorkingDay(k), true, `${k} already closed in main`);
    assert.equal(B.isErevChagKey(k) && B.isCholHamoedKey(k), true, `${k} is both erev chag and chol hamoed in v2`);
  }
  // Purim 23.3.2027 (Tue), Tisha B'Av 2027-08-12 (Thu), Chanukah, Yom HaAtzmaut, Lag BaOmer - all working
  for (const k of ['2027-03-23', '2027-08-12', '2026-12-07', '2027-05-12', '2027-05-25']) {
    assert.equal(B.isNonWorkingDay(k), false, `${k} should be a working day`);
  }
  // plain weekdays / Friday / Shabbat
  assert.equal(B.isNonWorkingDay('2026-11-03'), false);
  assert.equal(B.isNonWorkingDay('2026-11-06'), true);
  assert.equal(B.isNonWorkingDay('2026-11-07'), true);
  assert.equal(B.isWeekendKey('2026-11-06'), true);
  assert.equal(B.isWeekendKey('2026-11-08'), false);
});

test('dayStatus titles/reasons: nikud stripped, erev prefix, chol hamoed title, combined days', () => {
  assert.deepEqual(B.dayStatus('2026-09-21').titles, ['יום כפור']);
  assert.deepEqual(B.dayStatus('2026-09-20').titles, ['ערב יום כפור']);
  assert.deepEqual(B.dayStatus('2026-09-12').titles, ['ראש השנה 5787', 'ערב ראש השנה ב׳']);
  assert.deepEqual(B.dayStatus('2026-11-03').titles, []);
  assert.deepEqual(B.dayStatus('2026-09-28').reasons, ['chol_hamoed']);
  assert.deepEqual(B.dayStatus('2026-09-28').titles, ['סכות ג׳ (חוה״מ)']);
  // Hoshana Rabba 5787 = Friday + chol hamoed + erev Shmini Atzeret
  assert.deepEqual(B.dayStatus('2026-10-02').reasons, ['friday', 'chol_hamoed', 'erev_chag']);
  assert.deepEqual(B.dayStatus('2026-10-02').titles, ['סכות ז׳ (הושענא רבה)', 'ערב שמיני עצרת']);
  assert.deepEqual(B.dayStatus('2027-04-27').reasons, ['chol_hamoed', 'erev_chag']);
});

test('year boundary: holiday lookup near 31.12 / 1.1 does not depend on the year cache', () => {
  assert.equal(B.isHolidayKey('2026-12-31'), false);
  assert.equal(B.isHolidayKey('2027-01-01'), false);
  assert.equal(B.isErevChagKey('2029-12-31'), false);
});

test('Date / ISO inputs are instants mapped to the Israeli day (not the machine-local day)', () => {
  // 2026-09-20T21:30Z = 21.9 00:30 Israel = Yom Kippur; in America/Los_Angeles the local day is still 20.9
  assert.equal(B.toDayKey('2026-09-20T21:30:00Z'), '2026-09-21');
  assert.equal(B.isChagKey(B.toDayKey(new Date('2026-09-20T21:30:00Z'))), true);
  assert.equal(B.isNonWorkingDay(new Date('2026-09-20T21:30:00Z')), true);
  assert.equal(B.toDayKey('2026-09-21T00:00:00.000Z'), '2026-09-21');
  assert.equal(B.toDayKey(localMidnight('2026-09-21').getTime() + 12 * 3600000) !== null, true);
  assert.equal(B.toDayKey('garbage'), null);
  assert.equal(B.toDayKey(''), null);
  assert.equal(B.toDayKey(null), null);
  assert.equal(B.toDayKey('2026-02-30'), null, 'invalid calendar date');
  assert.equal(B.isNonWorkingDay('2026-02-30'), false, 'invalid input never blocks');
  assert.equal(B.keyFromLocalDate(localMidnight('2026-09-21')), '2026-09-21');
  assert.equal(addKey('2026-12-31', 1), '2027-01-01');
});

test('hebrewDateOfKey: timezone-free Gregorian -> Hebrew conversion, canonical month names, leap years', () => {
  assert.deepEqual(B.hebrewDateOfKey('2027-02-03'), { year: 5787, month: 'Shvat', monthNumber: 11, day: 26, leap: true, label: 'כ״ו שבט' });
  assert.deepEqual(B.hebrewDateOfKey('2026-09-12'), { year: 5787, month: 'Tishrei', monthNumber: 7, day: 1, leap: true, label: 'א׳ תשרי' });
  assert.equal(B.hebrewDateOfKey('2027-03-23').label, 'י״ד אדר ב\'', 'Purim 5787 (leap) = 14 Adar II');
  assert.equal(B.hebrewDateOfKey('2027-03-23').month, 'Adar II');
  assert.equal(B.hebrewDateOfKey('2027-02-21').month, 'Adar I', '5787 is leap: 14 Adar I');
  assert.equal(B.hebrewDateOfKey('2026-03-03').month, 'Adar', '5786 is not leap: plain Adar');
  assert.equal(B.hebrewDateOfKey('2026-03-03').leap, false);
  assert.equal(B.hebrewDateOfKey('2026-09-11T21:30:00Z').day, 1, 'instant 00:30 Israel on 12.9 = 1 Tishrei');
  assert.equal(B.hebrewDateOfKey('garbage'), null);
  // round trip through the recurring resolver for every day of two years
  for (const k of eachKey('2026-01-01', '2027-12-31')) {
    const h = B.hebrewDateOfKey(k);
    const cfg = B.parseNonWorkingDaysSetting({ recurringHebrew: [{ month: h.month, day: h.day }] });
    assert.equal(B.isNonWorkingDay(k, cfg), true, `${k} = ${h.label} ${h.year} must hit its own recurring entry`);
  }
});
