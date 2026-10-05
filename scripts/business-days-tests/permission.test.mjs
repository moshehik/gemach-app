// feature:non_working_days_manage - the permission that gates marking/removing closed days (owner decision
// 2026-10-01, NWD-Q08: head management by default, manageable in /admin/permissions). The catalog is pure, so
// the default per role, the catalog shape and the pure helpers the settings route uses are tested here. The
// server-side gate itself (POST /api/settings: a batch that is ONLY non_working_days_extra may be saved by an
// employee holding this permission; anything else stays head-management only) is covered via the pure helpers
// isNonWorkingDaysOnlySettingsBatch / validateNonWorkingDaysSettingValue; hasPermission() resolution is the
// shared lib/permissions.js path that every other feature item already uses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { L } from './fixtures.mjs';

const B = await L('lib/businessDays.js');
const P = await L('lib/permissionsMetadata.js');

const KEY = 'feature:non_working_days_manage';

test('catalog item exists, is a boolean enforced feature, closed by default for every non-head role', () => {
  const item = P.getCatalogItem(KEY);
  assert.ok(item, 'catalog item missing');
  assert.equal(B.NON_WORKING_DAYS_PERMISSION_KEY, KEY, 'lib/businessDays.js and the catalog agree on the key');
  assert.equal(item.group, 'features');
  assert.equal(item.type, 'boolean');
  assert.equal(item.enforced, true);
  assert.equal(item.approver, undefined, 'not a password-approval item');
  assert.equal(item.notConfigurable, undefined, 'offered in the row wizard');
  assert.ok(item.label && item.description && item.userNote && item.note);
  assert.ok(/non_working_days_extra/.test(item.note) && /api\/settings/.test(item.note), 'developer note names the enforcement point');
  assert.ok(!/[a-zA-Z]/.test(item.userNote), 'userNote is plain Hebrew (no English/code terms)');
  for (const roleId of [0, 1, 2, 3, 4, 5, 90, null, undefined]) {
    assert.equal(P.defaultValueForRoleId(item, roleId), false, `default for roleId ${roleId} must be closed`);
  }
  assert.deepEqual(P.ALWAYS_ALLOWED_ROLE_IDS, [0, 2], 'head management (0) and programmer (2) are always allowed by lib/permissions.js');
  assert.equal(P.getCatalogGroup('features').some((i) => i.key === KEY), true);
  assert.equal(P.getApproverKeys().includes(KEY), false);
  // one entry only, unique key
  assert.equal(P.PERMISSION_CATALOG.filter((i) => i.key === KEY).length, 1);
  assert.equal(new Set(P.PERMISSION_CATALOG.map((i) => i.key)).size, P.PERMISSION_CATALOG.length, 'catalog keys are unique');
});

test('settings-route helpers: only a pure non_working_days_extra batch qualifies for the feature permission; the value is always validated', async () => {
  const ok = [{ key: B.NON_WORKING_DAYS_SETTING_KEY, name: 'whatever the client sent', value: B.serializeNonWorkingDaysSetting({ days: [{ date: '2026-11-03', note: 'ספירה' }] }) }];
  assert.equal(B.isNonWorkingDaysOnlySettingsBatch(ok), true);
  assert.equal(B.validateNonWorkingDaysSettingValue(ok[0].value), null);
  // the same batch with any other key cannot ride on this permission
  assert.equal(B.isNonWorkingDaysOnlySettingsBatch([...ok, { key: 'require_login', value: 'false' }]), false);
  assert.equal(B.isNonWorkingDaysOnlySettingsBatch([...ok, { key: 'NON_WORKING_DAYS_EXTRA', value: '' }]), false, 'case-sensitive key');
  assert.equal(B.isNonWorkingDaysOnlySettingsBatch([{ key: B.NON_WORKING_DAYS_SETTING_KEY, value: '' }]), true, 'clearing the list is a valid save');
  // a permitted employee still cannot store garbage or the retired "open" status
  assert.notEqual(B.validateNonWorkingDaysSettingValue('{"days":[{"date":"2026-11-06","status":"open"}]}'), null);
  assert.notEqual(B.validateNonWorkingDaysSettingValue('{"days":[{"date":"2026-13-01"}]}'), null);
  assert.notEqual(B.validateNonWorkingDaysSettingValue('<script>'), null);
  assert.notEqual(B.validateNonWorkingDaysSettingValue('{"days":[{"date":"2026-11-03","note":"' + 'x'.repeat(B.MAX_SETTING_VALUE_LENGTH) + '"}]}'), null, 'oversized value rejected before parsing');
  // the settings-page label used for the row name on this path
  const S = await L('lib/settingsMetadata.js');
  assert.equal(S.SETTINGS_HEBREW_NAMES[B.NON_WORKING_DAYS_SETTING_KEY], 'ימים ללא פעילות (רשימת הבעלים)');
  assert.match(S.SETTINGS_HEBREW_NOTES[B.NON_WORKING_DAYS_SETTING_KEY], /"version":2/);
  assert.ok(!/"open"/.test(S.SETTINGS_HEBREW_NOTES[B.NON_WORKING_DAYS_SETTING_KEY]), 'settings help text no longer advertises "open"');
});
