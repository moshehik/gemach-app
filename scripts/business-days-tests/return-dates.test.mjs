// Return / pickup / prep dates that are PRINTED or SENT to the customer, main vs v2.
// "Before" = the frozen origin/main 00104dc4 (post-#220) copies in legacy/: getExpectedReturnDate / getExpectedReturnKey
//            (lateReturn.main.mjs), subtractBusinessDays / getPrintPrepDateWithConfig (businessDays.main.mjs) -
//            the exact helpers main's print page, the two order e-mails, lib/inventory.js "מוחזר מחר", a5/adv
//            "החזרה היום/מחר" and print-prep call. Main's rule: Fri/Sat + chag + erev chag + owner list, chol hamoed OPEN.
// "After"  = the same helpers from the live lib/ (v2 rule: chol hamoed CLOSED, ranges + recurring Hebrew dates, no "open").
// Both sides read the stored instant as the Israeli day, so the comparisons run in EVERY process timezone.
// Claims proven:
//  1. Return date: with no owner-marked days the v2 date equals main's on every event day EXCEPT when a chol-hamoed
//     day lies between the event and the v2 date; then it is strictly LATER, never earlier (never a NEW late flag).
//  2. Pickup (2 business days before) / prep (3 before): identical to main unless chol hamoed lies between the v2
//     date and the event; then v2 is strictly EARLIER (further before the event), never later.
//  3. Known answers: Rosh Hashana, Yom Kippur, Sukkot incl. chol hamoed, Pesach, Shavuot, DST days - main AND v2 values.
//  4. Owner-closed days (single, range, recurring Hebrew date) move the dates; the retired "open" status does nothing;
//     an explicit toDate/returnDate that falls on a closed day rolls to the next working day (owner decision 2.10.2026 -
//     full proof in return-roll-forward.test.mjs) - under v2 that includes chol hamoed; on a working day it is kept.
//  5. a5/adv: under v2 the event->due gap exceeds the fixed 7-day floor (chol hamoed), and the route's derived start
//     (min(inverse start, key-7)) still covers every event. print-prep: the event->prep gap exceeds the old fixed +12
//     under the DEFAULT rule now, and the derived window covers every event.
//  6. lib/inventory.js checkMissingDressForItem ("אמור לחזור מחר") uses the v2 rule (mocked DB + clock), incl. Sukkot.
//  7. Display strings (weekday letter + Hebrew date) are the same in every process timezone.
import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { L, LM, eachKey, addKey, weekday, localKey, installDb, isCholHamoed, cholHamoedBetween } from './fixtures.mjs';

const B = await L('lib/businessDays.js');
const LR = await L('lib/lateReturn.js');
const H = await L('lib/hebrewDate.js');
const MB = await LM('businessDays');
const MLR = await LM('lateReturn');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { checkMissingDressForItem } = await L('lib/inventory.js');

const RANGE = ['2025-09-01', '2027-12-31'];
const stored = (k) => `${k}T00:00:00.000Z`; // how the app stores eventDate (see getIsraelDayRange for the 2nd form)
const dayName = (k) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekday(k)];

test('RETURN date main vs v2, no owner days: identical unless chol hamoed lies between the event and the v2 date; then v2 is later (every zone, both storage forms)', () => {
  let same = 0, diff = 0;
  const diffDays = new Set();
  for (const k of eachKey(...RANGE)) {
    for (const ev of [stored(k), H.getIsraelDayRange(k).start]) {
      const o = { eventDate: ev };
      const before = MLR.getExpectedReturnKey(o, null);
      const after = LR.getExpectedReturnKey(o, null);
      assert.equal(localKey(LR.getExpectedReturnDate(o, null)), after, `${k}: Date and key forms agree (TZ=${process.env.TZ})`);
      assert.equal(localKey(MLR.getExpectedReturnDate(o, null)), before, `${k}: main Date and key forms agree`);
      if (before === after) { same++; continue; }
      diff++;
      diffDays.add(k);
      assert.ok(after > before, `${k}: v2 return ${after} must be later than main ${before}`);
      assert.ok(cholHamoedBetween(addKey(k, 1), after), `${k}: main ${before}, v2 ${after}, but no chol hamoed in between`);
      // main's date itself is a chol-hamoed day (that is the only way v2 can move past it)
      assert.ok(isCholHamoed(before), `${k}: main's due day ${before} is not chol hamoed`);
    }
  }
  assert.ok(diff > 0 && same > diff);
  console.log(`# INFO return date main vs v2: ${same} identical samples, ${diff} later (chol hamoed), ${diffDays.size} distinct event days: ${[...diffDays].sort().join(' ')}`);
});

test('PICKUP (2 before) / PREP (3 before) main vs v2, empty config: identical unless chol hamoed lies between; then v2 is EARLIER (every zone)', () => {
  let same = 0, diff = 0;
  const diffDays = new Set();
  for (const k of eachKey(...RANGE)) {
    const ev = stored(k);
    for (const [label, before, after] of [
      ['pickup', localKey(MB.subtractBusinessDays(ev, 2, null)), localKey(B.subtractBusinessDays(ev, 2, null))],
      ['pickup(empty cfg)', localKey(MB.subtractBusinessDays(ev, 2, MB.EMPTY_NON_WORKING_CONFIG)), localKey(B.subtractBusinessDays(ev, 2, B.EMPTY_NON_WORKING_CONFIG))],
      ['prep', localKey(MB.getPrintPrepDateWithConfig(ev, null)), localKey(B.getPrintPrepDateWithConfig(ev, null))],
      ['prep(raw empty)', localKey(MB.getPrintPrepDateWithConfig(ev, '')), localKey(B.getPrintPrepDateWithConfig(ev, ''))],
    ]) {
      if (before === after) { same++; continue; }
      diff++;
      diffDays.add(k);
      assert.ok(after < before, `${label} ${k}: v2 ${after} must be earlier than main ${before}`);
      assert.ok(cholHamoedBetween(after, addKey(k, -1)), `${label} ${k}: main ${before}, v2 ${after}, no chol hamoed between`);
    }
    // the v2 helper equals the key walk with the v2 rule (pure, timezone-free)
    assert.equal(localKey(B.subtractBusinessDays(ev, 2, null)), B.addBusinessDays(k, -2), `pickup ${k} == addBusinessDays(-2)`);
    assert.equal(localKey(B.getPrintPrepDateWithConfig(ev, null)), B.addBusinessDays(k, -3), `prep ${k} == addBusinessDays(-3)`);
  }
  // the helper always returns a LOCAL-midnight Date (what the formatters read), like main
  const d = B.subtractBusinessDays('2026-11-10', 2, null);
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()], [2026, 10, 8, 0]);
  assert.ok(diff > 0 && same > diff);
  console.log(`# INFO pickup/prep main vs v2: ${same} identical, ${diff} earlier (chol hamoed), ${diffDays.size} distinct event days`);
});

test('timezone independence of the v2 helpers (every zone, both storage forms): equals the independent key walk', () => {
  const nonWorking = (k) => { const w = weekday(k); return w === 5 || w === 6 || B.isHolidayKey(k); };
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

// [event day, MAIN return (post-#203: Fri/Sat/chag/erev), V2 return (+ chol hamoed), why]. Israel 5787 calendar:
// RH 12-13.9.2026 (Sat-Sun), erev YK Sun 20.9, YK Mon 21.9, erev Sukkot Fri 25.9, Sukkot Sat 26.9, chol hamoed
// Sun 27.9 - Fri 2.10 (Hoshana Rabba), Shmini Atzeret Sat 3.10; Pesach 5786 Thu 2.4.2026 (erev Wed 1.4) .. Wed 8.4
// (chol hamoed Fri 3.4 - Tue 7.4), Shavuot Fri 22.5.2026 (erev Thu 21.5).
const KNOWN = [
  ['2026-09-10', '2026-09-14', '2026-09-14', 'Thursday before Rosh Hashana: Fri, Sat RH I, Sun RH II -> Mon 14.9 (no chol hamoed: same)'],
  ['2026-09-17', '2026-09-22', '2026-09-22', 'Thursday: Sun 20.9 is erev Yom Kippur, Mon 21.9 is Yom Kippur -> Tue'],
  ['2026-09-18', '2026-09-22', '2026-09-22', 'FRIDAY event: same chain'],
  ['2026-09-19', '2026-09-22', '2026-09-22', 'SATURDAY event: same chain'],
  ['2026-09-20', '2026-09-22', '2026-09-22', 'DAY BEFORE Yom Kippur (erev chag event): next day is YK'],
  ['2026-09-21', '2026-09-22', '2026-09-22', 'Yom Kippur itself: Tue 22.9 is a normal day'],
  ['2026-09-24', '2026-09-27', '2026-10-04', 'Thursday before erev Sukkot: main Sun 27.9 (chol hamoed, open there); v2 Sun 4.10 after Shmini Atzeret'],
  ['2026-09-28', '2026-09-29', '2026-10-04', 'Monday IN chol hamoed: main Tue 29.9; v2 Sun 4.10'],
  ['2026-09-30', '2026-10-01', '2026-10-04', 'Wednesday in Sukkot week: main Thu 1.10 (chol hamoed); v2 Sun 4.10'],
  ['2026-10-01', '2026-10-04', '2026-10-04', 'Thursday chol hamoed: Fri 2.10 Hoshana Rabba (erev), Sat 3.10 Shmini Atzeret -> Sun 4.10 in BOTH'],
  ['2026-10-02', '2026-10-04', '2026-10-04', 'Friday = Hoshana Rabba: Sun 4.10 in both'],
  ['2026-10-08', '2026-10-11', '2026-10-11', 'Thursday after the chagim: Sun 11.10'],
  ['2026-03-31', '2026-04-05', '2026-04-09', 'Tuesday before Pesach 5786: Wed 1.4 erev, Thu 2.4 Pesach, Fri/Sat; main Sun 5.4 (chol hamoed); v2 Thu 9.4 after Pesach VII (Wed 8.4)'],
  ['2026-05-20', '2026-05-24', '2026-05-24', 'Wednesday before Shavuot: Thu 21.5 erev, Fri 22.5 Shavuot, Sat -> Sun 24.5'],
  // DST days (Israel: spring forward Fri 27.3.2026, fall back Sun 25.10.2026) - both forms of eventDate
  ['2026-03-26', '2026-03-29', '2026-03-29', 'DST eve (Thu 26.3): Sun 29.3'],
  ['2026-03-27', '2026-03-29', '2026-03-29', 'DST day itself (Fri 27.3)'],
  ['2026-03-28', '2026-03-29', '2026-03-29', 'DST day after (Sat 28.3)'],
  ['2026-10-24', '2026-10-25', '2026-10-25', 'DST eve (Sat 24.10): Sun 25.10'],
  ['2026-10-25', '2026-10-26', '2026-10-26', 'DST fall-back day itself (Sun 25.10): Mon 26.10'],
  ['2026-10-26', '2026-10-27', '2026-10-27', 'day after DST fall-back'],
  ['2026-11-05', '2026-11-08', '2026-11-08', 'ordinary Thursday: Sunday'],
];
test('RETURN date known answers (both storage forms of eventDate; every timezone, main AND v2)', () => {
  for (const [event, mainWant, v2Want, why] of KNOWN) {
    for (const ev of [stored(event), H.getIsraelDayRange(event).start]) {
      assert.equal(LR.getExpectedReturnKey({ eventDate: ev }, null), v2Want, `V2 ${event} (${ev}) ${why} TZ=${process.env.TZ}`);
      assert.equal(localKey(LR.getExpectedReturnDate({ eventDate: ev }, null)), v2Want, `V2(Date) ${event} ${why}`);
      assert.equal(MLR.getExpectedReturnKey({ eventDate: ev }, null), mainWant, `MAIN ${event} (${ev}) ${why}`);
      assert.equal(localKey(MLR.getExpectedReturnDate({ eventDate: ev }, null)), mainWant, `MAIN(Date) ${event} ${why}`);
    }
  }
  // the changed rows are exactly the chol-hamoed rows
  const changed = KNOWN.filter(([, o, n]) => o !== n).map(([e]) => e);
  assert.deepEqual(changed, ['2026-09-24', '2026-09-28', '2026-09-30', '2026-03-31']);
  for (const [, mainWant] of KNOWN.filter(([, o, n]) => o !== n)) assert.ok(isCholHamoed(mainWant), `${mainWant} is chol hamoed`);
});

test('RETURN / PICKUP: owner-closed days (single / range / recurring) move the dates; retired "open" does nothing; explicit toDate/returnDate roll forward only off a closed day', () => {
  // Thu 5.11.2026 normally returns Sun 8.11. Owner closes Sun 8.11 and Mon 9.11 -> Tue 10.11
  const cfg = B.parseNonWorkingDaysSetting('[{"date":"2026-11-08"},{"date":"2026-11-09","status":"closed","note":"x"}]');
  assert.equal(LR.getExpectedReturnKey({ eventDate: stored('2026-11-05') }, cfg), '2026-11-10');
  assert.equal(localKey(LR.getExpectedReturnDate({ eventDate: stored('2026-11-05') }, cfg)), '2026-11-10');
  assert.equal(LR.getExpectedReturnKey({ eventDate: stored('2026-11-05') }, '[{"date":"2026-11-08"}]'), '2026-11-09'); // raw setting string accepted
  // v2 ranges and recurring Hebrew dates
  const range = B.parseNonWorkingDaysSetting('{"ranges":[{"from":"2026-11-08","to":"2026-11-12","note":"חופשה"}]}');
  assert.equal(LR.getExpectedReturnKey({ eventDate: stored('2026-11-05') }, range), '2026-11-15', 'Thu 5.11 -> vacation Sun-Thu, Fri, Sat -> Sun 15.11');
  const rec = B.parseNonWorkingDaysSetting('{"recurringHebrew":[{"month":"Shvat","day":26}]}');
  assert.equal(LR.getExpectedReturnKey({ eventDate: stored('2027-02-02') }, rec), '2027-02-04', 'Tue 2.2.2027 -> Wed 3.2 = 26 Shvat closed -> Thu 4.2');
  assert.equal(MLR.getExpectedReturnKey({ eventDate: stored('2027-02-02') }, rec), '2027-02-03', 'main does not know recurring dates');
  // the retired v1 "open" status is ignored: erev Yom Kippur stays closed -> event Fri 18.9 still returns Tue 22.9
  const open = B.parseNonWorkingDaysSetting('{"version":1,"days":[{"date":"2026-09-20","status":"open"}]}');
  assert.equal(open.ignoredOpen, 1);
  assert.equal(LR.getExpectedReturnKey({ eventDate: stored('2026-09-18') }, open), '2026-09-22');
  assert.equal(MLR.getExpectedReturnKey({ eventDate: stored('2026-09-18') }, MB.parseNonWorkingDaysSetting('{"version":1,"days":[{"date":"2026-09-20","status":"open"}]}')), '2026-09-20', 'main honoured "open"');
  // pickup = 2 working days before: event Tue 10.11 -> Mon 9.11, Sun 8.11 -> pickup Sun 8.11 (empty) / Thu 5.11 (Sun closed)
  assert.equal(localKey(B.subtractBusinessDays(stored('2026-11-10'), 2, null)), '2026-11-08');
  const sun = B.parseNonWorkingDaysSetting('[{"date":"2026-11-08"}]');
  assert.equal(localKey(B.subtractBusinessDays(stored('2026-11-10'), 2, sun)), '2026-11-05');
  assert.equal(localKey(B.subtractBusinessDays(stored('2026-11-15'), 2, range)), '2026-11-04', 'range: Sun 15.11 -> Sat, Fri, vacation Thu-Sun, Sat, Fri -> Thu 5.11 (1st), Wed 4.11 (2nd)');
  // prep date (3 working days): Tue 10.11 -> Mon 9.11, Sun 8.11, Thu 5.11  /  with Sun closed: Mon 9.11, Thu 5.11, Wed 4.11
  assert.equal(localKey(B.getPrintPrepDateWithConfig(stored('2026-11-10'), null)), '2026-11-05');
  assert.equal(localKey(B.getPrintPrepDateWithConfig(stored('2026-11-10'), sun)), '2026-11-04');
  // explicit dates win; one that falls on a closed day (Mon 21.9 = Yom Kippur) rolls to the next working day, Tue 22.9
  // (owner decision 2.10.2026); one on a working day (Tue 15.9) is shown as is; one on an owner-closed day (Sun 8.11,
  // closed in cfg together with Mon 9.11) rolls to Tue 10.11; one on chol hamoed (Tue 29.9) rolls past the whole Sukkot
  // stretch to Sun 4.10 under v2 (main, where chol hamoed was open, kept 29.9)
  const holiday = '2026-09-21T00:00:00.000Z';
  for (const field of ['toDate', 'returnDate']) {
    const o = { eventDate: stored('2026-09-01'), [field]: holiday };
    assert.equal(localKey(LR.getExpectedReturnDate(o, cfg)), '2026-09-22'); // shown as the Israeli day, local midnight (see the round-2 test for 21:00Z storage)
    assert.equal(LR.getExpectedReturnKey(o, cfg), '2026-09-22');
    assert.equal(LR.getExpectedReturnKey({ eventDate: stored('2026-09-01'), [field]: stored('2026-09-15') }, cfg), '2026-09-15');
    assert.equal(LR.getExpectedReturnKey({ eventDate: stored('2026-11-05'), [field]: stored('2026-11-08') }, cfg), '2026-11-10');
    assert.equal(LR.getExpectedReturnKey({ eventDate: stored('2026-11-05'), [field]: stored('2026-11-08') }, null), '2026-11-08', 'Sunday is a working day without the owner list');
    const chm = { eventDate: stored('2026-09-01'), [field]: stored('2026-09-29') };
    assert.equal(LR.getExpectedReturnKey(chm, null), '2026-10-04', 'chol hamoed is closed under v2');
    assert.equal(localKey(LR.getExpectedReturnDate(chm, null)), '2026-10-04');
    assert.equal(MLR.getExpectedReturnKey(chm, null), '2026-09-29', 'main kept a chol-hamoed explicit date');
    // v2 range / recurring date also roll an explicit date
    assert.equal(LR.getExpectedReturnKey({ eventDate: stored('2026-11-01'), [field]: stored('2026-11-09') }, range), '2026-11-15');
    assert.equal(LR.getExpectedReturnKey({ eventDate: stored('2027-01-20'), [field]: stored('2027-02-03') }, rec), '2027-02-04');
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
  // Thu 10.9.2026 -> Monday 14.9.2026 = 3 Tishrei 5787; Thu 17.9.2026 -> Tue 22.9.2026; Thu 24.9 -> Sun 4.10 = 23 Tishrei
  for (const [event, wantKey, wantLabel] of [['2026-09-10', '2026-09-14', "יום ב'"], ['2026-09-17', '2026-09-22', "יום ג'"], ['2026-09-19', '2026-09-22', "יום ג'"], ['2026-09-24', '2026-10-04', "יום א'"]]) {
    const d = LR.getExpectedReturnDate({ eventDate: stored(event) }, null);
    assert.equal(H.getHebrewWeekdayLabel(d), wantLabel, `${event} TZ=${process.env.TZ}`);
    const [y, m, day] = wantKey.split('-').map(Number);
    assert.equal(H.getHebrewDateString(d), H.getHebrewDateString(new Date(y, m - 1, day)), `${event} hebrew date`);
  }
  const rh = H.getHebrewDateString(LR.getExpectedReturnDate({ eventDate: stored('2026-09-10') }, null));
  assert.match(rh, /^ג תשרי /); // 3 Tishrei
  assert.match(H.getHebrewDateString(LR.getExpectedReturnDate({ eventDate: stored('2026-09-24') }, null)), /^כג תשרי /); // 23 Tishrei (Isru Chag)
});

test('a5/adv "החזרה היום/מחר": under v2 the event->due gap exceeds the fixed 7-day floor (chol hamoed); the derived start covers every event; route wiring', () => {
  let max = 0, maxEvent = '', maxMain = 0;
  for (const k of eachKey('2024-01-01', '2040-12-31')) {
    const due = LR.getExpectedReturnKey({ eventDate: stored(k) }, null);
    const gap = (Date.parse(`${due}T00:00:00Z`) - Date.parse(`${k}T00:00:00Z`)) / 86400000;
    if (gap > max) { max = gap; maxEvent = k; }
    maxMain = Math.max(maxMain, (Date.parse(`${MLR.getExpectedReturnKey({ eventDate: stored(k) }, null)}T00:00:00Z`) - Date.parse(`${k}T00:00:00Z`)) / 86400000);
  }
  assert.ok(maxMain <= 7, `main's max gap ${maxMain} fitted its fixed floor`);
  assert.ok(max > 7, `v2 max gap ${max} (${maxEvent}) exceeds the fixed -7 floor: the derived start is what keeps these orders`);
  console.log(`# INFO max event->due gap 2024-2040: main ${maxMain} days, v2 ${max} days (event ${maxEvent}, ${dayName(maxEvent)})`);
  // the a5/adv formula: start = min(inverseBusinessDays(due, 1).startKey, due - 7) - every event is inside [start, due]
  for (const k of eachKey('2024-01-01', '2040-12-31')) {
    const due = LR.getExpectedReturnKey({ eventDate: stored(k) }, null);
    const inv = B.inverseBusinessDays(due, 1, null);
    assert.ok(inv, `${due} is a working day`);
    const start = inv.startKey < addKey(due, -7) ? inv.startKey : addKey(due, -7);
    assert.ok(k >= start && k <= due, `event ${k} due ${due} start ${start}`);
  }
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

test('lib/inventory.js "אמור לחזור מחר": follows the unified rule incl. chol hamoed (event Thu 24.9.2026: main = due Sun 27.9, v2 = due Sun 4.10)', async () => {
  // Thu 24.9.2026, day before erev Sukkot: main flagged on Sat 26.9 (due Sun 27.9, chol hamoed); v2 due Sun 4.10 -> flagged on Sat 3.10 only
  setupMissing({ eventKey: '2026-09-24' });
  assert.equal(await missingOn('2026-09-26T10:00:00Z'), null, 'Sat 26.9: due date is no longer Sun 27.9 (chol hamoed)');
  assert.equal(await missingOn('2026-09-30T10:00:00Z'), null, 'mid chol hamoed: nothing due tomorrow');
  assert.deepEqual(await missingOn('2026-10-03T10:00:00Z'), { familyName: 'כהן', returnOrderId: 77 }, 'Sat 3.10: due tomorrow Sun 4.10');
  assert.equal(await missingOn('2026-10-04T10:00:00Z'), null, 'Sun 4.10: due today, not tomorrow');
  // Thu 10.9.2026 (Rosh Hashana weekend): due Mon 14.9 in main and v2 alike -> flagged on Sun 13.9 only
  setupMissing({ eventKey: '2026-09-10' });
  assert.equal(await missingOn('2026-09-12T10:00:00Z'), null, 'Sat 12.9: due date is not Sun 13.9 (RH II)');
  assert.deepEqual(await missingOn('2026-09-13T10:00:00Z'), { familyName: 'כהן', returnOrderId: 77 }, 'Sun 13.9: due tomorrow Mon 14.9');
  assert.equal(await missingOn('2026-09-14T10:00:00Z'), null, 'Mon 14.9: due today, not tomorrow');
  // ordinary Thursday 5.11.2026: due Sun 8.11 -> flagged on Sat 7.11 exactly like before
  setupMissing({ eventKey: '2026-11-05' });
  assert.deepEqual(await missingOn('2026-11-07T10:00:00Z'), { familyName: 'כהן', returnOrderId: 77 });
  assert.equal(await missingOn('2026-11-06T10:00:00Z'), null);
  // Friday event 18.9.2026: due Tue 22.9 (erev YK + YK) -> flagged on Mon 21.9
  setupMissing({ eventKey: '2026-09-18' });
  assert.equal(await missingOn('2026-09-19T10:00:00Z'), null);
  assert.deepEqual(await missingOn('2026-09-21T10:00:00Z'), { familyName: 'כהן', returnOrderId: 77 });
});

test('lib/inventory.js: owner-closed day / range from the setting row moves "מחר"; explicit toDate untouched; broken setting = defaults', async () => {
  const closedSetting = (v) => [{ key: B.NON_WORKING_DAYS_SETTING_KEY, value: v }];
  // Thu 5.11 normally due Sun 8.11; owner closes Sun 8.11 -> due Mon 9.11 -> flagged Sun 8.11 (not Sat 7.11)
  setupMissing({ eventKey: '2026-11-05', settings: closedSetting('[{"date":"2026-11-08"}]') });
  assert.equal(await missingOn('2026-11-07T10:00:00Z'), null);
  assert.deepEqual(await missingOn('2026-11-08T10:00:00Z'), { familyName: 'כהן', returnOrderId: 77 });
  // v2 range Sun 8.11 - Thu 12.11 -> due Sun 15.11 -> flagged Sat 14.11
  setupMissing({ eventKey: '2026-11-05', settings: closedSetting('{"version":2,"ranges":[{"from":"2026-11-08","to":"2026-11-12"}]}') });
  assert.equal(await missingOn('2026-11-07T10:00:00Z'), null);
  assert.deepEqual(await missingOn('2026-11-14T10:00:00Z'), { familyName: 'כהן', returnOrderId: 77 });
  for (const broken of ['{"days":[{', '42', '', 'null']) {
    setupMissing({ eventKey: '2026-11-05', settings: closedSetting(broken) });
    assert.deepEqual(await missingOn('2026-11-07T10:00:00Z'), { familyName: 'כהן', returnOrderId: 77 }, `broken setting ${JSON.stringify(broken)} = defaults`);
  }
  // explicit toDate on a holiday (Mon 21.9 = Yom Kippur) is due on the next working day, Tue 22.9 (owner decision
  // 2.10.2026): "back tomorrow" on Mon 21.9, not on Sun 20.9
  setupMissing({ eventKey: '2026-09-01' });
  globalThis.__ORDER_ITEMS[0].order.toDate = new Date('2026-09-21T00:00:00.000Z');
  assert.deepEqual(await missingOn('2026-09-21T10:00:00Z'), { familyName: 'כהן', returnOrderId: 77 });
  assert.equal(await missingOn('2026-09-20T10:00:00Z'), null);
  assert.equal(await missingOn('2026-09-19T10:00:00Z'), null);
  // explicit toDate on a working day (Tue 15.9): unchanged - "back tomorrow" on Mon 14.9
  globalThis.__ORDER_ITEMS[0].order.toDate = new Date('2026-09-15T00:00:00.000Z');
  assert.deepEqual(await missingOn('2026-09-14T10:00:00Z'), { familyName: 'כהן', returnOrderId: 77 });
  assert.equal(await missingOn('2026-09-15T10:00:00Z'), null);
});

// ---- round 2: explicit dates read as the Israeli day; lookup windows derived from the rule ----
const cfgOf = (...ranges) => {
  const days = [];
  for (const [a, b] of ranges) for (const k of eachKey(a, b ?? a)) days.push({ date: k });
  return B.parseNonWorkingDaysSetting(JSON.stringify(days));
};

test('explicit toDate/returnDate and event-date fallbacks are read as the ISRAELI day in every timezone (21:00Z / 22:00Z storage)', () => {
  // [stored instant, the Israeli day it denotes, the due day shown everywhere = that day rolled to a working day
  // (owner decision 2.10.2026): Mon 21.9 = Yom Kippur -> Tue 22.9, Fri 27.3 -> Sun 29.3; Thu 5.11 / Sun 25.10 kept]
  const cases = [
    ['2026-09-20T21:00:00.000Z', '2026-09-21', '2026-09-22'], // summer Israel midnight of 21.9 (previous UTC day)
    ['2026-11-04T22:00:00.000Z', '2026-11-05', '2026-11-05'], // winter Israel midnight of 5.11
    ['2026-09-21T00:00:00.000Z', '2026-09-21', '2026-09-22'], // usual storage
    ['2026-09-21T12:00:00.000Z', '2026-09-21', '2026-09-22'],
    ['2026-03-26T22:00:00.000Z', '2026-03-27', '2026-03-29'], // day before the spring DST change (27.3 is a Friday)
    ['2026-10-24T21:00:00.000Z', '2026-10-25', '2026-10-25'], // fall-back day, 00:00 Israel (still summer time)
  ];
  for (const [iso, want, wantDue] of cases) {
    assert.equal(B.rollForwardToWorkingDay(want, null), wantDue);
    for (const field of ['toDate', 'returnDate']) {
      const d = LR.getExpectedReturnDate({ eventDate: stored('2026-09-01'), [field]: iso }, null);
      assert.equal(localKey(d), wantDue, `${field} ${iso} TZ=${process.env.TZ}`);
      assert.equal(d.getHours(), 0);
      assert.equal(LR.getExpectedReturnKey({ eventDate: stored('2026-09-01'), [field]: iso }, null), wantDue);
    }
    assert.equal(localKey(B.israelLocalDate(iso)), want, `israelLocalDate ${iso}`);
    assert.equal(localKey(B.israelLocalDate(new Date(iso))), want);
    assert.equal(localKey(MB.israelLocalDate(iso)), want, 'israelLocalDate unchanged vs main');
    // the weekday letter and Hebrew date shown to the customer are the Israeli ones
    const [y, m, day] = want.split('-').map(Number);
    assert.equal(H.getHebrewWeekdayLabel(B.israelLocalDate(iso)), H.getHebrewWeekdayLabel(new Date(y, m - 1, day)));
    assert.equal(H.getHebrewDateString(B.israelLocalDate(iso)), H.getHebrewDateString(new Date(y, m - 1, day)));
  }
  // an explicit date is read as the Israeli day FIRST and only then rolled (21:00Z of 20.9 = Israel midnight of
  // Mon 21.9 = Yom Kippur -> Tue 22.9; on a UTC server the raw instant would have read as Sun 20.9, erev YK)
  assert.equal(LR.getExpectedReturnKey({ toDate: '2026-09-20T21:00:00.000Z' }, null), '2026-09-22');
  assert.equal(LR.getExpectedReturnKey({ toDate: '2026-09-14T21:00:00.000Z' }, null), '2026-09-15', 'Israel midnight of a working day: unchanged');
  for (const bad of [null, undefined, '', 'garbage', new Date('x')]) assert.equal(B.israelLocalDate(bad), null);
  assert.equal(LR.getExpectedReturnDate({ eventDate: stored('2026-09-01'), toDate: 'garbage' }, null), null);
});

// brute force: every event E whose counted date lands in [from, to] must lie inside eventRangeForOffset(from, to, n)
const CLOSED_WEEK = cfgOf(['2026-11-02', '2026-11-08']);
const TWO_WEEKS = cfgOf(['2026-11-01', '2026-11-16']);
// owner closes the working days around the chagim too (Sukkot 2026 and Pesach 2027 stacked on the closed chol hamoed)
const CHAGIM_PLUS = B.parseNonWorkingDaysSetting('{"ranges":[{"from":"2026-09-22","to":"2026-10-08"},{"from":"2027-04-18","to":"2027-05-06"}]}');
const CONFIGS = { empty: null, closedWeek: CLOSED_WEEK, twoWeeks: TWO_WEEKS, chagimPlus: CHAGIM_PLUS };

test('eventRangeForOffset: derived window contains EVERY matching event (prep n=-3, due n=+1; single days and ranges; closed weeks / chol hamoed / stacked ranges)', () => {
  let checks = 0, widest = 0;
  for (const [name, cfg] of Object.entries(CONFIGS)) {
    for (const n of [-3, 1]) {
      const evs = [...eachKey('2026-08-15', '2027-06-15')];
      const counted = new Map(evs.map((e) => [e, B.addBusinessDays(e, n, cfg)]));
      for (const [from, len] of [['2026-09-01', 1], ['2026-09-20', 1], ['2026-09-22', 1], ['2026-09-23', 1], ['2026-10-04', 1], ['2026-10-11', 1], ['2026-11-03', 1], ['2026-11-09', 1], ['2026-11-10', 1], ['2027-04-19', 1], ['2027-04-14', 1], ['2027-05-02', 1], ['2026-09-20', 7], ['2026-11-01', 9], ['2026-12-01', 3], ['2027-04-02', 12], ['2027-04-15', 20]]) {
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
  assert.ok(widest < 60, `windows stay small (widest ${widest} days)`);
  console.log(`# INFO eventRangeForOffset: ${checks} window checks, widest window ${widest} days`);
  // degenerate inputs
  assert.equal(B.eventRangeForOffset('garbage', '2026-11-03', -3, null), null);
  assert.equal(B.eventRangeForOffset('2026-11-05', '2026-11-03', -3, null), null);
  assert.deepEqual(B.eventRangeForOffset('2026-11-03', '2026-11-05', 0, null), { startKey: '2026-11-03', endKey: '2026-11-05' });
  assert.equal(B.eventRangeForOffset('2026-11-06', '2026-11-07', -3, null), null, 'Fri+Sat only: no working target day');
  assert.equal(B.eventRangeForOffset('2026-09-27', '2026-10-03', -3, null), null, 'the whole chol hamoed .. Shmini Atzeret stretch: no working target day under v2');
  assert.deepEqual(MB.eventRangeForOffset('2026-09-27', '2026-10-01', -3, null) !== null, true, 'main still had working days there');
  // Sukkot 5787 under v2: prep day Wed 23.9 serves events Mon 5.10 .. Mon 5.10? (3 business days before Mon 5.10 = Sun 4.10, Thu 24.9, Wed 23.9)
  assert.deepEqual(B.eventRangeForOffset('2026-09-23', '2026-09-23', -3, null), { startKey: '2026-10-05', endKey: '2026-10-05' });
  assert.deepEqual(B.eventRangeForOffset('2026-09-22', '2026-09-22', -3, null), { startKey: '2026-09-25', endKey: '2026-10-04' }, 'Tue 22.9 serves every event from erev Sukkot through Sun 4.10');
});

test('the fixed windows (print-prep +12, a5/adv -7) would now drop orders under the DEFAULT v2 rule; the derived windows do not', () => {
  // print-prep used a fixed +12 days from the target: event -> prep gap under the rule
  const gap = (cfg) => { let max = 0, at = ''; for (const e of eachKey('2025-09-01', '2027-12-31')) { const p = localKey(B.getPrintPrepDateWithConfig(e, cfg)); const g = (Date.parse(e) - Date.parse(p)) / 86400000; if (g > max) { max = g; at = e; } } return { max, at }; };
  const mainGap = (() => { let max = 0; for (const e of eachKey('2025-09-01', '2027-12-31')) max = Math.max(max, (Date.parse(e) - Date.parse(localKey(MB.getPrintPrepDateWithConfig(e, null)))) / 86400000); return max; })();
  assert.ok(mainGap <= 12, `main's default max gap ${mainGap} fitted the old +12`);
  const g0 = gap(null);
  assert.ok(g0.max > 12, `v2 default max gap ${g0.max} (event ${g0.at}) exceeds the old +12: chol hamoed alone needs the derived window`);
  assert.ok(gap(TWO_WEEKS).max > 12, `a closed fortnight pushes the gap to ${gap(TWO_WEEKS).max} (> 12)`);
  console.log(`# INFO event->prep gap (3 business days): main max ${mainGap} days, v2 max ${g0.max} days (event ${g0.at}, ${dayName(g0.at)})`);
  // ...and the derived end covers every event whose prep day is the requested day
  for (const cfg of [null, CLOSED_WEEK, TWO_WEEKS, CHAGIM_PLUS]) {
    for (const d of eachKey('2026-09-01', '2027-06-30')) {
      const end = B.printPrepWindowEndKey(d, d, cfg);
      for (const e of eachKey(d, addKey(d, 40))) {
        if (localKey(B.getPrintPrepDateWithConfig(e, cfg)) === d) assert.ok(end && e <= end, `prep day ${d}: event ${e} beyond derived end ${end}`);
      }
    }
  }
  // a5/adv used a fixed -7 days: event -> due gap
  const dueGap = (cfg) => { let max = 0; for (const e of eachKey('2026-08-01', '2027-06-30')) { max = Math.max(max, (Date.parse(LR.getExpectedReturnKey({ eventDate: stored(e) }, cfg)) - Date.parse(e)) / 86400000); } return max; };
  assert.ok(dueGap(null) > 7, `chol hamoed closed -> default due gap ${dueGap(null)} (> 7): a fixed 7-day window would drop orders`);
  assert.ok(dueGap(TWO_WEEKS) > 7);
  // ...and the derived start covers every event (the a5/adv formula: min(inverse start, key-7))
  for (const cfg of [TWO_WEEKS, CHAGIM_PLUS, CLOSED_WEEK, null]) {
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
  // behaviour of the print-prep window is proven by print-prep-route.test.mjs (real handler); here only the wiring
  assert.match(pp, /printPrepWindowEndKey\(fromStr, toStr, nonWorkingDays\)/);
  assert.doesNotMatch(pp, /\.test\(fromStr\)/, 'no hand-written date regex in the route');
  const adv = read('app/api/a5/adv/route.js');
  assert.match(adv, /inverseBusinessDays\(key, 1, nonWorkingDays\)/);
  assert.match(adv, /dueEventStart\(key\)/);
  assert.match(adv, /import \{ canOpenPage \} from '@\/lib\/permissions'/);
  assert.match(adv, /const FOCUS_PAGE = \{/);
  assert.match(adv, /if \(!\(await canOpenPage\(FOCUS_PAGE\[focus\]\)\)\) return NextResponse\.json\(/);
  assert.match(adv, /if \(!FOCUS_PAGE\[focus\]\) return NextResponse\.json\(/);
  assert.match(adv, /status: 403/);
});
