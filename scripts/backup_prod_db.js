#!/usr/bin/env node
/**
 * Logical backup of the PRODUCTION Neon Postgres database(s), for BOTH gemachs
 * (org 1 = main gemach, org 2 = "Neve Yaakov" - separate Neon projects/DBs).
 *
 * NOTE ON WHAT THIS IS TODAY (2026-09-23): this used to be the primary automatic
 * nightly backup (Windows Task Scheduler, `GemachApp-ProdDbBackup`, daily 03:30),
 * but that task was deliberately DISABLED on 2026-09-20 after running it alongside
 * the newer cloud backup (`scripts/cloud_backup.js` -> GitHub Actions -> Google
 * Drive, see BACKUPS.md "Layer 0") caused org1 to exceed Neon's free-tier 5GB/month
 * data-transfer quota and take the site down (two full-DB reads/day instead of
 * one). The cloud backup already covers BOTH orgs automatically and does not
 * depend on this machine being on - see BACKUPS.md for the full story. This
 * script is now a MANUAL fallback only (`npm run backup:prod`) - useful if the
 * cloud backup is ever broken, or you just want a local off-Neon copy right now.
 * Do NOT re-enable automatic/scheduled runs of this script for both orgs without
 * first re-checking each org's current Neon egress headroom - see BACKUPS.md's
 * "Backups count against Neon egress" section.
 *
 * This is an ADDITIONAL safety net on top of Neon's built-in point-in-time
 * restore (PITR - 7 days). PITR only protects against accidental changes
 * *within* that rolling window and only from inside Neon (branch-and-restore) -
 * it is not a portable file. This script produces a compressed, plain-SQL dump
 * you can keep off-Neon and restore anywhere with plain `psql`. See BACKUPS.md.
 *
 * Real `pg_dump` is not installed on this machine (checked with
 * `pg_dump --version` - not found), so this reimplements a minimal,
 * dependency-free logical dump using the `pg` driver already in
 * package.json: it discovers every base table + foreign-key edge in the
 * `public` schema, topologically sorts tables (parents before children), and
 * streams each one out as batched `INSERT INTO ... VALUES (...), (...);`
 * statements, all inside one REPEATABLE READ / READ ONLY transaction per org
 * so each org's file is a consistent snapshot as of a single instant. Same
 * dump algorithm as `scripts/cloud_backup.js` (kept in sync deliberately).
 *
 * Usage:
 *   node scripts/backup_prod_db.js
 *   npm run backup:prod
 *
 * Always attempts org 1 first, then org 2, independently - a problem with one
 * org's DB or config does not stop the other org's backup from running.
 *
 * Env (read from process.env, falling back to .env.local then .env in the
 * repo root - Next.js precedence: .env.local wins over .env), reusing
 * scripts/lib/db-env.js's resolveDbUrl() for the org1/org2 lookup pattern
 * already used by scripts/cloud_backup.js and the /fix-reports scripts:
 *   org1 (required - a hard failure if missing, same as always):
 *     BACKUP_DATABASE_URL         optional explicit override
 *     PROD_DATABASE_URL           used if BACKUP_DATABASE_URL is not set
 *     DATABASE_URL                used if neither of the above is set
 *   org2 (optional - skipped with a clear log line if not configured):
 *     BACKUP_DATABASE_URL_ORG2    optional explicit override
 *     PROD_DATABASE_URL_ORG2      used if BACKUP_DATABASE_URL_ORG2 is not set
 *     DATABASE_URL_ORG2           used if neither of the above is set
 *
 * Output (gitignored - see .gitignore):
 *   backups/gemach-prod-YYYY-MM-DD.sql.gz        org1 (unchanged filename, for
 *                                                 backward compatibility with
 *                                                 existing files/rotation/docs)
 *   backups/gemach-org2-prod-YYYY-MM-DD.sql.gz   org2 (new)
 *   backups/backup.log                           one line per org per run,
 *                                                 tagged "[org1]"/"[org2]"
 *
 * Rotation: each org keeps its own most recent 14 daily dumps, plus one dump
 * per ISO calendar week for the 8 weeks before that, independently of the
 * other org's files.
 *
 * Restore (disaster recovery) - see BACKUPS.md for the full walkthrough:
 *   1. Recreate the schema on the target DB from the versioned Prisma schema:
 *        DATABASE_URL="<target>" npx prisma db push --schema=prisma/schema.prisma
 *   2. Load the data:
 *        gunzip -c backups/gemach-prod-2026-08-05.sql.gz | psql "<target-connection-string>"
 *        gunzip -c backups/gemach-org2-prod-2026-09-23.sql.gz | psql "<target-connection-string>"
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { Client } = require('pg');
const { resolveDbUrl } = require('./lib/db-env');

const ROOT = path.join(__dirname, '..');
const BACKUP_DIR = path.join(ROOT, 'backups');
const LOG_FILE = path.join(BACKUP_DIR, 'backup.log');

const DAILY_KEEP = 14;
const WEEKLY_KEEP = 8;
const BATCH_SIZE = 2000; // rows fetched per round-trip (keyset pagination on id)
const ROWS_PER_INSERT = 500; // rows per multi-row INSERT statement

// ---------------------------------------------------------------------------
// Tiny .env loader. No `dotenv` package is actually installed in this repo
// (scripts/sync_prod_to_test.js requires() it but node_modules has no such
// package, so that script would crash on `require('dotenv')` - don't repeat
// that mistake). This mirrors Next.js's precedence: .env.local wins over
// .env, and anything already present in process.env wins over both.
// scripts/lib/db-env.js's own loadEnvFiles() does the same thing and is
// idempotent, so calling both is harmless - kept here too so the
// BACKUP_DATABASE_URL*/env-var documentation above stays self-contained.
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

// ---------------------------------------------------------------------------
// Per-org config
// ---------------------------------------------------------------------------
const ORGS = [
  { org: 1, label: 'org1', filePrefix: 'gemach-prod', required: true, overrideEnv: 'BACKUP_DATABASE_URL' },
  { org: 2, label: 'org2', filePrefix: 'gemach-org2-prod', required: false, overrideEnv: 'BACKUP_DATABASE_URL_ORG2' },
];

/** Resolves the connection string for one org, honoring its BACKUP_DATABASE_URL*
 * override first, then falling back to scripts/lib/db-env.js's resolveDbUrl()
 * (PROD_DATABASE_URL[_ORG2] / DATABASE_URL[_ORG2]). Throws if nothing is found -
 * caller decides whether that's a hard failure (org1) or a skip (org2). */
function resolveOrgUrl(orgCfg) {
  const override = process.env[orgCfg.overrideEnv];
  if (override) return override;
  return resolveDbUrl(orgCfg.org);
}

// ---------------------------------------------------------------------------
// SQL literal / identifier formatting
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
    // Defensive: this schema has no native Postgres array columns today.
    return `'{${value.map((v) => (v === null ? 'NULL' : JSON.stringify(String(v)))).join(',')}}'`;
  }
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

// ---------------------------------------------------------------------------
// Schema introspection + dependency ordering
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
  // child depends on parent -> parent must be loaded (INSERTed) first
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
  const dependsOn = new Map(tables.map((t) => [t, new Set()])); // child -> set(parent)
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
      // Cycle - shouldn't happen with this schema, but don't hang forever.
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

// ---------------------------------------------------------------------------
// Per-table dump (keyset pagination on "id", which every model in this
// schema has as its uuid primary key - see prisma/schema.prisma)
// ---------------------------------------------------------------------------
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
// Rotation: keep last 14 daily + last 8 weekly, delete the rest - run
// independently per org against that org's own filename prefix.
// ---------------------------------------------------------------------------
function formatDate(d) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function isoWeekKey(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function rotateBackups(filePrefix) {
  const fileRe = new RegExp(`^${filePrefix}-(\\d{4}-\\d{2}-\\d{2})\\.sql\\.gz$`);
  const files = fs.existsSync(BACKUP_DIR) ? fs.readdirSync(BACKUP_DIR) : [];
  const dated = files
    .map((f) => {
      const m = f.match(fileRe);
      return m ? { file: f, date: new Date(m[1] + 'T00:00:00Z') } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.date - a.date); // newest first

  const keep = new Set(dated.slice(0, DAILY_KEEP).map((d) => d.file));
  const older = dated.slice(DAILY_KEEP);

  const seenWeeks = new Set();
  for (const entry of older) {
    const wk = isoWeekKey(entry.date);
    if (!seenWeeks.has(wk) && seenWeeks.size < WEEKLY_KEEP) {
      seenWeeks.add(wk);
      keep.add(entry.file);
    }
  }

  const deleted = [];
  for (const entry of dated) {
    if (!keep.has(entry.file)) {
      fs.unlinkSync(path.join(BACKUP_DIR, entry.file));
      deleted.push(entry.file);
    }
  }
  return { kept: [...keep], deleted };
}

function appendLog(line) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${line}\n`);
}

// ---------------------------------------------------------------------------
// One org's dump: connect, dump every table inside one read-only transaction,
// gzip to a tmp file, rename into place on success, rotate that org's files.
// Throws on failure (caller logs/handles) - never leaves a partial file at
// the final name (only at "<name>.tmp", which is not picked up by rotation).
// ---------------------------------------------------------------------------
async function dumpOrg(orgCfg, dbUrl) {
  const startedAt = Date.now();
  const dateStr = formatDate(new Date());
  const outFile = path.join(BACKUP_DIR, `${orgCfg.filePrefix}-${dateStr}.sql.gz`);
  const tmpFile = outFile + '.tmp';

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  const gzip = zlib.createGzip({ level: 9 });
  const out = fs.createWriteStream(tmpFile);
  const finished = new Promise((resolve, reject) => {
    out.on('finish', resolve);
    out.on('error', reject);
    gzip.on('error', reject);
  });
  gzip.pipe(out);
  const write = (s) => gzip.write(s);

  const tableSummary = [];
  try {
    await client.query('BEGIN');
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');

    const tables = await discoverTables(client);
    const edges = await discoverForeignKeyEdges(client);
    const orderedTables = topologicalSort(tables, edges);

    write(`-- gemach-app production logical backup (${orgCfg.label})\n`);
    write(`-- generated: ${new Date().toISOString()}\n`);
    write(`-- source: ${dbUrl.replace(/:[^:@/]+@/, ':***@')}\n`);
    write(`-- tables: ${orderedTables.length}\n`);
    write('-- Restore: recreate the schema first (npx prisma db push), then\n');
    write('--   gunzip -c <this file> | psql "<target-connection-string>"\n');
    write('-- See BACKUPS.md for the full restore walkthrough.\n\n');
    write('BEGIN;\n\n');

    for (const table of orderedTables) {
      const columns = await getColumns(client, table);
      write(`-- ${table}\n`);
      const count = await dumpTable(client, table, columns, write);
      tableSummary.push(`${table}=${count}`);
      write('\n');
    }

    write('COMMIT;\n');
    await client.query('COMMIT'); // release the read-only snapshot
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (e) {
      /* ignore */
    }
    gzip.end();
    await finished.catch(() => {});
    try {
      fs.unlinkSync(tmpFile);
    } catch (e) {
      /* ignore */
    }
    await client.end();
    throw err;
  }

  gzip.end();
  await finished;
  await client.end();

  fs.renameSync(tmpFile, outFile);
  const { size } = fs.statSync(outFile);
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

  const { kept, deleted } = rotateBackups(orgCfg.filePrefix);

  const summaryLine = `[${orgCfg.label}] OK ${path.basename(outFile)} ${size}bytes ${elapsedSec}s tables=${tableSummary.length} kept=${kept.length} deleted=${deleted.length}`;
  appendLog(summaryLine);
  console.log(summaryLine);
  console.log(`[${orgCfg.label}] Row counts:`, tableSummary.join(', '));
  if (deleted.length) console.log(`[${orgCfg.label}] Rotated away:`, deleted.join(', '));
}

// ---------------------------------------------------------------------------
// Main: org1 then org2, independently. org1 missing entirely is a hard
// failure (same as always); org2 missing is a skip, not an error.
// ---------------------------------------------------------------------------
async function main() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  let hadFailure = false;

  for (const orgCfg of ORGS) {
    let dbUrl;
    try {
      dbUrl = resolveOrgUrl(orgCfg);
    } catch (e) {
      if (orgCfg.required) {
        console.error(
          `[${orgCfg.label}] No database URL found (checked ${orgCfg.overrideEnv}, PROD_DATABASE_URL, DATABASE_URL).`
        );
        process.exit(1);
      }
      const msg = `SKIPPED no database URL configured (checked ${orgCfg.overrideEnv}, PROD_DATABASE_URL_ORG2, DATABASE_URL_ORG2) - see BACKUPS.md.`;
      console.log(`[${orgCfg.label}] ${msg}`);
      appendLog(`[${orgCfg.label}] ${msg}`);
      continue;
    }

    try {
      await dumpOrg(orgCfg, dbUrl);
    } catch (err) {
      hadFailure = true;
      console.error(`[${orgCfg.label}] Backup failed:`, err);
      appendLog(`[${orgCfg.label}] FAILED ${err.message}`);
      if (orgCfg.required) {
        // org1 failing is treated the same as before: stop the whole run.
        process.exit(1);
      }
      // org2 failing does not affect org1's already-completed backup.
    }
  }

  if (hadFailure) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  appendLog(`FAILED ${err.message}`);
  process.exit(1);
});
