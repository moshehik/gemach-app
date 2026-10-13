// "הגדרות תהליכים" של הלו"ז (lib/schedule/stageSettings.js): תצוגת העריכה והמרת הקלט ל-writes. בלי DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const { buildStageSettingsView, buildStageWrites, HORIZON_KEY } = await L('lib/schedule/stageSettings.js');
const { resolveScheduleSettings } = await L('lib/schedule/settings.js');
const by = (v, k) => v.stages.find((s) => s.key === k);



test('בלי שורות: ברירות המחדל של הקוד (הכנה 3 לפני, איסוף 2 לפני, החזרה 1 אחרי, תיקונים 0) וטווח 14', () => {
  const v = buildStageSettingsView({});
  assert.deepEqual([by(v, 'prep').days, by(v, 'pick').days, by(v, 'manret').days, by(v, 'repair').days], [3, 2, 1, 0]);
  assert.equal(v.horizonDays, 14);
  assert.deepEqual([by(v, 'prep').direction, by(v, 'manret').direction, by(v, 'dout').direction], ['before', 'after', null]);
  assert.equal(by(v, 'order').fixed, true); assert.equal(by(v, 'event').fixed, true); assert.equal(by(v, 'prep').fixed, false);
  assert.equal(by(v, 'order').daysConfigurable, false); assert.equal(by(v, 'dout').daysConfigurable, false);
});
test('התצוגה והקורא (resolveScheduleSettings) מסכימים על אותן שורות', () => {
  const map = { schedule_stage_prep_days: '5', schedule_stage_pick_enabled: 'false', schedule_stage_manret_shift: 'am', branch_transfer_horizon_days: '30' };
  const v = buildStageSettingsView(map);
  const r = resolveScheduleSettings(map);
  assert.equal(by(v, 'prep').days, 5); assert.equal(r.stages.prep.offset, -5);
  assert.equal(by(v, 'pick').enabled, false); assert.equal(r.stages.pick.enabled, false);
  assert.equal(by(v, 'manret').shift, 'am'); assert.equal(r.stages.manret.shift, 'am');
  assert.equal(v.horizonDays, 30);
});
test('כתיבה: רק מה ששונה; הכנה 5 ימים נכתב, איסוף שלא השתנה לא', () => {
  const r = buildStageWrites({ stages: { prep: { days: 5, enabled: true }, pick: { days: 2 } } }, {});
  assert.deepEqual(r.writes, { schedule_stage_prep_days: '5' });
});
test('כתיבה: כיבוי, משמרת, טווח התראה', () => {
  const r = buildStageWrites({ stages: { pick: { enabled: false }, manret: { shift: 'pm' } }, horizonDays: 21 }, {});
  assert.deepEqual(r.writes, { schedule_stage_pick_enabled: 'false', schedule_stage_manret_shift: 'pm', [HORIZON_KEY]: '21' });
});
test('שורה שכבר קיימת נכתבת גם כשחזרה לברירת המחדל (איפוס)', () => {
  const r = buildStageWrites({ stages: { prep: { days: 3 } } }, { schedule_stage_prep_days: '5' });
  assert.deepEqual(r.writes, { schedule_stage_prep_days: '3' });
});
test('A2 + שלבים קבועים: אין ימים לשלב 1, אין כיבוי / משמרת לשלבי מידע, אין ימים למשלוחים', () => {
  const r = buildStageWrites({ stages: { order: { days: 4, enabled: false, shift: 'am' }, event: { enabled: false }, dout: { days: 9 } } }, {});
  assert.deepEqual(r.writes, {});
});
test('ולידציה: ימים מחוץ לטווח, משמרת שגויה, שלב לא מוכר, טווח התראה', () => {
  assert.equal(buildStageWrites({ stages: { prep: { days: 61 } } }).ok, false);
  assert.equal(buildStageWrites({ stages: { prep: { days: -1 } } }).ok, false);
  assert.equal(buildStageWrites({ stages: { prep: { shift: 'night' } } }).ok, false);
  assert.equal(buildStageWrites({ stages: { zzz: { days: 1 } } }).ok, false);
  assert.equal(buildStageWrites({ horizonDays: 0 }).ok, false);
  assert.equal(buildStageWrites({ horizonDays: 61 }).ok, false);
  assert.equal(buildStageWrites({ horizonDays: 60 }).ok, true);
});
