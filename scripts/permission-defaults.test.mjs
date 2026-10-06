// node --test scripts/permission-defaults.test.mjs - catalog defaults that must not drift (6.10.2026: a default meant for debt_approval landed on page:refunds).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PERMISSION_CATALOG } from '../lib/permissionsMetadata.js';
const item = (k) => PERMISSION_CATALOG.find((x) => x.key === k);
test('page:refunds is closed by default for branch managers and employees, open for head management/programmer', () => {
  const d = item('page:refunds').defaultForRoleId;
  assert.equal(d(1), false); assert.equal(d(3), false); assert.equal(d(undefined), false);
});
test('feature:debt_approval defaults to manager level and above (owner 5.10.2026, answer 3), same as payment_exit_approval', () => {
  const d = item('feature:debt_approval').defaultForRoleId;
  assert.equal(d(1), true); assert.equal(d(0), true); assert.equal(d(2), true); assert.equal(d(3), false);
  const e = item('feature:payment_exit_approval').defaultForRoleId;
  for (const r of [0, 1, 2, 3]) assert.equal(d(r), e(r));
});
