// lib/lateReturn.js before/after. "Before" = the formula as of origin/main 4cd89a6f, inlined here
// from that file (toIsraelCalendarDate + addDaysSkippingWeekends(…, 1) + getIsraelDaysUntil).
// Claims proven:
//  1. With every holiday marked "open" the new due date == the old one on every event day (UTC + Israel TZ,
//     where production runs: Vercel = UTC, the employee's browser = Israel).
//  2. With the default rule the only differences are event days followed by a holiday/erev chag, and the
//     new due date is later (never earlier) - i.e. fewer/later "late" flags, never new ones.
//  3. The function is timezone-independent (Los Angeles / Kiritimati give the same answer as the key walk),
//     while the old formula was not (documented, not asserted as parity there).
//  4. Old call signatures still work; toDate/returnDate still win (rolled to the next working day when they fall on a
//     closed day - owner decision 2.10.2026, proven in return-roll-forward.test.mjs); invalid eventDate => not late.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { L, eachKey, addKey, allHolidaysOpen, makeRef } from './fixtures.mjs';

const B = await L('lib/businessDays.js');
const { getLateReturnInfo, LATE_RETURN_THRESHOLD_DAYS } = await L('lib/lateReturn.js');
const { toIsraelCalendarDate, getIsraelDaysUntil, getIsraelDateKey, isChagDay } = await L('lib/hebrewDate.js');
const { addDaysSkippingWeekends } = await L('lib/clientInventory.js');
const REF = makeRef(isChagDay);

// --- the OLD formula (origin/main lib/lateReturn.js), verbatim logic ---
function oldLateReturnInfo(order, thresholdDays = LATE_RETURN_THRESHOLD_DAYS, now = new Date()) {
  if (!order) return { isLate: false };
  let dueDateRaw = order.toDate || order.returnDate;
  if (!dueDateRaw && order.eventDate) {
    const eventDay = toIsraelCalendarDate(order.eventDate);
    if (eventDay && !isNaN(eventDay.getTime())) dueDateRaw = addDaysSkippingWeekends(eventDay, 1);
  }
  if (!dueDateRaw) return { isLate: false };
  const dueDate = new Date(dueDateRaw);
  if (isNaN(dueDate.getTime())) return { isLate: false };
  dueDate.setHours(0, 0, 0, 0);
  const daysLate = 0 - getIsraelDaysUntil(dueDateRaw, now);
  if (daysLate < thresholdDays) return { isLate: false, daysLate, dueDate };
  return { isLate: true, daysLate, dueDate };
}

const PROD_TZ = process.env.TZ === 'UTC' || process.env.TZ === 'Asia/Jerusalem';
const RANGE = ['2025-09-01', '2027-12-31'];
const NOWS = ['2026-09-29T09:00:00Z', '2026-10-01T21:30:00Z' /* 00:30 Israel 2.10 */, '2027-04-30T12:00:00Z', '2026-03-26T22:30:00Z' /* DST night */];

test('old formula == new formula with all holidays "open" (production timezones), every event day, 4 "now" instants, both eventDate storage forms', { skip: !PROD_TZ && 'old formula is timezone-dependent; parity only meaningful in UTC/Israel' }, () => {
  const open = allHolidaysOpen(B.isHolidayKey, '2025-08-01', '2028-01-31', { keepWeekend: true });
  let checks = 0;
  for (const k of eachKey(...RANGE)) {
    for (const stored of [`${k}T00:00:00.000Z`, `${addKey(k, -1)}T21:00:00.000Z`]) {
      for (const nowIso of NOWS) {
        const now = new Date(nowIso);
        const a = oldLateReturnInfo({ eventDate: stored }, 7, now);
        const b = getLateReturnInfo({ eventDate: stored }, 7, { now, nonWorkingDays: open });
        assert.equal(b.isLate, a.isLate, `${k} (${stored}) now=${nowIso}`);
        assert.equal(b.daysLate, a.daysLate, `${k} (${stored}) now=${nowIso} daysLate`);
        assert.equal(dueOf(b, now), dueOf(a, now), `${k} due day`);
        checks++;
      }
    }
  }
  console.log(`# INFO lateReturn old==new (holidays opened): ${checks} checks`);
});

test('default rule vs old: differences only when a holiday follows the event; new due date is always later => never a NEW late flag', { skip: !PROD_TZ && 'see above' }, () => {
  let same = 0, diff = 0, flippedToLate = 0;
  const now = new Date('2028-06-01T09:00:00Z'); // far enough that every order in RANGE is "late" by the old rule
  for (const k of eachKey(...RANGE)) {
    const stored = `${k}T00:00:00.000Z`;
    const a = oldLateReturnInfo({ eventDate: stored }, 7, now);
    const b = getLateReturnInfo({ eventDate: stored }, 7, now);
    if (a.daysLate === b.daysLate) { same++; continue; }
    diff++;
    assert.ok(b.daysLate < a.daysLate, `${k}: new due must be later (fewer days late)`);
    const oldDue = dueOf(a, now), newDue = dueOf(b, now);
    let hol = false;
    for (const d of eachKey(addKey(k, 1), newDue)) if (B.isHolidayKey(d)) hol = true;
    assert.ok(hol, `${k}: old due ${oldDue}, new due ${newDue}, no holiday between`);
    if (!a.isLate && b.isLate) flippedToLate++;
  }
  assert.equal(flippedToLate, 0);
  assert.ok(diff > 0);
  console.log(`# INFO lateReturn default vs old: ${same} identical event days, ${diff} later due dates (holiday)`);
});

test('timezone independence: due day == independent key walk in EVERY timezone (incl. LA / Kiritimati)', () => {
  let checks = 0;
  for (const k of eachKey('2026-06-01', '2027-06-30')) {
    // 00:00Z = the usual storage; 21:00Z/22:00Z of the previous day = "Israel midnight" storage (summer/winter) -
    // the Israeli day of the instant is what counts, in every machine timezone
    for (const stored of [`${k}T00:00:00.000Z`, `${addKey(k, -1)}T21:00:00.000Z`, `${addKey(k, -1)}T22:00:00.000Z`]) {
      const israelDay = getIsraelDateKey(stored);
      assert.ok(israelDay === k || israelDay === addKey(k, -1), `${stored} -> ${israelDay}`);
      const expectedDue = REF.walk(israelDay, 1);
      const now = new Date('2027-12-01T09:00:00Z');
      const info = getLateReturnInfo({ eventDate: stored }, 7, now);
      assert.equal(dueOf(info, now), expectedDue, `${k} via ${stored} (TZ=${process.env.TZ})`);
      checks++;
    }
  }
  console.log(`# INFO lateReturn TZ-independence: ${checks} checks`);
});

test('known cases: Thursday event late from the following Sunday; event before Yom Kippur; owner-closed days', () => {
  // Thu 17.9.2026 -> due Tue 22.9 (Fri, Sat, erev YK Sun, YK Mon skipped). 7 days late on 29.9.
  const thu = { eventDate: '2026-09-17T00:00:00.000Z' };
  let now = new Date('2026-09-28T09:00:00Z');
  assert.deepEqual(pick(getLateReturnInfo(thu, 7, now), now), { isLate: false, daysLate: 6, due: '2026-09-22' });
  now = new Date('2026-09-29T09:00:00Z');
  assert.deepEqual(pick(getLateReturnInfo(thu, 7, now), now), { isLate: true, daysLate: 7, due: '2026-09-22' });
  // the OLD rule said due Sun 20.9 (erev YK) and "late" already on 27.9
  if (PROD_TZ) assert.equal(oldLateReturnInfo(thu, 7, new Date('2026-09-27T09:00:00Z')).isLate, true);
  assert.equal(getLateReturnInfo(thu, 7, new Date('2026-09-27T09:00:00Z')).isLate, false);
  // plain Thursday 5.11 -> Sunday 8.11, identical to the old rule
  const nov = { eventDate: '2026-11-05T00:00:00.000Z' };
  now = new Date('2026-11-15T09:00:00Z');
  assert.deepEqual(pick(getLateReturnInfo(nov, 7, now), now), { isLate: true, daysLate: 7, due: '2026-11-08' });
  if (PROD_TZ) assert.deepEqual(pick(oldLateReturnInfo(nov, 7, now), now), { isLate: true, daysLate: 7, due: '2026-11-08' });
  // owner closes 8-10.11 -> due Wed 11.11
  const cfg = B.parseNonWorkingDaysSetting('[{"date":"2026-11-08"},{"date":"2026-11-09"},{"date":"2026-11-10"}]');
  assert.deepEqual(pick(getLateReturnInfo(nov, 7, { now, nonWorkingDays: cfg }), now), { isLate: false, daysLate: 4, due: '2026-11-11' });
  // raw setting string is accepted too, and the 4th positional parameter
  assert.equal(getLateReturnInfo(nov, 7, { now: new Date('2026-11-15T09:00:00Z'), nonWorkingDays: '[{"date":"2026-11-08"}]' }).daysLate, 6);
  assert.equal(getLateReturnInfo(nov, 7, new Date('2026-11-15T09:00:00Z'), cfg).daysLate, 4);
});

test('unchanged behaviour: toDate/returnDate win, invalid eventDate => not late, old call signatures', () => {
  const now = new Date('2026-10-01T09:00:00Z');
  for (const bad of ['garbage', '', null, undefined, new Date('x')]) {
    const info = getLateReturnInfo({ eventDate: bad }, 7, now);
    assert.equal(info.isLate, false);
    assert.equal(info.daysLate, undefined);
  }
  assert.equal(getLateReturnInfo(null, 7, now).isLate, false);
  assert.equal(getLateReturnInfo({}, 7, now).isLate, false);
  assert.equal(getLateReturnInfo({ eventDate: 'garbage', toDate: '2026-09-20T00:00:00.000Z' }, 7, now).isLate, true);
  // toDate on a holiday (Mon 21.9 = Yom Kippur) rolls to the next working day, Tue 22.9 (owner decision 2.10.2026):
  // 9 days late on 1.10, not 10; a toDate on a working day (Tue 15.9) is unchanged
  assert.equal(dueOf(getLateReturnInfo({ eventDate: '2026-09-01T00:00:00.000Z', toDate: '2026-09-21T00:00:00.000Z' }, 7, now), now), '2026-09-22');
  assert.equal(getLateReturnInfo({ eventDate: '2026-09-01T00:00:00.000Z', toDate: '2026-09-21T00:00:00.000Z' }, 7, now).daysLate, 9);
  assert.equal(dueOf(getLateReturnInfo({ eventDate: '2026-09-01T00:00:00.000Z', toDate: '2026-09-15T00:00:00.000Z' }, 7, now), now), '2026-09-15');
  // existing test from scripts/test_israel_dates.mjs (event 15.9 => due 16.9, 15 days late on 1.10; 27.9 => 28.9, 3 days)
  assert.equal(getLateReturnInfo({ eventDate: '2026-09-15T00:00:00.000Z' }, 7, now).daysLate, 15);
  assert.equal(getLateReturnInfo({ eventDate: '2026-09-27T00:00:00.000Z' }, 7, now).daysLate, 3);
  // default now (no 3rd arg) and default threshold
  assert.equal(typeof getLateReturnInfo({ eventDate: '2020-01-01T00:00:00.000Z' }).daysLate, 'number');
  assert.equal(getLateReturnInfo({ eventDate: '2020-01-01T00:00:00.000Z' }).isLate, true);
});

// the due DAY as the function actually reports it: now (Israel day) minus daysLate. info.dueDate itself is a
// local-midnight Date (pre-existing field, read by no consumer) and shifts a day in negative timezones.
function dueOf(info, now) { return info.daysLate === undefined ? null : addKey(getIsraelDateKey(now), -info.daysLate); }
function pick(info, now) { return { isLate: info.isLate, daysLate: info.daysLate, due: dueOf(info, now) }; }
