// Return / pickup dates that are PRINTED or SENT to the customer, before vs after the unified rule.
// "Before" = the formulas inlined below, taken from origin/main 46523a2f:
//   return date  : addDaysSkippingWeekends(eventDate, 1)            (Fri/Sat only; lib/clientInventory.js == lib/inventory.js copy)
//   pickup date  : subtractSkippingWeekendsAndChag(eventDate, 2)    (lib/hebrewDate.js; Fri/Sat + chag/erev chag, no owner list)
// "After"  = getExpectedReturnDate / getExpectedReturnKey (lib/lateReturn.js), subtractBusinessDays /
//            getPrintPrepDateWithConfig (lib/businessDays.js) - the helpers the print page, the two order
//            e-mails, lib/inventory.js "מוחזר מחר", a5/adv "החזרה היום/מחר" and print-prep now call.
// Claims proven:
//  1. Return date: with no owner-marked days the new date equals the old one on every event day EXCEPT
//     when a holiday/erev chag lies between the event and the old date; then it is strictly LATER, never earlier.
//     With every holiday marked "open" the new date equals the old one on every day (full parity).
//  2. Pickup / prep date: with an empty config, identical to the old functions on every day (no exceptions).
//  3. Known answers: Friday, Saturday, day before Yom Kippur, Sukkot, Pesach, Rosh Hashana, DST days.
//  4. Owner-closed days move both dates; explicit toDate/returnDate are untouched.
//  5. a5/adv: the widest event->due gap under the new rule is <= 7 days (the new dueWindow lower bound).
//  6. lib/inventory.js checkMissingDressForItem ("אמור לחזור מחר") uses the new rule (mocked DB + clock).
//  7. Display strings (weekday letter + Hebrew date) are the same in every process timezone.
import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { L, eachKey, addKey, weekday, localKey, allHolidaysOpen, installDb } from './fixtures.mjs';

const B = await L('lib/businessDays.js');
const LR = await L('lib/lateReturn.js');
const H = await L('lib/hebrewDate.js');
const { addDaysSkippingWeekends } = await L('lib/clientInventory.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { checkMissingDressForItem } = await L('lib/inventory.js');

// the old formulas verbatim
const oldReturnDate = (o) => (o.toDate || o.returnDate ? new Date(o.toDate || o.returnDate) : (o.eventDate ? addDaysSkippingWeekends(o.eventDate, 1) : null));
const oldPickupDate = (o) => (o.eventDate ? H.subtractSkippingWeekendsAndChag(o.eventDate, 2) : null);

// The old code reads the machine-local calendar day of the stored instant, so before/after parity is only
// meaningful where production runs (Vercel = UTC, the employee's browser = Israel). Everything else is
// asserted against the timezone-independent key walk in every zone.
const PROD_TZ = process.env.TZ === 'UTC' || process.env.TZ === 'Asia/Jerusalem';
const RANGE = ['2025-09-01', '2027-12-31'];
const stored = (k) => `${k}T00:00:00.000Z`; // how the app stores eventDate (see getIsraelDayRange for the 2nd form)
// The Access-import storage form (Israel midnight = 21:00Z/22:00Z of the previous UTC day) is read correctly by the
// OLD code only when the machine runs in Israel's timezone (browser). On a UTC server (Vercel: the two e-mails,
// lib/inventory.js, print-prep) the old code saw the previous calendar day - the new helpers read the Israeli day
// everywhere, so for that form before/after parity is asserted in Asia/Jerusalem only.
const oldReadsIsraelMidnightRight = process.env.TZ === 'Asia/Jerusalem';
const dayName = (k) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekday(k)];

test('RETURN date: no owner days => same as before except around holidays, where it is later (production timezones)', { skip: !PROD_TZ && 'old formula is machine-timezone dependent' }, () => {
  let same = 0, diff = 0;
  for (const k of eachKey(...RANGE)) {
    const o = { eventDate: stored(k) };
    const before = localKey(oldReturnDate(o));
    const after = localKey(LR.getExpectedReturnDate(o, null));
    assert.equal(after, LR.getExpectedReturnKey(o, null), `${k}: Date and key forms agree`);
    if (before === after) { same++; continue; }
    diff++;
    assert.ok(after > before, `${k}: new return ${after} must be later than old ${before}`);
    let holiday = false;
    for (const d of eachKey(addKey(k, 1), after)) if (B.isHolidayKey(d)) holiday = true;
    assert.ok(holiday, `${k}: old ${before}, new ${after}, but no holiday/erev chag in between`);
  }
  assert.ok(diff > 0 && same > diff);
  console.log(`# INFO return date vs old: ${same} identical event days, ${diff} later (holiday/erev chag in the way)`);
});

test('RETURN date: with every holiday marked open the new date equals the old one on every day (production timezones)', { skip: !PROD_TZ && 'old formula is machine-timezone dependent' }, () => {
  const open = allHolidaysOpen(B.isHolidayKey, '2025-08-01', '2028-01-31', { keepWeekend: true });
  let checks = 0;
  for (const k of eachKey(...RANGE)) {
    // both storage forms: 00:00Z and Israel midnight (21:00Z previous day in summer / 22:00Z in winter)
    for (const ev of [stored(k), H.getIsraelDayRange(k).start]) {
      if (ev !== stored(k) && !oldReadsIsraelMidnightRight) continue;
      assert.equal(localKey(LR.getExpectedReturnDate({ eventDate: ev }, open)), localKey(oldReturnDate({ eventDate: ev })), `${k} (${ev})`);
      checks++;
    }
  }
  console.log(`# INFO return date parity (holidays opened): ${checks} checks`);
});

test('PICKUP / PREP date: empty config == old subtractSkippingWeekendsAndChag / getPrintPrepDate on every day (production timezones)', { skip: !PROD_TZ && 'old formula is machine-timezone dependent' }, () => {
  let checks = 0;
  for (const k of eachKey(...RANGE)) {
    const o = { eventDate: stored(k) };
    assert.equal(localKey(B.subtractBusinessDays(o.eventDate, 2, null)), localKey(oldPickupDate(o)), `pickup ${k}`);
    assert.equal(localKey(B.subtractBusinessDays(o.eventDate, 2, B.EMPTY_NON_WORKING_CONFIG)), localKey(oldPickupDate(o)), `pickup(empty) ${k}`);
    assert.equal(localKey(B.getPrintPrepDateWithConfig(o.eventDate, null)), localKey(H.getPrintPrepDate(o.eventDate)), `prep ${k}`);
    assert.equal(localKey(B.getPrintPrepDateWithConfig(o.eventDate, '')), localKey(H.getPrintPrepDate(o.eventDate)), `prep(raw empty) ${k}`);
    checks += 4;
  }
  // the helper always returns a LOCAL-midnight Date (what the formatters read), like the old function
  const d = B.subtractBusinessDays('2026-11-10', 2, null);
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()], [2026, 10, 8, 0]);
  console.log(`# INFO pickup/prep parity (empty config): ${checks} checks`);
});

test('timezone independence of the new helpers (every zone, both storage forms): equals the independent key walk', () => {
  const REFH = (k) => B.isHolidayKey(k);
  const nonWorking = (k) => { const w = weekday(k); return w === 5 || w === 6 || REFH(k); };
  const walk = (k, n) => { let cur = k, left = Math.abs(n); const step = n > 0 ? 1 : -1; while (left) { cur = addKey(cur, step); if (!nonWorking(cur)) left--; } return cur; };
  let checks = 0;
  for (const k of eachKey('2026-01-01', '2027-12-31')) {
    for (const ev of [stored(k), H.getIsraelDayRange(k).start]) {
      const israelDay = H.getIsraelDateKey(ev);
      assert.equal(LR.getExpectedReturnKey({ eventDate: ev }, null), walk(israelDay, 1), `return ${k} (${ev}, TZ=${process.env.TZ})`);
      assert.equal(localKey(LR.getExpectedReturnDate({ eventDate: ev }, null)), walk(israelDay, 1));
      assert.equal(localKey(B.subtractBusinessDays(ev, 2, null)), walk(israelDay, -2), `pickup ${k} (${ev}, TZ=${process.env.TZ})`);
      checks++;
    }
  }
  console.log(`# INFO return/pickup TZ-independence: ${checks} event days`);
});

// [event day, expected OLD return, expected NEW return, why]. Israel 5787 calendar: RH 12-13.9.2026 (Sat-Sun),
// erev YK Sun 20.9, YK Mon 21.9, Sukkot Sat 3.10, Shmini Atzeret/Simchat Torah Sat 10.10, Pesach Thu 2.4.2026
// (erev Wed 1.4) .. Wed 8.4 (7th day Wed 8.4, erev Tue 7.4), Shavuot Fri 22.5.2026 (erev Thu 21.5).
const KNOWN = [
  ['2026-09-10', '2026-09-13', '2026-09-14', 'Thursday before Rosh Hashana: Sun 13.9 is RH day 2'],
  ['2026-09-17', '2026-09-20', '2026-09-22', 'Thursday: Sun 20.9 is erev Yom Kippur, Mon 21.9 is Yom Kippur'],
  ['2026-09-18', '2026-09-20', '2026-09-22', 'FRIDAY event: same chain'],
  ['2026-09-19', '2026-09-20', '2026-09-22', 'SATURDAY event: same chain'],
  ['2026-09-20', '2026-09-21', '2026-09-22', 'DAY BEFORE Yom Kippur (erev chag event): next day is YK'],
  ['2026-09-21', '2026-09-22', '2026-09-22', 'Yom Kippur itself: Tue 22.9 is a normal day - no change'],
  ['2026-10-01', '2026-10-04', '2026-10-04', 'Thursday before Sukkot: Fri erev, Sat Sukkot -> Sun 4.10 (chol hamoed, working) - no change'],
  ['2026-10-02', '2026-10-04', '2026-10-04', 'Friday = erev Sukkot: no change'],
  ['2026-10-08', '2026-10-11', '2026-10-11', 'Thursday before Simchat Torah (Sat): Sun 11.10 - no change'],
  ['2026-09-30', '2026-10-01', '2026-10-01', 'Wednesday in Sukkot week: Thu 1.10 - no change'],
  ['2026-03-31', '2026-04-01', '2026-04-05', 'Tuesday before Pesach: Wed 1.4 is erev Pesach, Thu 2.4 Pesach, Fri/Sat -> Sun 5.4'],
  ['2026-05-20', '2026-05-21', '2026-05-24', 'Wednesday before Shavuot: Thu 21.5 erev, Fri 22.5 Shavuot, Sat -> Sun 24.5'],
  // DST days (Israel: spring forward Fri 27.3.2026, fall back Sun 25.10.2026) - both forms of eventDate
  ['2026-03-26', '2026-03-29', '2026-03-29', 'DST eve (Thu 26.3): Sun 29.3 - no change'],
  ['2026-03-27', '2026-03-29', '2026-03-29', 'DST day itself (Fri 27.3)'],
  ['2026-03-28', '2026-03-29', '2026-03-29', 'DST day after (Sat 28.3)'],
  ['2026-10-24', '2026-10-25', '2026-10-25', 'DST eve (Sat 24.10): Sun 25.10'],
  ['2026-10-25', '2026-10-26', '2026-10-26', 'DST fall-back day itself (Sun 25.10): Mon 26.10'],
  ['2026-10-26', '2026-10-27', '2026-10-27', 'day after DST fall-back'],
  ['2026-11-05', '2026-11-08', '2026-11-08', 'ordinary Thursday: Sunday - no change'],
];

test('RETURN date known answers (both storage forms of eventDate; every timezone for the NEW value)', () => {
  for (const [event, oldWant, newWant, why] of KNOWN) {
    for (const ev of [stored(event), H.getIsraelDayRange(event).start]) {
      assert.equal(LR.getExpectedReturnKey({ eventDate: ev }, null), newWant, `NEW ${event} (${ev}) ${why} TZ=${process.env.TZ}`);
      assert.equal(localKey(LR.getExpectedReturnDate({ eventDate: ev }, null)), newWant, `NEW(Date) ${event} ${why}`);
      if (PROD_TZ && (ev === stored(event) || oldReadsIsraelMidnightRight)) assert.equal(localKey(oldReturnDate({ eventDate: ev })), oldWant, `OLD ${event} (${ev}) ${why}`);
    }
  }
  // the changed rows are exactly the holiday rows
  const changed = KNOWN.filter(([, o, n]) => o !== n).map(([e]) => e);
  assert.deepEqual(changed, ['2026-09-10', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20', '2026-03-31', '2026-05-20']);
});

test('RETURN / PICKUP: owner-closed days move the dates; explicit toDate/returnDate are never moved', () => {
  // Thu 5.11.2026 normally returns Sun 8.11. Owner closes Sun 8.11 and Mon 9.11 -> Tue 10.11
  const cfg = B.parseNonWorkingDaysSetting('[{"date":"2026-11-08"},{"date":"2026-11-09","status":"closed","note":"x"}]');
  assert.equal(LR.getExpectedReturnKey({ eventDate: stored('2026-11-05') }, cfg), '2026-11-10');
  assert.equal(localKey(LR.getExpectedReturnDate({ eventDate: stored('2026-11-05') }, cfg)), '2026-11-10');
  assert.equal(LR.getExpectedReturnKey({ eventDate: stored('2026-11-05') }, '[{"date":"2026-11-08"}]'), '2026-11-09'); // raw setting string accepted
  // owner marks erev Yom Kippur "open": Sun 20.9 is a working day again -> event Fri 18.9 returns Sun 20.9
  const open = B.parseNonWorkingDaysSetting('{"version":1,"days":[{"date":"2026-09-20","status":"open"}]}');
  assert.equal(LR.getExpectedReturnKey({ eventDate: stored('2026-09-18') }, open), '2026-09-20');
  // pickup = 2 working days before: event Tue 10.11 -> Mon 9.11, Sun 8.11 -> pickup Sun 8.11 (empty) / Thu 5.11 (Sun closed)
  assert.equal(localKey(B.subtractBusinessDays(stored('2026-11-10'), 2, null)), '2026-11-08');
  const sun = B.parseNonWorkingDaysSetting('[{"date":"2026-11-08"}]');
  assert.equal(localKey(B.subtractBusinessDays(stored('2026-11-10'), 2, sun)), '2026-11-05');
  // prep date (3 working days): Tue 10.11 -> Mon 9.11, Sun 8.11, Thu 5.11  /  with Sun closed: Mon 9.11, Thu 5.11, Wed 4.11
  assert.equal(localKey(B.getPrintPrepDateWithConfig(stored('2026-11-10'), null)), '2026-11-05');
  assert.equal(localKey(B.getPrintPrepDateWithConfig(stored('2026-11-10'), sun)), '2026-11-04');
  // explicit dates win and are not shifted, even onto a closed day (the customer's own agreement)
  const holiday = '2026-09-21T00:00:00.000Z';
  for (const field of ['toDate', 'returnDate']) {
    const o = { eventDate: stored('2026-09-01'), [field]: holiday };
    assert.equal(localKey(LR.getExpectedReturnDate(o, cfg)), '2026-09-21'); // shown as the Israeli day, local midnight (see the round-2 test for 21:00Z storage)
    assert.equal(LR.getExpectedReturnKey(o, cfg), '2026-09-21');
  }
  // missing / invalid input
  for (const bad of [null, undefined, {}, { eventDate: null }, { eventDate: 'garbage' }, { eventDate: '' }]) {
    assert.equal(LR.getExpectedReturnKey(bad, null), null);
    assert.equal(LR.getExpectedReturnDate(bad, null), null);
  }
  assert.equal(B.subtractBusinessDays('garbage', 2, null), null);
  assert.equal(B.subtractBusinessDays(null, 2, null), null);
  assert.equal(B.localDateFromKey('2026-02-30'), null);
});

test('display strings (weekday letter + Hebrew date) are identical in every timezone', () => {
  // Thu 10.9.2026 -> Monday 14.9.2026 = 3 Tishrei 5787; Thu 17.9.2026 -> Tue 22.9.2026
  for (const [event, wantKey, wantLabel] of [['2026-09-10', '2026-09-14', "יום ב'"], ['2026-09-17', '2026-09-22', "יום ג'"], ['2026-09-19', '2026-09-22', "יום ג'"]]) {
    const d = LR.getExpectedReturnDate({ eventDate: stored(event) }, null);
    assert.equal(H.getHebrewWeekdayLabel(d), wantLabel, `${event} TZ=${process.env.TZ}`);
    const [y, m, day] = wantKey.split('-').map(Number);
    assert.equal(H.getHebrewDateString(d), H.getHebrewDateString(new Date(y, m - 1, day)), `${event} hebrew date`);
  }
  const rh = H.getHebrewDateString(LR.getExpectedReturnDate({ eventDate: stored('2026-09-10') }, null));
  assert.match(rh, /^ג תשרי /); // 3 Tishrei
});

test('a5/adv "החזרה היום/מחר": event->due gap never exceeds the widened dueWindow (7 days); route uses the shared helper', () => {
  let max = 0, maxEvent = '';
  for (const k of eachKey('2024-01-01', '2040-12-31')) {
    const due = LR.getExpectedReturnKey({ eventDate: stored(k) }, null);
    const gap = (Date.parse(`${due}T00:00:00Z`) - Date.parse(`${k}T00:00:00Z`)) / 86400000;
    if (gap > max) { max = gap; maxEvent = k; }
  }
  assert.ok(max <= 7, `max gap ${max} (${maxEvent}) must fit dueWindow(-7)`);
  assert.ok(max > 4, 'the old -4 window really was too narrow under the new rule');
  console.log(`# INFO max event->due gap 2024-2040 under the new rule: ${max} days (event ${maxEvent}, ${dayName(maxEvent)}); old rule max was 3`);
  const src = fs.readFileSync(path.join(process.env.PROJ, 'app/api/a5/adv/route.js'), 'utf8');
  assert.match(src, /addKey\(key, -7\)/);
  assert.doesNotMatch(src, /addKey\(key, -4\)/);
  assert.doesNotMatch(src, /addDaysSkippingWeekends/);
  assert.match(src, /getExpectedReturnKey\(o, nonWorkingDays\)/);
});

test('every customer-visible call site was switched (no leftover old return-date computation)', () => {
  const read = (f) => fs.readFileSync(path.join(process.env.PROJ, f), 'utf8');
  for (const f of ['app/print/order/page.js', 'app/api/orders/[id]/email/route.js', 'app/api/orders/route.js']) {
    const src = read(f);
    assert.doesNotMatch(src, /addDaysSkippingWeekends\(/, `${f}: old return-date formula`);
    assert.doesNotMatch(src, /subtractSkippingWeekendsAndChag\(/, `${f}: old pickup formula`);
    assert.match(src, /getExpectedReturnDate\(/, `${f}: new return helper`);
    assert.match(src, /subtractBusinessDays\(/, `${f}: new pickup helper`);
  }
  const inv = read('lib/inventory.js');
  assert.match(inv, /getExpectedReturnKey\(/);
  assert.doesNotMatch(inv, /addDaysSkippingWeekends\(toIsraelCalendarDate\(ord\.eventDate\)/);
  assert.match(read('app/api/orders/print-prep/route.js'), /getPrintPrepDateWithConfig\(/);
});

// ---- lib/inventory.js checkMissingDressForItem ("אמור לחזור מחר") with a mocked DB and a mocked clock ----
function setupMissing({ eventKey, settings = [] }) {
  installDb({ settings });
  globalThis.__DRESS_ITEMS = [{ id: 1 }];
  globalThis.__ORDER_ITEMS = [{ dressItemId: 1, order: { orderId: 77, eventDate: new Date(`${eventKey}T00:00:00.000Z`), toDate: null, returnDate: null, customer: { lastName: 'כהן', firstName: 'ר' } } }];
  invalidateSettingsCache();
}
const missingOn = async (todayIso) => {
  mock.timers.enable({ apis: ['Date'], now: new Date(todayIso) });
  try { return await checkMissingDressForItem({ dressModelId: 5, sizeText: null }); } finally { mock.timers.reset(); }
};
beforeEach(() => { mock.timers.reset(); });

test('lib/inventory.js "אמור לחזור מחר": follows the unified rule (event Thu 10.9.2026: old = due Sun 13.9, new = due Mon 14.9)', async () => {
  setupMissing({ eventKey: '2026-09-10' });
  // old rule would have flagged on Sat 12.9 (due Sun 13.9); the new rule says due Mon 14.9 -> flagged on Sun 13.9 only
  assert.equal(await missingOn('2026-09-12T10:00:00Z'), null, 'Sat 12.9: due date is no longer Sun 13.9');
  assert.deepEqual(await missingOn('2026-09-13T10:00:00Z'), { familyName: 'כהן', returnOrderId: 77 }, 'Sun 13.9: due tomorrow Mon 14.9');
  assert.equal(await missingOn('2026-09-14T10:00:00Z'), null, 'Mon 14.9: due today, not tomorrow');
  // ordinary Thursday 5.11.2026: due Sun 8.11 -> flagged on Sat 7.11 exactly like before
  setupMissing({ eventKey: '2026-11-05' });
  assert.deepEqual(await missingOn('2026-11-07T10:00:00Z'), { familyName: 'כהן', returnOrderId: 77 });
  assert.equal(await missingOn('2026-11-06T10:00:00Z'), null);
  // Friday event 18.9.2026: old due Sun 20.9 (erev YK), new due Tue 22.9 -> flagged on Mon 21.9
  setupMissing({ eventKey: '2026-09-18' });
  assert.equal(await missingOn('2026-09-19T10:00:00Z'), null);
  assert.deepEqual(await missingOn('2026-09-21T10:00:00Z'), { familyName: 'כהן', returnOrderId: 77 });
});

test('lib/inventory.js: owner-closed day from the setting row moves "מחר"; explicit toDate untouched; broken setting = defaults', async () => {
  const closedSetting = (v) => [{ key: B.NON_WORKING_DAYS_SETTING_KEY, value: v }];
  // Thu 5.11 normally due Sun 8.11; owner closes Sun 8.11 -> due Mon 9.11 -> flagged Sun 8.11 (not Sat 7.11)
  setupMissing({ eventKey: '2026-11-05', settings: closedSetting('[{"date":"2026-11-08"}]') });
  assert.equal(await missingOn('2026-11-07T10:00:00Z'), null);
  assert.deepEqual(await missingOn('2026-11-08T10:00:00Z'), { familyName: 'כהן', returnOrderId: 77 });
  for (const broken of ['{"days":[{', '42', '', 'null']) {
    setupMissing({ eventKey: '2026-11-05', settings: closedSetting(broken) });
    assert.deepEqual(await missingOn('2026-11-07T10:00:00Z'), { familyName: 'כהן', returnOrderId: 77 }, `broken setting ${JSON.stringify(broken)} = defaults`);
  }
  // explicit toDate: returns on the stated day even if it is a holiday
  setupMissing({ eventKey: '2026-09-01' });
  globalThis.__ORDER_ITEMS[0].order.toDate = new Date('2026-09-21T00:00:00.000Z');
  assert.deepEqual(await missingOn('2026-09-20T10:00:00Z'), { familyName: 'כהן', returnOrderId: 77 });
  assert.equal(await missingOn('2026-09-19T10:00:00Z'), null);
});

// ---- round 2: explicit dates read as the Israeli day; lookup windows derived from the rule ----
const cfgOf = (...ranges) => {
  const days = [];
  for (const [a, b] of ranges) for (const k of eachKey(a, b ?? a)) days.push({ date: k });
  return B.parseNonWorkingDaysSetting(JSON.stringify(days));
};

test('explicit toDate/returnDate and event-date fallbacks are read as the ISRAELI day in every timezone (21:00Z / 22:00Z storage)', () => {
  const cases = [
    ['2026-09-20T21:00:00.000Z', '2026-09-21'], // summer Israel midnight of 21.9 (previous UTC day)
    ['2026-11-04T22:00:00.000Z', '2026-11-05'], // winter Israel midnight of 5.11
    ['2026-09-21T00:00:00.000Z', '2026-09-21'], // usual storage
    ['2026-09-21T12:00:00.000Z', '2026-09-21'],
    ['2026-03-26T22:00:00.000Z', '2026-03-27'], // day before the spring DST change
    ['2026-10-24T21:00:00.000Z', '2026-10-25'], // fall-back day, 00:00 Israel (still summer time)
  ];
  for (const [iso, want] of cases) {
    for (const field of ['toDate', 'returnDate']) {
      const d = LR.getExpectedReturnDate({ eventDate: stored('2026-09-01'), [field]: iso }, null);
      assert.equal(localKey(d), want, `${field} ${iso} TZ=${process.env.TZ}`);
      assert.equal(d.getHours(), 0);
      assert.equal(LR.getExpectedReturnKey({ eventDate: stored('2026-09-01'), [field]: iso }, null), want);
    }
    assert.equal(localKey(B.israelLocalDate(iso)), want, `israelLocalDate ${iso}`);
    assert.equal(localKey(B.israelLocalDate(new Date(iso))), want);
    // the weekday letter and Hebrew date shown to the customer are the Israeli ones
    const [y, m, day] = want.split('-').map(Number);
    assert.equal(H.getHebrewWeekdayLabel(B.israelLocalDate(iso)), H.getHebrewWeekdayLabel(new Date(y, m - 1, day)));
    assert.equal(H.getHebrewDateString(B.israelLocalDate(iso)), H.getHebrewDateString(new Date(y, m - 1, day)));
  }
  // an explicit date is still never shifted to a working day (21.9 = Yom Kippur)
  assert.equal(LR.getExpectedReturnKey({ toDate: '2026-09-20T21:00:00.000Z' }, null), '2026-09-21');
  for (const bad of [null, undefined, '', 'garbage', new Date('x')]) assert.equal(B.israelLocalDate(bad), null);
  assert.equal(LR.getExpectedReturnDate({ eventDate: stored('2026-09-01'), toDate: 'garbage' }, null), null);
});

// brute force: every event E whose counted date lands in [from, to] must lie inside eventRangeForOffset(from, to, n)
const CLOSED_WEEK = cfgOf(['2026-11-02', '2026-11-08']);
const TWO_WEEKS = cfgOf(['2026-11-01', '2026-11-16']);
// hypothetical "version 2": chol hamoed closed as well (Sukkot 2026 and Pesach 2027 weeks)
const V2_CHOL_HAMOED = cfgOf(['2026-09-27', '2026-10-01'], ['2026-10-04', '2026-10-09'], ['2027-04-04', '2027-04-06'], ['2027-04-09', '2027-04-13']);
const CONFIGS = { empty: null, closedWeek: CLOSED_WEEK, twoWeeks: TWO_WEEKS, v2CholHamoed: V2_CHOL_HAMOED };

test('eventRangeForOffset: derived window contains EVERY matching event (prep n=-3, due n=+1; single days and ranges; closed weeks / chol hamoed)', () => {
  let checks = 0, widest = 0;
  for (const [name, cfg] of Object.entries(CONFIGS)) {
    for (const n of [-3, 1]) {
      const evs = [...eachKey('2026-08-15', '2027-05-15')];
      const counted = new Map(evs.map((e) => [e, B.addBusinessDays(e, n, cfg)]));
      for (const [from, len] of [['2026-09-01', 1], ['2026-09-20', 1], ['2026-10-11', 1], ['2026-11-03', 1], ['2026-11-09', 1], ['2026-11-10', 1], ['2027-04-14', 1], ['2026-09-20', 7], ['2026-11-01', 9], ['2026-12-01', 3], ['2027-04-02', 12]]) {
        const to = addKey(from, len - 1);
        const w = B.eventRangeForOffset(from, to, n, cfg);
        const matching = evs.filter((e) => { const x = counted.get(e); return x >= from && x <= to; });
        if (!w) { assert.equal(matching.length, 0, `${name} n=${n} ${from}..${to}: null window but ${matching.length} matches`); checks++; continue; }
        for (const e of matching) assert.ok(e >= w.startKey && e <= w.endKey, `${name} n=${n} ${from}..${to}: event ${e} outside ${w.startKey}..${w.endKey}`);
        widest = Math.max(widest, (Date.parse(w.endKey) - Date.parse(w.startKey)) / 86400000);
        checks++;
      }
    }
  }
  assert.ok(widest < 45, `windows stay small (widest ${widest} days)`);
  console.log(`# INFO eventRangeForOffset: ${checks} window checks, widest window ${widest} days`);
  // degenerate inputs
  assert.equal(B.eventRangeForOffset('garbage', '2026-11-03', -3, null), null);
  assert.equal(B.eventRangeForOffset('2026-11-05', '2026-11-03', -3, null), null);
  assert.deepEqual(B.eventRangeForOffset('2026-11-03', '2026-11-05', 0, null), { startKey: '2026-11-03', endKey: '2026-11-05' });
  assert.equal(B.eventRangeForOffset('2026-11-06', '2026-11-07', -3, null), null, 'Fri+Sat only: no working target day');
});

test('the old fixed windows really would drop orders under these configs; the derived ones do not', () => {
  // print-prep used a fixed +12 days from the target: event -> prep gap under the rule
  const gap = (cfg) => { let max = 0; for (const e of eachKey('2025-09-01', '2027-12-31')) { const p = localKey(B.getPrintPrepDateWithConfig(e, cfg)); max = Math.max(max, (Date.parse(e) - Date.parse(p)) / 86400000); } return max; };
  assert.ok(gap(null) <= 12, `default max gap ${gap(null)} fits the old +12`);
  assert.ok(gap(TWO_WEEKS) > 12, `a closed fortnight pushes the gap to ${gap(TWO_WEEKS)} (> 12): the old fixed window dropped these orders`);
  // a5/adv used a fixed -7 days: event -> due gap
  const dueGap = (cfg) => { let max = 0; for (const e of eachKey('2026-08-01', '2027-06-30')) { max = Math.max(max, (Date.parse(LR.getExpectedReturnKey({ eventDate: stored(e) }, cfg)) - Date.parse(e)) / 86400000); } return max; };
  assert.ok(dueGap(null) <= 7);
  assert.ok(dueGap(V2_CHOL_HAMOED) > 7, `chol hamoed closed -> due gap ${dueGap(V2_CHOL_HAMOED)} (> 7): a fixed 7-day window would drop orders`);
  assert.ok(dueGap(TWO_WEEKS) > 7);
  // ...and the derived start covers every event (the a5/adv formula: min(inverse start, key-7))
  for (const cfg of [TWO_WEEKS, V2_CHOL_HAMOED, CLOSED_WEEK, null]) {
    for (const e of eachKey('2026-08-01', '2027-06-30')) {
      const due = LR.getExpectedReturnKey({ eventDate: stored(e) }, cfg);
      const inv = B.inverseBusinessDays(due, 1, cfg);
      assert.ok(inv, `due ${due} is a working day`);
      const start = inv.startKey < addKey(due, -7) ? inv.startKey : addKey(due, -7);
      assert.ok(e >= start && e <= due, `event ${e} due ${due} start ${start}`);
    }
  }
});

test('routes use the derived windows; #202 permission gate on a5/adv is intact', () => {
  const read = (f) => fs.readFileSync(path.join(process.env.PROJ, f), 'utf8');
  const pp = read('app/api/orders/print-prep/route.js');
  assert.match(pp, /eventRangeForOffset\(/);
  assert.match(pp, /PRINT_PREP_BUSINESS_DAYS_BEFORE_EVENT/);
  const adv = read('app/api/a5/adv/route.js');
  assert.match(adv, /inverseBusinessDays\(key, 1, nonWorkingDays\)/);
  assert.match(adv, /dueEventStart\(key\)/);
  assert.match(adv, /import \{ canOpenPage \} from '@\/lib\/permissions'/);
  assert.match(adv, /const FOCUS_PAGE = \{/);
  assert.match(adv, /if \(!\(await canOpenPage\(FOCUS_PAGE\[focus\]\)\)\) return NextResponse\.json\(/);
  assert.match(adv, /if \(!FOCUS_PAGE\[focus\]\) return NextResponse\.json\(/);
  assert.match(adv, /status: 403/);
});
