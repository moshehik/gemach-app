// lib/lateReturn.js before/after. "Before" = legacy/lateReturn.main.mjs (frozen origin/main 00104dc4, post-#220: toDate/returnDate
// on a closed day rolls to the next working day). Claims proven:
//  1. main vs v2: the due date differs ONLY when a chol-hamoed day lies between the event and the new due date, and
//     the new due date is always later (never earlier) - i.e. fewer/later "late" flags, never a NEW one.
//  2. v2 equals an independent reference walk in every timezone (incl. LA / Kiritimati).
//  3. Call signatures, toDate/returnDate precedence and invalid-input behaviour are unchanged; an explicit date on a
//     closed day rolls forward (owner decision 2.10.2026) - under v2 that now includes chol hamoed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { L, LM, eachKey, addKey, makeRef, isCholHamoed } from './fixtures.mjs';

const B = await L('lib/businessDays.js');
const { getLateReturnInfo, LATE_RETURN_THRESHOLD_DAYS } = await L('lib/lateReturn.js');
const { getLateReturnInfo: mainLateReturnInfo } = await LM('lateReturn');
const { getIsraelDateKey, isChagDay } = await L('lib/hebrewDate.js');
const REF = makeRef(isChagDay);

const RANGE = ['2025-09-01', '2027-12-31'];
const NOWS = ['2026-09-29T09:00:00Z', '2026-10-01T21:30:00Z' /* 00:30 Israel 2.10 */, '2027-04-30T12:00:00Z', '2026-03-26T22:30:00Z' /* DST night */];

test('main vs v2: identical unless chol hamoed follows the event; then the v2 due date is later => never a NEW late flag (every event day, 4 "now" instants, both storage forms)', () => {
  let same = 0, diff = 0, flippedToLate = 0;
  const diffDays = new Set();
  for (const k of eachKey(...RANGE)) {
    for (const stored of [`${k}T00:00:00.000Z`, `${addKey(k, -1)}T21:00:00.000Z`]) {
      for (const nowIso of NOWS) {
        const now = new Date(nowIso);
        const a = mainLateReturnInfo({ eventDate: stored }, 7, now);
        const b = getLateReturnInfo({ eventDate: stored }, 7, now);
        if (a.daysLate === b.daysLate && a.isLate === b.isLate) { same++; continue; }
        diff++;
        diffDays.add(getIsraelDateKey(stored));
        assert.ok(b.daysLate < a.daysLate, `${k} (${stored}) now=${nowIso}: v2 due must be later (fewer days late)`);
        const oldDue = dueOf(a, now), newDue = dueOf(b, now);
        let chm = false;
        for (const d of eachKey(addKey(getIsraelDateKey(stored), 1), newDue)) if (isCholHamoed(d)) chm = true;
        assert.ok(chm, `${k}: main due ${oldDue}, v2 due ${newDue}, no chol hamoed between`);
        if (!a.isLate && b.isLate) flippedToLate++;
      }
    }
  }
  assert.equal(flippedToLate, 0);
  assert.ok(diff > 0);
  console.log(`# INFO lateReturn main vs v2: ${same} identical samples, ${diff} later due dates (chol hamoed), ${diffDays.size} distinct event days affected: ${[...diffDays].sort().join(' ')}`);
});

test('timezone independence: due day == independent key walk in EVERY timezone (incl. LA / Kiritimati)', () => {
  let checks = 0;
  for (const k of eachKey('2026-06-01', '2027-06-30')) {
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

test('known cases: Sukkot 5787 (event before / during chol hamoed), Yom Kippur week unchanged, owner ranges and recurring days', () => {
  // Thu 24.9.2026 (day before erev Sukkot): v2 due Sun 4.10 (first working day after Simchat Torah); main said Sun 27.9 (chol hamoed)
  const thu = { eventDate: '2026-09-24T00:00:00.000Z' };
  let now = new Date('2026-10-10T09:00:00Z');
  assert.deepEqual(pick(getLateReturnInfo(thu, 7, now), now), { isLate: false, daysLate: 6, due: '2026-10-04' });
  assert.deepEqual(pick(mainLateReturnInfo(thu, 7, now), now), { isLate: true, daysLate: 13, due: '2026-09-27' });
  now = new Date('2026-10-11T09:00:00Z');
  assert.deepEqual(pick(getLateReturnInfo(thu, 7, now), now), { isLate: true, daysLate: 7, due: '2026-10-04' });
  // event during chol hamoed (Tue 29.9): due Sun 4.10 (main: Wed 30.9)
  const chm = { eventDate: '2026-09-29T00:00:00.000Z' };
  assert.equal(dueOf(getLateReturnInfo(chm, 7, now), now), '2026-10-04');
  assert.equal(dueOf(mainLateReturnInfo(chm, 7, now), now), '2026-09-30');
  // Yom Kippur week: Thu 17.9 -> Tue 22.9 in both (no chol hamoed)
  const yk = { eventDate: '2026-09-17T00:00:00.000Z' };
  now = new Date('2026-09-29T09:00:00Z');
  assert.deepEqual(pick(getLateReturnInfo(yk, 7, now), now), { isLate: true, daysLate: 7, due: '2026-09-22' });
  assert.deepEqual(pick(mainLateReturnInfo(yk, 7, now), now), { isLate: true, daysLate: 7, due: '2026-09-22' });
  // plain Thursday 5.11 -> Sunday 8.11, identical to main
  const nov = { eventDate: '2026-11-05T00:00:00.000Z' };
  now = new Date('2026-11-15T09:00:00Z');
  assert.deepEqual(pick(getLateReturnInfo(nov, 7, now), now), { isLate: true, daysLate: 7, due: '2026-11-08' });
  assert.deepEqual(pick(mainLateReturnInfo(nov, 7, now), now), { isLate: true, daysLate: 7, due: '2026-11-08' });
  // owner closes 8-10.11 as a range -> due Wed 11.11
  const cfg = B.parseNonWorkingDaysSetting('{"ranges":[{"from":"2026-11-08","to":"2026-11-10","note":"חופשה"}]}');
  assert.deepEqual(pick(getLateReturnInfo(nov, 7, { now, nonWorkingDays: cfg }), now), { isLate: false, daysLate: 4, due: '2026-11-11' });
  // recurring 26 Shvat: event Tue 2.2.2027 -> due Thu 4.2.2027 (Wed 3.2 = 26 Shvat 5787 closed)
  const rec = B.parseNonWorkingDaysSetting('{"recurringHebrew":[{"month":"Shvat","day":26}]}');
  const feb = { eventDate: '2027-02-02T00:00:00.000Z' };
  now = new Date('2027-02-14T09:00:00Z');
  assert.equal(dueOf(getLateReturnInfo(feb, 7, { now, nonWorkingDays: rec }), now), '2027-02-04');
  assert.equal(dueOf(getLateReturnInfo(feb, 7, now), now), '2027-02-03');
  // raw setting string is accepted too, and the 4th positional parameter; v1 "open" is ignored
  assert.equal(getLateReturnInfo(nov, 7, { now: new Date('2026-11-15T09:00:00Z'), nonWorkingDays: '[{"date":"2026-11-08"}]' }).daysLate, 6);
  assert.equal(getLateReturnInfo(nov, 7, new Date('2026-11-15T09:00:00Z'), cfg).daysLate, 4);
  assert.equal(getLateReturnInfo(nov, 7, { now: new Date('2026-11-15T09:00:00Z'), nonWorkingDays: '[{"date":"2026-11-06","status":"open"}]' }).daysLate, 7, '"open" Friday does not pull the due date to Friday');
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
  // toDate on a holiday (Mon 21.9 = Yom Kippur) rolls to the next working day, Tue 22.9 (owner decision 2.10.2026) -
  // same in main and v2: 9 days late on 1.10, not 10; a toDate on a working day (Tue 15.9) is unchanged
  assert.equal(dueOf(getLateReturnInfo({ eventDate: '2026-09-01T00:00:00.000Z', toDate: '2026-09-21T00:00:00.000Z' }, 7, now), now), '2026-09-22');
  assert.equal(dueOf(mainLateReturnInfo({ eventDate: '2026-09-01T00:00:00.000Z', toDate: '2026-09-21T00:00:00.000Z' }, 7, now), now), '2026-09-22');
  assert.equal(getLateReturnInfo({ eventDate: '2026-09-01T00:00:00.000Z', toDate: '2026-09-21T00:00:00.000Z' }, 7, now).daysLate, 9);
  assert.equal(dueOf(getLateReturnInfo({ eventDate: '2026-09-01T00:00:00.000Z', toDate: '2026-09-15T00:00:00.000Z' }, 7, now), now), '2026-09-15');
  // returnDate on chol hamoed (Tue 29.9.2026): v2 rolls past the whole Sukkot stretch to Sun 4.10; main (chol hamoed open) kept 29.9
  const later = new Date('2026-10-10T09:00:00Z');
  assert.equal(dueOf(getLateReturnInfo({ eventDate: '2026-09-01T00:00:00.000Z', returnDate: '2026-09-29T00:00:00.000Z' }, 7, later), later), '2026-10-04');
  assert.equal(dueOf(mainLateReturnInfo({ eventDate: '2026-09-01T00:00:00.000Z', returnDate: '2026-09-29T00:00:00.000Z' }, 7, later), later), '2026-09-29');
  // existing test from scripts/test_israel_dates.mjs (event 15.9 => due 16.9, 15 days late on 1.10; 27.9 => now 4.10 (chol hamoed), -3 days)
  assert.equal(getLateReturnInfo({ eventDate: '2026-09-15T00:00:00.000Z' }, 7, now).daysLate, 15);
  assert.equal(getLateReturnInfo({ eventDate: '2026-09-27T00:00:00.000Z' }, 7, now).daysLate, -3);
  assert.equal(mainLateReturnInfo({ eventDate: '2026-09-27T00:00:00.000Z' }, 7, now).daysLate, 3);
  assert.equal(LATE_RETURN_THRESHOLD_DAYS, 7);
  assert.equal(typeof getLateReturnInfo({ eventDate: '2020-01-01T00:00:00.000Z' }).daysLate, 'number');
  assert.equal(getLateReturnInfo({ eventDate: '2020-01-01T00:00:00.000Z' }).isLate, true);
});

// the due DAY as the function actually reports it: now (Israel day) minus daysLate. info.dueDate itself is a
// local-midnight Date (pre-existing field, read by no consumer) and shifts a day in negative timezones.
function dueOf(info, now) { return info.daysLate === undefined ? null : addKey(getIsraelDateKey(now), -info.daysLate); }
function pick(info, now) { return { isLate: info.isLate, daysLate: info.daysLate, due: dueOf(info, now) }; }
