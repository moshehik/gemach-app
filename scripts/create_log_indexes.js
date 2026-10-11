#!/usr/bin/env node
/**
 * יוצר את שני האינדקסים שהומלצו בביקורת האבטחה / ביצועים של 11.10.2026 (security-audit.md סעיף 10; מחליף את ההרצה הידנית של
 * prisma/migrations-pending/2026-10-11-auditlog-createdat-index.sql ו-2026-10-11-admin-logs-index-recommendations.sql):
 *
 *   "AuditLog_createdAt_idx"  ON "AuditLog" ("createdAt")   - רשימת "היסטוריית נתונים" ממיינת לפי createdAt (החדש ראשון)
 *   "EmailLog_sentAt_idx"     ON "EmailLog" ("sentAt")      - יומן המיילים ממיין לפי sentAt (החדש ראשון)
 *
 * השמות הם ברירת המחדל של Prisma ל-@@index([createdAt]) / @@index([sentAt]) (ראו prisma/schema.prisma), ולכן prisma db push לא ינסה ליצור / למחוק אותם.
 * CREATE INDEX CONCURRENTLY IF NOT EXISTS: לא נועל כתיבות, רץ מחוץ לטרנזקציה. אם נשאר אינדקס לא תקין (indisvalid=false) מריצה קודמת שנקטעה - הוא נמחק
 * (DROP INDEX CONCURRENTLY) ונוצר מחדש. אחרי היצירה נבדק indisvalid ומודפס. אין שום שינוי בנתונים.
 *
 * שימוש (ברירת מחדל = DRY RUN: רק קורא את מצב האינדקסים ומדפיס מה היה קורה):
 *   node scripts/create_log_indexes.js --confirm-host <host מלא | ep-xxxx> [--i-know-this-is-prod | --not-prod] [--explain] [--direct] [--apply]
 *
 *   --confirm-host  חובה; אותו שער זהות כמו scripts/set-ui-variant.js (host מלא או ep-xxxx, >= 8 תווים, התאמה מדויקת).
 *   --i-know-this-is-prod  נדרש לכל DB שאינו TEST_DATABASE_URL (סגור-בכישלון), גם ב-dry-run. --not-prod: רק host מקומי.
 *   --apply         יוצר בפועל. בלעדיו - dry-run.
 *   --explain       מדפיס EXPLAIN (ANALYZE) של רשימת ברירת המחדל (AuditLog לפי createdAt, EmailLog לפי sentAt, 50 שורות) - לפני ואחרי. קריאה בלבד.
 *   --direct        מתחבר ל-endpoint הישיר (בלי "-pooler") לאותו Neon endpoint. מומלץ ל-DDL ארוך על טבלה גדולה: pgbouncer במצב transaction לא מבטיח session.
 *
 * הסקריפט מדפיס host / database / gmach_name / מספר שורות משוער לפני כל פעולה.
 */

'use strict';

const path = require('path');
const { checkHost, collectKnownDbs, describeDbTarget } = require('./set-ui-variant.js');

const INDEXES = [
  { name: 'AuditLog_createdAt_idx', table: 'AuditLog', column: 'createdAt' },
  { name: 'EmailLog_sentAt_idx', table: 'EmailLog', column: 'sentAt' },
];
// הרשימות כפי שהאפליקציה שואלת אותן (lib/adminAuditListServer.js / lib/adminEmailLogs.js) בלי סינון: מיון חדש-ראשון, עמוד ראשון.
const EXPLAIN_SQL = {
  AuditLog: `SELECT a.id, a."entityType", a."entityId", a."action", a."createdAt", a."employeeId", a."changesJson" FROM "AuditLog" a ORDER BY a."createdAt" DESC, a.id DESC LIMIT 50 OFFSET 0`,
  EmailLog: `SELECT e.id, e."to", e."subject", e."status", e."sentAt" FROM "EmailLog" e ORDER BY e."sentAt" DESC, e."id" ASC LIMIT 50 OFFSET 0`,
};
const KNOWN_FLAGS = new Set(['confirm-host', 'apply', 'dry-run', 'i-know-this-is-prod', 'not-prod', 'explain', 'direct', 'help']);
const BOOLEAN_FLAGS = new Set(['apply', 'dry-run', 'i-know-this-is-prod', 'not-prod', 'explain', 'direct', 'help']);

const USAGE = [
  'Usage:',
  '  node scripts/create_log_indexes.js --confirm-host <full DB host | ep-xxxx> [--i-know-this-is-prod | --not-prod] [--explain] [--direct] [--apply]',
  'DRY RUN by default. Creates "AuditLog_createdAt_idx" and "EmailLog_sentAt_idx" with CREATE INDEX CONCURRENTLY IF NOT EXISTS (invalid leftovers are dropped and re-created).',
  'Same identity / production guard as scripts/set-ui-variant.js. No data is changed.',
].join('\n');

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    let name = arg.slice(2);
    let value;
    const eq = name.indexOf('=');
    if (eq !== -1) { value = name.slice(eq + 1); name = name.slice(0, eq); }
    if (!KNOWN_FLAGS.has(name)) throw new Error(`Unknown flag: --${name}`);
    if (BOOLEAN_FLAGS.has(name)) { opts[name] = true; continue; }
    if (value === undefined) {
      value = argv[++i];
      if (value === undefined || value.startsWith('--')) throw new Error(`Flag --${name} needs a value`);
    }
    opts[name] = value;
  }
  if (opts.help) return opts;
  if (!opts['confirm-host']) throw new Error('--confirm-host <full DB host or ep-xxxx endpoint id> is required');
  if (opts['not-prod'] && opts['i-know-this-is-prod']) throw new Error('--not-prod and --i-know-this-is-prod are mutually exclusive');
  if (opts.apply && opts['dry-run']) throw new Error('--apply and --dry-run are mutually exclusive');
  return opts;
}

/** מצב אינדקס לפי שם: null (אין) | { valid, ready }. db = { q(sql, params) -> rows } (ר' main: לקוח pg, פרוטוקול query פשוט, בלי טרנזקציה). */
async function indexState(db, name) {
  const rows = await db.q(
    `SELECT i.indisvalid AS valid, i.indisready AS ready
       FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = $1 AND n.nspname = current_schema()`, [name]);
  return rows.length ? { valid: !!rows[0].valid, ready: !!rows[0].ready } : null;
}

/** מריץ EXPLAIN (ANALYZE, FORMAT JSON) ומחזיר { ms, node, usesIndex } - בלי נתוני השורות. */
async function explain(db, table) {
  const out = await db.q(`EXPLAIN (ANALYZE, FORMAT JSON) ${EXPLAIN_SQL[table]}`);
  const plan = out[0]['QUERY PLAN'];
  const root = (typeof plan === 'string' ? JSON.parse(plan) : plan)[0];
  const nodes = [];
  (function walk(n) { nodes.push(n['Node Type']); (n.Plans || []).forEach(walk); })(root.Plan);
  return { ms: Number(root['Execution Time']), nodes, usesIndex: nodes.some((x) => /Index/.test(x)) };
}
const fmtExplain = (e) => `${e.ms.toFixed(1)} ms  [${e.nodes.join(' > ')}]`;

async function run(db, opts, log = console.log, indexes = INDEXES) {
  const apply = !!opts.apply;
  const results = [];
  log(`mode: ${apply ? 'APPLY (creates indexes)' : 'DRY RUN'}`);
  for (const ix of indexes) {
    const approx = await db.q(`SELECT reltuples::bigint AS n FROM pg_class WHERE oid = $1::text::regclass`, [`"${ix.table}"`]);
    const state = await indexState(db, ix.name);
    const r = { name: ix.name, table: ix.table, rowsApprox: Number(approx[0].n), before: state ? (state.valid ? 'valid' : 'INVALID') : 'missing', action: '', ms: 0 };
    log(`\n${ix.name} on "${ix.table}" ("${ix.column}"): ~${r.rowsApprox} rows, currently ${r.before}`);
    if (opts.explain) { r.explainBefore = await explain(db, ix.table); log(`  EXPLAIN default list BEFORE: ${fmtExplain(r.explainBefore)}`); }

    if (state && state.valid) { r.action = 'skip (already valid)'; log(`  ${r.action}`); results.push(r); continue; }
    const steps = [];
    if (state && !state.valid) steps.push(`DROP INDEX CONCURRENTLY IF EXISTS "${ix.name}"`);
    steps.push(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "${ix.name}" ON "${ix.table}" ("${ix.column}")`);
    r.action = steps.join(' ; ');
    if (!apply) { log(`  WOULD run: ${r.action}`); results.push(r); continue; }

    const t0 = Date.now();
    for (const sql of steps) {
      log(`  running: ${sql}`);
      await db.q(sql); // פרוטוקול query פשוט, פקודה בודדת = בלי בלוק טרנזקציה (CONCURRENTLY לא רץ בתוך טרנזקציה)
    }
    r.ms = Date.now() - t0;
    const after = await indexState(db, ix.name);
    r.after = after ? (after.valid ? 'valid' : 'INVALID') : 'missing';
    log(`  done in ${r.ms} ms -> index is ${r.after}`);
    if (r.after !== 'valid') {
      r.failed = true;
      log(`  ERROR: "${ix.name}" is ${r.after}. Re-run this script (it drops an invalid index and re-creates it).`);
    }
    if (opts.explain) { r.explainAfter = await explain(db, ix.table); log(`  EXPLAIN default list AFTER:  ${fmtExplain(r.explainAfter)}`); }
    results.push(r);
  }
  if (!apply) log('\nDRY RUN - nothing created. Add --apply to create.');
  return results;
}

/** אותו endpoint של Neon בלי הסיומת -pooler (חיבור ישיר). */
function directUrl(url) {
  const u = new URL(url);
  u.hostname = u.hostname.replace(/^([^.]+?)-pooler(\.|$)/, '$1$2');
  return u.toString();
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { console.log(USAGE); return; }

  require(path.join(__dirname, 'lib', 'db-env.js')).loadEnvFiles();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const target = describeDbTarget(url);
  if (process.env.PROD_DATABASE_URL && process.env.PROD_DATABASE_URL !== url) {
    console.warn('WARNING: PROD_DATABASE_URL is also set and differs from DATABASE_URL - the app itself reads PROD_DATABASE_URL first. This script uses DATABASE_URL only.');
  }
  console.log(`DB target: host=${target.host} database=${target.database}`);
  const hostCheck = checkHost(target.host, opts['confirm-host'], collectKnownDbs(), { allowProd: !!opts['i-know-this-is-prod'], notProd: !!opts['not-prod'] });
  if (!hostCheck.ok) {
    console.error(`REFUSING TO RUN: ${hostCheck.reason}`);
    process.exit(2);
  }
  console.log(`DB identity: ${hostCheck.label || '(not one of the known PROD/TEST/org2 env URLs - treated as production)'}${hostCheck.prod ? '  ** PRODUCTION **' : ''}`);
  if (/-pooler\./i.test(target.host) && !opts.direct) {
    console.log('NOTE: connected through the Neon pooler (pgbouncer). CREATE INDEX CONCURRENTLY works, but for a long build on a big table prefer --direct.');
  }

  // לקוח pg יחיד (חיבור אחד, פרוטוקול query פשוט): Prisma עוטף שאילתות גולמיות בטרנזקציה ולכן CREATE INDEX CONCURRENTLY נכשל דרכו (25001).
  // חיבור יחיד גם גורם ל-SET להמשיך לחול על הפקודות הבאות (עם --direct; מאחורי pgbouncer במצב transaction SET לא נשמר, וזה לא מזיק).
  const { Client } = require('pg');
  // sslmode=require -> verify-full: אותה התנהגות ש-pg נותן היום ל-"require", רק בלי אזהרת ההוצאה משימוש שלו (תעודות Neon תקינות)
  const client = new Client({ connectionString: (opts.direct ? directUrl(url) : url).replace(/sslmode=require/i, 'sslmode=verify-full') });
  await client.connect();
  const db = { q: async (sql, params) => (await client.query(sql, params)).rows };
  try {
    const nameRows = await db.q(`SELECT value FROM "SystemSetting" WHERE key = 'gmach_name'`);
    console.log(`gmach_name: ${nameRows[0] && nameRows[0].value != null ? String(nameRows[0].value) : '(no gmach_name setting)'}`);
    console.log(`current_database: ${(await db.q('SELECT current_database() AS db'))[0].db}`);
    if (opts.apply) {
      try { await db.q('SET statement_timeout = 0'); } catch (e) { console.warn('could not SET statement_timeout = 0 (continuing):', e.message); }
      try { await db.q(`SET lock_timeout = '15s'`); } catch (e) { /* optional */ }
    }
    const results = await run(db, opts);
    if (results.some((r) => r.failed)) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

module.exports = { INDEXES, parseArgs, directUrl, indexState, run };

if (require.main === module) {
  main().catch((err) => {
    console.error('FAILED:', err.message);
    process.exit(1);
  });
}
