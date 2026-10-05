// node --test scripts/backup-tests/paging.test.mjs - backup paging helper (6.10.2026: DeliveryJoin has no "id" column).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { pickPagingKey, buildPageQuery, nextCursor } = require('../lib/backup-paging.js');
const sqlIdent = (n) => '"' + String(n).replace(/"/g, '""') + '"';
const fake = (rows) => ({ query: async () => ({ rows }) });

test('table with an id column pages by id (unchanged behaviour)', async () => {
  const key = await pickPagingKey(fake([]), 'Order', ['id', 'x'], sqlIdent);
  assert.deepEqual(key, { kind: 'keyset', column: 'id' });
  const q = buildPageQuery({ table: 'Order', colList: '"id","x"', key, cursor: 'abc', batchSize: 500, sqlIdent });
  assert.match(q.text, /WHERE "id" > \$2 ORDER BY "id" LIMIT \$1/);
  assert.deepEqual(q.params, [500, 'abc']);
});
test('table without id but a single-column primary key (DeliveryJoin) pages by that key', async () => {
  const key = await pickPagingKey(fake([{ name: 'orderId' }]), 'DeliveryJoin', ['orderId', 'joinedToOrderId'], sqlIdent);
  assert.deepEqual(key, { kind: 'keyset', column: 'orderId' });
  const q = buildPageQuery({ table: 'DeliveryJoin', colList: '"orderId"', key, cursor: null, batchSize: 500, sqlIdent });
  assert.match(q.text, /ORDER BY "orderId" LIMIT \$1/); assert.doesNotMatch(q.text, /"id"/);
  assert.equal(nextCursor(key, [{ orderId: 3 }, { orderId: 9 }], null), 9);
});
test('composite or missing primary key falls back to ctid offset paging', async () => {
  for (const pk of [[], [{ name: 'a' }, { name: 'b' }]]) {
    const key = await pickPagingKey(fake(pk), 'Link', ['a', 'b'], sqlIdent);
    assert.deepEqual(key, { kind: 'offset' });
    const q1 = buildPageQuery({ table: 'Link', colList: '"a","b"', key, cursor: null, batchSize: 2, sqlIdent });
    assert.match(q1.text, /ORDER BY ctid LIMIT \$1 OFFSET \$2/); assert.deepEqual(q1.params, [2, 0]);
    assert.equal(nextCursor(key, [{}, {}], null), 2); assert.equal(nextCursor(key, [{}], 2), 3);
  }
});
test('both backup scripts use the helper and never hard-code ORDER BY "id"', () => {
  for (const f of ['../cloud_backup.js', '../backup_prod_db.js']) {
    const s = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.match(s, /require\('\.\/lib\/backup-paging'\)/); assert.doesNotMatch(s, /ORDER BY \$\{sqlIdent\('id'\)\}/);
  }
});
