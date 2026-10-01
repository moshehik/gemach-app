// non_working_days_extra: parsing (tolerant), serialization (canonical), closed/open semantics,
// dayStatus / listNonWorkingDays for the calendar UI. Contract: scratch/schedule-build/CONTRACT-non-working-days.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { L } from './fixtures.mjs';

const B = await L('lib/businessDays.js');

const CANON = JSON.stringify({ version: 1, days: [
  { date: '2026-09-20', status: 'open', note: 'ערב יום כיפור - פתוחים עד הצהריים' },
  { date: '2026-10-15', status: 'closed', note: 'ספירת מלאי' },
  { date: '2026-10-16', status: 'closed' },
] });

test('key name is the contract one', () => {
  assert.equal(B.NON_WORKING_DAYS_SETTING_KEY, 'non_working_days_extra');
});

test('missing / empty / broken value => empty config (defaults only), never throws', () => {
  for (const raw of [null, undefined, '', '   ', '{', 'null', '42', '"x"', '{"days":"no"}', '{}']) {
    const cfg = B.parseNonWorkingDaysSetting(raw);
    assert.equal(cfg.closed.size, 0, `closed for ${JSON.stringify(raw)}`);
    assert.equal(cfg.open.size, 0, `open for ${JSON.stringify(raw)}`);
    assert.equal(B.isNonWorkingDay('2026-11-03', cfg), false);
    assert.equal(B.isNonWorkingDay('2026-11-06', cfg), true, 'Friday still closed with empty config');
  }
  assert.equal(B.parseNonWorkingDaysSetting('{').invalid, 1);
  assert.equal(B.parseNonWorkingDaysSetting('').invalid, 0);
  assert.equal(B.parseNonWorkingDaysSetting(null).invalid, 0);
});

test('canonical shape parses; serialize(parse(x)) is canonical and sorted', () => {
  const cfg = B.parseNonWorkingDaysSetting(CANON);
  assert.deepEqual([...cfg.closed].sort(), ['2026-10-15', '2026-10-16']);
  assert.deepEqual([...cfg.open], ['2026-09-20']);
  assert.equal(cfg.notes.get('2026-10-15'), 'ספירת מלאי');
  assert.equal(cfg.notes.get('2026-09-20'), 'ערב יום כיפור - פתוחים עד הצהריים');
  assert.equal(cfg.invalid, 0);
  assert.equal(B.serializeNonWorkingDaysSetting(cfg), CANON);
  // unsorted input serializes sorted
  const shuffled = JSON.stringify({ version: 1, days: [{ date: '2026-10-16' }, { date: '2026-10-15', note: 'ספירת מלאי' }, { date: '2026-09-20', status: 'open', note: 'ערב יום כיפור - פתוחים עד הצהריים' }] });
  assert.equal(B.serializeNonWorkingDaysSetting(B.parseNonWorkingDaysSetting(shuffled)), CANON);
  // serialize accepts the raw string too
  assert.equal(B.serializeNonWorkingDaysSetting(CANON), CANON);
});

test('tolerant inputs: bare array of entries, array of strings (=closed), already-parsed objects/config', () => {
  const a = B.parseNonWorkingDaysSetting('[{"date":"2026-10-15"},{"date":"2026-10-16","status":"closed"}]');
  assert.deepEqual([...a.closed].sort(), ['2026-10-15', '2026-10-16']);
  const b = B.parseNonWorkingDaysSetting('["2026-10-15","2026-10-16"]');
  assert.deepEqual([...b.closed].sort(), ['2026-10-15', '2026-10-16']);
  const c = B.parseNonWorkingDaysSetting({ days: [{ date: '2026-10-15' }] });
  assert.deepEqual([...c.closed], ['2026-10-15']);
  const d = B.parseNonWorkingDaysSetting(c);
  assert.equal(d, c, 'a config object is returned as-is');
});

test('invalid entries are skipped and counted; valid ones still apply', () => {
  const raw = JSON.stringify({ days: [
    { date: '2026-10-15' },               // ok
    { date: '2026-02-30' },               // not a real date
    { date: '15/10/2026' },               // wrong format
    { date: '2026-10-17', status: 'maybe' }, // unknown status
    'not-a-date', 7, null, { note: 'x' },  // garbage
    { date: '2026-10-18', status: 'open', note: 'x'.repeat(500) }, // note truncated to 200
  ] });
  const cfg = B.parseNonWorkingDaysSetting(raw);
  assert.deepEqual([...cfg.closed], ['2026-10-15']);
  assert.deepEqual([...cfg.open], ['2026-10-18']);
  assert.equal(cfg.invalid, 7);
  assert.equal(cfg.notes.get('2026-10-18').length, 200);
});

test('duplicate dates: closed wins over open (either order); last note wins within a status', () => {
  const openThenClosed = B.parseNonWorkingDaysSetting('[{"date":"2026-11-03","status":"open"},{"date":"2026-11-03","status":"closed","note":"a"}]');
  assert.equal(B.isNonWorkingDay('2026-11-03', openThenClosed), true);
  assert.equal(openThenClosed.open.has('2026-11-03'), false);
  const closedThenOpen = B.parseNonWorkingDaysSetting('[{"date":"2026-11-03","status":"closed"},{"date":"2026-11-03","status":"open"}]');
  assert.equal(B.isNonWorkingDay('2026-11-03', closedThenOpen), true);
  assert.equal(closedThenOpen.open.has('2026-11-03'), false);
  const notes = B.parseNonWorkingDaysSetting('[{"date":"2026-11-03","note":"first"},{"date":"2026-11-03","note":"second"}]');
  assert.equal(notes.notes.get('2026-11-03'), 'second');
});

test('closed: a plain Tuesday becomes non-working; open: Friday / erev chag / Yom Kippur become working', () => {
  const cfg = B.parseNonWorkingDaysSetting('[{"date":"2026-11-03"},{"date":"2026-11-06","status":"open"},{"date":"2026-09-20","status":"open"},{"date":"2026-09-21","status":"open"}]');
  assert.equal(B.isNonWorkingDay('2026-11-03', cfg), true);
  assert.equal(B.isNonWorkingDay('2026-11-06', cfg), false, 'Friday opened');
  assert.equal(B.isNonWorkingDay('2026-11-07', cfg), true, 'Shabbat untouched');
  assert.equal(B.isNonWorkingDay('2026-09-20', cfg), false, 'erev YK opened');
  assert.equal(B.isNonWorkingDay('2026-09-21', cfg), false, 'YK opened (allowed, UI must warn)');
  assert.equal(B.isWorkingDay('2026-09-21', cfg), true);
  // without the config the same days are closed
  assert.equal(B.isNonWorkingDay('2026-11-03'), false);
  assert.equal(B.isNonWorkingDay('2026-09-20'), true);
});

test('opts.skipWeekend=false ignores Fri/Sat but still honours holidays and the owner list', () => {
  const cfg = B.parseNonWorkingDaysSetting('[{"date":"2026-11-03"}]');
  const o = { skipWeekend: false };
  assert.equal(B.isNonWorkingDay('2026-11-06', cfg, o), false, 'Friday counts');
  assert.equal(B.isNonWorkingDay('2026-11-07', cfg, o), false, 'Shabbat counts');
  assert.equal(B.isNonWorkingDay('2026-09-21', cfg, o), true, 'Yom Kippur still closed');
  assert.equal(B.isNonWorkingDay('2026-09-20', cfg, o), true, 'erev YK still closed');
  assert.equal(B.isNonWorkingDay('2026-11-03', cfg, o), true, 'owner day still closed');
  assert.equal(B.isNonWorkingDay('2026-09-21', cfg, { skipWeekend: false, skipHolidays: false }), false);
});

test('dayStatus: reasons in fixed order, note, titles', () => {
  const cfg = B.parseNonWorkingDaysSetting(CANON);
  assert.deepEqual(B.dayStatus('2026-10-15', cfg), { key: '2026-10-15', working: false, reasons: ['closed'], titles: [], note: 'ספירת מלאי' });
  assert.deepEqual(B.dayStatus('2026-10-16', cfg), { key: '2026-10-16', working: false, reasons: ['closed', 'friday'], titles: [], note: null });
  assert.deepEqual(B.dayStatus('2026-09-20', cfg), { key: '2026-09-20', working: true, reasons: ['open', 'erev_chag'], titles: ['ערב יום כפור'], note: 'ערב יום כיפור - פתוחים עד הצהריים' });
  assert.deepEqual(B.dayStatus('2026-09-21', cfg), { key: '2026-09-21', working: false, reasons: ['chag'], titles: ['יום כפור'], note: null });
  assert.deepEqual(B.dayStatus('2026-10-17', cfg), { key: '2026-10-17', working: false, reasons: ['shabbat'], titles: [], note: null });
  assert.deepEqual(B.dayStatus('2026-11-03', cfg), { key: '2026-11-03', working: true, reasons: [], titles: [], note: null });
  assert.equal(B.dayStatus('garbage', cfg), null);
});

test('listNonWorkingDays: a month at a glance', () => {
  const cfg = B.parseNonWorkingDaysSetting(CANON);
  const sept = B.listNonWorkingDays('2026-09-01', '2026-09-30', cfg);
  const keys = sept.map((d) => d.key);
  // Fridays/Shabbatot of Sep 2026: 4,5,11,12,18,19,25,26 + RH 12-13 + erev YK 20 (opened => excluded) + YK 21 + erev Sukkot 25 + Sukkot 26
  assert.deepEqual(keys, ['2026-09-04', '2026-09-05', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-18', '2026-09-19', '2026-09-21', '2026-09-25', '2026-09-26']);
  assert.deepEqual(sept.find((d) => d.key === '2026-09-13').reasons, ['chag']);
  assert.deepEqual(sept.find((d) => d.key === '2026-09-11').reasons, ['friday', 'erev_chag']);
  assert.deepEqual(B.listNonWorkingDays('2026-09-30', '2026-09-01', cfg), [], 'reversed range => empty');
  assert.deepEqual(B.listNonWorkingDays('x', '2026-09-01', cfg), []);
});
