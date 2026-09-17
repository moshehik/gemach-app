#!/usr/bin/env node
/**
 * Cloud backup: full logical dump of both gemachs' production DBs, uploaded to Google
 * Drive via the shared Apps Script "archive bridge" (scripts/lib/driveBridge.js) - the
 * SAME already-deployed GAS project that print-center and the bagrut site already use
 * (apps-script-send/ArchiveBridge.js), reused as-is per the owner's decision (17.09.2026):
 * one bridge, separation is done purely in Drive via a distinct root folder per org - no
 * new GAS project, no new deployment, no new secret. Replaces the old local-machine-only
 * scripts/backup_prod_db.js (org1-only, dependent on this machine being on) - see BACKUPS.md.
 *
 * Runs from .github/workflows/backup-to-drive.yml on two triggers:
 *   - schedule (every 15 min) - cheap per-org "is a backup due yet" check, most ticks
 *     just log and exit without touching either DB's data tables.
 *   - repository_dispatch 'run-backup-now' - fired by app/api/admin/backups/trigger's
 *     POST route (the admin "גיבוי מיידי" button), same instant-trigger pattern already
 *     used for error reports (see claude-fix-reports.yml / app/api/error-report/route.js).
 *
 * For EACH org (1 = main gemach, 2 = נווה יעקב - scripts/lib/db-env.js resolves the
 * right DATABASE_URL/DATABASE_URL_ORG2), independently:
 *   1. Read that org's own SystemSetting rows: backup_enabled, backup_interval_hours,
 *      backup_drive_folder_id (repurposed: the Drive ROOT FOLDER NAME for this org's
 *      backups, auto-created by the bridge if missing - not an id, the bridge only
 *      works by name), backup_owner_email, backup_requested_at.
 *   2. Skip entirely (no BackupRun row written) if backup_enabled='false', or if not due
 *      yet: the last 'ok' BackupRun is more recent than backup_interval_hours ago AND
 *      there's no pending backup_requested_at newer than that last ok run.
 *   3. Otherwise: insert a BackupRun row (status='running'), run the dump (same
 *      introspect + topological-sort + batched multi-row INSERT approach as
 *      scripts/backup_prod_db.js, gzipped fully in memory - this runs on an ephemeral
 *      GitHub-hosted runner, no local disk to write to), upload it straight to Drive via
 *      a resumable REST upload (bypasses GAS's own ~50MB/request ceiling entirely - see
 *      driveBridge.js), share it with backup_owner_email if set (explicit read-only
 *      permission, never "anyone with the link"), then update the row to 'ok' (with
 *      size/duration/table summary/Drive link) or 'failed' (with the error message) -
 *      this is what app/admin/backups renders as the run list + error log.
 *   4. On a successful upload: list that org's Drive backup files and delete old ones,
 *      keeping the last 14 daily + one per ISO week for the 8 weeks before that (same
 *      retention policy backup_prod_db.js used locally).
 *
 * Requires DRIVE_BRIDGE_URL + DRIVE_BRIDGE_SECRET (GitHub secrets, shared by both orgs -
 * the bridge and its secret aren't per-org data, same treatment as DATABASE_URL/
 * DATABASE_URL_ORG2). Both orgs are skipped with a clear log line, not an error, if
 * these aren't configured.
 *
 * Usage: node scripts/cloud_backup.js   (always attempts org 1, then org 2 - org 2 is
 * skipped with a log line, not an error, if no org-2 DB URL is configured at all)
 */

'use strict';

const zlib = require('zlib');
const { Client } = require('pg');
const { PrismaClient } = require('@prisma/client');
const { resolveDbUrl } = require('./lib/db-env');
const driveBridge = require('./lib/driveBridge');

const DAILY_KEEP = 14;
const WEEKLY_KEEP = 8;
const BATCH_SIZE = 2000; // rows fetched per round-trip (keyset pagination on id)
const ROWS_PER_INSERT = 500; // rows per multi-row INSERT statement

const SETTING_KEYS = [
  'backup_enabled',
  'backup_interval_hours',
  'backup_drive_folder_id',
  'backup_owner_email',
  'backup_requested_at',
];

// ---------------------------------------------------------------------------
// SQL literal / identifier formatting (identical to scripts/backup_prod_db.js)
// ---------------------------------------------------------------------------
function sqlIdent(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (Buffer.isBuffer(value)) return `'\\x${value.toString('hex')}'`;
  if (Array.isArray(value)) {
    return `'{${value.map((v) => (v === null ? 'NULL' : JSON.stringify(String(v)))).join(',')}}'`;
  }
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

// ---------------------------------------------------------------------------
// Schema introspection + dependency ordering (identical to backup_prod_db.js)
// ---------------------------------------------------------------------------
async function discoverTables(client) {
  const { rows } = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return rows.map((r) => r.table_name);
}

async function discoverForeignKeyEdges(client) {
  const { rows } = await client.query(`
    SELECT DISTINCT tc.table_name AS child, ccu.table_name AS parent
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name <> ccu.table_name
  `);
  return rows;
}

function topologicalSort(tables, edges) {
  const dependsOn = new Map(tables.map((t) => [t, new Set()]));
  for (const { child, parent } of edges) {
    if (dependsOn.has(child) && dependsOn.has(parent)) dependsOn.get(child).add(parent);
  }
  const sorted = [];
  const remaining = new Set(tables);
  let guard = tables.length + 1;
  while (remaining.size > 0 && guard-- > 0) {
    const ready = [...remaining]
      .filter((t) => [...dependsOn.get(t)].every((p) => !remaining.has(p)))
      .sort();
    if (ready.length === 0) {
      const rest = [...remaining].sort();
      console.warn('WARNING: foreign-key cycle detected among remaining tables, breaking arbitrarily:', rest);
      ready.push(rest[0]);
    }
    for (const t of ready) {
      sorted.push(t);
      remaining.delete(t);
    }
  }
  return sorted;
}

async function getColumns(client, table) {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
    [table]
  );
  return rows.map((r) => r.column_name);
}

async function dumpTable(client, table, columns, write) {
  let total = 0;
  let lastId = null;
  const colList = columns.map(sqlIdent).join(', ');

  while (true) {
    const whereClause = lastId === null ? '' : `WHERE ${sqlIdent('id')} > $2`;
    const params = lastId === null ? [BATCH_SIZE] : [BATCH_SIZE, lastId];
    const { rows } = await client.query(
      `SELECT ${colList} FROM ${sqlIdent(table)} ${whereClause} ORDER BY ${sqlIdent('id')} LIMIT $1`,
      params
    );
    if (rows.length === 0) break;
    total += rows.length;
    lastId = rows[rows.length - 1].id;

    for (let i = 0; i < rows.length; i += ROWS_PER_INSERT) {
      const chunk = rows.slice(i, i + ROWS_PER_INSERT);
      const valuesSql = chunk
        .map((row) => '(' + columns.map((c) => sqlLiteral(row[c])).join(', ') + ')')
        .join(',\n  ');
      write(`INSERT INTO ${sqlIdent(table)} (${colList}) VALUES\n  ${valuesSql};\n`);
    }
    if (rows.length < BATCH_SIZE) break;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Full dump -> gzip buffer, entirely in memory (no local disk on a CI runner)
// ---------------------------------------------------------------------------
async function dumpDatabase(dbUrl) {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  const chunks = [];
  const gzip = zlib.createGzip({ level: 9 });
  gzip.on('data', (c) => chunks.push(c));
  const finished = new Promise((resolve, reject) => {
    gzip.on('end', resolve);
    gzip.on('error', reject);
  });
  const write = (s) => gzip.write(s);

  const tableSummaryParts = [];
  try {
    await client.query('BEGIN');
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');

    const tables = await discoverTables(client);
    const edges = await discoverForeignKeyEdges(client);
    const orderedTables = topologicalSort(tables, edges);

    write('-- gemach-app cloud backup\n');
    write(`-- generated: ${new Date().toISOString()}\n`);
    write(`-- tables: ${orderedTables.length}\n`);
    write('-- Restore: recreate the schema first (npx prisma db push), then\n');
    write('--   gunzip -c <this file> | psql "<target-connection-string>"\n');
    write('-- See BACKUPS.md for the full restore walkthrough.\n\n');
    write('BEGIN;\n\n');

    for (const table of orderedTables) {
      const columns = await getColumns(client, table);
      write(`-- ${table}\n`);
      const count = await dumpTable(client, table, columns, write);
      tableSummaryParts.push(`${table}=${count}`);
      write('\n');
    }

    write('COMMIT;\n');
    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (e) {
      /* ignore */
    }
    gzip.end();
    await finished.catch(() => {});
    await client.end();
    throw err;
  }

  gzip.end();
  await finished;
  await client.end();

  return { buffer: Buffer.concat(chunks), tableSummary: tableSummaryParts.join(', ') };
}

// ---------------------------------------------------------------------------
// Retention: keep last 14 daily + last 8 weekly, delete the rest (same policy
// as rotateBackups() in the old backup_prod_db.js, ported to operate on the
// Drive file list instead of local filenames).
// ---------------------------------------------------------------------------
function isoWeekKey(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function decideRotation(files) {
  const dated = files
    .map((f) => ({ ...f, date: new Date(f.createdTime) }))
    .filter((f) => !isNaN(f.date))
    .sort((a, b) => b.date - a.date); // newest first

  const keep = new Set(dated.slice(0, DAILY_KEEP).map((f) => f.id));
  const older = dated.slice(DAILY_KEEP);

  const seenWeeks = new Set();
  for (const entry of older) {
    const wk = isoWeekKey(entry.date);
    if (!seenWeeks.has(wk) && seenWeeks.size < WEEKLY_KEEP) {
      seenWeeks.add(wk);
      keep.add(entry.id);
    }
  }

  return dated.filter((f) => !keep.has(f.id)).map((f) => f.id);
}

async function rotateDriveBackups(rootFolder, org) {
  const files = (await driveBridge.listFiles(rootFolder)).filter((f) => f.name.startsWith(`gemach-org${org}-`));
  const deleteIds = decideRotation(files);
  for (const id of deleteIds) {
    try {
      await driveBridge.deleteFile(id);
    } catch (e) {
      console.error(`[org${org}] failed to delete old backup ${id}:`, e.message);
    }
  }
  if (deleteIds.length) console.log(`[org${org}] rotated away ${deleteIds.length} old backup(s).`);
}

// ---------------------------------------------------------------------------
// Per-org run: decide if due, dump, upload, record, rotate
// ---------------------------------------------------------------------------
async function runOrgBackup(org) {
  let dbUrl;
  try {
    dbUrl = resolveDbUrl(org);
  } catch (e) {
    if (org === 2) {
      console.log(`[org${org}] no database URL configured, skipping (expected until Neve Yaakov's DB secret is added).`);
      return;
    }
    throw e;
  }

  const prisma = new PrismaClient({ datasourceUrl: dbUrl });
  try {
    const settings = await prisma.systemSetting.findMany({ where: { key: { in: SETTING_KEYS } } });
    const val = (key, fallback = null) => settings.find((s) => s.key === key)?.value ?? fallback;

    if (!driveBridge.isConfigured()) {
      console.log(`[org${org}] Drive bridge not configured (DRIVE_BRIDGE_URL/DRIVE_BRIDGE_SECRET) - skipping.`);
      return;
    }
    const rootFolder = val('backup_drive_folder_id') || `gemach-backup-org${org}`;

    const intervalHours = Number(val('backup_interval_hours', '24')) || 24;
    const requestedAtRaw = val('backup_requested_at');
    const requestedAt = requestedAtRaw ? new Date(requestedAtRaw) : null;

    const lastOk = await prisma.backupRun.findFirst({ where: { status: 'ok' }, orderBy: { startedAt: 'desc' } });
    const hoursSinceLastOk = lastOk ? (Date.now() - lastOk.startedAt.getTime()) / 3600000 : Infinity;
    // A pending "immediate" click (duePending) always runs, even if the automatic
    // toggle is off - backup_enabled only gates the schedule, not the manual button.
    const duePending = !!(requestedAt && !isNaN(requestedAt) && (!lastOk || requestedAt > lastOk.startedAt));
    const enabled = val('backup_enabled', 'true') !== 'false';
    const dueBySchedule = enabled && hoursSinceLastOk >= intervalHours;

    if (!dueBySchedule && !duePending) {
      console.log(enabled
        ? `[org${org}] not due yet (last ok backup ${hoursSinceLastOk.toFixed(1)}h ago, interval ${intervalHours}h).`
        : `[org${org}] backups disabled (backup_enabled=false) and no pending manual request, skipping.`);
      return;
    }

    const trigger = duePending ? 'manual' : 'schedule';
    if (duePending) {
      // Clear the flag before attempting: a failed upload shouldn't retry-loop
      // every 15 minutes just because the flag is still set - the admin can
      // just click the button again.
      await prisma.systemSetting.updateMany({ where: { key: 'backup_requested_at' }, data: { value: null } });
    }

    const run = await prisma.backupRun.create({ data: { status: 'running', trigger } });
    const startedAt = Date.now();
    console.log(`[org${org}] starting backup (trigger=${trigger}), BackupRun ${run.id}`);

    try {
      const { buffer, tableSummary } = await dumpDatabase(dbUrl);
      const durationSec = (Date.now() - startedAt) / 1000;
      const fileName = `gemach-org${org}-${new Date().toISOString().replace(/[:.]/g, '-')}.sql.gz`;

      const shareEmail = val('backup_owner_email');
      if (!shareEmail) {
        console.warn(`[org${org}] backup_owner_email not set - backup file will only be reachable from the bridge's own Google account, not shared to anyone.`);
      }
      const uploaded = await driveBridge.uploadFile({
        root: rootFolder,
        name: fileName,
        mimeType: 'application/gzip',
        buffer,
      });
      if (shareEmail) {
        await driveBridge.shareFile(uploaded.fileId, shareEmail);
      }

      await prisma.backupRun.update({
        where: { id: run.id },
        data: {
          status: 'ok',
          finishedAt: new Date(),
          sizeBytes: buffer.length,
          durationSec,
          tableSummary,
          fileName,
          driveUrl: driveBridge.webViewLink(uploaded.fileId),
        },
      });
      console.log(`[org${org}] OK ${fileName} ${buffer.length} bytes ${durationSec.toFixed(1)}s`);

      await rotateDriveBackups(rootFolder, org);
    } catch (err) {
      const durationSec = (Date.now() - startedAt) / 1000;
      await prisma.backupRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          durationSec,
          errorMessage: String((err && err.message) || err).slice(0, 2000),
        },
      });
      console.error(`[org${org}] FAILED: ${err.message}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  let hadUncaughtError = false;
  for (const org of [1, 2]) {
    try {
      await runOrgBackup(org);
    } catch (err) {
      hadUncaughtError = true;
      console.error(`[org${org}] uncaught error (before a BackupRun row could be recorded):`, err);
    }
  }
  if (hadUncaughtError) process.exit(1);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
