// non_working_days_extra v2: parsing (tolerant, v1-compatible), serialization (canonical), closed days /
// ranges / recurring Hebrew dates, NO "open" override, dayStatus / listNonWorkingDays for the calendar UI,
// validation for POST /api/settings. Contract: scratch/schedule-build/CONTRACT-non-working-days.md (v2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HDate } from '@hebcal/core';
import { L, eachKey, addKey } from './fixtures.mjs';

const B = await L('lib/businessDays.js');

const DOC = {
  version: 2,
  days: [{ date: '2026-10-15', note: 'ספירת מלאי' }, { date: '2026-10-16' }],
  ranges: [{ from: '2026-11-15', to: '2026-11-19', note: 'חופשה' }],
  recurringHebrew: [{ month: 'Shvat', day: 26, note: 'יום זיכרון' }],
};
const CANON = JSON.stringify(DOC);

test('key name / version / permission key are the contract ones', () => {
  assert.equal(B.NON_WORKING_DAYS_SETTING_KEY, 'non_working_days_extra');
  assert.equal(B.NON_WORKING_DAYS_SETTING_VERSION, 2);
  assert.equal(B.NON_WORKING_DAYS_PERMISSION_KEY, 'feature:non_working_days_manage');
});

test('missing / empty / broken value => empty config (defaults only), never throws', () => {
  for (const raw of [null, undefined, '', '   ', '{', 'null', '42', '"x"', '{"days":"no"}', '{}', '[]']) {
    const cfg = B.parseNonWorkingDaysSetting(raw);
    assert.equal(cfg.closed.size, 0, `closed for ${JSON.stringify(raw)}`);
    assert.equal(cfg.ranges.length, 0);
    assert.equal(cfg.recurringHebrew.length, 0);
    assert.equal(B.isNonWorkingDay('2026-11-03', cfg), false);
    assert.equal(B.isNonWorkingDay('2026-11-06', cfg), true, 'Friday still closed with empty config');
    assert.equal(B.isNonWorkingDay('2026-09-28', cfg), true, 'chol hamoed still closed with empty config');
  }
  assert.equal(B.parseNonWorkingDaysSetting('{').invalid, 1);
  assert.equal(B.parseNonWorkingDaysSetting('{"days":"no"}').invalid, 1);
  assert.equal(B.parseNonWorkingDaysSetting('').invalid, 0);
  assert.equal(B.parseNonWorkingDaysSetting('{}').invalid, 0);
  assert.equal(B.parseNonWorkingDaysSetting(null).invalid, 0);
});

test('canonical v2 shape parses; serialize(parse(x)) is canonical, sorted and stable; document round trip', () => {
  const cfg = B.parseNonWorkingDaysSetting(CANON);
  assert.equal(cfg.version, 2);
  assert.deepEqual([...cfg.days].sort(), ['2026-10-15', '2026-10-16']);
  assert.deepEqual([...cfg.closed].sort(), ['2026-10-15', '2026-10-16', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19']);
  assert.equal(cfg.notes.get('2026-10-15'), 'ספירת מלאי');
  assert.equal(cfg.notes.get('2026-11-17'), 'חופשה', 'range note applies to each day of the range');
  assert.deepEqual(cfg.ranges, [{ from: '2026-11-15', to: '2026-11-19', note: 'חופשה' }]);
  assert.deepEqual(cfg.recurringHebrew, [{ month: 'Shvat', day: 26, note: 'יום זיכרון' }]);
  assert.equal(cfg.invalid, 0);
  assert.equal(cfg.ignoredOpen, 0);
  assert.equal(B.serializeNonWorkingDaysSetting(cfg), CANON);
  assert.deepEqual(B.nonWorkingDaysDocument(cfg), DOC);
  // unsorted / aliased input serializes canonical
  const shuffled = JSON.stringify({ days: [{ date: '2026-10-16' }, { date: '2026-10-15', note: 'ספירת מלאי' }], ranges: DOC.ranges, recurringHebrew: [{ month: 'שבט', day: '26', note: 'יום זיכרון' }] });
  assert.equal(B.serializeNonWorkingDaysSetting(B.parseNonWorkingDaysSetting(shuffled)), CANON);
  // serialize accepts the raw string / the document object too
  assert.equal(B.serializeNonWorkingDaysSetting(CANON), CANON);
  assert.equal(B.serializeNonWorkingDaysSetting(DOC), CANON);
  // the document is a plain editable object the UI can mutate and re-parse
  const doc = B.nonWorkingDaysDocument(cfg);
  doc.days.push({ date: '2026-12-01', note: 'x' });
  doc.ranges.push({ from: '2027-01-10', to: '2027-01-12' });
  doc.recurringHebrew.push({ month: 'Adar', day: 14 });
  const cfg2 = B.parseNonWorkingDaysSetting(doc);
  assert.equal(B.isNonWorkingDay('2026-12-01', cfg2), true);
  assert.equal(B.isNonWorkingDay('2027-01-11', cfg2), true);
  assert.equal(B.isNonWorkingDay('2027-03-23', cfg2), true, '14 Adar in leap 5787 = Adar II = Purim 23.3.2027');
  assert.equal(cfg.closed.size, 7, 'the source config is untouched');
});

test('v1 compatibility: {version:1, days:[{date,status,note}]}, bare arrays, arrays of strings; "open" is ignored and counted', () => {
  const v1 = B.parseNonWorkingDaysSetting('{"version":1,"days":[{"date":"2026-10-15","status":"closed","note":"ספירת מלאי"},{"date":"2026-10-16"},{"date":"2026-09-20","status":"open","note":"ערב יום כיפור - פתוחים"}]}');
  assert.deepEqual([...v1.closed].sort(), ['2026-10-15', '2026-10-16']);
  assert.equal(v1.notes.get('2026-10-15'), 'ספירת מלאי');
  assert.equal(v1.ignoredOpen, 1);
  assert.equal(v1.invalid, 1, 'the open entry counts as invalid too');
  assert.equal(B.isNonWorkingDay('2026-09-20', v1), true, 'erev YK stays closed - "open" has no effect');
  assert.equal(v1.notes.has('2026-09-20'), false);
  assert.equal(B.serializeNonWorkingDaysSetting(v1), JSON.stringify({ version: 2, days: [{ date: '2026-10-15', note: 'ספירת מלאי' }, { date: '2026-10-16' }], ranges: [], recurringHebrew: [] }), 're-serialized as v2 without the open entry');
  for (const open of ['Open', ' open ', 'OPEN']) assert.equal(B.parseNonWorkingDaysSetting(`[{"date":"2026-11-06","status":"${open}"}]`).ignoredOpen, 1, open);
  const a = B.parseNonWorkingDaysSetting('[{"date":"2026-10-15"},{"date":"2026-10-16","status":"closed"},{"date":"2026-10-17","status":" CLOSED "}]');
  assert.deepEqual([...a.closed].sort(), ['2026-10-15', '2026-10-16', '2026-10-17']);
  const b = B.parseNonWorkingDaysSetting('["2026-10-15","2026-10-16"]');
  assert.deepEqual([...b.closed].sort(), ['2026-10-15', '2026-10-16']);
  const c = B.parseNonWorkingDaysSetting({ days: [{ date: '2026-10-15' }] });
  assert.deepEqual([...c.closed], ['2026-10-15']);
  assert.equal(B.parseNonWorkingDaysSetting(c), c, 'a config object is returned as-is');
  assert.equal('open' in c, false, 'no open set on the config any more');
});

test('a default-closed day can never be opened: no API, no status, no config field has that effect', () => {
  const attempts = [
    '[{"date":"2026-11-06","status":"open"}]',
    '{"days":[{"date":"2026-11-06","status":"open"}],"open":["2026-11-06"]}',
    '{"open":["2026-11-06"],"working":["2026-11-06"],"exceptions":["2026-11-06"]}',
    '{"ranges":[{"from":"2026-11-06","to":"2026-11-06","status":"open"}]}',
  ];
  for (const raw of attempts) {
    const cfg = B.parseNonWorkingDaysSetting(raw);
    assert.equal(B.isNonWorkingDay('2026-11-06', cfg), true, `Friday stays closed for ${raw}`);
    assert.equal(B.isNonWorkingDay('2026-09-21', cfg), true, 'Yom Kippur stays closed');
    assert.equal(B.isNonWorkingDay('2026-09-28', cfg), true, 'chol hamoed stays closed');
  }
  assert.equal(B.validateNonWorkingDaysSettingValue(attempts[0]), 'סימון יום סגור כ"פתוח" אינו נתמך יותר.');
});

test('invalid entries are skipped and counted; valid ones still apply', () => {
  const raw = JSON.stringify({ days: [
    { date: '2026-10-15' },               // ok
    { date: '2026-02-30' },               // not a real date
    { date: '15/10/2026' },               // wrong format
    { date: '2026-10-17', status: 'maybe' }, // unknown status
    'not-a-date', 7, null, { note: 'x' },  // garbage
    { date: '2026-10-18', note: 'x'.repeat(500) }, // note truncated to 200
  ], ranges: [
    { from: '2026-12-01', to: '2026-12-03' },        // ok
    { from: '2026-12-10', to: '2026-12-05' },        // reversed
    { from: '2026-12-01', to: '2027-12-02' },        // 367 days: too long
    { from: '2026-12-01' }, 'x', null, { from: '2026-02-30', to: '2026-03-01' },
    { from: '2027-01-01', to: '2027-12-31', note: 'ok' }, // exactly 365 days: fine
  ], recurringHebrew: [
    { month: 'Shvat', day: 26 },     // ok
    { month: 'Shvat', day: 31 },     // no such day
    { month: 'Shvat', day: 0 },
    { month: 'Iyyar', day: 30 },     // Iyyar is always 29
    { month: 'Adar', day: 30 },      // Adar / Adar II are always 29
    { month: 'Adar II', day: 30 },
    { month: 'Adar I', day: 30 },    // ok (30 in leap years; closes nothing in a simple year)
    { month: 'Cheshvan', day: 30 },  // ok (closes nothing in a short year)
    { month: 'Mars', day: 1 }, { month: 12, day: 1 }, { day: 1 }, null, 'x', { month: 'Nisan', day: 1.5 },
  ] });
  const cfg = B.parseNonWorkingDaysSetting(raw);
  assert.deepEqual([...cfg.days].sort(), ['2026-10-15', '2026-10-18']);
  assert.equal(cfg.notes.get('2026-10-18').length, 200);
  assert.deepEqual(cfg.ranges.map((r) => `${r.from}..${r.to}`), ['2026-12-01..2026-12-03', '2027-01-01..2027-12-31']);
  assert.deepEqual(cfg.recurringHebrew.map((r) => `${r.month} ${r.day}`), ['Cheshvan 30', 'Shvat 26', 'Adar I 30']);
  assert.equal(cfg.invalid, 7 + 6 + 11);
  assert.equal(cfg.ignoredOpen, 0);
});

test('ranges: every day closed, note precedence (day > later range > earlier range), reasons, serialization keeps the range', () => {
  const cfg = B.parseNonWorkingDaysSetting({
    days: [{ date: '2026-11-17', note: 'יום בודד' }],
    ranges: [{ from: '2026-11-15', to: '2026-11-19', note: 'חופשה' }, { from: '2026-11-18', to: '2026-11-20', note: 'מלאי' }],
  });
  for (const k of eachKey('2026-11-15', '2026-11-20')) assert.equal(B.isNonWorkingDay(k, cfg), true, k);
  assert.equal(B.isNonWorkingDay('2026-11-14', cfg), true, 'Shabbat anyway');
  assert.equal(B.isNonWorkingDay('2026-11-22', cfg), false);
  assert.equal(B.dayStatus('2026-11-16', cfg).note, 'חופשה');
  assert.equal(B.dayStatus('2026-11-18', cfg).note, 'מלאי', 'the later range wins on overlap');
  assert.equal(B.dayStatus('2026-11-17', cfg).note, 'יום בודד', 'an explicit day note wins over the range note');
  assert.deepEqual(B.dayStatus('2026-11-17', cfg).reasons, ['closed', 'range']);
  assert.deepEqual(B.dayStatus('2026-11-16', cfg).reasons, ['range']);
  assert.deepEqual(B.dayStatus('2026-11-20', cfg).reasons, ['range', 'friday']);
  assert.equal(B.nextWorkingDay('2026-11-12', cfg), '2026-11-22', 'Thu 12.11 -> Fri/Sat, range 15-20, Sat 21 -> Sun 22');
  const doc = B.nonWorkingDaysDocument(cfg);
  assert.deepEqual(doc.days, [{ date: '2026-11-17', note: 'יום בודד' }], 'range days are not flattened into days');
  assert.equal(doc.ranges.length, 2);
  // a one-day range is allowed
  const one = B.parseNonWorkingDaysSetting({ ranges: [{ from: '2026-11-17', to: '2026-11-17' }] });
  assert.equal(B.isNonWorkingDay('2026-11-17', one), true);
  assert.equal(one.invalid, 0);
});

test('recurring Hebrew dates: canonical/alias/Hebrew month names, Adar rule (Adar I = leap years only), 30th-of-short-month rule (no closure that year), leap and non-leap years', () => {
  const cfg = B.parseNonWorkingDaysSetting({ recurringHebrew: [
    { month: 'שבט', day: 26, note: 'כ"ו שבט' },
    { month: 'Adar', day: 14 },      // Purim day
    { month: 'Adar I', day: 14 },    // Purim katan in leap years; nothing in simple years
    { month: 'Adar II', day: 7 },
    { month: "Sh'vat", day: 15 },    // alias
    { month: 'cheshvan', day: 30 },
    { month: 'Kislev', day: 30 },
    { month: 'Adar I', day: 30 },
    { month: 'TISHREI', day: 1 },    // coincides with Rosh Hashana
  ] });
  assert.equal(cfg.invalid, 0);
  assert.deepEqual(cfg.recurringHebrew.map((r) => r.month), ['Tishrei', 'Cheshvan', 'Kislev', 'Shvat', 'Shvat', 'Adar', 'Adar I', 'Adar I', 'Adar II'], 'sorted from Tishrei, Adar before Nisan');
  const hits = (y) => B.listNonWorkingDays(`${y}-01-01`, `${y}-12-31`, cfg).filter((d) => d.reasons.includes('recurring')).map((d) => `${d.key}=${d.recurring.label}`);
  // 5787 (Sep 2026 - Sep 2027) is a leap year; 5786 and 5789 are not. Cheshvan 5787 has 30 days, Cheshvan 5789 has 29.
  assert.deepEqual(hits(2027), [
    '2027-02-03=כ״ו שבט',            // 26 Shvat 5787
    '2027-02-21=י״ד אדר א\'',        // Adar I 14 (leap)
    '2027-03-09=ל׳ אדר א\'',         // Adar I 30 (leap: Adar I has 30)
    '2027-03-16=ז׳ אדר ב\'',         // Adar II 7
    '2027-03-23=י״ד אדר',            // 'Adar' in a leap year = Adar II = Purim 23.3.2027
    '2027-10-02=א׳ תשרי',            // 1 Tishrei 5788 = Sat 2.10.2027 (Rosh Hashana)
    '2027-11-30=ל׳ חשוון',           // 30 Cheshvan 5788 (Cheshvan 5788 has 30 days)
    '2027-12-30=ל׳ כסלו',            // 30 Kislev 5788
    '2027-01-23=ט״ו שבט',
  ].sort());
  // non-leap 5789 (Sep 2028 - Sep 2029): 'Adar' and 'Adar II' land on the one Adar; 'Adar I' (14 and 30) closes NOTHING (NW-I7);
  // Cheshvan 5789 has 29 days, so 30 Cheshvan closes nothing that year (NW-I7b); Kislev 5789 has 30 days (18.12.2028)
  const y2029 = hits(2029);
  assert.ok(y2029.includes('2029-02-11=כ״ו שבט'), y2029.join(' '));
  assert.equal(y2029.filter((h) => h.startsWith('2029-03-01=')).length, 1, 'Purim 5789 = 1.3.2029: only Adar 14 closes it (Adar I 14 does not exist in a simple year)');
  assert.equal(B.dayStatus('2029-03-01', cfg).recurring.month, 'Adar', 'the one entry that hits Purim of a simple year is plain Adar');
  assert.equal(B.hebrewDateOfKey('2029-03-01').label, 'י״ד אדר');
  assert.ok(y2029.includes('2029-02-22=ז׳ אדר ב\''), 'Adar II 7 in a non-leap year = 7 Adar');
  assert.equal(B.hebrewDateOfKey('2029-02-22').label, 'ז׳ אדר');
  assert.equal(y2029.some((h) => h.startsWith('2029-03-16=')), false, '30 Adar I in a non-leap year: no Adar I, nothing closes (not 29 Adar)');
  assert.equal(B.dayStatus('2029-03-16', cfg).recurring, null);
  assert.equal(B.hebrewDateOfKey('2029-03-16').label, 'כ״ט אדר');
  assert.equal(y2029.some((h) => h.endsWith('=ל׳ חשוון')), false, 'Cheshvan 5790 is short: 30 Cheshvan closes nothing, not 29 Cheshvan');
  assert.equal(B.dayStatus('2029-11-07', cfg).recurring, null);
  assert.equal(B.hebrewDateOfKey('2029-11-07').label, 'כ״ט חשוון');
  // reference years (owner NW-I7b): 5787 (leap, Cheshvan 30 + Kislev 30) closes 30 Cheshvan and 30 Kislev; 5789 (Cheshvan 29, Kislev 30) only 30 Kislev
  const y5787 = B.listNonWorkingDays('2026-09-12', '2027-09-11', cfg).filter((d) => d.reasons.includes('recurring')).map((d) => `${d.key}=${d.recurring.label}`);
  assert.ok(y5787.includes('2026-11-10=ל׳ חשוון') && y5787.includes('2026-12-10=ל׳ כסלו'), 'Cheshvan 5787 and Kislev 5787 have a 30th');
  const y5789 = B.listNonWorkingDays('2028-09-01', '2029-09-10', cfg).filter((d) => d.reasons.includes('recurring')).map((d) => `${d.key}=${d.recurring.label}`);
  assert.equal(y5789.some((h) => h.endsWith('=ל׳ חשוון')), false, 'Cheshvan 5789 has 29 days: 30 Cheshvan closes nothing');
  assert.ok(y5789.includes('2028-12-18=ל׳ כסלו'), 'Kislev 5789 has 30 days');
  // Tishrei 1 = Rosh Hashana: closed anyway, both reasons reported
  assert.deepEqual(B.dayStatus('2026-09-12', cfg).reasons, ['recurring', 'shabbat', 'chag', 'erev_chag']);
  assert.equal(B.dayStatus('2027-02-03', cfg).note, 'כ"ו שבט');
  assert.equal(B.dayStatus('2027-02-03', cfg).recurring.label, 'כ״ו שבט');
  assert.equal(B.listNonWorkingDays('2027-02-01', '2027-02-28', cfg).some((d) => d.key === '2027-02-03'), true);
  // duplicates: the last entry's note wins, listed once
  const dup = B.parseNonWorkingDaysSetting({ recurringHebrew: [{ month: 'Shvat', day: 26, note: 'a' }, { month: 'שבט', day: '26', note: 'b' }] });
  assert.equal(dup.recurringHebrew.length, 1);
  assert.equal(dup.recurringHebrew[0].note, 'b');
  // a Hebrew date near the Gregorian year boundary can fall 0 or 2 times in one Gregorian year (10 Tevet: 30.12.2025,
  // 20.12.2026, none in 2027, 9.1.2028 and 28.12.2028). Over a long span every Hebrew year is hit exactly once.
  const single = B.parseNonWorkingDaysSetting({ recurringHebrew: [{ month: 'Tevet', day: 10 }] });
  const yearly = (y) => B.listNonWorkingDays(`${y}-01-01`, `${y}-12-31`, single).filter((d) => d.reasons.includes('recurring')).map((d) => d.key);
  assert.deepEqual(yearly(2026), ['2026-12-20']);
  assert.deepEqual(yearly(2027), []);
  assert.deepEqual(yearly(2028), ['2028-01-09', '2028-12-28']);
  // independent count: 10 Tevet of every Hebrew year, via hebcal's absolute day number, that falls in 2025-2034
  let expected = 0;
  for (let hy = 5784; hy <= 5797; hy++) { const k = new Date((new HDate(10, 10, hy).abs() - 719163) * 86400000).toISOString().slice(0, 10); if (k >= '2025-01-01' && k <= '2034-12-31') expected++; }
  let total = 0;
  for (let y = 2025; y <= 2034; y++) {
    for (const k of yearly(y)) { total++; const h = B.hebrewDateOfKey(k); assert.deepEqual([h.month, h.day], ['Tevet', 10], k); }
  }
  assert.equal(total, expected, `2025-2034 contain ${expected} occurrences of 10 Tevet`);
  assert.ok(expected >= 9 && expected <= 11);
});

test('recurring cache: repeated lookups are fast and independent per config signature (dates AND notes)', () => {
  const cfgA = B.parseNonWorkingDaysSetting({ recurringHebrew: [{ month: 'Shvat', day: 26 }] });
  const cfgB = B.parseNonWorkingDaysSetting({ recurringHebrew: [{ month: 'Shvat', day: 27 }] });
  // same date, different notes: each config reports its own note (the cache must not leak one into the other)
  const noteA = B.parseNonWorkingDaysSetting({ recurringHebrew: [{ month: 'Shvat', day: 26, note: 'הערה א' }] });
  const noteB = B.parseNonWorkingDaysSetting({ recurringHebrew: [{ month: 'Shvat', day: 26, note: 'הערה ב' }] });
  assert.equal(B.dayStatus('2027-02-03', cfgA).note, null);
  assert.equal(B.dayStatus('2027-02-03', noteA).note, 'הערה א');
  assert.equal(B.dayStatus('2027-02-03', noteB).note, 'הערה ב');
  assert.equal(B.dayStatus('2027-02-03', cfgA).note, null);
  const t0 = Date.now();
  let n = 0;
  for (let i = 0; i < 20; i++) for (const k of eachKey('2026-01-01', '2027-12-31')) { if (B.isNonWorkingDay(k, cfgA)) n++; if (B.isNonWorkingDay(k, cfgB)) n++; }
  assert.ok(Date.now() - t0 < 3000, `29k lookups took ${Date.now() - t0}ms`);
  assert.ok(n > 0);
  assert.equal(B.isNonWorkingDay('2027-02-03', cfgA), true);
  assert.equal(B.isNonWorkingDay('2027-02-03', cfgB), false);
  assert.equal(B.isNonWorkingDay('2027-02-04', cfgB), true);
  // many distinct signatures do not leak memory (cache is bounded) and stay correct
  for (let d = 1; d <= 29; d++) {
    for (const m of ['Nisan', 'Iyyar', 'Sivan']) {
      const c = B.parseNonWorkingDaysSetting({ recurringHebrew: [{ month: m, day: d }] });
      const list = B.listNonWorkingDays('2027-03-01', '2027-07-31', c).filter((x) => x.reasons.includes('recurring'));
      assert.equal(list.length, 1, `${m} ${d}`);
      assert.deepEqual([B.hebrewDateOfKey(list[0].key).month, B.hebrewDateOfKey(list[0].key).day], [m, d]);
    }
  }
});

test('EMPTY_NON_WORKING_CONFIG is immutable; cloneNonWorkingConfig / nonWorkingDaysDocument give editable copies', () => {
  const E = B.EMPTY_NON_WORKING_CONFIG;
  assert.throws(() => E.closed.add('2026-11-03'), TypeError);
  assert.throws(() => E.days.add('2026-11-03'), TypeError);
  assert.throws(() => E.notes.set('2026-11-03', 'x'), TypeError);
  assert.throws(() => E.closed.clear(), TypeError);
  assert.throws(() => E.ranges.push({ from: '2026-11-03', to: '2026-11-03' }), TypeError);
  assert.throws(() => E.recurringHebrew.push({ month: 'Shvat', day: 1 }), TypeError);
  assert.throws(() => { E.invalid = 5; }, TypeError); // frozen object in strict (ESM) mode
  assert.equal(E.closed.size, 0);
  assert.equal(B.isNonWorkingDay('2026-11-03', E), false, 'defaults still work with the frozen config');
  assert.equal(B.isNonWorkingDay('2026-11-06', E), true);
  const c = B.cloneNonWorkingConfig(E);
  c.closed.add('2026-11-03');
  c.notes.set('2026-11-03', 'x');
  assert.equal(B.isNonWorkingDay('2026-11-03', c), true);
  assert.equal(E.closed.size, 0, 'the default is untouched');
  const src = B.parseNonWorkingDaysSetting('[{"date":"2026-11-04"}]');
  const c2 = B.cloneNonWorkingConfig(src);
  c2.closed.delete('2026-11-04');
  assert.equal(src.closed.has('2026-11-04'), true);
  assert.equal(B.cloneNonWorkingConfig(null).closed.size, 0);
  assert.deepEqual([...B.cloneNonWorkingConfig('[{"date":"2026-11-05"}]').closed], ['2026-11-05']);
  assert.deepEqual(B.nonWorkingDaysDocument(E), { version: 2, days: [], ranges: [], recurringHebrew: [] });
  assert.deepEqual(B.nonWorkingDaysDocument(null), { version: 2, days: [], ranges: [], recurringHebrew: [] });
});

test('caps: 2000 days / 100 ranges / 60 recurring are read (rest counted as invalid); listNonWorkingDays returns at most 800 days', () => {
  const days = [];
  for (let i = 0; i < 2500; i++) days.push({ date: addKey('2030-01-01', i) });
  const ranges = [];
  for (let i = 0; i < 120; i++) ranges.push({ from: addKey('2040-01-01', i * 3), to: addKey('2040-01-01', i * 3 + 1) }); // 2040: clear of the 2500 single days (2030-2036)
  const recurringHebrew = [];
  for (let i = 0; i < 70; i++) recurringHebrew.push({ month: 'Nisan', day: 1 + (i % 29), note: String(i) });
  const cfg = B.parseNonWorkingDaysSetting(JSON.stringify({ days, ranges, recurringHebrew }));
  assert.equal(cfg.days.size, 2000);
  assert.equal(cfg.ranges.length, 100);
  assert.equal(cfg.recurringHebrew.length, 29, '60 read, duplicates collapse to the 29 distinct days');
  assert.equal(cfg.invalid, 500 + 20 + 10);
  assert.equal(cfg.closed.has('2030-01-01'), true);
  assert.equal(cfg.closed.has(addKey('2030-01-01', 1999)), true);
  assert.equal(cfg.closed.has(addKey('2030-01-01', 2000)), false, 'entry 2001 dropped');
  assert.equal(cfg.closed.has(addKey('2040-01-01', 99 * 3)), true);
  assert.equal(cfg.closed.has(addKey('2040-01-01', 100 * 3)), false, 'range 101 dropped');
  assert.equal(B.MAX_SETTING_ENTRIES, 2000);
  assert.equal(B.MAX_RANGE_ENTRIES, 100);
  assert.equal(B.MAX_RANGE_DAYS, 366);
  assert.equal(B.MAX_RECURRING_ENTRIES, 60);
  // a 1e5-entry setting parses quickly and never hangs; 100 max-length ranges too
  const big = JSON.stringify({ days: new Array(100000).fill({ date: '2030-05-05' }), ranges: new Array(100).fill({ from: '2030-01-01', to: '2030-12-31' }) });
  const t0 = Date.now();
  const bigCfg = B.parseNonWorkingDaysSetting(big);
  assert.ok(Date.now() - t0 < 3000, 'parse under 3s');
  assert.equal(bigCfg.days.size, 1);
  assert.equal(bigCfg.closed.size, 365);
  assert.equal(bigCfg.invalid, 98000);
  // listNonWorkingDays range cap
  assert.equal(B.MAX_LIST_RANGE_DAYS, 800);
  const all = B.listNonWorkingDays('2026-01-01', '2036-12-31', cfg); // 11 years asked, 800 days served
  const last = all.at(-1).key;
  assert.ok(last <= '2028-03-10' && last >= '2028-03-01', `last listed day ${last}`); // 2026-01-01 + 799 days = 2028-03-10
  assert.ok(all.length > 200 && all.length < 320, `count ${all.length}`);
  assert.equal(B.listNonWorkingDays('2026-01-01', '2026-01-01', cfg).length, 0, 'Thursday 1.1.2026');
  assert.equal(B.listNonWorkingDays('2026-01-02', '2026-01-03', cfg).length, 2, 'Fri+Sat');
});

test('duplicate dates: last note wins; status variants', () => {
  const notes = B.parseNonWorkingDaysSetting('[{"date":"2026-11-03","note":"first"},{"date":"2026-11-03","note":"second"}]');
  assert.equal(notes.notes.get('2026-11-03'), 'second');
  assert.equal(notes.closed.size, 1);
  const cfg = B.parseNonWorkingDaysSetting('[{"date":"2026-11-04","status":" closed "},{"date":"2026-11-05","status":"CLOSED"},{"date":"2026-11-06","status":"  "},{"date":"2026-11-09","status":"opened"},{"date":"2026-11-10","status":7}]');
  assert.deepEqual([...cfg.closed].sort(), ['2026-11-04', '2026-11-05', '2026-11-06']); // blank status = closed
  assert.equal(cfg.invalid, 2);
});

test('closed: a plain Tuesday becomes non-working; defaults unaffected elsewhere', () => {
  const cfg = B.parseNonWorkingDaysSetting('[{"date":"2026-11-03"}]');
  assert.equal(B.isNonWorkingDay('2026-11-03', cfg), true);
  assert.equal(B.isNonWorkingDay('2026-11-04', cfg), false);
  assert.equal(B.isNonWorkingDay('2026-11-07', cfg), true, 'Shabbat untouched');
  assert.equal(B.isWorkingDay('2026-11-03', cfg), false);
  assert.equal(B.isNonWorkingDay('2026-11-03'), false, 'without the config the Tuesday is open');
});

test('opts.skipWeekend=false ignores Fri/Sat but still honours holidays, chol hamoed and the owner list', () => {
  const cfg = B.parseNonWorkingDaysSetting('{"days":[{"date":"2026-11-03"}],"recurringHebrew":[{"month":"Shvat","day":26}]}');
  const o = { skipWeekend: false };
  assert.equal(B.isNonWorkingDay('2026-11-06', cfg, o), false, 'Friday counts');
  assert.equal(B.isNonWorkingDay('2026-11-07', cfg, o), false, 'Shabbat counts');
  assert.equal(B.isNonWorkingDay('2026-09-21', cfg, o), true, 'Yom Kippur still closed');
  assert.equal(B.isNonWorkingDay('2026-09-20', cfg, o), true, 'erev YK still closed');
  assert.equal(B.isNonWorkingDay('2026-09-28', cfg, o), true, 'chol hamoed still closed');
  assert.equal(B.isNonWorkingDay('2026-11-03', cfg, o), true, 'owner day still closed');
  assert.equal(B.isNonWorkingDay('2027-02-03', cfg, o), true, 'recurring day still closed');
  assert.equal(B.isNonWorkingDay('2026-09-21', cfg, { skipWeekend: false, skipHolidays: false }), false);
  assert.equal(B.isNonWorkingDay('2026-09-28', cfg, { skipWeekend: false, skipHolidays: false }), false);
});

test('dayStatus: reasons in fixed order, note, titles, recurring info', () => {
  const cfg = B.parseNonWorkingDaysSetting(CANON);
  assert.deepEqual(B.dayStatus('2026-10-15', cfg), { key: '2026-10-15', working: false, reasons: ['closed'], titles: [], note: 'ספירת מלאי', recurring: null });
  assert.deepEqual(B.dayStatus('2026-10-16', cfg), { key: '2026-10-16', working: false, reasons: ['closed', 'friday'], titles: [], note: null, recurring: null });
  assert.deepEqual(B.dayStatus('2026-09-20', cfg), { key: '2026-09-20', working: false, reasons: ['erev_chag'], titles: ['ערב יום כפור'], note: null, recurring: null });
  assert.deepEqual(B.dayStatus('2026-09-21', cfg), { key: '2026-09-21', working: false, reasons: ['chag'], titles: ['יום כפור'], note: null, recurring: null });
  assert.deepEqual(B.dayStatus('2026-10-17', cfg), { key: '2026-10-17', working: false, reasons: ['shabbat'], titles: [], note: null, recurring: null });
  assert.deepEqual(B.dayStatus('2026-11-03', cfg), { key: '2026-11-03', working: true, reasons: [], titles: [], note: null, recurring: null });
  assert.deepEqual(B.dayStatus('2026-11-17', cfg), { key: '2026-11-17', working: false, reasons: ['range'], titles: [], note: 'חופשה', recurring: null });
  assert.deepEqual(B.dayStatus('2027-02-03', cfg), { key: '2027-02-03', working: false, reasons: ['recurring'], titles: [], note: 'יום זיכרון', recurring: { month: 'Shvat', day: 26, label: 'כ״ו שבט' } });
  assert.equal(B.dayStatus('garbage', cfg), null);
});

test('listNonWorkingDays: a month at a glance (Sep 2026 incl. chol hamoed Sukkot)', () => {
  const cfg = B.parseNonWorkingDaysSetting(CANON);
  const sept = B.listNonWorkingDays('2026-09-01', '2026-09-30', cfg);
  const keys = sept.map((d) => d.key);
  // Fri/Sat: 4,5,11,12,18,19,25,26 + RH 12-13 + erev YK 20 + YK 21 + erev Sukkot 25 + Sukkot 26 + chol hamoed 27-30
  assert.deepEqual(keys, ['2026-09-04', '2026-09-05', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30']);
  assert.deepEqual(sept.find((d) => d.key === '2026-09-13').reasons, ['chag']);
  assert.deepEqual(sept.find((d) => d.key === '2026-09-11').reasons, ['friday', 'erev_chag']);
  assert.deepEqual(sept.find((d) => d.key === '2026-09-29').reasons, ['chol_hamoed']);
  assert.deepEqual(B.listNonWorkingDays('2026-09-30', '2026-09-01', cfg), [], 'reversed range => empty');
  assert.deepEqual(B.listNonWorkingDays('x', '2026-09-01', cfg), []);
});

test('validateNonWorkingDaysSettingValue: what POST /api/settings accepts', () => {
  assert.equal(B.validateNonWorkingDaysSettingValue(CANON), null);
  assert.equal(B.validateNonWorkingDaysSettingValue(''), null, 'empty = no extra days');
  assert.equal(B.validateNonWorkingDaysSettingValue('   '), null);
  assert.equal(B.validateNonWorkingDaysSettingValue(undefined), null);
  assert.equal(B.validateNonWorkingDaysSettingValue(null), null);
  assert.equal(B.validateNonWorkingDaysSettingValue('{"version":1,"days":[{"date":"2026-10-15","status":"closed"}]}'), null, 'v1 closed entries are fine');
  assert.equal(B.validateNonWorkingDaysSettingValue('{'), 'רשימת הימים אינה JSON תקין.');
  assert.equal(B.validateNonWorkingDaysSettingValue('42'), 'רשימת הימים מכילה 1 רשומות לא תקינות (תאריך לא קיים, טווח הפוך או ארוך משנה, חודש/יום עברי לא תקין, או חריגה מהתקרה).');
  assert.match(B.validateNonWorkingDaysSettingValue('{"days":[{"date":"2026-02-30"}]}'), /1 רשומות לא תקינות/);
  assert.match(B.validateNonWorkingDaysSettingValue('{"ranges":[{"from":"2026-12-10","to":"2026-12-05"}]}'), /לא תקינות/);
  assert.match(B.validateNonWorkingDaysSettingValue('{"recurringHebrew":[{"month":"Iyyar","day":30}]}'), /לא תקינות/);
  assert.equal(B.validateNonWorkingDaysSettingValue('{"days":[{"date":"2026-11-06","status":"open"}]}'), 'סימון יום סגור כ"פתוח" אינו נתמך יותר.');
  assert.equal(B.validateNonWorkingDaysSettingValue(42), 'ערך לא תקין - נדרשת מחרוזת JSON.');
  assert.equal(B.validateNonWorkingDaysSettingValue('x'.repeat(B.MAX_SETTING_VALUE_LENGTH + 1)), 'רשימת הימים ארוכה מדי.');
  assert.equal(B.isNonWorkingDaysOnlySettingsBatch([{ key: 'non_working_days_extra', value: '' }]), true);
  assert.equal(B.isNonWorkingDaysOnlySettingsBatch([{ key: 'non_working_days_extra' }, { key: 'non_working_days_extra' }]), true);
  assert.equal(B.isNonWorkingDaysOnlySettingsBatch([{ key: 'non_working_days_extra' }, { key: 'require_login' }]), false, 'any other key => head management only');
  assert.equal(B.isNonWorkingDaysOnlySettingsBatch([]), false);
  assert.equal(B.isNonWorkingDaysOnlySettingsBatch([null]), false);
  assert.equal(B.isNonWorkingDaysOnlySettingsBatch({ key: 'non_working_days_extra' }), false);
  assert.equal(B.isNonWorkingDaysOnlySettingsBatch(null), false);
});

test('HEBREW_MONTH_OPTIONS / formatHebrewDayMonth for the UI', () => {
  assert.deepEqual(B.HEBREW_MONTH_OPTIONS.map((o) => o.value), ['Tishrei', 'Cheshvan', 'Kislev', 'Tevet', 'Shvat', 'Adar', 'Adar I', 'Adar II', 'Nisan', 'Iyyar', 'Sivan', 'Tamuz', 'Av', 'Elul']);
  assert.deepEqual(B.HEBREW_MONTH_OPTIONS.map((o) => o.maxDay), [30, 30, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29]);
  assert.equal(B.HEBREW_MONTH_OPTIONS.find((o) => o.value === 'Cheshvan').label, 'חשוון');
  assert.throws(() => B.HEBREW_MONTH_OPTIONS.push({}), TypeError);
  assert.equal(B.formatHebrewDayMonth('Shvat', 26), 'כ״ו שבט');
  assert.equal(B.formatHebrewDayMonth('Tishrei', 1), 'א׳ תשרי');
  assert.equal(B.formatHebrewDayMonth('Cheshvan', 30), 'ל׳ חשוון');
  assert.equal(B.formatHebrewDayMonth('Shvat', 15), 'ט״ו שבט');
  assert.equal(B.formatHebrewDayMonth('Adar II', 16), 'ט״ז אדר ב\'');
});
