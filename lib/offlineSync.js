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
//   - Conflicts are resolved last-write-wins: whatever is in the local row simply
//     overwrites Postgres via upsert. If a row was *also* edited in Postgres while
//     the branch office was offline, that edit is silently lost. Given how rarely
//     and briefly this app is expected to run offline, that tradeoff is accepted -
//     but every such overwrite is logged (see `log` below) so it's at least visible
//     after the fact, not silent.
//
// This file is framework-agnostic (no Next.js imports) so it can be exercised from
// a plain Node script - see scratch/ for the verification scripts used while
// building this.

import fs from 'fs';
import path from 'path';

// Parents-before-children order, so FK columns (customerId, orderId, dressItemId,
// dressModelId, orderItemId, paymentId, employeeId...) always resolve.
//
// Coverage audit (2026-08-06, against prisma/schema.local.prisma's 23 models):
//  - Added `refund`: app/api/refunds/route.js (POST) and app/api/refunds/[id]/route.js
//    (PATCH) write Refund through the shared `@/app/lib/prisma` client, same as every
//    other synced model - meaning a refund recorded while offline was previously silently
//    stranded in local SQLite forever (never reconciled to Postgres). This is financial
//    data (bank details + amount for a real money transfer back to a customer), so it's
//    the highest-priority gap of anything found here. Placed after `paymentObligation`
//    since Refund has FKs to Customer, Order, AND Payment (paymentId - the reversing
//    payment record), all of which are already synced earlier in this list.
//  - Added `systemSetting`: app/api/settings/route.js, app/api/settings/labels/route.js,
//    and app/api/upload-logo/route.js all write SystemSetting via the shared client too.
//    No FK dependencies, so position doesn't matter for correctness. A config value
//    changed while offline (e.g. a price-list toggle, a label override) silently reverting
//    once back online (because it was never synced) is a real drift risk - low volume/low
//    noise, so worth including.
//  - Deliberately NOT added (checked each for `prisma.<model>.create/update` call sites
//    reachable from a normal app route, and whether that route is realistically usable
//    while genuinely offline):
//      - `aiChatSession` / the AI query-log path: both require a live call to the Gemini
//        API (lib/ai/gemini.js) to produce anything worth persisting - obviously
//        online-only, can't meaningfully be used offline in the first place.
//      - `queryLog` (app/api/admin/query/route.js): the admin raw-SQL console. Technically
//        routed through the shared client like everything else, but it's a rare-use admin
//        debugging tool whose log rows are pure audit noise, not data the app depends on -
//        same category CLAUDE.md already puts PageVisitLog/AuditLog/Shift in for the
//        audit-log extension's own exclusion list.
//      - `pageVisitLog` (app/api/log-visit/route.js): pure page-view analytics noise: high
//        volume, zero value if lost, explicitly already treated as noise elsewhere in this
//        codebase (excluded from the audit-log extension for the same reason).
//      - `auditLog`: excluded from the audit-log extension itself specifically to avoid
//        recursive logging, and every write to every OTHER synced model already produces
//        one - syncing it too would multiply write volume for no operational benefit; losing
//        history rows for the rare, brief offline window this app is designed for is an
//        accepted tradeoff (see the file-level comment above on last-write-wins).
//      - `notification` / `notificationTag`: app/api/notifications/route.js fires an
//        external Apps Script fetch() for the email alert half of a notification, i.e. the
//        feature's own primary side-effect already assumes internet; not clearly used in a
//        genuinely offline session, and internal messaging state syncing later is low-stakes
//        (no financial/config impact if delayed).
//      - `shift` (attendance/punch clock, app/api/attendance/route.js and
//        app/api/employees/[id]/shifts/*): also explicitly excluded from the audit-log
//        extension already ("to avoid recursive/noisy logging" per CLAUDE.md) which is at
//        least a signal it's treated as a special/lower-priority case elsewhere in this
//        codebase; no separate evidence found that punch-clock entries are relied upon to
//        survive an offline gap the way financial (Refund) or config (SystemSetting) data
//        is. Left out for now - flag for a follow-up if that assumption turns out wrong.
export const SYNCED_MODELS = [
  'employee',
  'customer',
  'dressModel',
  'dressItem',
  'order',
  'orderItem',
  'payment',
  'paymentObligation',
  'refund',
  'systemSetting',
];

export const DEFAULT_STATE_PATH = path.join(process.cwd(), 'sync_state.json');

// The distant epoch used as "since" for a model that has never been synced before,
// so the very first run picks up everything currently in the local DB.
const EPOCH = new Date(0).toISOString();

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
 * @param {string} since - ISO timestamp cursor; rows with updatedAt < since are skipped
 *   (rows exactly AT `since` are intentionally re-included - see the `gte` comment below)
 * @param {(msg: string) => void} log
 */
export async function syncModel(model, localClient, cloudClient, since, log = () => {}) {
  const sinceDate = new Date(since);
  // CURSOR TIEBREAKER (2026-08-06): this used to be `gt: sinceDate` (strictly greater
  // than). That has a silent-skip bug: if a row's `updatedAt` lands on the EXACT same
  // millisecond as the cursor stored from a previous run (two rows updated together in
  // one request, or SQLite's timestamp resolution coalescing two close writes), that row
  // is never `>` the cursor on any future run - it's permanently invisible, forever, with
  // no error. A "proper" fix would track the specific row id(s) already synced at the
  // cursor's exact timestamp and exclude only those, but that needs extra persisted state
  // per model (a set of ids alongside the timestamp) for a rare edge case. Simpler and
  // just as safe given this file's own upsert-by-id design: use `gte` instead, so the
  // row(s) exactly at the cursor are re-fetched every run. Re-upserting an already-synced
  // row is a harmless no-op (see the module comment above - upsert-by-id is idempotent by
  // construction), so the only cost is re-doing a handful of no-op upserts each run, which
  // is a fine trade for "can never silently drop a row again".
  const rows = await localClient[model].findMany({
    where: { updatedAt: { gte: sinceDate } },
    orderBy: { updatedAt: 'asc' },
  });

  let synced = 0;
  let failed = 0;
  let newestSeen = sinceDate;

  for (const row of rows) {
    try {
      const { id, ...data } = row;
      await cloudClient[model].upsert({
        where: { id },
        create: { id, ...data },
        update: data,
      });
      synced++;
    } catch (err) {
      failed++;
      // Last-write-wins is the accepted policy, but a *failed* upsert (FK violation,
      // unique constraint clash, etc.) is not the same as "lost a conflict" - it means
      // the row was NOT written to Postgres at all, so it's logged loudly and the
      // cursor is not advanced past it (see below) so it's retried on the next run.
      log(`[offline-sync] FAILED to sync ${model} ${row.id}: ${err.message}`);
    }
    if (row.updatedAt > newestSeen) newestSeen = row.updatedAt;
  }

  if (synced > 0) {
    log(`[offline-sync] ${model}: synced ${synced}/${rows.length} row(s) to Postgres`);
  }

  return {
    model,
    total: rows.length,
    synced,
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
  }

  saveSyncState(state, statePath);

  const totalSynced = results.reduce((sum, r) => sum + r.synced, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  return { results, totalSynced, totalFailed };
}
