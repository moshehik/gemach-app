// seed_order_docs_delivery_settings.js: Neve-only, never overwrites an existing value except delivery_as_item_row with --force-delivery-item-row.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const req = createRequire(path.join(process.env.PROJ, 'package.json'));
const S = req('./scripts/seed_order_docs_delivery_settings.js');
const def = (key) => S.DEFS.find((d) => d.key === key);

test('target values: item row ON for Neve, Neve pickup address, notice defaults', () => {
  assert.equal(def('delivery_as_item_row').value, 'true');
  assert.equal(def('gmach_pickup_address').value, 'צוקרמן 1, נווה יעקב');
  assert.equal(def('gmach_pickup_maps_url').value, '');
  assert.equal(def('delivery_return_hours').value, '10:00–13:00');
});

test('missing row => create with the target value', () => {
  for (const d of S.DEFS) assert.deepEqual(S.planSetting(d, undefined, []), { action: 'create', value: d.value });
});

test('existing value is kept (incl. item row = false) without the force flag', () => {
  assert.equal(S.planSetting(def('delivery_as_item_row'), 'false', []).action, 'keep');
  assert.equal(S.planSetting(def('delivery_as_item_row'), 'false', ['--write']).action, 'keep');
  assert.equal(S.planSetting(def('gmach_pickup_address'), 'משהו אחר', []).action, 'keep');
});

test('--force-delivery-item-row updates ONLY delivery_as_item_row, and only when it differs', () => {
  const flags = ['--force-delivery-item-row'];
  assert.deepEqual(S.planSetting(def('delivery_as_item_row'), 'false', flags), { action: 'update', value: 'true' });
  assert.equal(S.planSetting(def('delivery_as_item_row'), 'true', flags).action, 'keep');
  for (const d of S.DEFS.filter((x) => x.key !== 'delivery_as_item_row')) assert.equal(S.planSetting(d, 'x', flags).action, 'keep', d.key);
});

test('script refuses the main gemach (org 1) before touching any DB', () => {
  const r = spawnSync(process.execPath, [path.join(process.env.PROJ, 'scripts/seed_order_docs_delivery_settings.js'), '--org=1'], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /נווה יעקב בלבד/);
});

test('every seeded key is known to the settings metadata (names/notes/category)', async () => {
  const src = (await import('node:fs')).readFileSync(path.join(process.env.PROJ, 'lib/settingsMetadata.js'), 'utf8');
  for (const d of S.DEFS) assert.ok(src.includes(`${d.key}:`), `${d.key} missing in settingsMetadata.js`);
});
