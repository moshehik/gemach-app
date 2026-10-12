#!/usr/bin/env node
/**
 * size_cleanup_apply.js - owner-approved clean-up of irregular DressItem sizes, NEVE YAAKOV ONLY (12.10.2026).
 *
 * Approved actions (docs/sizes-access-audit.md):
 *   (12) SPACED    " 32", "  36"  -> trimmed ("32", "36")
 *        LETTERED  "36א".."36ד" -> "36", "  40א"/"40ב" -> "40", "42א" -> "42"   (digits only, letter dropped)
 *   (13) DECIMAL   "06.1", "00.5"... -> sizeText is NOT changed and NOT rounded; the item is only marked notInUse
 *                  (notInUse=true, notInUseSince=<run time>, notInUseReason=<text below>)
 * Nothing else: no OrderItem (history) is touched, nothing is deleted, no other column changes (besides updatedAt).
 *
 * The list of rows is computed at run time from the DB by fixed criteria (non-deleted DressItem whose MODEL is marked
 * exited from the repository - exitDateFromRepo is not null), and printed as a "what will change" table first.
 *
 * MODES
 *   dry-run (default): BEGIN READ ONLY, prints the table, writes nothing anywhere (optional --json-out <file>).
 *   --write           : needs --expect-host=<prefix>, --i-know-this-is-prod and --backup-dir=<dir>.
 *                       One transaction: SELECT ... FOR UPDATE -> plan -> backup JSON written + fsynced -> UPDATEs, each with a
 *                       compare-and-swap on the OLD value and required to touch exactly 1 row (else the whole transaction
 *                       rolls back) -> COMMIT. A second run finds nothing to do (idempotent).
 *
 * SAFETY
 *   - Writes are allowed ONLY on the Neve Yaakov prod host (ep-young-math). The main gemach (ep-weathered-tree) and every
 *     unknown host are refused outright. The TEST host (ep-fancy-pine) is allowed for dry-run only.
 *   - No AuditLog row is written: this is raw SQL, so the Prisma audit extension (app/lib/prisma.js, needs the Next runtime) does
 *     not see it, and we do not hand-write AuditLog rows. The backup JSON (before/after per row) is the change record.
 *
 * ROLLBACK: scripts/size_cleanup_rollback.js <backup file>  (dry-run by default).
 *
 * Usage:
 *   node scripts/size_cleanup_apply.js --env scratch/new_gemach_db.env --var PROD_DATABASE_URL --expect-host=ep-young-math
 *   node scripts/size_cleanup_apply.js --env scratch/new_gemach_db.env --var PROD_DATABASE_URL --expect-host=ep-young-math \
 *        --write --i-know-this-is-prod --backup-dir=C:\\path\\to\\backups
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------------------------------------------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------------------------------------------
const NEVE_PROD_HOST = 'ep-young-math';
const DRY_RUN_ONLY_HOSTS = ['ep-fancy-pine']; // the shared TEST database
const REFUSED_HOSTS = ['ep-weathered-tree']; // main gemach prod (checked first, even if someone lists it in --expect-host)
const NOT_IN_USE_REASON = 'דגם יצא מהמאגר - מידה עשרונית (ניקוי מידות 12.10.2026)';
const DEFAULT_MAX_CHANGES = 120; // the audit found 41 + 7 + 20 = 68; anything far above that means the criteria matched something unexpected

/** Returns { allowWrite } or throws with a readable reason. */
function checkHost(host, expectHost) {
  if (!expectHost) throw new Error('Refusing to run without --expect-host=<prefix>. The URL points at: ' + host);
  if (!host.includes(expectHost)) throw new Error(`Host mismatch: expected "${expectHost}" in "${host}".`);
  for (const bad of REFUSED_HOSTS) if (host.includes(bad) || expectHost.includes(bad)) throw new Error('Refusing to run on the main gemach database.');
  if (host.includes(NEVE_PROD_HOST)) return { allowWrite: true, label: 'neve-prod' };
  if (DRY_RUN_ONLY_HOSTS.some((h) => host.includes(h))) return { allowWrite: false, label: 'test' };
  throw new Error(`Unknown host "${host}": this script only runs against Neve Yaakov (${NEVE_PROD_HOST}).`);
}

// ---------------------------------------------------------------------------------------------------------------
// Pure planning (no DB)
// ---------------------------------------------------------------------------------------------------------------
const RE_SPACED = /^\s*\d{1,3}\s*$/;
const RE_LETTERED = /^\s*(\d{1,3})\s*[\u05d0-\u05ea]+\s*$/;
const RE_DECIMAL = /^\s*\d+[.,]\d*[1-9]\d*\s*$/; // a real fraction; "38.0" is not a decimal size and is left alone

/** One candidate row -> a change description or null. Row = { id, barcode, sizeText, notInUse, notInUseSince, notInUseReason, updatedAt, model, modelExit }. */
function planRow(r) {
  const v = r.sizeText;
  if (v == null) return null;
  if (!r.modelExit) return null; // only items of models that left the repository
  if (RE_SPACED.test(v)) {
    const to = v.trim();
    return to === v ? null : { kind: 'TRIM', fields: { sizeText: { before: v, after: to } } };
  }
  const m = RE_LETTERED.exec(v);
  if (m) return { kind: 'LETTER', fields: { sizeText: { before: v, after: m[1] } } };
  if (RE_DECIMAL.test(v)) {
    if (r.notInUse) return null; // already marked: nothing to do (idempotent)
    return { kind: 'DECIMAL_NOT_IN_USE', fields: { notInUse: { before: false, after: true }, notInUseReason: { before: r.notInUseReason ?? null, after: NOT_IN_USE_REASON } } };
  }
  return null;
}

/** Candidate rows -> deterministic plan object (no timestamps inside, so a dry-run and a real run print the identical JSON). */
function buildPlan(rows, { host, maxChanges = DEFAULT_MAX_CHANGES } = {}) {
  const changes = [];
  for (const r of rows) {
    const c = planRow(r);
    if (!c) continue;
    changes.push({ id: r.id, barcode: r.barcode, model: r.model, modelExit: r.modelExit, kind: c.kind, sizeTextBefore: r.sizeText, fields: c.fields });
  }
  changes.sort((a, b) => String(a.barcode).localeCompare(String(b.barcode)) || String(a.sizeTextBefore).localeCompare(String(b.sizeTextBefore)) || a.id.localeCompare(b.id));
  const summary = {};
  for (const c of changes) summary[c.kind] = (summary[c.kind] || 0) + 1;
  if (changes.length > maxChanges) throw new Error(`Plan has ${changes.length} changes, more than --max-changes=${maxChanges}. Aborting: the criteria matched more than the audit expected.`);
  const plan = { script: 'size_cleanup_apply', host: host || null, notInUseReason: NOT_IN_USE_REASON, summary, changes };
  plan.planHash = crypto.createHash('sha256').update(JSON.stringify({ summary, changes })).digest('hex');
  return plan;
}

// ---------------------------------------------------------------------------------------------------------------
// DB layer (works with a real pg Client or the in-memory fake used by the test)
// ---------------------------------------------------------------------------------------------------------------
const SELECT_CANDIDATES = `
  SELECT i.id, i."dressBarcode" AS barcode, i."sizeText" AS "sizeText", i."notInUse" AS "notInUse", i."notInUseSince"::text AS "notInUseSince",
         i."notInUseReason" AS "notInUseReason", i."updatedAt"::text AS "updatedAt", m."name" AS model,
         to_char(m."exitDateFromRepo" AT TIME ZONE 'Asia/Jerusalem', 'YYYY-MM-DD') AS "modelExit"
  FROM "DressItem" i JOIN "DressModel" m ON m.id = i."dressModelId"
  WHERE i."isDeleted" = false AND m."exitDateFromRepo" IS NOT NULL AND i."sizeText" IS NOT NULL
    AND i."sizeText" !~ '^[0-9]{1,3}$'`;

const UPDATE_SIZE = `UPDATE "DressItem" SET "sizeText" = $2, "updatedAt" = $4 WHERE id = $1 AND "sizeText" = $3 AND "isDeleted" = false`;
const UPDATE_FLAG = `UPDATE "DressItem" SET "notInUse" = true, "notInUseSince" = $4, "notInUseReason" = $2, "updatedAt" = $4 WHERE id = $1 AND "notInUse" = false AND "sizeText" = $3 AND "isDeleted" = false`;

async function loadCandidates(client, { lock }) {
  return (await client.query(SELECT_CANDIDATES + (lock ? ' FOR UPDATE OF i' : ''))).rows;
}

function printTable(plan, log = console.log) {
  log(`Host: ${plan.host}`);
  log('Summary: ' + JSON.stringify(plan.summary) + `  planHash=${plan.planHash.slice(0, 12)}`);
  for (const c of plan.changes) {
    const what = c.kind === 'DECIMAL_NOT_IN_USE'
      ? `sizeText ${JSON.stringify(c.sizeTextBefore)} unchanged; notInUse false -> true`
      : `sizeText ${JSON.stringify(c.fields.sizeText.before)} -> ${JSON.stringify(c.fields.sizeText.after)}`;
    log(`${c.kind.padEnd(18)} model ${String(c.model).padEnd(5)} (exit ${c.modelExit}) barcode ${c.barcode}  ${what}`);
  }
  if (!plan.changes.length) log('Nothing to change.');
}

/**
 * Runs the whole thing on an already-connected client.
 * opts: { write, host, runAt: Date, backupDir, backupWriter(file, text), maxChanges, log }
 * Returns { plan, applied, backupFile }.
 */
async function run(client, opts) {
  const log = opts.log || console.log;
  const write = !!opts.write;
  await client.query(write ? 'BEGIN' : 'BEGIN READ ONLY');
  let backupFile = null;
  try {
    const rows = await loadCandidates(client, { lock: write });
    const plan = buildPlan(rows, { host: opts.host, maxChanges: opts.maxChanges });
    printTable(plan, log);
    if (!write) { await client.query('ROLLBACK'); return { plan, applied: 0, backupFile: null }; }
    if (!plan.changes.length) { await client.query('ROLLBACK'); return { plan, applied: 0, backupFile: null }; }

    const runAt = opts.runAt || new Date();
    const runAtIso = runAt.toISOString();
    const byId = new Map(rows.map((r) => [r.id, r]));
    const backup = {
      format: 'size-cleanup-backup/1', status: 'pending', host: opts.host, runAt: runAtIso, plan,
      rows: plan.changes.map((c) => {
        const r = byId.get(c.id);
        const before = { sizeText: r.sizeText, notInUse: r.notInUse, notInUseSince: r.notInUseSince ?? null, notInUseReason: r.notInUseReason ?? null, updatedAt: r.updatedAt ?? null };
        const after = { ...before };
        for (const [k, f] of Object.entries(c.fields)) after[k] = f.after;
        if (c.kind === 'DECIMAL_NOT_IN_USE') after.notInUseSince = runAtIso;
        after.updatedAt = runAtIso;
        return { id: c.id, barcode: c.barcode, model: c.model, kind: c.kind, before, after };
      }),
    };
    backupFile = opts.backupWriter(backup); // must persist BEFORE the first UPDATE; throws if it cannot
    let applied = 0;
    for (const c of plan.changes) {
      const res = c.kind === 'DECIMAL_NOT_IN_USE'
        ? await client.query(UPDATE_FLAG, [c.id, NOT_IN_USE_REASON, c.sizeTextBefore, runAtIso])
        : await client.query(UPDATE_SIZE, [c.id, c.fields.sizeText.after, c.fields.sizeText.before, runAtIso]);
      if (res.rowCount !== 1) throw new Error(`Compare-and-swap failed for item ${c.id} (barcode ${c.barcode}): rowCount=${res.rowCount}. Rolling the whole transaction back.`);
      applied++;
    }
    await client.query('COMMIT');
    if (opts.backupFinalizer) opts.backupFinalizer(backupFile, backup);
    log(`COMMITTED ${applied} change(s). Backup: ${backupFile}`);
    return { plan, applied, backupFile };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw e;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// CLI helpers (shared with size_cleanup_rollback.js)
// ---------------------------------------------------------------------------------------------------------------
function makeArgs(argv) {
  const get = (name, def = null) => {
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === name) return argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def;
      if (argv[i].startsWith(name + '=')) return argv[i].slice(name.length + 1);
    }
    return def;
  };
  return { get, has: (name) => argv.some((a) => a === name || a.startsWith(name + '=')) };
}

function readEnvVar(file, name) {
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = raw.trim().match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && m[1] === name) return m[2].trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

async function connect(url) {
  const { Client } = require('pg'); // lazy: the unit test never needs it
  for (let i = 0; i < 12; i++) {
    const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 30000 });
    try { await c.connect(); return c; } catch (e) { console.error(`connect retry ${i + 1}: ${e.code || e.message}`); await new Promise((r) => setTimeout(r, 8000)); }
  }
  throw new Error('Could not connect');
}

function writeBackupFile(dir, host, runAtIso) {
  fs.mkdirSync(dir, { recursive: true });
  const safeHost = host.split('.')[0];
  const file = path.join(dir, `size_cleanup_${safeHost}_${runAtIso.replace(/[:.]/g, '-')}.json`);
  return (backup) => {
    const fd = fs.openSync(file, 'wx'); // never overwrite an existing backup
    try { fs.writeSync(fd, JSON.stringify(backup, null, 2)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    return file;
  };
}

async function main() {
  const a = makeArgs(process.argv.slice(2));
  const envFile = a.get('--env', '.env');
  const varName = a.get('--var', 'DATABASE_URL');
  const write = a.has('--write');
  const url = readEnvVar(envFile, varName);
  if (!url) throw new Error(`No ${varName} in ${envFile}`);
  const host = new URL(url.replace(/^postgres(ql)?:/, 'http:')).hostname;
  const pol = checkHost(host, a.get('--expect-host'));
  if (write) {
    if (!pol.allowWrite) throw new Error('This host is dry-run only. Writes are allowed on Neve Yaakov prod only.');
    if (!a.has('--i-know-this-is-prod')) throw new Error('--write needs --i-know-this-is-prod (this is the production database).');
    if (!a.get('--backup-dir')) throw new Error('--write needs --backup-dir=<directory> for the rollback backup file.');
  }
  const maxChanges = parseInt(a.get('--max-changes', String(DEFAULT_MAX_CHANGES)), 10);
  const runAt = new Date();
  const client = await connect(url);
  try {
    const res = await run(client, {
      write, host, runAt, maxChanges,
      backupWriter: write ? writeBackupFile(a.get('--backup-dir'), host, runAt.toISOString()) : null,
      backupFinalizer: (file, backup) => { backup.status = 'committed'; fs.writeFileSync(file, JSON.stringify(backup, null, 2)); },
    });
    if (!write) console.log('\nDRY RUN - nothing was written. Re-run with --write --i-know-this-is-prod --backup-dir=<dir> to apply.');
    const jsonOut = a.get('--json-out');
    if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(res.plan, null, 2));
  } finally { await client.end(); }
}

module.exports = { writeBackupFile, checkHost, planRow, buildPlan, run, makeArgs, readEnvVar, connect, NOT_IN_USE_REASON, NEVE_PROD_HOST, SELECT_CANDIDATES, UPDATE_SIZE, UPDATE_FLAG, DEFAULT_MAX_CHANGES };

if (require.main === module) main().catch((e) => { console.error(e.message || e); process.exit(1); });
