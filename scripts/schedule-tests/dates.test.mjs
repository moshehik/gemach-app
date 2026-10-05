// תאריכים: חלונות יום ישראליים, 00:30 שעון ישראל, מעבר שעון קיץ, והחיבור לכלל האחיד "יום לא עובד"
// (lib/businessDays.js) - ימי עסקים לשני הכיוונים, ההופכי, רשימת הימים של הבעלים.
// מורץ ב-3 אזורי זמן (ר' run.mjs) - כל הציפיות מוחלטות.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const D = await L('lib/schedule/dates.js');
const H = await L('lib/hebrewDate.js');
const B = await L('lib/businessDays.js');
const LR = await L('lib/lateReturn.js');

// רשימת בעלים (non_working_days_extra) בצורה הקנונית של גרסה 1
const owner = (days) => B.parseNonWorkingDaysSetting(JSON.stringify({ version: 1, days }));

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

// ---------- הכלל האחיד (lib/businessDays.js) דרך dates.js ----------

test('the schedule has NO calendar rule of its own: dates.js exports no weekday/holiday check, only wrappers over lib/businessDays.js', () => {
  for (const gone of ['isFridayOrShabbat', 'isChagKey', 'isBusinessDay', 'weekdayOf']) assert.equal(gone in D, false, gone + ' must not exist');
  for (const kept of ['isNonWorkingDay', 'dayStatus', 'addBusinessDays', 'sourceKeysForDay', 'rollForwardToWorkingDay', 'rolledSourceKeysForDay']) assert.equal(typeof D[kept], 'function', kept);
});

test('isNonWorkingDay / dayStatus come from the unified helper: Fri, Shabbat, chag, chol hamoed, erev chag (owner: "the gemach does not work on erev chag"; v2 NWD-Q02: chol hamoed closed) - timezone independent', () => {
  assert.equal(D.isNonWorkingDay('2026-10-01'), true, 'Thu 1.10 = chol hamoed Sukkot - closed under rule v2 (NWD-Q02, 1.10.2026)');
  assert.equal(D.isNonWorkingDay('2026-09-27'), true, 'Sun 27.9 = first day of chol hamoed Sukkot (v2)');
  assert.equal(D.isNonWorkingDay('2026-09-24'), false, 'Thu 24.9 = 13 Tishrei, the last working day before Sukkot');
  assert.equal(D.isNonWorkingDay('2026-10-02'), true, 'Fri 2.10 = Hoshana Raba = erev Shmini Atzeret');
  assert.equal(D.isNonWorkingDay('2026-10-03'), true, 'Shabbat 3.10 = Shmini Atzeret');
  assert.equal(D.isNonWorkingDay('2026-10-04'), false, 'Sun 4.10');
  assert.equal(D.isNonWorkingDay('2026-09-21'), true, 'Yom Kippur 5787 (Monday)');
  assert.equal(D.isNonWorkingDay('2026-09-20'), true, 'erev Yom Kippur (Sunday) - non-working by owner decision');
  assert.equal(D.isNonWorkingDay('2026-04-02'), true, 'Pesach I 5786');
  assert.equal(D.isNonWorkingDay('2026-04-07'), true, 'erev Pesach VII (20 Nisan)');
  assert.equal(D.isNonWorkingDay('2026-04-08'), true, 'Pesach VII');
  assert.equal(D.isNonWorkingDay('2026-04-05'), true, 'chol hamoed Pesach that is not an erev chag - closed under rule v2');
  // weekday erev chag examples for 5787: Sun 20.9.2026 erev Yom Kippur, Wed 21.4.2027 erev Pesach, Thu 10.6.2027 erev Shavuot
  for (const key of ['2026-09-20', '2027-04-21', '2027-06-10']) assert.equal(D.isNonWorkingDay(key), true, key + ' (erev chag, weekday)');

  const thu = D.dayStatus('2026-10-01');
  assert.equal(thu.working, false);
  assert.deepEqual(thu.reasons, ['chol_hamoed'], 'chol hamoed is its own reason (not chag, not erev chag)');
  assert.equal(thu.titles.length, 1);
  assert.match(thu.titles[0], /סכות.*חוה״מ/);
  assert.equal(thu.note, null);
  assert.deepEqual(D.dayStatus('2026-10-15'), { key: '2026-10-15', working: true, reasons: [], titles: [], note: null, recurring: null }, 'a plain Thursday (the fixture "today"); recurring = v2 field (owner\'s fixed Hebrew dates)');
  const fri = D.dayStatus('2026-10-02');
  assert.equal(fri.working, false);
  assert.deepEqual(fri.reasons, ['friday', 'chol_hamoed', 'erev_chag'], 'Hoshana Raba is both the last day of chol hamoed and erev Shmini Atzeret');
  assert.equal(fri.titles.length, 2);
  assert.match(fri.titles[0], /הושענא רבה/);
  assert.match(fri.titles[1], /^ערב .*שמיני עצרת/);
  const sat = D.dayStatus('2026-10-03');
  assert.deepEqual(sat.reasons, ['shabbat', 'chag']);
  assert.match(sat.titles[0], /שמיני עצרת/);
  assert.deepEqual(D.dayStatus('2026-09-21').reasons, ['chag']);
  assert.deepEqual(D.dayStatus('2026-09-20').reasons, ['erev_chag']);
});

test('owner-marked days (non_working_days_extra) are non-working for the schedule too, with reason "closed" and the note', () => {
  const cfg = owner([{ date: '2026-10-07', note: 'ספירת מלאי' }, { date: '2026-10-08' }]);
  assert.equal(D.isNonWorkingDay('2026-10-07'), false, 'a plain Wednesday without the config');
  assert.equal(D.isNonWorkingDay('2026-10-07', cfg), true);
  assert.equal(D.isNonWorkingDay('2026-10-08', cfg), true);
  assert.equal(D.isNonWorkingDay('2026-10-06', cfg), false);
  const st = D.dayStatus('2026-10-07', cfg);
  assert.deepEqual(st.reasons, ['closed']);
  assert.equal(st.note, 'ספירת מלאי');
  assert.deepEqual(st.titles, []);
  assert.equal(D.dayStatus('2026-10-08', cfg).note, null);
  // identical to the helper on every day of a full year (no drift between the schedule and the rest of the system)
  let k = '2026-09-12';
  for (let i = 0; i < 400; i++) {
    assert.equal(D.isNonWorkingDay(k, cfg), B.isNonWorkingDay(k, cfg), k);
    assert.deepEqual(D.dayStatus(k, cfg), B.dayStatus(k, cfg), k);
    k = D.addCalendarDays(k, 1);
  }
});

test('addBusinessDays: both directions through the helper; Fri/Sat/chag/chol hamoed/erev chag skipped; owner-marked day skipped', () => {
  assert.equal(D.addBusinessDays('2026-10-01', 1), '2026-10-04'); // Thu (chol hamoed) -> Fri (Hoshana Raba, erev chag) + Shabbat (chag) skipped -> Sun
  assert.equal(D.addBusinessDays('2026-10-15', 1), '2026-10-18'); // a plain Thu -> Fri/Sat skipped -> Sun
  assert.equal(D.addBusinessDays('2026-10-18', -1), '2026-10-15'); // Sun -> Thu
  // v2: backwards from Sun 4.10 the whole of Sukkot is closed - Shmini Atzeret, Hoshana Raba, chol hamoed 27.9-1.10,
  // Sukkot I (Shabbat 26.9), erev Sukkot (Fri 25.9) - so the previous business day is Thu 24.9
  assert.equal(D.addBusinessDays('2026-10-04', -1), '2026-09-24');
  assert.equal(D.addBusinessDays('2026-10-01', 0), '2026-10-01');
  assert.equal(D.addBusinessDays('2026-10-03', 0), '2026-10-03'); // event on Shabbat stays
  assert.equal(D.addBusinessDays('2026-09-30', 2), '2026-10-05'); // Wed (chol hamoed) -> Thu 1.10 (chol hamoed) .. Sat 3.10 skipped -> Sun(1) -> Mon(2)
  assert.equal(D.addBusinessDays('2026-09-30', 3), '2026-10-06');
  assert.equal(D.addBusinessDays('2026-10-14', 2), '2026-10-18'); // a plain Wed -> Thu(1) -> Fri/Sat skipped -> Sun(2)
  assert.equal(D.addBusinessDays('2026-10-14', 3), '2026-10-19');
  assert.equal(D.addBusinessDays('2026-09-24', 1), '2026-10-04', 'Thu 24.9 -> the next working day after Sukkot is Sun 4.10 (9 closed days)');
  assert.equal(D.addBusinessDays('2026-09-20', 1), '2026-09-22', 'erev YK -> YK skipped -> Tue');
  assert.equal(D.addBusinessDays('2026-09-19', 1), '2026-09-22', 'Sat -> Sun (erev YK) + Mon (YK) skipped -> Tue');
  const cfg = owner(['2026-10-05']);
  assert.equal(D.addBusinessDays('2026-10-01', 1, cfg), '2026-10-04');
  assert.equal(D.addBusinessDays('2026-10-01', 2, cfg), '2026-10-06', 'Mon 5.10 marked closed by the owner is skipped');
  assert.equal(D.addBusinessDays('2026-10-07', -2, cfg), '2026-10-04');
  assert.equal(D.addBusinessDays('2026-10-07', -2), '2026-10-05', '(same move without the owner list)');
});

test('stage 8 parity: addBusinessDays(event, 1, cfg) === getExpectedReturnKey (lib/lateReturn.js: order card, late list, print) on 120 consecutive event days, with and without owner-marked days', () => {
  const cfg = owner(['2026-10-05', '2026-11-17', '2026-11-18']);
  let key = '2026-09-01';
  for (let i = 0; i < 120; i++) {
    const order = { eventDate: key + 'T00:00:00.000Z' };
    assert.equal(D.addBusinessDays(key, 1, cfg), LR.getExpectedReturnKey(order, cfg), 'event ' + key + ' (owner list)');
    assert.equal(D.addBusinessDays(key, 1), LR.getExpectedReturnKey(order), 'event ' + key);
    key = D.addCalendarDays(key, 1);
  }
});

test('stage 8 parity for EXPLICIT dates: rollForwardToWorkingDay(toDate) === getExpectedReturnKey (lib/lateReturn.js) on 120 consecutive days, with and without owner-marked days (owner decision 2.10.2026)', () => {
  const cfg = owner(['2026-10-05', '2026-11-17', '2026-11-18', { date: '2026-10-16', status: 'open' }]);
  let key = '2026-09-01';
  for (let i = 0; i < 120; i++) {
    for (const field of ['toDate', 'returnDate']) {
      const order = { eventDate: '2026-08-20T00:00:00.000Z', [field]: key + 'T00:00:00.000Z' };
      assert.equal(LR.getExpectedReturnKey(order, cfg), D.rollForwardToWorkingDay(key, cfg), field + ' ' + key + ' (owner list)');
      assert.equal(LR.getExpectedReturnKey(order), D.rollForwardToWorkingDay(key), field + ' ' + key);
      assert.equal(D.isNonWorkingDay(LR.getExpectedReturnKey(order, cfg), cfg), false, 'never lands on a closed day');
    }
    key = D.addCalendarDays(key, 1);
  }
  // the v1 "open" override on Fri 16.10 is IGNORED since v2 (owner NWD-Q04: a closed day can never be opened) - it is
  // read, counted in ignoredOpen, and the Friday stays closed: the explicit date rolls to Sunday in both places
  assert.equal(cfg.ignoredOpen, 1);
  assert.equal(cfg.closed.has('2026-10-16'), false, 'the "open" row adds nothing to the closed set either');
  assert.equal(D.isNonWorkingDay('2026-10-16', cfg), true);
  assert.equal(D.rollForwardToWorkingDay('2026-10-16', cfg), '2026-10-18');
  assert.equal(LR.getExpectedReturnKey({ toDate: '2026-10-16T00:00:00.000Z' }, cfg), '2026-10-18');
  assert.equal(LR.getExpectedReturnKey({ toDate: '2026-10-16T00:00:00.000Z' }), '2026-10-18');
});

// The print pages / e-mails take the prep date from getPrintPrepDateWithConfig (lib/businessDays.js); the old
// getPrintPrepDate (lib/hebrewDate.js, Fri/Sat/chag/erev chag only) is no longer called by production code. v2 closes
// chol hamoed, so the two agree everywhere EXCEPT when the 3-day count crosses chol hamoed - there v2 is earlier.
test('addBusinessDays backward 3 days equals getPrintPrepDateWithConfig (print/e-mail prep date) on 90 consecutive days; vs the old getPrintPrepDate it differs exactly where the count crosses chol hamoed', () => {
  const keyOf = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  // a chol hamoed day that v1 COUNTED (not Fri/Shabbat, not erev chag like Hoshana Raba) in [fromKey, toKey)
  const cholHamoedBetween = (fromKey, toKey) => {
    for (let k = fromKey; k < toKey; k = D.addCalendarDays(k, 1)) if (B.isCholHamoedKey(k) && !B.isWeekendKey(k) && !B.isErevChagKey(k)) return true;
    return false;
  };
  let key = '2026-09-01';
  let differ = 0;
  for (let i = 0; i < 90; i++) {
    const ours = D.addBusinessDays(key, -3);
    assert.equal(ours, keyOf(B.getPrintPrepDateWithConfig(key, null)), 'prep date for event ' + key);
    const legacy = keyOf(H.getPrintPrepDate(D.keyToLocalMidnight(key)));
    if (cholHamoedBetween(legacy, key)) {
      differ++;
      assert.ok(ours < legacy, 'event ' + key + ': v2 prep (' + ours + ') must be EARLIER than the v1 one (' + legacy + ')');
    } else {
      assert.equal(ours, legacy, 'event ' + key + ' (no chol hamoed in the window): same as the old rule');
    }
    key = D.addCalendarDays(key, 1);
  }
  // events 28.9 - 6.10.2026: the v1 count stopped on chol hamoed 27.9-1.10; e.g. event Tue 6.10 -> v1 Thu 1.10, v2 Thu 24.9
  assert.equal(D.addBusinessDays('2026-10-06', -3), '2026-09-24');
  assert.ok(differ > 0, 'the window does cross Sukkot 5787');
});

test('Pesach 5786: prep date skips chag, chol hamoed AND erev chag (owner decisions)', () => {
  // Thu 9.4 back: Apr 8 (Pesach VII) + Apr 7 (chol hamoed + erev) + Apr 3-6 (chol hamoed, Fri/Shabbat) + Apr 2 (Pesach I) +
  // Apr 1 (erev Pesach) skipped -> Tue 31.3 (1), Mon 30.3 (2), Sun 29.3 (3). (Under v1, chol hamoed Sun 5.4 / Mon 6.4 counted -> 31.3.)
  assert.equal(D.addBusinessDays('2026-04-09', -3), '2026-03-29');
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

test('sourceKeysForDay: which event dates land on the requested day (inverse of the unified rule)', () => {
  // v2: Thu 1.10 is chol hamoed - closed, so nothing is prepared / picked up / returned on it
  for (const off of [-3, -2, 1]) assert.deepEqual(D.sourceKeysForDay('2026-10-01', off), [], 'chol hamoed 1.10, offset ' + off);
  // prep (-3 business days) on a plain Thursday 15.10: Fri 16.10 + Shabbat 17.10 skipped -> event Tue 20.10
  assert.deepEqual(D.sourceKeysForDay('2026-10-15', -3), ['2026-10-20']);
  // pickup (-2) on Thu 15.10 <- event Mon 19.10
  assert.deepEqual(D.sourceKeysForDay('2026-10-15', -2), ['2026-10-19']);
  // manual return (+1) on Thu 15.10 <- event Wed 14.10
  assert.deepEqual(D.sourceKeysForDay('2026-10-15', 1), ['2026-10-14']);
  // manual return on Sun 18.10 <- events Thu 15.10, Fri 16.10, Sat 17.10 (all map to the next working day)
  assert.deepEqual(D.sourceKeysForDay('2026-10-18', 1), ['2026-10-15', '2026-10-16', '2026-10-17']);
  // over Sukkot (v2): the last working day before it, Thu 24.9, prepares the events of Tue 6.10 and picks up those of
  // Mon 5.10; Sun 4.10 takes back every event from Thu 24.9 through Shmini Atzeret (10 days)
  assert.deepEqual(D.sourceKeysForDay('2026-09-24', -3), ['2026-10-06']);
  assert.deepEqual(D.sourceKeysForDay('2026-09-24', -2), ['2026-10-05']);
  assert.deepEqual(D.sourceKeysForDay('2026-10-04', 1), ['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03']);
  assert.deepEqual(D.sourceKeysForDay('2026-10-01', 0), ['2026-10-01']);
  // a non-working day is never the target of a count: nothing is prepared / picked up / returned on it
  assert.deepEqual(D.sourceKeysForDay('2026-10-03', -3), []);
  assert.deepEqual(D.sourceKeysForDay('2026-10-02', 1), []);
  assert.deepEqual(D.sourceKeysForDay('2026-10-03', 0), ['2026-10-03'], 'offset 0 (event day) is the day itself, even on Shabbat');
  // every returned key really maps back to the day
  for (const k of D.sourceKeysForDay('2026-09-24', -3)) assert.equal(D.addBusinessDays(k, -3), '2026-09-24');
  for (const k of D.sourceKeysForDay('2026-10-04', 1)) assert.equal(D.addBusinessDays(k, 1), '2026-10-04');
  // owner-marked Monday 5.10: pickup (-2) on Thu 24.9 (the working day before it, over Sukkot) now also covers events on
  // the closed Monday itself and on Tuesday
  const cfg = owner(['2026-10-05']);
  assert.deepEqual(D.sourceKeysForDay('2026-09-24', -2, cfg), ['2026-10-05', '2026-10-06']);
  assert.deepEqual(D.sourceKeysForDay('2026-09-24', -3, cfg), ['2026-10-07']);
  assert.deepEqual(D.sourceKeysForDay('2026-10-05', -2, cfg), [], 'the closed Monday itself has no pickups');
  // returns (+1) with the closed Monday: Thu 24.9 - Sat 3.10 events still come back on Sun 4.10 (Sunday itself stays
  // open), and Tue 6.10 collects only the events whose NEXT working day is Tuesday - Sunday's (Monday is closed) and the
  // closed Monday's own. Thu 1.10 does NOT map to 6.10: addBusinessDays('2026-10-01', 1, cfg) is Sunday, not Tuesday.
  assert.deepEqual(D.sourceKeysForDay('2026-10-04', 1, cfg), D.sourceKeysForDay('2026-10-04', 1), 'Sun 4.10 is unchanged by the closed Monday');
  assert.deepEqual(D.sourceKeysForDay('2026-10-06', 1, cfg), ['2026-10-04', '2026-10-05'], 'returns due Tue 6.10: Sunday events + the closed Monday itself');
  assert.deepEqual(D.sourceKeysForDay('2026-10-05', 1, cfg), [], 'nothing is returned on the closed Monday');
  for (const k of D.sourceKeysForDay('2026-10-06', 1, cfg)) assert.equal(D.addBusinessDays(k, 1, cfg), '2026-10-06');
  // the helper's own inverse is the source of truth: dates.js only expands its range to a list
  assert.deepEqual(B.inverseBusinessDays('2026-10-06', 1, cfg), { startKey: '2026-10-04', endKey: '2026-10-05' });
});

test('owner decision 2.10.2026: a return never lands on a closed day - rollForwardToWorkingDay / rolledSourceKeysForDay', () => {
  // a working day is itself
  assert.equal(D.rollForwardToWorkingDay('2026-10-15'), '2026-10-15', 'Thu 15.10');
  assert.equal(D.rollForwardToWorkingDay('2026-09-24'), '2026-09-24', 'Thu 24.9');
  // chol hamoed (v2) rolls like any closed day: Thu 1.10 -> Sun 4.10 (Fri 2.10 + Shabbat 3.10 closed as well)
  assert.equal(D.rollForwardToWorkingDay('2026-10-01'), '2026-10-04');
  assert.equal(D.rollForwardToWorkingDay('2026-09-27'), '2026-10-04', 'first day of chol hamoed -> Sun 4.10');
  // Fri / Shabbat -> Sunday
  assert.equal(D.rollForwardToWorkingDay('2026-10-16'), '2026-10-18', 'Fri 16.10 -> Sun 18.10');
  assert.equal(D.rollForwardToWorkingDay('2026-10-17'), '2026-10-18', 'Shabbat 17.10 -> Sun 18.10');
  // erev Yom Kippur (Sun 20.9) and Yom Kippur (Mon 21.9) -> Tue 22.9
  assert.equal(D.rollForwardToWorkingDay('2026-09-20'), '2026-09-22');
  assert.equal(D.rollForwardToWorkingDay('2026-09-21'), '2026-09-22');
  // Shabbat 26.9 = Sukkot I -> Sun 4.10: chol hamoed 27.9-1.10 is closed under rule v2 (it was Sun 27.9 under v1)
  assert.equal(D.rollForwardToWorkingDay('2026-09-26'), '2026-10-04');
  // owner-marked day
  const cfg = owner([{ date: '2026-10-13', note: 'ספירת מלאי' }]);
  assert.equal(D.rollForwardToWorkingDay('2026-10-13', cfg), '2026-10-14');
  assert.equal(D.rollForwardToWorkingDay('2026-10-13'), '2026-10-13', '(same day without the owner list)');
  assert.equal(D.rollForwardToWorkingDay('garbage'), null);

  // the inverse: the day itself + the closed run before it; [] on a closed day
  assert.deepEqual(D.rolledSourceKeysForDay('2026-10-18'), ['2026-10-16', '2026-10-17', '2026-10-18']);
  assert.deepEqual(D.rolledSourceKeysForDay('2026-10-04'), ['2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'],
    'v2: erev Sukkot (Fri 25.9), Sukkot I, chol hamoed, Hoshana Raba and Shmini Atzeret all roll to Sun 4.10');
  assert.deepEqual(D.rolledSourceKeysForDay('2026-10-01'), [], 'chol hamoed is closed: nothing rolls onto it');
  assert.deepEqual(D.rolledSourceKeysForDay('2026-10-15'), ['2026-10-15']);
  assert.deepEqual(D.rolledSourceKeysForDay('2026-10-17'), [], 'Shabbat');
  assert.deepEqual(D.rolledSourceKeysForDay('2026-10-13', cfg), []);
  assert.deepEqual(D.rolledSourceKeysForDay('2026-10-14', cfg), ['2026-10-13', '2026-10-14']);
  assert.deepEqual(D.rolledSourceKeysForDay('2026-09-22'), ['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22'], 'Fri + Shabbat + erev YK + YK all roll to Tue 22.9');
  assert.deepEqual(D.rolledSourceKeysForDay('garbage'), []);
  // invariant Sep-Dec 2026 (with and without the owner list): every key is in the list of its own rolled day,
  // the lists of working days partition the calendar, and no list contains a closed day as its target
  for (const c of [null, cfg]) {
    const seen = new Set();
    let k = '2026-09-01';
    while (k <= '2026-12-31') {
      const target = D.rollForwardToWorkingDay(k, c);
      assert.equal(D.isNonWorkingDay(target, c), false, 'target of ' + k + ' is a working day');
      assert.ok(D.rolledSourceKeysForDay(target, c).includes(k), k + ' is in the source list of ' + target);
      if (!D.isNonWorkingDay(k, c)) for (const s of D.rolledSourceKeysForDay(k, c)) { assert.equal(seen.has(s), false, s + ' listed twice'); seen.add(s); }
      k = D.addCalendarDays(k, 1);
    }
  }
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

// ?date= של הדף: "היום"/"מחר" בתפריט הם מילות יחס (סקירה 2.10, C) - מפוענחות בדף לפי היום הישראלי ולא נקבעות פעם אחת
// בבניית ה-layout (אחרי חצות "היום" נשאר אתמול עד טעינה קשיחה). רשימה סגורה; ISO ממשיך לעבוד.
test('?date= tokens: whitelist, ISO passthrough, resolution from the Israeli today key (incl. month/year/DST edges)', async () => {
  const C = await L('app/components/schedule/hebrewCalendar.js');
  for (const ok of ['today', 'tomorrow', '2026-10-04']) assert.equal(C.parseDateParam(ok), ok);
  for (const bad of ['yesterday', 'Today', 'TODAY', 'today ', 'now', '2026-1-1', '<script>', '', null, undefined, 'constructor', '__proto__', 'hasOwnProperty']) {
    assert.equal(C.parseDateParam(bad), null, String(bad));
  }
  assert.equal(C.resolveDateParam('today', '2026-10-04'), '2026-10-04');
  assert.equal(C.resolveDateParam('tomorrow', '2026-10-04'), '2026-10-05');
  assert.equal(C.resolveDateParam('tomorrow', '2026-10-31'), '2026-11-01');
  assert.equal(C.resolveDateParam('tomorrow', '2026-12-31'), '2027-01-01');
  assert.equal(C.resolveDateParam('tomorrow', '2026-10-24'), '2026-10-25', 'Israel DST ends 25.10.2026');
  assert.equal(C.resolveDateParam('tomorrow', '2027-03-25'), '2027-03-26', 'Israel DST starts 26.3.2027');
  assert.equal(C.resolveDateParam('2026-10-07', '2026-10-04'), '2026-10-07', 'ISO is not shifted');
  assert.equal(C.resolveDateParam(null, '2026-10-04'), null, 'no param => server decides (its Israeli today)');
  // בלי שעון מהשרת: לפי שעון ישראל בדפדפן, לא לפי אזור הזמן של המכשיר (00:30 ישראל = 21:30 UTC של אתמול)
  const t = Date.UTC(2026, 9, 3, 21, 30); // 4.10 00:30 ישראל
  assert.equal(C.israelTodayKey(new Date(t)), '2026-10-04');
  assert.equal(C.israelTodayKey(new Date(Date.UTC(2026, 9, 4, 20, 59))), '2026-10-04', '23:59 ישראל');
  assert.equal(C.israelTodayKey(new Date(Date.UTC(2026, 9, 4, 21, 0))), '2026-10-05', '00:00 ישראל');
});
