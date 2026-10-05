// Static sanity of the signature BACKFILL files (nothing here touches a DB): prisma/migrations-pending/2026-10-05-customer-signature-backfill.sql
// (one idempotent UPDATE), ...-backfill-dryrun.sql (read-only counts + anonymised sample) and scripts/customer-signature-backfill.js (the runner).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ROOT = process.env.PROJ;
const raw = (rel) => readFileSync(`${ROOT}/${rel}`);
const text = (rel) => raw(rel).toString('utf8').replace(/\r\n/g, '\n');
const stmts = (rel) => text(rel).split('\n').filter((l) => l.trim() && !l.trim().startsWith('--')).join('\n').split(';').map((s) => s.trim()).filter(Boolean);
const norm = (s) => s.replace(/\s+/g, ' ').trim();

const BACKFILL = 'prisma/migrations-pending/2026-10-05-customer-signature-backfill.sql';
const DRYRUN = 'prisma/migrations-pending/2026-10-05-customer-signature-backfill-dryrun.sql';

test('both SQL files are clean UTF-8 (no BOM, no control characters) with Hebrew comments', () => {
  for (const f of [BACKFILL, DRYRUN]) {
    const buf = raw(f);
    assert.notDeepEqual([...buf.subarray(0, 3)], [0xef, 0xbb, 0xbf], `${f}: BOM`);
    assert.ok(![...buf].some((b) => b < 0x20 && b !== 0x0a && b !== 0x09 && b !== 0x0d), `${f}: control characters`);
    new TextDecoder('utf-8', { fatal: true }).decode(buf);
    assert.match(text(f), /[א-ת]/);
  }
});

test('backfill: exactly ONE statement, an UPDATE of "Customer" that sets only the two signature columns', () => {
  const s = stmts(BACKFILL);
  assert.equal(s.length, 1);
  const sql = norm(s[0]);
  assert.match(sql, /^UPDATE "Customer" AS c SET /);
  const set = sql.slice(sql.indexOf(' SET ') + 5, sql.indexOf(' FROM '));
  assert.deepEqual(set.split(',').map((x) => x.trim().split(' = ')[0]).sort(), ['"hasSignedRegulations"', '"regulationsSignedAt"']);
  assert.match(set, /"hasSignedRegulations" = true/);
  assert.match(set, /"regulationsSignedAt" = s\."firstSignedAt"/);
});

test('backfill: never overwrites - only active, not-yet-signed, not-revoked customers (all four guards present in the WHERE)', () => {
  const sql = norm(stmts(BACKFILL)[0]);
  const where = sql.slice(sql.lastIndexOf(' WHERE c."id"'));
  for (const guard of ['c."id" = s."customerId"', 'c."isDeleted" = false', 'c."hasSignedRegulations" = false', 'c."regulationsSignedAt" IS NULL']) {
    assert.ok(where.includes(guard), `missing guard: ${guard}`);
  }
});

test('backfill: the source is the EARLIEST active signed order per customer (DISTINCT ON + ORDER BY ... ASC, orderId tiebreak), date = orderDate else updatedAt', () => {
  const sql = norm(stmts(BACKFILL)[0]);
  assert.match(sql, /SELECT DISTINCT ON \(o\."customerId"\)/);
  assert.match(sql, /COALESCE\(o\."orderDate", o\."updatedAt"\) AS "firstSignedAt"/);
  assert.match(sql, /WHERE o\."isDeleted" = false AND o\."hasSignedRegulations" = true AND o\."customerId" IS NOT NULL/);
  assert.match(sql, /ORDER BY o\."customerId", COALESCE\(o\."orderDate", o\."updatedAt"\) ASC, o\."orderId" ASC/);
});

test('backfill: touches nothing else (no DDL, no DELETE/INSERT, no Customer.updatedAt, no AuditLog, no DROP/TRUNCATE) in code or comments-as-code', () => {
  const sql = stmts(BACKFILL).join('\n');
  assert.ok(!/\b(DROP|TRUNCATE|DELETE|INSERT|ALTER|CREATE|GRANT|RENAME)\b/i.test(sql));
  assert.ok(!/"updatedAt" =/.test(sql.replace(/COALESCE\(o\."orderDate", o\."updatedAt"\)/g, '')), 'must not set Customer.updatedAt (no false 409s)');
  assert.ok(!/AuditLog/i.test(sql));
  assert.ok(!/\bRETURNING\b/i.test(sql));
});

test('backfill: idempotent by construction - a second run matches no rows (the WHERE requires hasSignedRegulations = false, the SET makes it true)', () => {
  const sql = norm(stmts(BACKFILL)[0]);
  assert.ok(sql.includes('c."hasSignedRegulations" = false'));
  assert.ok(sql.includes('"hasSignedRegulations" = true,'));
});

test('dry-run: read-only (every statement is SELECT/WITH), two statements: counts + sample', () => {
  const s = stmts(DRYRUN);
  assert.equal(s.length, 2);
  for (const x of s) assert.match(x, /^(SELECT|WITH)\b/);
  assert.ok(!/\b(UPDATE|INSERT|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT)\b/i.test(s.join('\n')));
});

test('dry-run: the same eligibility rules as the UPDATE (same source subquery, same four conditions) so would_change = rows the UPDATE will touch', () => {
  const upd = norm(stmts(BACKFILL)[0]);
  const ORDER_BY = 'ORDER BY o."customerId", COALESCE(o."orderDate", o."updatedAt") ASC, o."orderId" ASC';
  const srcOf = (sql) => sql.slice(sql.indexOf('SELECT DISTINCT ON'), sql.indexOf(ORDER_BY) + ORDER_BY.length);
  const [counts, sample] = stmts(DRYRUN).map(norm);
  const updSrc = srcOf(upd).replace(/ AS "customerId"/g, '').replace(/ AS "firstSignedAt"/g, '');
  for (const q of [counts, sample]) {
    const src = srcOf(q).replace(/o\."orderId" AS "orderId", /g, '').replace(/ AS "customerId"/g, '').replace(/ AS "firstSignedAt"/g, '');
    assert.equal(src, updSrc, 'source subquery drifted from the UPDATE');
  }
  assert.match(counts, /AS would_change/);
  const wc = counts.slice(counts.indexOf('FROM first_signed fs JOIN "Customer" c ON c."id" = fs."customerId" WHERE c."isDeleted" = false AND c."hasSignedRegulations" = false AND c."regulationsSignedAt" IS NULL) AS would_change'));
  assert.ok(wc.startsWith('FROM first_signed'), 'would_change uses exactly the UPDATE guards');
  assert.match(sample, /WHERE c\."isDeleted" = false AND c\."hasSignedRegulations" = false AND c\."regulationsSignedAt" IS NULL/);
});

test('dry-run: reports the other buckets the operator must understand (kept signed, revoked, deleted-customer, orphan signed orders)', () => {
  const counts = norm(stmts(DRYRUN)[0]);
  for (const col of ['active_customers', 'already_signed_stored', 'revoked_kept_as_is', 'customers_with_signed_order', 'would_change', 'signed_order_but_already_stored_kept', 'signed_order_but_revoked_kept', 'signed_order_deleted_customer_skipped', 'signed_orders_without_customer']) {
    assert.ok(counts.includes(`AS ${col}`), col);
  }
});

test('dry-run: the sample is anonymised - hashed customer id, order id and date only; no name / phone / email / raw id', () => {
  const sample = norm(stmts(DRYRUN)[1]);
  const select = sample.slice(0, sample.indexOf(' FROM '));
  assert.match(select, /left\(md5\(c\."id"\), 8\) AS anon_customer/);
  assert.ok(!/firstName|lastName|phone|email|zeout|notes|bank/i.test(select));
  assert.ok(!/\bc\."id" AS\b|\bSELECT c\."id"\b/.test(select), 'raw customer id is not selected');
  assert.match(sample, /LIMIT 10$/);
});

test('runner script: dry-run by default, writes only with --write, host-checked via connectStrict (no DATABASE_URL fallback), aborts (rollback) if the row count differs from the dry-run, no DDL / AuditLog', () => {
  const src = text('scripts/customer-signature-backfill.js');
  assert.match(src, /const write = rest\.includes\('--write'\)/);
  assert.match(src, /connectStrict\(org, write, /);
  const code = src.replace(/\/\/.*$/gm, '');
  assert.ok(!/process\.env\.DATABASE_URL|process\.env\[['"`]DATABASE_URL|fileVars\.DATABASE_URL|fileVars\[['"`]DATABASE_URL/.test(code), 'never reads a bare DATABASE_URL (no silent fallback)');
  assert.ok(!/resolveDbUrl|connectOrg|seed-bool-setting/.test(code), 'does not use the helpers that fall back to DATABASE_URL');
  assert.match(code, /PROD_DATABASE_URL_ORG2/);
  assert.match(code, /NO fallback to DATABASE_URL/);
  assert.match(src, /if \(!write\) \{ console\.log\('dry-run - pass --write to apply'\); return; \}/);
  assert.match(src, /prisma\.\$transaction\(/);
  assert.match(src, /if \(n !== expected\) throw/);
  assert.match(src, /cols\.length !== 2/);
  assert.ok(!/\b(DROP|ALTER|TRUNCATE)\b/.test(src.replace(/\/\/.*$/gm, '')));
  assert.ok(!/auditLog/i.test(src.replace(/\/\/.*$/gm, '')));
  assert.ok(src.indexOf("if (!write)") < src.indexOf('$executeRawUnsafe'), 'the write path is after the dry-run return');
});
