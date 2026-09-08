// Reconciles rows written to the local SQLite fallback (prisma/schema.local.prisma,
// loaded when IS_OFFLINE_MODE=true - see app/lib/prisma.js) back into the real
// Postgres database once the app has internet access again.
//
// Design (deliberately simple - this is a small gemach's internal tool, not a
// distributed system):
//   - Both the local SQLite schema and the Postgres schema use the same UUID `id`
//     values (both use `@default(uuid())`), so a row created offline already has
//     the exact id it needs in Postgres. That makes "sync" just an idempotent
//     upsert-by-id - no separate outbox table, no id remapping.
//   - Every synced model has an `updatedAt @updatedAt` column in both schemas, so
//     "what changed while offline" is answered by comparing against a per-model
//     cursor (the timestamp of the newest row synced so far), persisted to a small
//     JSON file (see DEFAULT_STATE_PATH).
//   - Models are synced in FK-safe order (parents before children) so an upsert
//     never references a row that doesn't exist in Postgres yet.
//   - Conflicts are resolved last-write-wins BY TIMESTAMP: the cloud row's own
//     `updatedAt` is checked before every upsert, and the local row only overwrites
//     it when the cloud row doesn't exist yet or is genuinely older. If the cloud
//     row was edited more recently than the offline copy, the cloud version wins
//     and the local row is skipped (logged, not applied) - the offline edit is lost
//     in that case, but only when it is actually the older of the two.
//   - Every applied row also gets a manual AuditLog entry (upsert() bypasses the
//     app's own audit-logging extension - see the note on that call below), so a
//     synced change is visible in the entity's own in-app history, not just server
//     console logs.
//
// This file is framework-agnostic (no Next.js imports) so it can be exercised from
// a plain Node script - see scratch/ for the verification scripts used while
// building this.

import fs from 'fs';
import path from 'path';

// Parents-before-children order, so FK columns (customerId, orderId, dressItemId,
// dressModelId, orderItemId, paymentId, employeeId...) always resolve.
export const SYNCED_MODELS = [
  'employee',
  'customer',
  'dressModel',
  'dressItem',
  'order',
  'orderItem',
  'payment',
  'paymentObligation',
];

export const DEFAULT_STATE_PATH = path.join(process.cwd(), 'sync_state.json');

// The distant epoch used as "since" for a model that has never been synced before,
// so the very first run picks up everything currently in the local DB.
const EPOCH = new Date(0).toISOString();

// Prisma model accessors are camelCase ('dressModel'); AuditLog's own entityType
// convention (set by the app's query extension, see app/lib/prisma.js) uses the
// PascalCase model name ('DressModel') - match it so this shows up consistently
// alongside normal in-app edits in the same entity's history.
const entityTypeFor = (model) => model.charAt(0).toUpperCase() + model.slice(1);

const normalize = (v) => (v instanceof Date ? v.toISOString() : v);

function buildUpdateDiff(before, after) {
  const diff = {};
  for (const key of Object.keys(after)) {
    if (key === 'id') continue;
    const from = before ? normalize(before[key]) : null;
    const to = normalize(after[key]);
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      diff[key] = { from, to };
    }
  }
  return diff;
}

export function loadSyncState(statePath = DEFAULT_STATE_PATH) {
  try {
    const raw = fs.readFileSync(statePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

export function saveSyncState(state, statePath = DEFAULT_STATE_PATH) {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

/**
 * Syncs every row of `model` whose `updatedAt` is newer than the saved cursor from
 * the local (SQLite) client to the cloud (Postgres) client, via upsert-by-id.
 *
 * @param {string} model - Prisma model accessor name, e.g. 'customer'
 * @param {object} localClient - a @prisma/local-client PrismaClient instance
 * @param {object} cloudClient - a @prisma/client PrismaClient instance
 * @param {string} since - ISO timestamp cursor; rows with updatedAt <= since are skipped
 * @param {(msg: string) => void} log
 */
export async function syncModel(model, localClient, cloudClient, since, log = () => {}) {
  const sinceDate = new Date(since);
  const rows = await localClient[model].findMany({
    where: { updatedAt: { gt: sinceDate } },
    orderBy: { updatedAt: 'asc' },
  });

  let synced = 0;
  let skipped = 0;
  let failed = 0;
  let newestSeen = sinceDate;

  for (const row of rows) {
    try {
      const { id, ...data } = row;

      // True last-write-wins: only overwrite the cloud row if it doesn't exist yet,
      // or is genuinely older than the offline-collected row. Otherwise the cloud
      // edit is the newer one and must be kept - skip this row rather than clobber it.
      const cloudRow = await cloudClient[model].findUnique({ where: { id } });
      if (cloudRow && cloudRow.updatedAt >= row.updatedAt) {
        skipped++;
        log(`[offline-sync] skipped ${model} ${row.id}: cloud row is newer or equal (cloud=${cloudRow.updatedAt.toISOString()}, local=${row.updatedAt.toISOString()})`);
        continue;
      }

      await cloudClient[model].upsert({
        where: { id },
        create: { id, ...data },
        update: data,
      });
      synced++;

      // upsert() isn't one of the operations the app's own audit-logging query
      // extension recognizes ('create'/'update'/'delete', not 'upsert'), so it never
      // gets an AuditLog row automatically - write one explicitly here so a synced
      // change is visible in the entity's own history, not just this console log.
      try {
        const diff = cloudRow ? buildUpdateDiff(cloudRow, row) : null;
        await cloudClient.auditLog.create({
          data: {
            entityType: entityTypeFor(model),
            entityId: id,
            action: cloudRow ? 'UPDATE' : 'CREATE',
            changesJson: JSON.stringify(
              cloudRow
                ? { ...diff, note: 'Synced from offline SQLite (last-write-wins: local row was newer).' }
                : { ...data, note: 'Created from offline SQLite sync.' }
            ),
            employeeId: null,
          },
        });
      } catch (auditErr) {
        log(`[offline-sync] WARNING: synced ${model} ${row.id} but failed to write its AuditLog entry: ${auditErr.message}`);
      }
    } catch (err) {
      failed++;
      // A *failed* upsert (FK violation, unique constraint clash, etc.) is not the
      // same as "lost a conflict" - it means the row was NOT written to Postgres at
      // all, so it's logged loudly and the cursor is not advanced past it (see below)
      // so it's retried on the next run.
      log(`[offline-sync] FAILED to sync ${model} ${row.id}: ${err.message}`);
    }
    if (row.updatedAt > newestSeen) newestSeen = row.updatedAt;
  }

  if (synced > 0 || skipped > 0) {
    log(`[offline-sync] ${model}: synced ${synced}/${rows.length} row(s) to Postgres (${skipped} skipped - cloud newer)`);
  }

  return {
    model,
    total: rows.length,
    synced,
    skipped,
    failed,
    // Only advance the cursor if nothing failed - a failed row would otherwise be
    // skipped forever since its updatedAt is now "in the past" relative to the cursor.
    newCursor: failed === 0 ? newestSeen.toISOString() : since,
  };
}

/**
 * Runs a full offline->cloud reconciliation pass across SYNCED_MODELS (or a custom
 * subset), advancing and persisting the sync cursor as it goes.
 *
 * Safe to call repeatedly / on every server start - if there is nothing new locally
 * since the last successful run, every model is a fast no-op (a single indexed query
 * each, no writes).
 */
export async function runOfflineSync({
  localClient,
  cloudClient,
  models = SYNCED_MODELS,
  statePath = DEFAULT_STATE_PATH,
  log = () => {},
} = {}) {
  if (!localClient || !cloudClient) {
    throw new Error('runOfflineSync requires both localClient and cloudClient');
  }

  const state = loadSyncState(statePath);
  const results = [];

  for (const model of models) {
    const since = state[model] || EPOCH;
    const result = await syncModel(model, localClient, cloudClient, since, log);
    results.push(result);
    state[model] = result.newCursor;
    // Persist after each model, not just once at the end - if a later model throws,
    // progress already made on earlier models must not be discarded (that would force
    // re-processing the same rows, and re-running the newer-wins check, on every
    // subsequent server start instead of just once).
    saveSyncState(state, statePath);
  }

  const totalSynced = results.reduce((sum, r) => sum + r.synced, 0);
  const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  return { results, totalSynced, totalSkipped, totalFailed };
}
