// refresh_local_from_prod.js
// Pulls new/updated rows from the PROD Postgres DB into the local SQLite backup DB
// (prisma/gemach-local.db) used by offline mode (הפעל_מערכת_אופליין.bat).
//
// This replaces the PULL half of the old bidirectional offline-sync.js engine that was
// deleted in commit c05ff99 (2026-07-26). The PUSH half (offline-written rows back to
// Postgres) is handled separately by lib/offlineSync.js, which runs automatically on
// normal (online) server startup — so this script deliberately only pulls.
//
// Delta strategy: per model, take MAX(updatedAt) already in the local DB and pull cloud
// rows newer than that (minus a 1-hour overlap; upserts are idempotent so overlap is
// safe). No state file needed — the local DB itself is the state. Department (no
// timestamps) is small and fully re-pulled every run. Rows hard-deleted in prod are NOT
// removed locally (the app uses soft-delete/isDeleted almost everywhere, so this rarely
// matters).
//
// Usage:  node scripts/refresh_local_from_prod.js
// Requires @prisma/local-client to be generated first: npm run generate:offline
//
// Run this periodically while online (or before an expected outage) so the offline
// backup server has fresh data.

const path = require('path');
const fs = require('fs');

// dotenv isn't installed in this repo — parse .env by hand like the values it holds:
// KEY="value" or KEY=value, # comments ignored.
function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const root = path.join(__dirname, '..');
const env = { ...loadEnv(path.join(root, '.env')), ...loadEnv(path.join(root, '.env.local')) };

const prodUrl = env.PROD_DATABASE_URL || env.DATABASE_URL;
if (!prodUrl) {
  console.error('Missing PROD_DATABASE_URL / DATABASE_URL in .env');
  process.exit(1);
}

// Absolute path so the script works regardless of cwd; matches the app's SQLITE_URL
// ("file:./gemach-local.db", resolved relative to prisma/).
const sqliteUrl = 'file:' + path.join(root, 'prisma', 'gemach-local.db').replace(/\\/g, '/');

const { PrismaClient: PostgresClient } = require('@prisma/client');
let LocalClient;
try {
  LocalClient = require('@prisma/local-client').PrismaClient;
} catch (e) {
  console.error('@prisma/local-client is not generated. Run: npm run generate:offline');
  process.exit(1);
}

const cloud = new PostgresClient({ datasourceUrl: prodUrl });
const local = new LocalClient({ datasources: { db: { url: sqliteUrl } } });

// FK-safe order: parents before children.
const MODELS = [
  { name: 'department', delta: null },            // no timestamps — always full pull (tiny table)
  { name: 'employee', delta: 'updatedAt' },
  // upsert by `key` (not id): the old local snapshot holds the same settings under
  // different ids, so id-based upserts explode on the unique key constraint.
  { name: 'systemSetting', delta: 'updatedAt', uniqueBy: 'key' },
  { name: 'priceList', delta: 'updatedAt' },
  { name: 'priceRule', delta: 'updatedAt' },
  { name: 'dressModel', delta: 'updatedAt' },
  { name: 'dressItem', delta: 'updatedAt' },
  { name: 'customer', delta: 'updatedAt' },
  { name: 'order', delta: 'updatedAt' },
  { name: 'orderItem', delta: 'updatedAt' },
  { name: 'payment', delta: 'updatedAt' },
  { name: 'paymentObligation', delta: 'updatedAt' },
  { name: 'refund', delta: 'updatedAt' },
  { name: 'shift', delta: 'updatedAt' },
  { name: 'notification', delta: 'updatedAt' },
  { name: 'notificationTag', delta: 'updatedAt' },
  { name: 'aIChatSession', delta: 'updatedAt' },
  { name: 'errorReport', delta: 'updatedAt' },
  { name: 'errorReportReply', delta: 'createdAt' }, // append-only, has no updatedAt
  { name: 'auditLog', delta: 'updatedAt' },
  { name: 'pageVisitLog', delta: 'updatedAt' },
  { name: 'emailLog', delta: 'updatedAt' },
  { name: 'queryLog', delta: 'updatedAt' },
];

const OVERLAP_MS = 60 * 60 * 1000; // re-pull the last hour to absorb clock skew; upserts make it harmless
const PAGE = 1000;

// --full=payment,refund forces a full (non-delta) pull for those models. Needed when a
// previous run died mid-model: rows are pulled in id order, so a partial pull can leave
// the local MAX(updatedAt) watermark ahead of rows that were never copied.
const FULL_MODELS = new Set(
  (process.argv.find(a => a.startsWith('--full=')) || '').replace('--full=', '').split(',').filter(Boolean)
);

// Cloud reads go over the network to Neon, which can drop a connection mid-run
// (the first full run died exactly this way after ~50 min). Retry with backoff.
async function cloudRead(fn, tries = 4) {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= tries) throw e;
      console.warn(`  cloud read failed (attempt ${i}/${tries}), retrying in ${i * 5}s: ${e.message.split('\n').pop()}`);
      await new Promise(r => setTimeout(r, i * 5000));
    }
  }
}

async function upsertRow(name, uniqueBy, row) {
  const where = uniqueBy ? { [uniqueBy]: row[uniqueBy] } : { id: row.id };
  try {
    await local[name].upsert({ where, update: row, create: row });
  } catch (e) {
    // Stale local snapshot rows can hold the same unique value (legacyId etc.) under a
    // DIFFERENT id — e.g. Payment.legacyId rows that were re-keyed in prod after the
    // Access-import collision fix. The prod row is the truth: evict the stale local row
    // and retry once.
    const fields = (e.meta && e.meta.target) || [];
    if (e.code === 'P2002' && fields.length) {
      await local[name].deleteMany({
        where: { AND: [{ [fields[0]]: row[fields[0]] }, { NOT: { id: row.id } }] },
      });
      await local[name].upsert({ where, update: row, create: row });
      return;
    }
    throw e;
  }
}

async function refreshModel({ name, delta, uniqueBy }) {
  let where;
  if (delta && !FULL_MODELS.has(name)) {
    const agg = await local[name].aggregate({ _max: { [delta]: true } });
    const localMax = agg._max[delta];
    where = localMax ? { [delta]: { gt: new Date(localMax.getTime() - OVERLAP_MS) } } : undefined;
  }

  const total = await cloudRead(() => cloud[name].count({ where }));
  if (total === 0) { console.log(`${name}: up to date`); return { name, pulled: 0, errors: 0 }; }

  let pulled = 0, errors = 0, cursor;
  // Cursor pagination on id (stable even while rows keep changing mid-run).
  for (;;) {
    const rows = await cloudRead(() => cloud[name].findMany({
      where,
      orderBy: { id: 'asc' },
      take: PAGE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }));
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;

    // Fast path: the whole page in one SQLite transaction (~50x fewer commits).
    // On any failure, redo the page row-by-row so one bad row doesn't sink the rest.
    try {
      await local.$transaction(rows.map(row => {
        const w = uniqueBy ? { [uniqueBy]: row[uniqueBy] } : { id: row.id };
        return local[name].upsert({ where: w, update: row, create: row });
      }));
      pulled += rows.length;
    } catch (chunkErr) {
      for (const row of rows) {
        try {
          await upsertRow(name, uniqueBy, row);
          pulled++;
        } catch (e) {
          errors++;
          if (errors <= 3) console.warn(`  ${name} ${row.id}: ${e.message.split('\n').pop()}`);
        }
      }
    }
    process.stdout.write(`\r${name}: ${pulled}/${total}${errors ? ` (${errors} errors)` : ''}   `);
    if (rows.length < PAGE) break;
  }
  console.log(`\r${name}: ${pulled}/${total} pulled${errors ? `, ${errors} ERRORS` : ''}     `);
  return { name, pulled, errors };
}

(async () => {
  console.log(`Refreshing local SQLite (${sqliteUrl}) from PROD...`);
  const started = Date.now();
  let totalPulled = 0, totalErrors = 0;
  for (const m of MODELS) {
    try {
      const r = await refreshModel(m);
      totalPulled += r.pulled; totalErrors += r.errors;
    } catch (e) {
      totalErrors++;
      console.error(`${m.name}: FAILED — ${e.message.split('\n').pop()}`);
    }
  }
  console.log(`\nDone in ${Math.round((Date.now() - started) / 1000)}s: ${totalPulled} rows pulled, ${totalErrors} errors.`);
  await cloud.$disconnect();
  await local.$disconnect();
  process.exit(totalErrors ? 1 : 0);
})();
