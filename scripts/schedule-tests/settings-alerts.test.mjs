// הגדרות (ברירות מחדל שאינן משנות התנהגות) והתראות שורה.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const S = await L('lib/schedule/settings.js');
const A = await L('lib/schedule/alerts.js');
const { STAGE_BY_KEY, STAGES } = await L('lib/schedule/stages.js');

test('stage catalog: 8 stages, no stage 3 (transfer), 1 and 7 info-only', () => {
  assert.deepEqual(STAGES.map((s) => s.number), [1, 2, 4, 5, 6, 7, 8, 9]);
  assert.equal(STAGE_BY_KEY.order.infoOnly, true);
  assert.equal(STAGE_BY_KEY.event.infoOnly, true);
  assert.equal(STAGE_BY_KEY.dout.showModel, false);
  assert.equal(STAGE_BY_KEY.manret.showModel, false);
  assert.equal(STAGE_BY_KEY.prep.doneSource, null);
  assert.equal(STAGE_BY_KEY.repair.doneSource, 'alterationDone');
});

test('resolveScheduleSettings: empty map keeps today\'s behaviour', () => {
  const r = S.resolveScheduleSettings({});
  assert.equal(r.deliveriesEnabled, false);
  assert.equal(r.alterationsEnabled, true);
  assert.equal(r.branchesEnabled, false);
  assert.equal(r.lateReturnThresholdDays, 7);
  assert.equal(r.pickupHours, '20:00-21:30');
  assert.equal(r.maxScanRows, 3000);
  assert.equal(r.stages.dout.enabled, false, 'deliveries stages follow enable_deliveries');
  assert.equal(r.stages.dback.enabled, false);
  assert.equal(r.stages.repair.enabled, true);
  assert.equal(r.stages.repair.offset, 0);
  assert.equal(r.stages.prep.offset, -3);
  assert.equal(r.stages.pick.offset, -2);
  assert.equal(r.stages.manret.offset, 1);
  for (const s of STAGES) assert.equal(r.stages[s.key].shift, 'none');
  // the owner's list: missing row = empty config (defaults only), never throws
  assert.equal(r.nonWorkingDays.closed.size, 0);
  assert.equal(r.nonWorkingDays.invalid, 0);
});

test('one calendar for every stage (owner decisions B4 + 3): no per-stage chag switch, schedule_skip_chag_all_stages is not a setting any more', () => {
  const r = S.resolveScheduleSettings({ schedule_skip_chag_all_stages: 'false' });
  assert.equal('skipChagAllStages' in r, false);
  for (const s of STAGES) {
    assert.equal('skipChag' in r.stages[s.key], false, s.key);
    assert.equal('skipChagDefault' in STAGE_BY_KEY[s.key], false, s.key);
  }
});

test('non_working_days_extra is read from the same settings map into a NonWorkingConfig (broken JSON = defaults + invalid counter)', () => {
  const r = S.resolveScheduleSettings({ non_working_days_extra: JSON.stringify({ version: 1, days: [{ date: '2026-10-07', note: 'ספירת מלאי' }, { date: 'nope' }] }) });
  assert.equal(r.nonWorkingDays.closed.has('2026-10-07'), true);
  assert.equal(r.nonWorkingDays.notes.get('2026-10-07'), 'ספירת מלאי');
  assert.equal(r.nonWorkingDays.invalid, 1);
  const broken = S.resolveScheduleSettings({ non_working_days_extra: '{not json' });
  assert.equal(broken.nonWorkingDays.closed.size, 0);
  assert.equal(broken.nonWorkingDays.invalid, 1);
  assert.equal(S.resolveScheduleSettings({ non_working_days_extra: '' }).nonWorkingDays.closed.size, 0);
});

test('branches: branch_list is parsed only when branches_enabled (sent with /api/schedule for the filter)', () => {
  assert.deepEqual(S.resolveScheduleSettings({ branches_enabled: 'true', branch_list: ' נווה יעקב ,גב״ש,,' }).branches, ['נווה יעקב', 'גב״ש']);
  assert.deepEqual(S.resolveScheduleSettings({ branches_enabled: 'true' }).branches, []);
  assert.deepEqual(S.resolveScheduleSettings({ branch_list: 'א,ב' }).branches, [], 'branches off => no list');
});

test('A2: stage 1 has no "days from event" - schedule_stage_order_days is ignored, no offset', () => {
  assert.equal(STAGE_BY_KEY.order.offsetConfigurable, false);
  assert.equal(STAGE_BY_KEY.order.defaultOffset, null);
  assert.equal(STAGE_BY_KEY.order.dateSource, 'orderDate');
  const r = S.resolveScheduleSettings({ schedule_stage_order_days: '3' });
  assert.equal(r.stages.order.offset, null);
});

test('A1: nothing in the stage catalog refers to stage 3 / transfer', () => {
  assert.ok(!STAGES.some((s) => s.number === 3));
  assert.ok(!STAGES.some((s) => /transfer|העברה/.test(JSON.stringify(s))));
});

test('resolveScheduleSettings: existing org keys + new schedule_* keys', () => {
  const r = S.resolveScheduleSettings({
    enable_deliveries: 'true', enable_alterations: 'false', branches_enabled: 'true',
    late_return_threshold_days: '3', standard_pickup_hours: '18:00-19:00',
    schedule_stage_prep_days: '5', schedule_stage_pick_days: '-4', schedule_stage_manret_days: '2',
    schedule_stage_event_enabled: 'false', schedule_stage_prep_shift: 'am', schedule_stage_pick_shift: 'bogus',
    schedule_skip_chag_all_stages: 'true', schedule_max_scan_rows: '50',
  });
  assert.equal(r.stages.dout.enabled, true);
  assert.equal(r.stages.repair.enabled, false, 'alterations off => repair stage off');
  assert.equal(r.stages.prep.offset, -5);
  assert.equal(r.stages.pick.offset, -4, 'a negative value is read as its absolute size, direction is fixed per stage');
  assert.equal(S.resolveScheduleSettings({ schedule_stage_pick_days: '0' }).stages.pick.offset, 0);
  assert.equal(S.resolveScheduleSettings({ schedule_stage_pick_days: '-0' }).stages.pick.offset, 0);
  assert.equal(S.resolveScheduleSettings({ schedule_stage_prep_days: '999' }).stages.prep.offset, -60);
  assert.equal(S.resolveScheduleSettings({ schedule_stage_prep_days: 'x' }).stages.prep.offset, -3);
  assert.equal(r.stages.manret.offset, 2);
  assert.equal(r.stages.event.enabled, false);
  assert.equal(r.stages.prep.shift, 'am');
  assert.equal(r.stages.pick.shift, 'none');
  assert.equal('skipChag' in r.stages.manret, false, 'schedule_skip_chag_all_stages above is ignored - one unified calendar (see the dedicated test)');
  assert.equal(r.lateReturnThresholdDays, 3);
  assert.equal(r.pickupHours, '18:00-19:00');
  assert.equal(r.maxScanRows, 100, 'clamped to the minimum');
  assert.equal(S.resolveScheduleSettings({ late_return_threshold_days: '500' }).lateReturnThresholdDays, 90);
  assert.equal(S.resolveScheduleSettings({ late_return_threshold_days: 'abc' }).lateReturnThresholdDays, 7);
});

test('loadScheduleSettings reads rows through the injected loader', async () => {
  const r = await S.loadScheduleSettings(async () => [{ key: 'enable_deliveries', value: 'true' }, { key: 'schedule_stage_prep_days', value: '1' }]);
  assert.equal(r.stages.dout.enabled, true);
  assert.equal(r.stages.prep.offset, -1);
  const fallback = await S.loadScheduleSettings(async () => { throw new Error('db down'); });
  assert.equal(fallback.stages.prep.offset, -3);
});

const ctx = { dayKey: '2026-09-24', todayKey: '2026-10-01', lateReturnThresholdDays: 7 };

test('alerts: info-only stages never alert', () => {
  assert.deepEqual(A.alertsForRow({ done: false }, STAGE_BY_KEY.order, ctx), []);
  assert.deepEqual(A.alertsForRow({ done: false }, STAGE_BY_KEY.event, ctx), []);
});

test('alerts: manual return is late only from late_return_threshold_days', () => {
  const late = A.alertsForRow({ done: false }, STAGE_BY_KEY.manret, ctx);
  assert.equal(late.length, 1);
  assert.equal(late[0].code, 'late_not_done');
  assert.equal(late[0].label, 'באיחור - לא סומן כבוצע');
  assert.equal(late[0].daysLate, 7);
  assert.deepEqual(A.alertsForRow({ done: false }, STAGE_BY_KEY.manret, { ...ctx, dayKey: '2026-09-25' }), [], '6 days = not yet late');
  assert.deepEqual(A.alertsForRow({ done: true }, STAGE_BY_KEY.manret, ctx), []);
  assert.equal(A.alertsForRow({ done: false }, STAGE_BY_KEY.manret, { ...ctx, lateReturnThresholdDays: 3 }).length, 1);
});

test('alerts: stages with a done field are late once the day has passed; stages without one never are', () => {
  assert.equal(A.alertsForRow({ done: false }, STAGE_BY_KEY.pick, ctx).length, 1);
  assert.equal(A.alertsForRow({ done: false }, STAGE_BY_KEY.repair, ctx).length, 1);
  assert.deepEqual(A.alertsForRow({ done: false }, STAGE_BY_KEY.pick, { ...ctx, dayKey: '2026-10-01' }), [], 'today is not late');
  assert.deepEqual(A.alertsForRow({ done: false }, STAGE_BY_KEY.pick, { ...ctx, dayKey: '2026-10-05' }), [], 'future is not late');
  assert.deepEqual(A.alertsForRow({ done: null }, STAGE_BY_KEY.prep, ctx), [], 'no done source => unknown, no alert');
});

test('alerts: missing delivery address (street or city empty)', () => {
  const row = (address) => ({ done: null, address });
  assert.equal(A.alertsForRow(row({ street: '', city: 'ירושלים' }), STAGE_BY_KEY.dout, ctx)[0]?.code, 'missing_delivery_address');
  assert.equal(A.alertsForRow(row({ street: 'הרצל 5', city: '' }), STAGE_BY_KEY.dback, ctx)[0]?.code, 'missing_delivery_address');
  assert.deepEqual(A.alertsForRow(row({ street: 'הרצל 5', city: 'ירושלים' }), STAGE_BY_KEY.dout, ctx), []);
  assert.deepEqual(A.alertsForRow(row({ street: '', city: '' }), STAGE_BY_KEY.manret, ctx), [], 'manual return has no address alert');
});
