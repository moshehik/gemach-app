#!/usr/bin/env node
/**
 * Automatic retention cleanup for the two ever-growing log tables:
 *
 *   - PageVisitLog - every page view / API call, recorded by the app's own
 *     request logging (see app/management/history/page.js, which shows a
 *     manual-cleanup UI for it and warns above 10,000 rows).
 *   - QueryLog - every raw-SQL statement run from the admin Data Explorer
 *     (app/admin/data-explorer/page.js), recorded by app/api/admin/query/route.js.
 *     Its own GET route (app/api/admin/query-log/route.js) only ever reads the
 *     most recent 50 rows for display - nothing was ever deleting old ones,
 *     so the table grew without bound.
 *
 * This script deletes rows older than RETENTION_DAYS (90) from both tables.
 * It is the automatic counterpart to the manual "מחק ישן מ-90 יום" button on
 * the history page (app/api/history/route.js DELETE handler, olderThanDays
 * param) - same cutoff, same intent, just unattended. Deleting rows that are
 * already gone is a no-op, so this is safe to re-run any number of times
 * (idempotent) - a missed/duplicate run does not double-delete or error.
 *
 * Usage:
 *   node scripts/cleanup_old_logs.js
 *
 * Env (read from process.env, falling back to .env.local then .env in the
 * repo root - same precedence as scripts/backup_prod_db.js):
 *   CLEANUP_DATABASE_URL   optional explicit override (e.g. to point this at
 *                          TEST_DATABASE_URL manually while testing)
 *   PROD_DATABASE_URL      used if CLEANUP_DATABASE_URL is not set
 *   DATABASE_URL           used if neither of the above is set
 *
 * This intentionally connects with the plain `pg` driver, the same as
 * scripts/backup_prod_db.js, rather than going through app/lib/prisma.js -
 * that module is Next-coupled (imports next/headers) and its prod/test
 * routing depends on a `.active-db` file meant for the running dev/prod
 * server, not a standalone script. A raw DELETE ... WHERE "timestamp" < $1
 * also avoids Prisma's automatic AuditLog write-on-delete extension, which
 * would otherwise flood AuditLog with thousands of noisy rows every night
 * (see CLAUDE.md "Automatic audit logging" - PageVisitLog is excluded from
 * the app's own audit hook for the same reason, and QueryLog is exempt too
 * since it isn't in the audited-model set).
 *
 * Output: backups/log-cleanup.log (one line appended per run).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT = path.join(__dirname, '..');
const LOG_DIR = path.join(ROOT, 'backups');
const LOG_FILE = path.join(LOG_DIR, 'log-cleanup.log');

const RETENTION_DAYS = 90;

// ---------------------------------------------------------------------------
// Tiny .env loader, identical in behavior to scripts/backup_prod_db.js -
// .env.local wins over .env, and anything already in process.env wins over
// both. No `dotenv` package is installed in this repo.
// ---------------------------------------------------------------------------
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile(path.join(ROOT, '.env.local'));
loadEnvFile(path.join(ROOT, '.env'));

const DATABASE_URL = process.env.CLEANUP_DATABASE_URL || process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('No database URL found (checked CLEANUP_DATABASE_URL, PROD_DATABASE_URL, DATABASE_URL).');
  process.exit(1);
}

function appendLog(line) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${line}\n`);
}

async function main() {
  const startedAt = Date.now();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    const pageVisitResult = await client.query(
      'DELETE FROM "PageVisitLog" WHERE "timestamp" < $1',
      [cutoff]
    );
    const queryLogResult = await client.query(
      'DELETE FROM "QueryLog" WHERE "executedAt" < $1',
      [cutoff]
    );

    const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
    const summaryLine = `OK cutoff=${cutoff.toISOString()} PageVisitLog=${pageVisitResult.rowCount} QueryLog=${queryLogResult.rowCount} ${elapsedSec}s`;
    appendLog(summaryLine);
    console.log(summaryLine);
  } catch (err) {
    appendLog(`FAILED ${err.message}`);
    console.error('Log cleanup failed:', err);
    await client.end();
    process.exit(1);
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  appendLog(`FAILED ${err.message}`);
  process.exit(1);
});
