// בדיקת scripts/create_log_indexes.js: שער הזהות / ייצור (בלי DB), שמות האינדקסים זהים לברירת המחדל של Prisma ול-schema.prisma, ובדיקה מול TEST:
// dry-run לא יוצר, apply יוצר ובודק indisvalid, הרצה חוזרת מדלגת, ואינדקס לא תקין (indisvalid=false) נמחק ונוצר מחדש.
// החלק מול ה-DB רץ רק על TEST_DATABASE_URL ורק על טבלה זמנית משלו (zz_idx_test_<ts>) - לא נוגע באינדקסים האמיתיים.
// הרצה: node scripts/test_create_log_indexes.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'create_log_indexes.js');
const X = require('./create_log_indexes.js');
let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');

console.log('הצהרות');
await t('שמות האינדקסים = ברירת המחדל של Prisma (<Model>_<field>_idx) והם מוצהרים ב-schema.prisma', () => {
  const schema = read('prisma/schema.prisma');
  assert.deepEqual(X.INDEXES.map((i) => i.name), ['AuditLog_createdAt_idx', 'EmailLog_sentAt_idx']);
  for (const ix of X.INDEXES) {
    assert.equal(ix.name, `${ix.table}_${ix.column}_idx`);
    const block = schema.match(new RegExp(`model ${ix.table} \\{[\\s\\S]*?\\n\\}`))[0];
    assert.ok(block.includes(`@@index([${ix.column}])`), `${ix.table} חסר @@index([${ix.column}])`);
    assert.ok(!/@@index\(\[[^\]]*\],\s*(name|map):/.test(block), 'אסור name:/map: כדי שהשם יישאר ברירת המחדל');
  }
});
await t('קבצי ה-SQL הממתינים מזכירים את אותם שמות ואת הסקריפט', () => {
  const a = read('prisma/migrations-pending/2026-10-11-auditlog-createdat-index.sql');
  const b = read('prisma/migrations-pending/2026-10-11-admin-logs-index-recommendations.sql');
  assert.ok(a.includes('"AuditLog_createdAt_idx"') && a.includes('scripts/create_log_indexes.js'));
  assert.ok(b.includes('"EmailLog_sentAt_idx"') && b.includes('scripts/create_log_indexes.js'));
});
await t('הסקריפט משתמש ב-CREATE INDEX CONCURRENTLY IF NOT EXISTS, DROP INDEX CONCURRENTLY, ובודק indisvalid', () => {
  const s = read('scripts/create_log_indexes.js');
  assert.ok(/CREATE INDEX CONCURRENTLY IF NOT EXISTS/.test(s));
  assert.ok(/DROP INDEX CONCURRENTLY IF EXISTS/.test(s));
  assert.ok(/indisvalid/.test(s));
});

console.log('שורת פקודה ושערי הזהות');
await t('parseArgs', () => {
  assert.throws(() => X.parseArgs([]), /--confirm-host/);
  assert.throws(() => X.parseArgs(['--confirm-host', 'ep-aaaa-bbbb-1', '--apply', '--dry-run']), /mutually exclusive/);
  assert.throws(() => X.parseArgs(['--confirm-host', 'ep-aaaa-bbbb-1', '--zzz']), /Unknown flag/);
  assert.equal(!!X.parseArgs(['--confirm-host', 'ep-aaaa-bbbb-1']).apply, false);
});
await t('directUrl מסיר רק את -pooler של ה-endpoint', () => {
  assert.equal(X.directUrl('postgresql://u:p@ep-cool-sky-123456-pooler.c-2.us-east-1.aws.neon.tech/db?sslmode=require'), 'postgresql://u:p@ep-cool-sky-123456.c-2.us-east-1.aws.neon.tech/db?sslmode=require');
  assert.equal(X.directUrl('postgresql://u:p@ep-cool-sky-123456.c-2.us-east-1.aws.neon.tech/db'), 'postgresql://u:p@ep-cool-sky-123456.c-2.us-east-1.aws.neon.tech/db');
});
function cli(args, env) {
  const clean = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP };
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { env: { ...clean, ...env }, encoding: 'utf8', timeout: 20000 });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
const FAKE_URL = 'postgresql://u:secretpw@ep-fake-host-123456.eu-central-1.aws.neon.tech/neondb';
await t('confirm-host שגוי / חסר / קצר: נדחה לפני חיבור; host נכון בלי --i-know-this-is-prod: נדחה כייצור (גם dry-run); --not-prod על Neon נדחה', () => {
  assert.notEqual(cli([], { DATABASE_URL: FAKE_URL }).code, 0);
  const wrong = cli(['--confirm-host', 'ep-other-host-999999'], { DATABASE_URL: FAKE_URL });
  assert.equal(wrong.code, 2); assert.match(wrong.out, /REFUSING TO RUN/); assert.ok(!wrong.out.includes('secretpw'));
  assert.equal(cli(['--confirm-host', 'neon'], { DATABASE_URL: FAKE_URL }).code, 2);
  for (const extra of [[], ['--apply']]) {
    const r = cli(['--confirm-host', 'ep-fake-host-123456', ...extra], { DATABASE_URL: FAKE_URL });
    assert.equal(r.code, 2); assert.match(r.out, /PRODUCTION/);
  }
  assert.equal(cli(['--confirm-host', 'ep-fake-host-123456', '--not-prod'], { DATABASE_URL: FAKE_URL }).code, 2);
});

console.log('מול TEST (טבלה זמנית משלנו)');
require('./lib/db-env.js').loadEnvFiles();
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  console.log('  skip - TEST_DATABASE_URL לא מוגדר');
} else {
  const { Client } = require('pg');
  const client = new Client({ connectionString: testUrl.replace(/sslmode=require/i, 'sslmode=verify-full') });
  await client.connect();
  const db = { q: async (sql, params) => (await client.query(sql, params)).rows };
  const tbl = `zz_idx_test_${Date.now()}`;
  const IX = [{ name: `${tbl}_a_idx`, table: tbl, column: 'a' }];
  const logs = [];
  try {
    await db.q(`CREATE TABLE "${tbl}" (a int)`);
    await db.q(`INSERT INTO "${tbl}" VALUES (1), (1), (2)`);
    await t('dry-run: מדווח missing ולא יוצר', async () => {
      const r = await X.run(db, { apply: false }, (s) => logs.push(s), IX);
      assert.equal(r[0].before, 'missing');
      assert.equal(await X.indexState(db, IX[0].name), null);
    });
    await t('apply: יוצר, indisvalid=true, ומדפיס זמן', async () => {
      const r = await X.run(db, { apply: true }, (s) => logs.push(s), IX);
      assert.equal(r[0].after, 'valid');
      assert.ok(r[0].ms >= 0);
      assert.deepEqual(await X.indexState(db, IX[0].name), { valid: true, ready: true });
    });
    await t('הרצה חוזרת: מדלג על אינדקס תקין', async () => {
      const r = await X.run(db, { apply: true }, (s) => logs.push(s), IX);
      assert.match(r[0].action, /skip/);
    });
    await t('אינדקס לא תקין (בניית UNIQUE CONCURRENTLY שנכשלה על כפילות) נמחק ונוצר מחדש כאינדקס תקין', async () => {
      await db.q(`DROP INDEX CONCURRENTLY "${IX[0].name}"`);
      await assert.rejects(() => db.q(`CREATE UNIQUE INDEX CONCURRENTLY "${IX[0].name}" ON "${tbl}" (a)`), /could not create unique index|duplicate/i);
      const st = await X.indexState(db, IX[0].name);
      assert.ok(st && st.valid === false, 'הכנת אינדקס לא תקין נכשלה');
      const r = await X.run(db, { apply: true }, (s) => logs.push(s), IX);
      assert.match(r[0].action, /DROP INDEX CONCURRENTLY/);
      assert.equal(r[0].before, 'INVALID');
      assert.equal(r[0].after, 'valid');
      const def = await db.q(`SELECT indexdef FROM pg_indexes WHERE indexname = $1`, [IX[0].name]);
      assert.ok(!/UNIQUE/i.test(def[0].indexdef), 'האינדקס החדש לא אמור להיות UNIQUE');
    });
  } finally {
    await db.q(`DROP TABLE IF EXISTS "${tbl}"`);
    await client.end();
  }
}
console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
