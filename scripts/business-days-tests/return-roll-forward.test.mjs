// Owner decision 2.10.2026 ("the return of an event on Thursday will be on Sunday", explicit "yes" for the whole
// system): an EXPLICIT return date (Order.toDate / Order.returnDate) that falls on a closed day - Friday, Shabbat,
// chag, erev chag or an owner-marked day (non_working_days_extra) - is due on the NEXT WORKING DAY everywhere:
// lib/lateReturn.js (order card, late list, print, e-mails, "back tomorrow", "returns today/tomorrow" chips, daily cron)
// and lib/schedule (stage 8) share ONE helper, rollForwardToWorkingDay in lib/businessDays.js.
// Claims proven (in every process timezone the runner uses - UTC, Israel, Los Angeles, Kiritimati):
//  1. Known answers: Fri 16.10.2026 -> Sun 18.10; Shabbat -> Sunday; erev Yom Kippur -> Tue 22.9; Yom Kippur -> Tue;
//     owner-closed day -> the day after; a working day is unchanged; an owner "open" override keeps the date.
//  2. daysLate is counted from the rolled day (toDate Fri 16.10 seen on 25.10 = 7 days, not 9), incl. 00:30 Israel.
//  3. Parity: lib/lateReturn.getExpectedReturnKey == lib/schedule returnDueKey / rollForwardToWorkingDay on a sweep of
//     120 consecutive explicit dates (both fields, both storage forms), with and without owner-marked days; the
//     event+offset path is unchanged; rolledSourceKeysForDay / rolledSourceRange are the exact inverse.
//  4. The helper never lands on a closed day; invalid input => null / "not late"; the route wiring is in place.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { L, eachKey, addKey, localKey, weekday } from './fixtures.mjs';

const B = await L('lib/businessDays.js');
const LR = await L('lib/lateReturn.js');
const D = await L('lib/schedule/dates.js');
const { returnDueKey, returnDueKeys } = await L('lib/schedule/loaders.js');
const H = await L('lib/hebrewDate.js');

const stored = (k) => `${k}T00:00:00.000Z`;
// both storage forms of a date: 00:00Z and Israel midnight (21:00Z/22:00Z of the previous UTC day)
const forms = (k) => [stored(k), H.getIsraelDayRange(k).start.toISOString()];
const owner = (days) => B.parseNonWorkingDaysSetting(JSON.stringify({ version: 1, days }));
const TZ = process.env.TZ;

// [explicit date, expected due, why]  (Israel 5787: erev YK Sun 20.9.2026, YK Mon 21.9; Sukkot Sat 3.10; DST ends Sun 25.10)
const KNOWN = [
  ['2026-10-16', '2026-10-18', 'FRIDAY 16.10.2026 -> Sunday 18.10 (the owner\'s literal example)'],
  ['2026-10-17', '2026-10-18', 'Shabbat 17.10 -> Sunday 18.10'],
  ['2026-10-15', '2026-10-15', 'Thursday 15.10: a working day is unchanged'],
  ['2026-10-18', '2026-10-18', 'Sunday 18.10: unchanged'],
  ['2026-09-20', '2026-09-22', 'erev Yom Kippur (Sun 20.9) -> Tue 22.9 (Mon 21.9 is YK)'],
  ['2026-09-21', '2026-09-22', 'Yom Kippur (Mon 21.9) -> Tue 22.9'],
  ['2026-09-18', '2026-09-22', 'Fri 18.9 -> Sat, erev YK, YK all closed -> Tue 22.9'],
  ['2026-10-02', '2026-10-04', 'Fri 2.10 = Hoshana Raba / erev Shmini Atzeret -> Sun 4.10 (chol hamoed is a working day)'],
  ['2026-10-03', '2026-10-04', 'Shmini Atzeret on Shabbat 3.10 -> Sun 4.10'],
  ['2026-04-01', '2026-04-05', 'erev Pesach (Wed 1.4.2026) -> Pesach Thu, Fri, Sat -> Sun 5.4'],
  ['2026-05-22', '2026-05-24', 'Shavuot on Friday 22.5.2026 -> Sun 24.5'],
  ['2026-10-23', '2026-10-25', 'Fri 23.10 -> Sun 25.10 (the DST fall-back day itself)'],
  ['2026-10-24', '2026-10-25', 'Shabbat 24.10 -> Sun 25.10 (DST fall-back day)'],
  ['2026-03-27', '2026-03-29', 'Fri 27.3 (DST spring-forward day) -> Sun 29.3'],
];

test('known answers: explicit toDate/returnDate on a closed day rolls to the next working day; working days unchanged (both fields, both storage forms, every TZ)', () => {
  for (const [explicit, want, why] of KNOWN) {
    for (const iso of forms(explicit)) {
      for (const field of ['toDate', 'returnDate']) {
        const o = { eventDate: stored('2026-08-20'), [field]: iso };
        assert.equal(LR.getExpectedReturnKey(o, null), want, `${field} ${explicit} (${iso}) ${why} TZ=${TZ}`);
        const d = LR.getExpectedReturnDate(o, null);
        assert.equal(localKey(d), want, `Date form ${field} ${explicit} ${why} TZ=${TZ}`);
        assert.equal(d.getHours(), 0, 'local midnight for the Hebrew-date formatters');
        assert.equal(B.rollForwardToWorkingDay(explicit, null), want, `helper ${explicit} ${why}`);
        assert.equal(D.rollForwardToWorkingDay(explicit, null), want, `schedule wrapper ${explicit} ${why}`);
        assert.equal(returnDueKey(o, { nonWorkingDays: null }), want, `schedule stage 8 ${field} ${explicit} ${why}`);
      }
    }
  }
  // the owner's example as the customer will read it: Friday 16.10 is printed/mailed as "יום א'" (Sunday) 18.10
  const d = LR.getExpectedReturnDate({ eventDate: stored('2026-10-14'), toDate: stored('2026-10-16') }, null);
  assert.equal(H.getHebrewWeekdayLabel(d), "יום א'", `TZ=${TZ}`);
  assert.equal(H.getHebrewDateString(d), H.getHebrewDateString(new Date(2026, 9, 18)));
  // the raw (customer's) date is still available to the schedule row (dueKeyRaw) - nothing overwrote the order
  assert.deepEqual(returnDueKeys({ toDate: stored('2026-10-16') }, { nonWorkingDays: null }), { raw: '2026-10-16', due: '2026-10-18' });
});

test('owner-marked days: closed day rolls to the day after (and over a closed run); "open" override keeps the explicit date', () => {
  // Tue 13.10 closed -> Wed 14.10; Tue-Thu 13-15.10 closed + Fri/Sat -> Sun 18.10
  const one = owner([{ date: '2026-10-13', note: 'ספירת מלאי' }]);
  const run = owner(['2026-10-13', '2026-10-14', '2026-10-15']);
  for (const field of ['toDate', 'returnDate']) {
    const o = { eventDate: stored('2026-10-12'), [field]: stored('2026-10-13') };
    assert.equal(LR.getExpectedReturnKey(o, null), '2026-10-13', 'without the owner list Tuesday is a working day');
    assert.equal(LR.getExpectedReturnKey(o, one), '2026-10-14');
    assert.equal(LR.getExpectedReturnKey(o, run), '2026-10-18');
    assert.equal(LR.getExpectedReturnKey(o, '[{"date":"2026-10-13"}]'), '2026-10-14', 'raw setting string accepted');
    assert.equal(returnDueKey(o, { nonWorkingDays: one }), '2026-10-14');
    assert.equal(returnDueKey(o, { nonWorkingDays: run }), '2026-10-18');
  }
  // the owner opens Friday 16.10 -> the explicit Friday stays Friday everywhere
  const open = owner([{ date: '2026-10-16', status: 'open' }]);
  const fri = { eventDate: stored('2026-10-14'), toDate: stored('2026-10-16') };
  assert.equal(LR.getExpectedReturnKey(fri, open), '2026-10-16');
  assert.equal(returnDueKey(fri, { nonWorkingDays: open }), '2026-10-16');
  assert.equal(LR.getExpectedReturnKey(fri, null), '2026-10-18');
  // closed wins over open for the same date (parseNonWorkingDaysSetting rule) - rolled
  assert.equal(LR.getExpectedReturnKey(fri, owner([{ date: '2026-10-16', status: 'open' }, { date: '2026-10-16' }])), '2026-10-18');
});

test('daysLate is counted from the ROLLED day: toDate Fri 16.10.2026 is 7 days late on 25.10 (not 9), 6 on 24.10; dueKey/dueDate = the rolled day', () => {
  const order = { eventDate: stored('2026-10-14'), toDate: stored('2026-10-16') };
  const on = (iso, cfg) => LR.getLateReturnInfo(order, 7, { now: new Date(iso), nonWorkingDays: cfg ?? null });
  let info = on('2026-10-25T06:00:00Z');
  assert.deepEqual([info.isLate, info.daysLate, info.dueKey, localKey(info.dueDate)], [true, 7, '2026-10-18', '2026-10-18'], `TZ=${TZ}`);
  info = on('2026-10-24T06:00:00Z');
  assert.deepEqual([info.isLate, info.daysLate], [false, 6]);
  // 00:30 Israel on 25.10 (21:30Z on 24.10 - still UTC+3 before the 02:00 fall-back): already the 25th in Israel
  assert.deepEqual([on('2026-10-24T21:30:00Z').isLate, on('2026-10-24T21:30:00Z').daysLate], [true, 7], `00:30 Israel TZ=${TZ}`);
  // on the due day itself and before it: 0 / negative, never late
  assert.equal(on('2026-10-18T10:00:00Z').daysLate, 0);
  assert.equal(on('2026-10-16T10:00:00Z').daysLate, -2, 'Friday itself: 2 days before the rolled due day');
  // the 4th positional parameter and a Date "now" still work
  assert.equal(LR.getLateReturnInfo(order, 7, new Date('2026-10-25T06:00:00Z')).daysLate, 7);
  assert.equal(LR.getLateReturnInfo(order, 7, new Date('2026-10-25T06:00:00Z'), owner(['2026-10-18', '2026-10-19'])).daysLate, 5, 'owner closes Sun+Mon -> due Tue 20.10 -> 5 days');
  // threshold from settings: 5 => late on 23.10 (5 days from Sunday), not on 22.10
  assert.equal(LR.getLateReturnInfo(order, 5, new Date('2026-10-23T06:00:00Z')).isLate, true);
  assert.equal(LR.getLateReturnInfo(order, 5, new Date('2026-10-22T06:00:00Z')).isLate, false);
  // erev Yom Kippur toDate (Sun 20.9) -> due Tue 22.9: 7 days late on 29.9, not on 27.9
  const yk = { eventDate: stored('2026-09-17'), toDate: stored('2026-09-20') };
  assert.deepEqual([LR.getLateReturnInfo(yk, 7, new Date('2026-09-29T06:00:00Z')).isLate, LR.getLateReturnInfo(yk, 7, new Date('2026-09-29T06:00:00Z')).daysLate], [true, 7]);
  assert.equal(LR.getLateReturnInfo(yk, 7, new Date('2026-09-27T06:00:00Z')).isLate, false);
  assert.equal(LR.getLateReturnInfo(yk, 7, new Date('2026-09-27T06:00:00Z')).dueKey, '2026-09-22');
  // a working-day toDate: identical to before (Thu 15.10 -> 7 days late on 22.10)
  const thu = { eventDate: stored('2026-10-14'), toDate: stored('2026-10-15') };
  assert.deepEqual([LR.getLateReturnInfo(thu, 7, new Date('2026-10-22T06:00:00Z')).isLate, LR.getLateReturnInfo(thu, 7, new Date('2026-10-22T06:00:00Z')).daysLate], [true, 7]);
});

test('parity sweep: lib/lateReturn == lib/schedule (returnDueKey, rollForwardToWorkingDay) on 120 consecutive explicit dates, both fields, both storage forms, with and without owner-marked days; event+offset path unchanged', () => {
  const CFGS = { none: null, owner: owner(['2026-10-05', '2026-11-17', '2026-11-18', { date: '2026-10-16', status: 'open' }, { date: '2026-10-20', status: 'closed' }]) };
  let checks = 0, rolled = 0;
  for (const [name, cfg] of Object.entries(CFGS)) {
    for (const k of eachKey('2026-09-01', addKey('2026-09-01', 119))) {
      for (const iso of forms(k)) {
        for (const field of ['toDate', 'returnDate']) {
          const o = { eventDate: stored('2026-08-20'), [field]: iso };
          const ours = LR.getExpectedReturnKey(o, cfg);
          assert.equal(ours, returnDueKey(o, { nonWorkingDays: cfg }), `${name} ${field} ${k} (${iso}) TZ=${TZ}`);
          assert.equal(ours, D.rollForwardToWorkingDay(k, cfg), `${name} ${field} ${k} wrapper`);
          assert.equal(ours, B.rollForwardToWorkingDay(k, cfg), `${name} ${field} ${k} helper`);
          assert.equal(B.isNonWorkingDay(ours, cfg), false, `${name} ${k}: never a closed day`);
          assert.ok(ours >= k, 'never earlier than the explicit date');
          assert.equal(LR.getLateReturnInfo(o, 7, { now: new Date('2027-06-01T09:00:00Z'), nonWorkingDays: cfg }).dueKey, ours, 'late info uses the same day');
          if (ours !== k) rolled++;
          checks++;
        }
      }
      // the event+offset path is untouched: event-only order == addBusinessDays(event, 1) == schedule offset 1
      const ev = { eventDate: stored(k) };
      assert.equal(LR.getExpectedReturnKey(ev, cfg), B.addBusinessDays(k, 1, cfg), `${name} event ${k}`);
      assert.equal(LR.getExpectedReturnKey(ev, cfg), returnDueKey(ev, { nonWorkingDays: cfg }), `${name} event ${k} schedule`);
    }
  }
  assert.ok(rolled > 0 && rolled < checks);
  console.log(`# INFO return roll-forward parity: ${checks} explicit-date checks, ${rolled} rolled (TZ=${TZ})`);
});

test('inverse: rolledSourceRange / rolledSourceKeysForDay = exactly the dates that roll to the day; null/[] on a closed day', () => {
  const cfg = owner(['2026-10-05', '2026-11-17', '2026-11-18', { date: '2026-10-16', status: 'open' }]);
  for (const c of [null, cfg]) {
    const sweep = [...eachKey('2026-08-15', '2027-01-31')];
    const rollsTo = new Map();
    for (const k of sweep) { const r = B.rollForwardToWorkingDay(k, c); if (!rollsTo.has(r)) rollsTo.set(r, []); rollsTo.get(r).push(k); }
    for (const day of eachKey('2026-09-01', '2027-01-15')) {
      const range = B.rolledSourceRange(day, c);
      const list = D.rolledSourceKeysForDay(day, c);
      if (B.isNonWorkingDay(day, c)) { assert.equal(range, null, day); assert.deepEqual(list, [], day); continue; }
      assert.deepEqual(list, rollsTo.get(day), `${day} list`);
      assert.deepEqual(range, { startKey: list[0], endKey: list[list.length - 1] }, `${day} range`);
      assert.equal(range.endKey, day);
    }
  }
  assert.deepEqual(B.rolledSourceRange('2026-10-18', null), { startKey: '2026-10-16', endKey: '2026-10-18' }, 'Sunday collects Fri + Shabbat');
  assert.deepEqual(B.rolledSourceRange('2026-10-15', null), { startKey: '2026-10-15', endKey: '2026-10-15' });
  assert.deepEqual(B.rolledSourceRange('2026-09-22', null), { startKey: '2026-09-18', endKey: '2026-09-22' }, 'Tue after YK collects Fri..Mon');
  assert.equal(B.rolledSourceRange('2026-10-16', null), null);
  assert.deepEqual(B.rolledSourceRange('2026-10-16', cfg), { startKey: '2026-10-16', endKey: '2026-10-16' }, 'owner opened Friday');
  assert.deepEqual(B.rolledSourceRange('2026-10-18', cfg), { startKey: '2026-10-17', endKey: '2026-10-18' }, 'Sunday then collects Shabbat only');
  // a Date instant is accepted too (Israeli day)
  assert.deepEqual(B.rolledSourceRange(new Date('2026-10-17T21:00:00Z'), null), { startKey: '2026-10-16', endKey: '2026-10-18' });
});

test('invalid / missing input: helper null, late info "not late", no fallback from a broken explicit date to the event', () => {
  for (const bad of [null, undefined, '', 'garbage', '2026-02-30', new Date('x')]) {
    assert.equal(B.rollForwardToWorkingDay(bad, null), null);
    assert.equal(B.rolledSourceRange(bad, null), null);
  }
  const now = new Date('2026-12-01T09:00:00Z');
  for (const bad of ['garbage', new Date('x')]) {
    const o = { eventDate: stored('2026-09-01'), toDate: bad };
    assert.equal(LR.getExpectedReturnKey(o, null), null);
    assert.equal(LR.getExpectedReturnDate(o, null), null);
    assert.deepEqual(LR.getLateReturnInfo(o, 7, now), { isLate: false });
  }
  // a Date toDate and a Date eventDate are read like ISO strings
  assert.equal(LR.getExpectedReturnKey({ toDate: new Date('2026-10-16T00:00:00.000Z') }, null), '2026-10-18');
  assert.equal(LR.getLateReturnInfo({ toDate: new Date('2026-10-16T00:00:00.000Z') }, 7, now).dueKey, '2026-10-18');
});

test('wiring: one helper behind lib/lateReturn.js and lib/schedule/dates.js; a5/adv and the daily cron use the rolled date', () => {
  const read = (f) => fs.readFileSync(path.join(process.env.PROJ, f), 'utf8');
  const lr = read('lib/lateReturn.js');
  assert.match(lr, /rollForwardToWorkingDay\(explicitKey, nonWorkingDays \?\? null\)/);
  assert.match(lr, /const dueKey = getExpectedReturnKey\(order, nonWorking\)/, 'late info and the printed date come from the same function');
  assert.doesNotMatch(lr, /let dueDateRaw = order\.toDate/);
  const dates = read('lib/schedule/dates.js');
  assert.match(dates, /rollForwardToWorkingDay as helperRollForwardToWorkingDay/);
  assert.match(dates, /return helperRollForwardToWorkingDay\(key, nonWorkingDays \?\? null\)/);
  assert.match(dates, /rolledSourceRange\(day, nonWorkingDays \?\? null\)/);
  const adv = read('app/api/a5/adv/route.js');
  assert.match(adv, /const explicitWin = rolledSourceRange\(key, nonWorkingDays\)/, 'SQL window of toDate/returnDate = day + closed run before it');
  assert.match(adv, /toDate: \{ gte: dayRange\(explicitWin\.startKey\)\.start, lte: dayRange\(explicitWin\.endKey\)\.end \}/);
  assert.match(adv, /returnDate: \{ gte: dayRange\(explicitWin\.startKey\)\.start, lte: dayRange\(explicitWin\.endKey\)\.end \}/);
  assert.match(adv, /getExpectedReturnKey\(o, nonWorkingDays\)/);
  const cron = read('app/api/cron/daily/route.js');
  assert.match(cron, /getExpectedReturnDate\(o, nonWorkingDays\) \?\? o\.returnDate/, 'customer e-mail shows the rolled date');
  assert.doesNotMatch(cron, /returnDate: getHebrewDateString\(o\.returnDate\)/);
  // lib/lateReturn.js stays browser-safe (RentalReturnModal / app/rentals import it): relative imports only, no prisma/server modules
  assert.doesNotMatch(lr, /prisma|businessDaysServer|settingsCache|next\/headers/);
  assert.match(lr, /from '\.\/businessDays'/);
  // weekday sanity for the owner's example used throughout this file
  assert.equal(weekday('2026-10-16'), 5, 'Friday');
  assert.equal(weekday('2026-10-18'), 0, 'Sunday');
});
