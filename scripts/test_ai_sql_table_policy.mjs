// Tests for the AI SQL table allow-list (security-audit.md R4b, 2026-10-11). No DB, no Next, no LLM.
//   1. The model list in lib/ai/sqlTablePolicy.js equals prisma/schema.prisma (a new model must be classified on purpose); no column is named like a model.
//   2. Tier / context sets: who may read what.
//   3. checkSqlTables accepts the realistic SQL the prompts ask for and rejects every way of reaching a table outside the list.
//   4. Static manifest: chat, statistics and smart-search all call the guard next to assertReadOnlySelect; the tiers cannot be skipped.
// Run: node scripts/test_ai_sql_table_policy.mjs   (exit 1 on failure)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALL_TABLES, NEVER_TABLES, checkSqlTables, assertSqlTables, tablesForTier, aiTierForRole, tablesForSmartSearchContext,
  TIER_STANDARD, TIER_MANAGEMENT, TIER_PROGRAMMER,
} from '../lib/ai/sqlTablePolicy.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const std = tablesForTier(TIER_STANDARD);
const mgmt = tablesForTier(TIER_MANAGEMENT);
const prog = tablesForTier(TIER_PROGRAMMER);
const ok = (sql, allow, why) => assert.deepEqual(checkSqlTables(sql, allow), { ok: true }, `should be accepted${why ? ` (${why})` : ''}: ${sql}`);
const bad = (sql, allow, why) => assert.equal(checkSqlTables(sql, allow).ok, false, `should be rejected${why ? ` (${why})` : ''}: ${sql}`);

console.log('1. schema sync');
const schema = read('prisma/schema.prisma');
const models = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]);
t('ALL_TABLES equals the Prisma models', () => {
  assert.deepEqual([...ALL_TABLES].sort(), [...models].sort());
});
t('every table is in exactly one bucket (some tier, or NEVER)', () => {
  for (const tbl of ALL_TABLES) assert.ok(prog.has(tbl) || NEVER_TABLES.includes(tbl), `${tbl} is unclassified`);
  for (const tbl of NEVER_TABLES) assert.ok(!prog.has(tbl), `${tbl} must not be in any tier`);
});
t('no column is named EXACTLY like a model (quoted-identifier check would false-positive)', () => {
  const lower = new Set(models.map((m) => m.toLowerCase()));
  for (const block of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    for (const line of block[2].split('\n')) {
      const f = line.trim().match(/^(\w+)\s+(\w+)/);
      if (f && !models.includes(f[2]) && models.includes(f[1])) assert.fail(`${block[1]}.${f[1]} collides with a model name`);
    }
  }
});

console.log('2. tiers and contexts');
t('role -> tier', () => {
  assert.equal(aiTierForRole(2), TIER_PROGRAMMER);
  assert.equal(aiTierForRole(0), TIER_MANAGEMENT);
  assert.equal(aiTierForRole(1), TIER_STANDARD);
  assert.equal(aiTierForRole(5), TIER_STANDARD);
  assert.equal(aiTierForRole(null), TIER_STANDARD);
  assert.equal(aiTierForRole(undefined), TIER_STANDARD);
});
t('tiers are nested and secrets are in none', () => {
  for (const x of std) assert.ok(mgmt.has(x));
  for (const x of mgmt) assert.ok(prog.has(x));
  for (const x of ['SystemSetting', 'ApiKey', 'TrustedDevice', 'EmployeePermissionOverride', 'AIChatSession', 'QueryLog']) assert.ok(!prog.has(x), x);
  assert.ok(!std.has('EmailLog') && !std.has('AuditLog') && !std.has('Employee'));
  assert.ok(!mgmt.has('EmailLog') && mgmt.has('AuditLog') && mgmt.has('Employee'));
  assert.ok(prog.has('EmailLog'));
});
t('smart-search contexts: own tables only, money only when allowed', () => {
  const o = tablesForSmartSearchContext('orders');
  assert.ok(o.has('Order') && o.has('Customer') && o.has('OrderItem') && !o.has('Payment') && !o.has('Employee') && !o.has('EmailLog'));
  assert.ok(tablesForSmartSearchContext('orders', { financial: true }).has('Payment'));
  assert.ok(!tablesForSmartSearchContext('customers', { financial: true }).has('Payment'));
  assert.ok(tablesForSmartSearchContext('dresses').has('DressModel'));
  assert.ok(tablesForSmartSearchContext('rentals').has('Customer'));
  assert.deepEqual([...tablesForSmartSearchContext('nonsense')].sort(), [...tablesForSmartSearchContext('customers')].sort());
});

console.log('3. checkSqlTables - accepted');
const OK_ORDERS = tablesForSmartSearchContext('orders');
for (const [sql, allow, why] of [
  [`SELECT COUNT(*) as "כמות לקוחות" FROM "Customer" WHERE "isDeleted" = false;`, std],
  [`SELECT * FROM "Order" WHERE "customerId" IN (SELECT id FROM "Customer" WHERE ("firstName" ILIKE '%a%' OR "lastName" ILIKE '%a%')) LIMIT 50`, OK_ORDERS, 'smart-search sub-select'],
  [`SELECT o."orderId", c."firstName" FROM "Order" o JOIN "Customer" c ON c.id = o."customerId" WHERE o."eventDate" >= '2026-10-01'`, std, 'join'],
  [`WITH x AS (SELECT "orderId" FROM "OrderItem" WHERE "barcode" = '6323401') SELECT * FROM "Order" WHERE "orderId" IN (SELECT "orderId" FROM x)`, std, 'CTE'],
  [`SELECT * FROM "Customer" WHERE notes LIKE '%EmailLog%' AND city LIKE '%e'`, std, 'table name / lone letter inside a string literal'],
  [`SELECT * FROM "Customer" WHERE notes = 'it''s the "AuditLog"'`, std, 'escaped quote + double quotes inside a literal'],
  [`SELECT "refund" FROM "PriceRule" WHERE "refund" IS NOT NULL`, new Set(['PriceRule']), 'column named like a model (PriceRule.refund) is not the Refund table'],
  [`SELECT "firstName" FROM "Employee" WHERE "isActive" = true`, mgmt, 'management reads Employee'],
  [`SELECT "to", "subject" FROM "EmailLog" ORDER BY "sentAt" DESC LIMIT 5`, prog, 'programmer reads EmailLog'],
  [`SELECT EXTRACT(YEAR FROM "eventDate") AS y, COUNT(*) FROM "Order" GROUP BY y ORDER BY y`, std, 'ORDER keyword is not the Order table'],
  [`SELECT * FROM "DressItem" WHERE TRIM("sizeText") IN ('2', '02') AND "barcodePrefix" = 123`, std],
]) t(`accept: ${sql.slice(0, 70)}${why ? `  [${why}]` : ''}`, () => ok(sql, allow, why));

console.log('3b. checkSqlTables - rejected');
for (const [sql, allow, why] of [
  [`SELECT * FROM "EmailLog"`, std, 'direct, standard tier'],
  [`SELECT * FROM "EmailLog"`, mgmt, 'direct, management tier'],
  [`SELECT * FROM "AuditLog" LIMIT 5`, std],
  [`SELECT * FROM "Employee"`, std],
  [`SELECT * FROM "SystemSetting"`, prog, 'never, even for the programmer'],
  [`SELECT * FROM "ApiKey"`, prog],
  [`SELECT * FROM "EmployeePermissionOverride"`, prog],
  [`SELECT * FROM "AIChatSession"`, prog],
  [`SELECT * FROM "QueryLog"`, prog],
  [`SELECT * FROM "Customer" WHERE EXISTS (SELECT 1 FROM "EmailLog" WHERE body LIKE '%x%')`, std, 'yes/no oracle through EXISTS'],
  [`SELECT * FROM "Order" WHERE "customerId" IN (SELECT id FROM "Customer" WHERE phone1 IN (SELECT "to" FROM "EmailLog"))`, std, 'nested sub-select'],
  [`SELECT * FROM "Customer" WHERE (SELECT COUNT(*) FROM "AuditLog" WHERE "changesJson" LIKE '%a%') > 0`, std, 'scalar sub-select'],
  [`SELECT * FROM "Customer", "EmailLog"`, std, 'comma join'],
  [`SELECT * FROM "Customer" c JOIN "AuditLog" a ON true`, std, 'join'],
  [`WITH x AS (SELECT * FROM "EmailLog") SELECT * FROM x`, std, 'CTE body'],
  [`SELECT * FROM "Customer" UNION SELECT * FROM "SystemSetting"`, prog, 'union'],
  [`SELECT * FROM public."EmailLog"`, prog, 'schema-qualified'],
  [`SELECT * FROM "public"."Customer"`, std, 'schema-qualified quoted'],
  [`SELECT * FROM pg_catalog.pg_tables`, std, 'catalog'],
  [`SELECT tablename FROM pg_tables`, std],
  [`SELECT * FROM information_schema.columns`, std],
  [`SELECT pg_sleep(30)`, std, 'denial of service'],
  [`SELECT pg_read_file('/etc/passwd')`, prog],
  [`SELECT current_setting('server_version')`, std],
  [`SELECT * FROM "_prisma_migrations"`, prog],
  [`SELECT $$x$$ FROM "Customer"`, std, 'dollar quoting'],
  [`SELECT * FROM "Customer" WHERE notes = E'\\x45'`, std, 'E string'],
  [`SELECT * FROM "Customer" WHERE notes = U&'\\0041'`, std, 'U& string'],
  [`SELECT * FROM "Customer" WHERE notes = 'abc`, std, 'unterminated literal'],
  [`SELECT * FROM "Cust""omer"`, std, 'escaped quote in identifier'],
  [`SELECT * FROM "Customer" WHERE notes LIKE '%x%' AND "Employee" IS NULL`, std, 'a quoted model name used as a column is refused too'],
  [``, std, 'empty'],
]) t(`reject: ${sql.slice(0, 70)}${why ? `  [${why}]` : ''}`, () => bad(sql, allow, why));
t('assertSqlTables throws with rejectedSql + tablePolicy', () => {
  try { assertSqlTables('SELECT * FROM "EmailLog"', std); assert.fail('should throw'); } catch (e) {
    assert.equal(e.tablePolicy, true); assert.equal(e.rejectedSql, 'SELECT * FROM "EmailLog"'); assert.match(e.message, /EmailLog/);
  }
  assertSqlTables('SELECT 1 FROM "Customer"', std);
});

console.log('4. wiring');
const chat = read('app/api/ai/route.js');
const stats = read('app/api/ai/statistics/route.js');
const smart = read('app/api/ai/smart-search/route.js');
const common = read('lib/ai/aiCommon.js');
t('chat + statistics run the table guard right after assertReadOnlySelect, with the caller tier', () => {
  for (const [name, src] of [['chat', chat], ['statistics', stats]]) {
    assert.match(src, /assertSqlTables\([a-z]+, tablesForTier\(aiTierForRole\(aiRoleId\)\)\)/, `${name}: guard missing`);
    assert.match(src, /roleId: aiRoleId \} = await loadEmployeeAccess/, `${name}: role not read from loadEmployeeAccess`);
    const guards = (src.match(/assertSqlTables\(/g) || []).length;
    const reads = (src.match(/assertReadOnlySelect\(/g) || []).length;
    assert.equal(guards, reads, `${name}: every assertReadOnlySelect needs its table guard`);
  }
});
t('smart-search: every query goes through guardQuery (read-only + tables); no bare assertReadOnlySelect left but inside guardQuery', () => {
  assert.match(smart, /const guardQuery = \(q\) => \{ assertReadOnlySelect\(q\); assertSqlTables\(q, allowedTables\); \}/);
  assert.equal((smart.match(/assertReadOnlySelect\(/g) || []).length, 2, 'only the employees runQuery and guardQuery itself may call assertReadOnlySelect');
  assert.ok((smart.match(/guardQuery\(/g) || []).length >= 4, 'expected guardQuery on page-reuse, first, retry and count queries');
});
t('loadEmployeeAccess returns the role id', () => {
  assert.match(common, /return \{ isManager, employeeContext, employeeId: token\?\.value \|\| null, roleId \}/);
});

console.log(`\n${passed} checks passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
