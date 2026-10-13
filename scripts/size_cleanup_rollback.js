#!/usr/bin/env node
/**
 * size_cleanup_rollback.js - undoes scripts/size_cleanup_apply.js from its backup JSON (Neve Yaakov only).
 *
 * Dry-run by default: classifies every row of the backup against the live DB
 *   WOULD_RESTORE     the row still has exactly the values the clean-up wrote (compare-and-swap will match)
 *   ALREADY_RESTORED  the row already has its "before" values (a repeat run is a no-op)
 *   CONFLICT          the row has neither (someone edited it after the clean-up) -> it is NOT touched; with --write the whole
 *                     rollback aborts unless you pass --skip-conflicts
 * --write needs --expect-host=<prefix> and --i-know-this-is-prod, one transaction, every UPDATE guarded by the "after" values.
 * Same host policy as the apply script (Neve prod only for writes, main gemach always refused). Does not touch OrderItem or AuditLog.
 *
 * Usage:
 *   node scripts/size_cleanup_rollback.js <backup.json> --env scratch/new_gemach_db.env --var PROD_DATABASE_URL --expect-host=ep-young-math
 *   ... add --write --i-know-this-is-prod [--skip-conflicts] to apply
 */
'use strict';

const fs = require('fs');
const { checkHost, makeArgs, readEnvVar, connect } = require('./size_cleanup_apply.js');

const RESTORE_SIZE = `UPDATE "DressItem" SET "sizeText" = $2, "updatedAt" = $4 WHERE id = $1 AND "sizeText" = $3`;
const RESTORE_FLAG = `UPDATE "DressItem" SET "notInUse" = false, "notInUseSince" = $2, "notInUseReason" = $5, "updatedAt" = $4 WHERE id = $1 AND "notInUse" = true AND "notInUseReason" = $3`;
const SELECT_ROWS = `SELECT id, "sizeText", "notInUse", "notInUseReason", "notInUseSince"::text AS "notInUseSince" FROM "DressItem" WHERE id = ANY($1)`;

function classify(row, cur) {
  if (!cur) return 'CONFLICT';
  const b = row.before, a = row.after;
  if (row.kind === 'DECIMAL_NOT_IN_USE') {
    if (cur.notInUse === true && (cur.notInUseReason ?? null) === a.notInUseReason) return 'WOULD_RESTORE';
    if (cur.notInUse === b.notInUse && (cur.notInUseReason ?? null) === (b.notInUseReason ?? null)) return 'ALREADY_RESTORED';
    return 'CONFLICT';
  }
  if (cur.sizeText === a.sizeText) return 'WOULD_RESTORE';
  if (cur.sizeText === b.sizeText) return 'ALREADY_RESTORED';
  return 'CONFLICT';
}

/** client = connected pg client (or the test fake). opts: { write, skipConflicts, host, log, now } */
async function rollback(client, backup, opts = {}) {
  const log = opts.log || console.log;
  if (backup.format !== 'size-cleanup-backup/1') throw new Error('Not a size-cleanup backup file.');
  if (opts.host && backup.host && backup.host !== opts.host) throw new Error(`Backup was taken on ${backup.host}, but you are connected to ${opts.host}.`);
  const write = !!opts.write;
  await client.query(write ? 'BEGIN' : 'BEGIN READ ONLY');
  try {
    const cur = new Map((await client.query(SELECT_ROWS, [backup.rows.map((r) => r.id)])).rows.map((r) => [r.id, r]));
    const tally = {};
    const todo = [];
    for (const row of backup.rows) {
      const st = classify(row, cur.get(row.id));
      tally[st] = (tally[st] || 0) + 1;
      log(`${st.padEnd(16)} ${row.kind.padEnd(18)} model ${String(row.model).padEnd(5)} barcode ${row.barcode}`);
      if (st === 'WOULD_RESTORE') todo.push(row);
      if (st === 'CONFLICT' && write && !opts.skipConflicts) throw new Error(`Conflict on item ${row.id} (barcode ${row.barcode}): edited after the clean-up. Nothing was changed. Use --skip-conflicts to restore the rest.`);
    }
    log('Summary: ' + JSON.stringify(tally));
    if (!write) { await client.query('ROLLBACK'); return { tally, restored: 0 }; }
    const nowIso = (opts.now || new Date()).toISOString();
    let restored = 0;
    for (const row of todo) {
      const res = row.kind === 'DECIMAL_NOT_IN_USE'
        ? await client.query(RESTORE_FLAG, [row.id, row.before.notInUseSince, row.after.notInUseReason, nowIso, row.before.notInUseReason])
        : await client.query(RESTORE_SIZE, [row.id, row.before.sizeText, row.after.sizeText, nowIso]);
      if (res.rowCount !== 1) throw new Error(`Compare-and-swap failed for item ${row.id}: rowCount=${res.rowCount}. Rolled back.`);
      restored++;
    }
    await client.query('COMMIT');
    log(`COMMITTED rollback of ${restored} row(s).`);
    return { tally, restored };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw e;
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const a = makeArgs(argv);
  const file = argv.find((x) => !x.startsWith('--') && /\.json$/i.test(x));
  if (!file) throw new Error('Usage: size_cleanup_rollback.js <backup.json> --env <file> --var <NAME> --expect-host=<prefix> [--write --i-know-this-is-prod]');
  const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  const url = readEnvVar(a.get('--env', '.env'), a.get('--var', 'DATABASE_URL'));
  if (!url) throw new Error('No database URL in the env file');
  const host = new URL(url.replace(/^postgres(ql)?:/, 'http:')).hostname;
  const pol = checkHost(host, a.get('--expect-host'));
  const write = a.has('--write');
  if (write) {
    if (!pol.allowWrite) throw new Error('This host is dry-run only.');
    if (!a.has('--i-know-this-is-prod')) throw new Error('--write needs --i-know-this-is-prod.');
  }
  if (backup.status === 'pending') console.log('NOTE: backup status is "pending" (the apply run did not report a commit). Compare-and-swap protects the rows either way.');
  const client = await connect(url);
  try { await rollback(client, backup, { write, host, skipConflicts: a.has('--skip-conflicts') }); if (!write) console.log('\nDRY RUN - nothing was written.'); }
  finally { await client.end(); }
}

module.exports = { rollback, classify, RESTORE_SIZE, RESTORE_FLAG };
if (require.main === module) main().catch((e) => { console.error(e.message || e); process.exit(1); });
