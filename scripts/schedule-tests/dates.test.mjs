// תאריכים: חלונות יום ישראליים, 00:30 שעון ישראל, שבת/שישי/חג, מעבר שעון קיץ, ימי עסקים לשני הכיוונים.
// מורץ ב-3 אזורי זמן (ר' run.mjs) - כל הציפיות מוחלטות.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { HebrewCalendar, flags } from '@hebcal/core';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const D = await L('lib/schedule/dates.js');
const H = await L('lib/hebrewDate.js');

// בדיקת חג "מדויקת" (יום החג בלבד, בלי ערב החג) - רק כדי להוכיח שההתנהגות הרצויה (ערב חג = יום לא עובד,
// החלטת הבעלים 1.10.2026) אכן שונה ממנה. isChagDay הקיים הוא המקור, לא strictChag.
const strictChag = (localMidnight) => HebrewCalendar.calendar({
  start: localMidnight, end: localMidnight, isHebrewYear: false, noMinorFast: true, noRoshChodesh: true, noModern: true, il: true,
}).some((e) => (e.getFlags() & flags.CHAG) !== 0);

test('isValidKey', () => {
  assert.equal(D.isValidKey('2026-10-01'), true);
  assert.equal(D.isValidKey('2026-02-30'), false);
  assert.equal(D.isValidKey('2026-1-1'), false);
  assert.equal(D.isValidKey('01/10/2026'), false);
  assert.equal(D.isValidKey(null), false);
});

test('dayRange: Israel day window in UTC (UTC+3 in October)', () => {
  const r = D.dayRange('2026-10-01');
  assert.equal(r.start.toISOString(), '2026-09-30T21:00:00.000Z');
  assert.equal(r.end.toISOString(), '2026-10-01T20:59:59.999Z');
});

test('dayRange: winter (UTC+2)', () => {
  const r = D.dayRange('2026-12-15');
  assert.equal(r.start.toISOString(), '2026-12-14T22:00:00.000Z');
  assert.equal(r.end.toISOString(), '2026-12-15T21:59:59.999Z');
});

test('DST start day 2026-03-27: range contains both storage forms of the event date; starts at Israeli midnight (UTC+2)', () => {
  const r = D.dayRange('2026-03-27');
  // eventDate saved as Israeli midnight (22:00Z the night before, UTC+2 at that moment) and as plain UTC midnight
  for (const iso of ['2026-03-26T22:00:00.000Z', '2026-03-27T00:00:00.000Z', '2026-03-27T20:59:59.000Z']) {
    const t = new Date(iso).getTime();
    assert.ok(t >= r.start.getTime() && t <= r.end.getTime(), iso + ' should be inside the day');
  }
  // מאז PR #194 (main, 1.10.2026) getIsraelDayRange מחשב את ההיסט ברגע הגבול עצמו ולא לפי הצהריים:
  // חצות 27.3 היא עדיין UTC+2 (המעבר ב-02:00) ולכן תחילת היום = 22:00Z, לא 21:00Z (החלון הישן היה רחב בשעה).
  assert.equal(r.start.toISOString(), '2026-03-26T22:00:00.000Z');
  assert.equal(r.end.toISOString(), '2026-03-27T20:59:59.999Z', 'end of 27.3 is already UTC+3');
  assert.equal(D.instantToKey('2026-03-26T21:30:00Z'), '2026-03-26', '23:30 IL on 26.3 (UTC+2) is still 26.3');
  assert.equal(D.dayRange('2026-03-26').end.getTime() + 1, r.start.getTime(), '26.3 and 27.3 are contiguous');
});

test('DST END day 2026-10-25 (WP1 review #2, fixed by PR #194): the day window starts at Israeli midnight (UTC+3) and ends at 23:59:59.999 (UTC+2)', () => {
  // ב-25.10.2026 02:00 השעון חוזר ל-01:00: חצות היא UTC+3 (= 24.10 21:00Z) וסוף היום הוא UTC+2 (= 25.10 21:59:59Z).
  // לפני #194 ההיסט נקבע לפי הצהריים (UTC+2) ולכן היום התחיל ב-22:00Z - ותאריך שנשמר כחצות ישראלית
  // (2026-10-24T21:00Z, הצורה של ייבוא Access) נפל מחוץ לחלון של 24.10 וגם של 25.10 (ההזמנה נעלמה מהלו״ז).
  const r = D.dayRange('2026-10-25');
  assert.equal(r.start.toISOString(), '2026-10-24T21:00:00.000Z', 'start = Israeli midnight while still UTC+3');
  assert.equal(r.end.toISOString(), '2026-10-25T21:59:59.999Z', 'end = 23:59:59.999 after the switch back to UTC+2');
  const inside = (iso) => { const t = new Date(iso).getTime(); return t >= r.start.getTime() && t <= r.end.getTime(); };
  assert.equal(inside('2026-10-24T21:00:00.000Z'), true, 'eventDate stored as Israeli midnight is INSIDE 25.10 (this was the lost row)');
  assert.equal(inside('2026-10-25T00:00:00.000Z'), true, 'eventDate stored as UTC midnight');
  assert.equal(inside('2026-10-24T22:30:00.000Z'), true, '01:30 IL (first occurrence, UTC+3)');
  assert.equal(inside('2026-10-24T23:30:00.000Z'), true, '01:30 IL (second occurrence, UTC+2)');
  assert.equal(inside('2026-10-25T21:59:59.000Z'), true, '23:59:59 IL');
  assert.equal(inside('2026-10-24T20:59:59.999Z'), false, 'last ms of 24.10');
  assert.equal(inside('2026-10-25T22:00:00.000Z'), false, 'first ms of 26.10');
  // the neighbouring days are contiguous with it - no gap and no overlap on either side of the switch
  const prev = D.dayRange('2026-10-24');
  const next = D.dayRange('2026-10-26');
  assert.equal(prev.start.toISOString(), '2026-10-23T21:00:00.000Z');
  assert.equal(prev.end.getTime() + 1, r.start.getTime(), '24.10 ends exactly where 25.10 starts (the old gap was 21:00Z-22:00Z)');
  assert.equal(r.end.getTime() + 1, next.start.getTime(), '25.10 ends exactly where 26.10 starts');
  assert.equal(next.start.toISOString(), '2026-10-25T22:00:00.000Z', '26.10 is winter time (UTC+2)');
  // and instant -> key agrees with the window on both edges
  assert.equal(D.instantToKey('2026-10-24T21:00:00Z'), '2026-10-25');
  assert.equal(D.instantToKey('2026-10-24T20:59:59Z'), '2026-10-24');
  assert.equal(D.instantToKey('2026-10-25T21:59:59Z'), '2026-10-25');
  assert.equal(D.instantToKey('2026-10-25T22:00:00Z'), '2026-10-26');
});

test('every day of 2026 (both DST switches included): windows are contiguous, 24h +-1h only on switch days, and map back to their own key', () => {
  let key = '2026-01-01';
  let prevEnd = null;
  const lengths = {};
  while (key <= '2026-12-31') {
    const r = D.dayRange(key);
    if (prevEnd !== null) assert.equal(r.start.getTime(), prevEnd + 1, 'gap/overlap before ' + key);
    const hours = (r.end.getTime() + 1 - r.start.getTime()) / 3600000;
    lengths[key] = hours;
    assert.equal(D.instantToKey(r.start), key, 'start of ' + key);
    assert.equal(D.instantToKey(r.end), key, 'end of ' + key);
    prevEnd = r.end.getTime();
    key = D.addCalendarDays(key, 1);
  }
  assert.equal(lengths['2026-03-27'], 23, 'DST start day is 23h');
  assert.equal(lengths['2026-10-25'], 25, 'DST end day is 25h');
  const odd = Object.entries(lengths).filter(([, h]) => h !== 24).map(([k]) => k);
  assert.deepEqual(odd, ['2026-03-27', '2026-10-25'], 'only the two switch days differ from 24h');
});

test('instantToKey: 00:30 Israel time belongs to the NEXT Israeli day, not the UTC day', () => {
  assert.equal(D.instantToKey('2026-10-01T21:30:00Z'), '2026-10-02'); // 00:30 IL on Oct 2 (UTC+3)
  assert.equal(D.instantToKey('2026-12-01T22:30:00Z'), '2026-12-02'); // 00:30 IL on Dec 2 (UTC+2)
  assert.equal(D.instantToKey('2026-10-01T20:59:00Z'), '2026-10-01'); // 23:59 IL on Oct 1
  assert.equal(D.todayKey(new Date('2026-10-01T21:30:00Z')), '2026-10-02');
  assert.equal(D.instantToKey(null), null);
  assert.equal(D.instantToKey('garbage'), null);
});

test('weekday / Friday-Shabbat / chag detection is timezone independent', () => {
  assert.equal(D.weekdayOf('2026-10-01'), 4); // Thursday
  assert.equal(D.isFridayOrShabbat('2026-10-02'), true);
  assert.equal(D.isFridayOrShabbat('2026-10-03'), true);
  assert.equal(D.isFridayOrShabbat('2026-10-04'), false);
  assert.equal(D.isChagKey('2026-09-21'), true); // Yom Kippur 5787 (Monday)
  assert.equal(D.isChagKey('2026-04-02'), true); // Pesach I
  assert.equal(D.isChagKey('2026-04-05'), false); // chol hamoed
  assert.equal(D.isBusinessDay('2026-09-21'), false);
  assert.equal(D.isBusinessDay('2026-09-21', { skipChag: false }), true);
  assert.equal(D.isBusinessDay('2026-10-04'), true);
});

test('erev chag is a NON-working day (owner decision 2026-10-01: "the gemach does not work on erev chag") - isChagDay flags it on purpose', () => {
  // 2026-04-07 = erev Pesach VII (chol hamoed): a non-working day for the schedule, even though the strict
  // "chag day only" check says otherwise. This is the wanted behaviour, not a bug - do not "fix" isChagDay.
  assert.equal(D.isChagKey('2026-04-07'), true, 'erev chag counts as chag');
  assert.equal(D.isChagKey('2026-04-07', strictChag), false, '(strict check differs - and that is fine)');
  assert.equal(D.isChagKey('2026-04-08'), true, 'the chag itself');
  assert.equal(D.isBusinessDay('2026-04-07'), false, 'erev chag is not a business day');
  // weekday erev chag examples for 5787: Sun 20.9.2026 erev Yom Kippur, Wed 21.4.2027 erev Pesach, Thu 10.6.2027 erev Shavuot
  for (const key of ['2026-09-20', '2027-04-21', '2027-06-10']) assert.equal(D.isBusinessDay(key), false, key + ' (erev chag, weekday)');
  // chol hamoed that is NOT an erev chag stays a business day
  assert.equal(D.isBusinessDay('2026-04-05'), true);
  // and in business-day arithmetic: event Tue 22.9.2026, manual return +1 skips nothing; event Sat 19.9 -> Sun 20.9 (erev YK) and Mon 21.9 (YK) skipped -> Tue 22.9
  assert.equal(D.addBusinessDays('2026-09-19', 1, { skipChag: true }), '2026-09-22');
  assert.equal(D.addBusinessDays('2026-09-19', 1, { skipChag: true, chagFn: strictChag }), '2026-09-20', '(strict rule would land on erev YK - not what the owner wants)');
});

test('addBusinessDays: both directions, Fri/Sat skipped', () => {
  assert.equal(D.addBusinessDays('2026-10-01', 1, { skipChag: false }), '2026-10-04'); // Thu -> Sun
  assert.equal(D.addBusinessDays('2026-10-04', -1, { skipChag: false }), '2026-10-01'); // Sun -> Thu
  assert.equal(D.addBusinessDays('2026-10-01', 0), '2026-10-01');
  assert.equal(D.addBusinessDays('2026-10-03', 0), '2026-10-03'); // event on Shabbat stays
  assert.equal(D.addBusinessDays('2026-09-30', 2, { skipChag: false }), '2026-10-04'); // Wed -> Thu(1) -> Fri/Sat skipped -> Sun(2)
  assert.equal(D.addBusinessDays('2026-09-30', 3, { skipChag: false }), '2026-10-05');
});

test('addBusinessDays forward over a weekday chag (Yom Kippur Mon 2026-09-21)', () => {
  assert.equal(D.addBusinessDays('2026-09-20', 1, { skipChag: true }), '2026-09-22');
  assert.equal(D.addBusinessDays('2026-09-20', 1, { skipChag: false }), '2026-09-21');
});

test('addBusinessDays backward 3 days equals the existing getPrintPrepDate rule on 90 consecutive days', () => {
  let key = '2026-09-01';
  for (let i = 0; i < 90; i++) {
    const ours = D.addBusinessDays(key, -3, { skipChag: true });
    const theirs = H.getPrintPrepDate(D.keyToLocalMidnight(key));
    const theirsKey = `${theirs.getFullYear()}-${String(theirs.getMonth() + 1).padStart(2, '0')}-${String(theirs.getDate()).padStart(2, '0')}`;
    assert.equal(ours, theirsKey, 'prep date for event ' + key);
    key = D.addCalendarDays(key, 1);
  }
});

test('Pesach 5786: prep date skips chag AND erev chag (owner decision), unlike a strict chag-only rule', () => {
  assert.equal(D.addBusinessDays('2026-04-09', -3, { skipChag: true }), '2026-03-31'); // Apr 8 (chag) + Apr 7 (erev) + Apr 2 (chag) + Apr 1 (erev) skipped
  assert.equal(D.addBusinessDays('2026-04-09', -3, { skipChag: true, chagFn: strictChag }), '2026-04-05', '(strict rule - not used)');
});

test('isWithinReasonableRange: +-3 calendar years around today', () => {
  const today = '2026-10-01';
  assert.equal(D.isWithinReasonableRange('2026-10-01', today), true);
  assert.equal(D.isWithinReasonableRange('2023-10-01', today), true, 'exactly 3 years back is allowed');
  assert.equal(D.isWithinReasonableRange('2029-10-01', today), true, 'exactly 3 years ahead is allowed');
  assert.equal(D.isWithinReasonableRange('2023-09-30', today), false);
  assert.equal(D.isWithinReasonableRange('2029-10-02', today), false);
  assert.equal(D.isWithinReasonableRange('9999-12-31', today), false);
  assert.equal(D.isWithinReasonableRange('0100-01-01', today), false);
  assert.equal(D.isWithinReasonableRange('garbage', today), false);
  assert.equal(D.MAX_YEARS_FROM_TODAY, 3);
});

test('sourceKeysForDay: which event dates land on the requested day', () => {
  // prep (-3 business days) on Thu 2026-10-01: Fri Oct 2 + Shabbat/Shmini Atzeret Oct 3 are skipped
  assert.deepEqual(D.sourceKeysForDay('2026-10-01', -3), ['2026-10-06']);
  // pickup (-2) on Oct 1 <- event Mon Oct 5
  assert.deepEqual(D.sourceKeysForDay('2026-10-01', -2), ['2026-10-05']);
  // manual return (+1, Fri/Sat only) on Thu Oct 1 <- event Wed Sep 30
  assert.deepEqual(D.sourceKeysForDay('2026-10-01', 1, { skipChag: false }), ['2026-09-30']);
  // manual return on Sun Oct 4 <- events Thu Oct 1, Fri Oct 2, Sat Oct 3 (all map to the next business day)
  assert.deepEqual(D.sourceKeysForDay('2026-10-04', 1, { skipChag: false }), ['2026-10-01', '2026-10-02', '2026-10-03']);
  assert.deepEqual(D.sourceKeysForDay('2026-10-01', 0), ['2026-10-01']);
  // every returned key really maps back to the day
  for (const k of D.sourceKeysForDay('2026-09-24', -3)) assert.equal(D.addBusinessDays(k, -3), '2026-09-24');
});

test('unionRange / daysBetween / addCalendarDays', () => {
  const u = D.unionRange(['2026-10-06', '2026-10-01', '2026-10-03']);
  assert.equal(u.start.toISOString(), '2026-09-30T21:00:00.000Z');
  assert.equal(u.end.toISOString(), '2026-10-06T20:59:59.999Z');
  assert.equal(D.unionRange([]), null);
  assert.equal(D.daysBetween('2026-09-24', '2026-10-01'), 7);
  assert.equal(D.daysBetween('2026-10-01', '2026-09-24'), -7);
  assert.equal(D.addCalendarDays('2026-12-31', 1), '2027-01-01');
  assert.equal(D.addCalendarDays('2026-03-01', -1), '2026-02-28');
});

test('hebrew labels are built from the key, not from the server clock', () => {
  assert.match(D.hebrewLabel('2026-10-01'), /תשרי/);
  assert.equal(D.weekdayLabel('2026-10-01'), 'יום חמישי');
  assert.equal(D.weekdayLabel('2026-10-03'), 'שבת');
});
