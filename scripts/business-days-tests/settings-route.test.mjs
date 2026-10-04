// Behavioural test of the REAL app/api/settings/route.js (in-memory prisma + lib/auth shims) for the non-working-days key:
//  1. past-days lock (owner Q05) is enforced on the SERVER: adding or removing a day (single or inside a range) before the
//     Israeli today is a 400 with a Hebrew message; recurring Hebrew dates, note-only edits and future days stay allowed.
//  2. the public GET strips the free-text notes of non_working_days_extra unless checkAuth() passes (days stay, so every
//     client reader of the days keeps working).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { L, addKey, installDb } from './fixtures.mjs';

const B = await L('lib/businessDays.js');
const H = await L('lib/hebrewDate.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const route = await L('app/api/settings/route.js');

const KEY = B.NON_WORKING_DAYS_SETTING_KEY;
const TODAY = H.getIsraelTodayKey();
const PAST = addKey(TODAY, -10);
const PAST2 = addKey(TODAY, -9);
const FUT = addKey(TODAY, 10);
const FUT2 = addKey(TODAY, 11);
const doc = (o) => JSON.stringify({ version: 2, days: [], ranges: [], recurringHebrew: [], ...o });

function setup(value) {
  installDb({ settings: value === null ? [] : [{ key: KEY, value, name: 'x', category: 'יומן' }] });
  globalThis.__AUTH = true;
  invalidateSettingsCache();
}
const post = async (value) => {
  const res = await route.POST(new Request('http://test.local/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ key: KEY, value, name: 'x' }]) }));
  return { status: res.status, body: await res.json() };
};
const stored = () => (globalThis.__SETTINGS.find((s) => s.key === KEY) || {}).value;

test('past-day lock: adding a past day is rejected (400, Hebrew), nothing is written', async () => {
  setup(doc({ days: [{ date: FUT }] }));
  const before = stored();
  const r = await post(doc({ days: [{ date: FUT }, { date: PAST }] }));
  assert.equal(r.status, 400);
  assert.match(r.body.error, /שכבר עברו/);
  assert.equal(stored(), before);
  assert.ok(!globalThis.__MOCK_CALLS.some((c) => c.op === 'upsert'), 'no write attempted');
});

test('past-day lock: removing a stored past day (single or inside a range) is rejected', async () => {
  setup(doc({ days: [{ date: PAST }, { date: FUT }] }));
  let r = await post(doc({ days: [{ date: FUT }] }));
  assert.equal(r.status, 400);
  setup(doc({ ranges: [{ from: PAST, to: FUT }] }));
  r = await post(doc({ ranges: [{ from: TODAY, to: FUT }] }));
  assert.equal(r.status, 400, 'shrinking a range that covered past days');
  r = await post('');
  assert.equal(r.status, 400, 'clearing the list drops the stored past days');
});

test('past-day lock: a range that adds a past day is rejected even when its other days are future', async () => {
  setup(doc({ days: [{ date: FUT }] }));
  const r = await post(doc({ ranges: [{ from: PAST, to: FUT2 }] }));
  assert.equal(r.status, 400);
});

test('past-day lock: allowed edits - keep past days, add/remove future days, notes, recurring Hebrew dates, range<->days reshaping', async () => {
  setup(doc({ days: [{ date: PAST, note: 'old' }, { date: PAST2 }], ranges: [] }));
  // keep past (as a range now - same days), change its note, add a future day and a recurring date
  let r = await post(doc({ ranges: [{ from: PAST, to: PAST2, note: 'new note' }], days: [{ date: FUT }], recurringHebrew: [{ month: 'Shvat', day: 26 }] }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(stored(), /new note/);
  // remove the future day and the recurring date again
  r = await post(doc({ ranges: [{ from: PAST, to: PAST2, note: 'new note' }] }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  // first write on an empty store, future only
  setup(null);
  r = await post(doc({ days: [{ date: FUT }] }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(B.parseNonWorkingDaysSetting(stored()).closed.has(FUT), true);
});

test('past-day lock helper: pure expansion of old/new, today itself is not past', () => {
  assert.deepEqual(B.pastClosedDayChanges(null, doc({ days: [{ date: TODAY }, { date: FUT }] }), TODAY), []);
  assert.deepEqual(B.pastClosedDayChanges(doc({ ranges: [{ from: PAST, to: PAST2 }] }), doc({ days: [{ date: PAST }, { date: PAST2 }] }), TODAY), [], 'same days, different shape');
  assert.deepEqual(B.pastClosedDayChanges(doc({ days: [{ date: PAST }] }), doc({ days: [{ date: PAST2 }] }), TODAY), [PAST, PAST2], 'moved: one removed + one added');
  assert.deepEqual(B.pastClosedDayChanges('', '', TODAY), []);
});

test('public GET strips notes of the non-working-days value unless checkAuth passes; days/ranges/recurring survive', async () => {
  const full = doc({ days: [{ date: FUT, note: 'סודי א' }], ranges: [{ from: FUT2, to: addKey(FUT2, 2), note: 'סודי ב' }], recurringHebrew: [{ month: 'Shvat', day: 26, note: 'סודי ג' }] });
  setup(full);
  globalThis.__SETTINGS.push({ key: 'other_note_key', value: '{"note":"keep me"}', name: 'o' });
  const get = async () => (await (await route.GET()).json()).reduce((m, s) => ({ ...m, [s.key]: s.value }), {});
  globalThis.__AUTH = false;
  const anon = await get();
  assert.ok(!/סודי/.test(anon[KEY]) && !/"note"/.test(anon[KEY]), 'notes stripped for an unauthenticated reader');
  assert.equal(anon.other_note_key, '{"note":"keep me"}', 'other settings are untouched');
  const a = B.parseNonWorkingDaysSetting(anon[KEY]);
  const f = B.parseNonWorkingDaysSetting(full);
  assert.deepEqual([...a.closed].sort(), [...f.closed].sort(), 'same closed days');
  assert.equal(a.recurringSig === '[]', false, 'recurring date survives');
  assert.equal(a.invalid, 0);
  for (const k of f.closed) assert.equal(B.isNonWorkingDay(k, a), true);
  globalThis.__AUTH = true;
  const authed = await get();
  assert.equal(authed[KEY], full, 'a logged-in reader still gets the full value');
});

test('stripNonWorkingDaysNotes: legacy shapes (array of objects/strings), empty, garbage', () => {
  assert.equal(B.stripNonWorkingDaysNotes(''), '');
  assert.equal(B.stripNonWorkingDaysNotes('not json {"note":"x"}'), '');
  assert.equal(B.stripNonWorkingDaysNotes('[{"date":"2026-11-03","note":"x"},"2026-11-04"]'), '[{"date":"2026-11-03"},"2026-11-04"]');
  assert.equal(B.stripNonWorkingDaysNotes('{"version":1,"days":[{"date":"2026-11-03","status":"closed","note":"x"}]}'), '{"version":1,"days":[{"date":"2026-11-03","status":"closed"}]}');
});
