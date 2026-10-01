// isHolidayKey / isChagKey / isErevChagKey against the EXISTING isChagDay (lib/hebrewDate.js) - the
// owner decided erev chag stays a closed day, so the new key-based rule must equal the old one on
// every single day, in every timezone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { L, eachKey, localMidnight, addKey } from './fixtures.mjs';

const B = await L('lib/businessDays.js');
const { isChagDay } = await L('lib/hebrewDate.js');

test('isHolidayKey(key) === isChagDay(local midnight) for every day 2024-01-01 .. 2031-12-31', () => {
  let holidays = 0, days = 0;
  for (const k of eachKey('2024-01-01', '2031-12-31')) {
    days++;
    const expected = isChagDay(localMidnight(k));
    assert.equal(B.isHolidayKey(k), expected, `mismatch on ${k} (TZ=${process.env.TZ})`);
    if (expected) holidays++;
  }
  assert.equal(days, 2922);
  // 8 chag days + their eves per Hebrew year, minus overlaps (RH I is the eve of RH II) => ~15/yr
  assert.ok(holidays >= 8 * 15 - 10 && holidays <= 8 * 16 + 10, `holiday count ${holidays}`);
  console.log(`# INFO holiday parity: ${days} days checked, ${holidays} holiday/erev-chag days`);
});

test('known Israel calendar dates 5787 (Sep 2026 - Jun 2027): chag, erev chag, and NOT chol hamoed/purim/fasts', () => {
  const chag = ['2026-09-12', '2026-09-13', '2026-09-21', '2026-09-26', '2026-10-03', '2027-04-22', '2027-04-28', '2027-06-11'];
  for (const k of chag) {
    assert.equal(B.isChagKey(k), true, `${k} should be chag`);
    assert.equal(B.isNonWorkingDay(k), true);
  }
  // eves (day before each chag); RH I (12.9) is also the eve of RH II
  for (const k of ['2026-09-11', '2026-09-20', '2026-09-25', '2026-10-02', '2027-04-21', '2027-04-27', '2027-06-10']) {
    assert.equal(B.isErevChagKey(k), true, `${k} should be erev chag`);
    assert.equal(B.isHolidayKey(k), true);
    assert.equal(B.isNonWorkingDay(k), true);
  }
  assert.equal(B.isErevChagKey('2026-09-12'), true, 'RH I is the eve of RH II');
  // chol hamoed Sukkot (Mon-Thu 28.9-1.10.2026) is a working stretch except 2.10 (erev Shmini Atzeret, Friday anyway)
  for (const k of ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01']) {
    assert.equal(B.isHolidayKey(k), false, `${k} chol hamoed is not a holiday`);
    assert.equal(B.isNonWorkingDay(k), false, `${k} chol hamoed is a working day`);
  }
  // Purim 23.3.2027 (Tue), Tisha B'Av 2027-08-12 (Thu), Chanukah, Yom HaAtzmaut - all working
  for (const k of ['2027-03-23', '2027-08-12', '2026-12-07', '2027-05-12']) {
    assert.equal(B.isNonWorkingDay(k), false, `${k} should be a working day`);
  }
  // plain weekdays
  assert.equal(B.isNonWorkingDay('2026-11-03'), false);
  // Friday / Shabbat
  assert.equal(B.isNonWorkingDay('2026-11-06'), true);
  assert.equal(B.isNonWorkingDay('2026-11-07'), true);
  assert.equal(B.isWeekendKey('2026-11-06'), true);
  assert.equal(B.isWeekendKey('2026-11-08'), false);
});

test('Hebrew titles are stripped of nikud and erev gets a prefix', () => {
  assert.deepEqual(B.dayStatus('2026-09-21').titles, ['יום כפור']);
  assert.deepEqual(B.dayStatus('2026-09-20').titles, ['ערב יום כפור']);
  assert.deepEqual(B.dayStatus('2026-09-12').titles, ['ראש השנה 5787', 'ערב ראש השנה ב׳']);
  assert.deepEqual(B.dayStatus('2026-11-03').titles, []);
});

test('year boundary: chag lookup near 31.12 / 1.1 does not depend on the year cache (no Jewish chag there, but erev lookup crosses years safely)', () => {
  assert.equal(B.isHolidayKey('2026-12-31'), false);
  assert.equal(B.isHolidayKey('2027-01-01'), false);
  assert.equal(B.isErevChagKey('2029-12-31'), false);
});

test('Date / ISO inputs are instants mapped to the Israeli day (not the machine-local day)', () => {
  // 2026-09-20T21:30Z = 21.9 00:30 Israel = Yom Kippur; in America/Los_Angeles the local day is still 20.9
  assert.equal(B.toDayKey('2026-09-20T21:30:00Z'), '2026-09-21');
  assert.equal(B.isChagKey(B.toDayKey(new Date('2026-09-20T21:30:00Z'))), true);
  assert.equal(B.isNonWorkingDay(new Date('2026-09-20T21:30:00Z')), true);
  // eventDate stored as UTC midnight of the Israeli day (the normal convention)
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
