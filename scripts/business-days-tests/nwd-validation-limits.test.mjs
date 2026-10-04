// Review fixes for the non-working-days setting (validation side): bounded closed runs, integer Hebrew day, memoised server config.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { L, addKey, weekday, eachKey, installDb } from './fixtures.mjs';

const B = await L('lib/businessDays.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const S = await L('lib/businessDaysServer.js');

const doc = (o) => JSON.stringify({ version: 2, days: [], ranges: [], recurringHebrew: [], ...o });

test('closed run cap: a >366-day run of owner ranges is rejected with a Hebrew message (it used to be accepted and break rollForward)', () => {
  const start = '2027-03-01';
  const long = doc({ ranges: [{ from: start, to: addKey(start, 365) }, { from: addKey(start, 366), to: addKey(start, 449) }] }); // 450 consecutive days
  const msg = B.validateNonWorkingDaysSettingValue(long);
  assert.ok(msg && /רצף הימים הסגורים ארוך מדי/.test(msg) && /366/.test(msg), msg);
});

test('closed run cap counts the automatic Fri/Sat/chag days between owner days (Sun-Thu marked for two years is one endless closure)', () => {
  const days = [];
  for (const k of eachKey('2027-03-01', '2029-03-01')) if (weekday(k) <= 4) days.push({ date: k });
  assert.ok(days.length <= B.MAX_SETTING_ENTRIES);
  assert.ok(B.validateNonWorkingDaysSettingValue(doc({ days })), 'rejected');
});

test('closed run cap: accepted configs keep rollForward/isNonWorkingDay consistent; many separate closures adding up to >400 days are fine', () => {
  const from = '2027-03-01';
  const ok = doc({ ranges: [{ from, to: addKey(from, 340) }] });
  assert.equal(B.validateNonWorkingDaysSettingValue(ok), null);
  const cfg = B.parseNonWorkingDaysSetting(ok);
  const rolled = B.rollForwardToWorkingDay(from, cfg);
  assert.equal(B.isNonWorkingDay(rolled, cfg), false, 'roll-forward result is open');
  assert.ok(rolled > addKey(from, 340));
  // past days accumulate for ever, so the cap is on the consecutive run only, not on the total
  const ranges = [];
  for (let i = 0; i < 14; i++) ranges.push({ from: addKey('2027-01-04', i * 40), to: addKey('2027-01-04', i * 40 + 29) }); // 14 x 30 days = 420, 10-day gaps
  assert.equal(B.validateNonWorkingDaysSettingValue(doc({ ranges })), null);
});

test('recurring Hebrew day must be an integer number (no true / "5" / [5] / 5.5)', () => {
  const v = (day) => B.validateNonWorkingDaysSettingValue(doc({ recurringHebrew: [{ month: 'Shvat', day }] }));
  assert.equal(v(26), null);
  for (const bad of [true, '26', [26], 26.5, null, {}]) assert.notEqual(v(bad), null, JSON.stringify(bad));
  assert.equal(B.parseNonWorkingDaysSetting(doc({ recurringHebrew: [{ month: 'Shvat', day: true }] })).recurringHebrew.length, 0);
});

test('getNonWorkingDaysConfig is memoised by the raw string (same object while unchanged, re-parsed when the value changes)', async () => {
  const one = doc({ days: [{ date: '2027-05-03' }] });
  installDb({ settings: [{ key: B.NON_WORKING_DAYS_SETTING_KEY, value: one }] });
  invalidateSettingsCache();
  const a = await S.getNonWorkingDaysConfig();
  const b = await S.getNonWorkingDaysConfig();
  assert.equal(a, b, 'same parsed object');
  assert.equal(a.closed.has('2027-05-03'), true);
  globalThis.__SETTINGS[0].value = doc({ days: [{ date: '2027-05-04' }] });
  invalidateSettingsCache();
  const c = await S.getNonWorkingDaysConfig();
  assert.notEqual(c, a);
  assert.equal(c.closed.has('2027-05-04'), true);
  assert.equal(c.closed.has('2027-05-03'), false);
  installDb({ settings: [] });
  invalidateSettingsCache();
  const d = await S.getNonWorkingDaysConfig();
  assert.equal(d.closed.size, 0);
});
