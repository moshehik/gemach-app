// getScheduleRangeSummary (הלוח החודשי, /api/board/stages): לכל יום בטווח - אותם מונים בדיוק כמו getScheduleDay של אותו יום
// (total + alerts לכל שלב פעיל), בלי שורות; ולידציית טווח (תקין / הפוך / ארוך מ-31 יום); בלי "מי במשמרת".
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { installDb, NOW, SETTINGS_ORG2 } from './fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const { getScheduleDay } = await L('lib/schedule/index.js');
const { getScheduleRangeSummary, rangeKeys, summarizeDay, MAX_RANGE_DAYS } = await L('lib/schedule/range.js');
const { resolveScheduleSettings } = await L('lib/schedule/settings.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');

const settingsMap = (rows) => Object.fromEntries(rows.map((r) => [r.key, r.value]));
const settings = () => resolveScheduleSettings(settingsMap(SETTINGS_ORG2));
beforeEach(() => { installDb(); invalidateSettingsCache(); });

test('every day of the range = the daily schedule counts (total + alerts per enabled stage)', async () => {
  const res = await getScheduleRangeSummary({ from: '2026-09-27', to: '2026-10-06', settings: settings(), now: NOW });
  assert.equal(Object.keys(res.days).length, 10);
  assert.equal(res.today, '2026-10-01');
  assert.deepEqual(res.stages.map((s) => s.key), ['order', 'repair', 'prep', 'dout', 'pick', 'event', 'manret', 'dback']);
  let any = 0;
  for (const key of Object.keys(res.days)) {
    const day = await getScheduleDay({ date: key, user: null, settings: settings(), now: NOW });
    const exp = {};
    let alerts = 0;
    for (const st of day.stages) {
      if (!st.enabled) continue;
      alerts += st.counts.alerts;
      if (st.counts.total > 0) exp[st.key] = { t: st.counts.total, a: st.counts.alerts };
    }
    assert.deepEqual(res.days[key].s, exp, key);
    assert.equal(res.days[key].alerts, alerts, key + ' alerts');
    assert.equal(res.days[key].nonWorkingDay, !!day.nonWorkingDay, key + ' nonWorkingDay');
    any += Object.keys(exp).length;
  }
  assert.ok(any > 0, 'the fixtures produce stage rows in the range');
});

test('numbers only - no rows, names or phones leave the summary', async () => {
  const res = await getScheduleRangeSummary({ from: '2026-10-01', to: '2026-10-01', settings: settings(), now: NOW });
  const json = JSON.stringify(res);
  assert.ok(!/שרה|כהן|050-|items|customer/.test(json), json.slice(0, 200));
});

test('the loader is called once per day, without staff and without a user', async () => {
  const seen = [];
  const dayLoader = async (args) => { seen.push(args); return { stages: [], nonWorkingDay: false }; };
  await getScheduleRangeSummary({ from: '2026-10-01', to: '2026-10-05', settings: settings(), now: NOW, dayLoader });
  assert.deepEqual(seen.map((a) => a.date).sort(), ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']);
  assert.ok(seen.every((a) => a.skipStaff === true && a.user === null));
});

test('range validation: invalid / reversed / longer than MAX_RANGE_DAYS -> 400', () => {
  assert.equal(rangeKeys('2026-10-01', '2026-10-01').length, 1);
  assert.equal(rangeKeys('2026-09-12', '2026-10-11').length, 30);
  for (const [f, t] of [['x', '2026-10-01'], ['2026-10-05', '2026-10-01'], ['2026-09-01', '2026-10-15']]) {
    assert.throws(() => rangeKeys(f, t), (e) => e.status === 400, f + '..' + t);
  }
  assert.equal(MAX_RANGE_DAYS, 31);
  assert.deepEqual(summarizeDay({ stages: [{ key: 'prep', enabled: true, counts: { total: 2, alerts: 1 } }, { key: 'dout', enabled: false, counts: { total: 3, alerts: 3 } }, { key: 'pick', enabled: true, counts: { total: 0, alerts: 0 } }], nonWorkingDay: true }),
    { s: { prep: { t: 2, a: 1 } }, alerts: 1, nonWorkingDay: true });
});

test('skipStaff=false (the daily page) still loads who is on shift; skipStaff=true returns staff []', async () => {
  const withStaff = await getScheduleDay({ date: '2026-10-01', user: null, settings: settings(), now: NOW });
  const without = await getScheduleDay({ date: '2026-10-01', user: null, settings: settings(), now: NOW, skipStaff: true });
  assert.deepEqual(without.staff, []);
  assert.deepEqual(without.stages.map((s) => s.counts), withStaff.stages.map((s) => s.counts));
});
