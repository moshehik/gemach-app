#!/usr/bin/env node
/**
 * One-off purge/redaction of credentials that were stored in plaintext in
 * PageVisitLog.requestQuery / pageUrl (see lib/redactSensitive.js and the PR
 * "redact request bodies in visit log"). Rows are rewritten with the same
 * redaction the app now applies on write: auth endpoints (login, verify-pin,
 * attendance, ...) -> requestQuery NULL; other bodies -> sensitive keys
 * replaced by "[מוסתר]"; truncated/unparseable bodies containing a sensitive
 * word -> NULL.
 *
 * SAFETY (each org has its own DB - run once per org, deliberately):
 *   - DRY-RUN by default: prints counts per endpoint only (never values).
 *     Nothing is written without --apply.
 *   - --db-env <VAR> (required): name of the env var holding the connection
 *     string (e.g. TEST_DATABASE_URL, PROD_DATABASE_URL, or a var you export
 *     for the second org). The URL itself is never printed.
 *   - --expect-host <substring> (required): the DB host must contain it, else
 *     the script aborts. Copy it from the Vercel project's own DATABASE_URL
 *     so org1 and org2 can't be mixed up.
 *   - Uses raw pg UPDATEs (like scripts/cleanup_old_logs.js): PageVisitLog is
 *     not audited, so no AuditLog rows are produced.
 *
 * Usage:
 *   node scripts/redact_visit_log_secrets.js --db-env TEST_DATABASE_URL --expect-host ep-fancy-pine
 *   node scripts/redact_visit_log_secrets.js --db-env PROD_DATABASE_URL --expect-host <host> --apply   # ONLY with the owner's explicit approval
 *
 * Env files are read the same way as scripts/cleanup_old_logs.js
 * (process.env > .env.local > .env).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT = path.join(__dirname, '..');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile(path.join(ROOT, '.env.local'));
loadEnvFile(path.join(ROOT, '.env'));

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1] || '';
}

async function main() {
  const dbEnv = arg('--db-env');
  const expectHost = arg('--expect-host');
  const apply = process.argv.includes('--apply');
  if (!dbEnv || !expectHost) {
    console.error('Required: --db-env <ENV_VAR_NAME> --expect-host <host substring>. See header of this script.');
    process.exit(1);
  }
  const url = process.env[dbEnv];
  if (!url) { console.error(`Env var ${dbEnv} is not set.`); process.exit(1); }
  const host = new URL(url.replace(/^postgres(ql)?:/, 'http:')).hostname;
  if (!host.includes(expectHost)) {
    console.error(`Host check FAILED: ${dbEnv} points at "${host}", which does not contain "${expectHost}". Aborting - nothing was touched.`);
    process.exit(1);
  }
  console.log(`Target host: ${host}  mode: ${apply ? 'APPLY (writes!)' : 'dry-run'}`);

  const { redactRequestQuery, redactUrl } = await import('../lib/redactSensitive.js');
  const cleanUrl = url.replace(/[?&]channel_binding=require/, '').replace(/[?&]pgbouncer=true/, '');
  const client = new Client({ connectionString: cleanUrl });
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, "pageUrl", "requestQuery" FROM "PageVisitLog"
       WHERE "requestQuery" IS NOT NULL OR "pageUrl" LIKE '%?%'`
    );
    const perEndpoint = new Map();
    const todo = [];
    for (const r of rows) {
      const newQuery = redactRequestQuery(r.requestQuery, r.pageUrl);
      const newUrl = redactUrl(r.pageUrl);
      if (newQuery !== r.requestQuery || newUrl !== r.pageUrl) {
        todo.push({ id: r.id, newQuery, newUrl });
        const ep = r.pageUrl.split('?')[0].replace(/[0-9a-f]{8}-[0-9a-f-]{27}|\/\d+/gi, '/:id');
        perEndpoint.set(ep, (perEndpoint.get(ep) || 0) + 1);
      }
    }
    console.log(`Scanned ${rows.length} rows; ${todo.length} need redaction.`);
    [...perEndpoint.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).forEach(([ep, n]) => console.log(`  ${String(n).padStart(6)}  ${ep}`));
    if (!apply) { console.log('Dry-run only. Re-run with --apply to write.'); return; }
    let done = 0;
    for (const t of todo) {
      await client.query('UPDATE "PageVisitLog" SET "requestQuery" = $1, "pageUrl" = $2 WHERE id = $3', [t.newQuery, t.newUrl, t.id]);
      done++;
    }
    console.log(`Updated ${done} rows.`);
  } finally {
    await client.end();
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
