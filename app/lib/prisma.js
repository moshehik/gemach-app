import { PrismaClient as CloudClient } from '@prisma/client';

let PrismaClient = CloudClient;
if (process.env.IS_OFFLINE_MODE === 'true') {
  try {
    const local = require(/* webpackIgnore: true */ '@prisma/local-client');
    if (local && local.PrismaClient) PrismaClient = local.PrismaClient;
  } catch (e) {
    // @prisma/local-client is generated on demand (`npm run generate:offline`), it isn't
    // committed and isn't part of the normal `npm run build`. Without it this silently
    // falls back to the Postgres client below, which is indistinguishable from "online"
    // until a query actually times out - so make the fallback loud instead of silent.
    console.error(
      "[offline-mode] IS_OFFLINE_MODE=true but @prisma/local-client isn't built - " +
      "falling back to the Postgres client, which will hang/fail with no internet. " +
      "Run `npm run generate:offline` (needs SQLITE_URL in .env) and restart. Original error:",
      e.message
    );
  }
}
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { runOfflineSync } from '@/lib/offlineSync';

// Tracks the active interactive-transaction client (if any) for the current
// async execution context, so writes made inside `prisma.$transaction(async tx => ...)`
// can route their audit-log insert through the SAME transaction/connection instead of
// a separate one racing against it (which previously extended lock hold time and could
// leave orphaned audit rows if the transaction rolled back).
//
// ה-storage מוחזק על globalThis ולא כמשתנה מודול: Next מרכיב כל ראוט כבאנדל נפרד, ולכן
// ייתכנו כמה עותקים של הקובץ הזה בזיכרון, בעוד הלקוח עצמו משותף (נשמר על globalThis למטה).
const txStorage = globalThis.__prismaTxStorage || (globalThis.__prismaTxStorage = new AsyncLocalStorage());

/**
 * מוסיף לקריאת Prisma רגילה תיאור מפורש לרישום ההיסטוריה, למשל:
 *
 *   prisma.orderItem.update(auditAs('CANCEL_RENTAL', { where, data }, changes))
 *
 * בלי זה כל כתיבה נרשמת כ-CREATE/UPDATE/DELETE גנרי, ופעולות משמעותיות (ביטול השכרה,
 * ביטול החזרה, ביטול פריט) נראות בהיסטוריה כ"עדכון" סתמי. המפתח __audit מוסר מהארגומנטים
 * בתוך התוסף לפני שהם מגיעים למנוע, ולכן Prisma עצמו לעולם לא רואה אותו.
 *
 * העברת הנתון דרך הארגומנטים (ולא דרך AsyncLocalStorage) היא מכוונת: הקשר ה-async
 * לא שורד את שרשרת הקריאות הפנימית של Prisma, כך שהתוסף פשוט לא היה רואה אותו.
 *
 * action ריק מחזיר את הארגומנטים כמו שהם (רישום גנרי), כדי שקורא שמתייג רק חלק
 * מהמקרים — למשל רק מחיקה או שחזור של פריט — לא יצטרך להתפצל לשני מסלולי קוד.
 *
 * @param {string|null} action שם הפעולה ביומן (למשל 'CANCEL_RENTAL')
 * @param {object} args ארגומנטים רגילים של Prisma
 * @param {object} [changes] פירוט השינוי (from/to) במקום ערכי ה-data בלבד
 */
export function auditAs(action, args, changes) {
  if (!action) return args;
  return { ...args, __audit: { action, changes } };
}

/**
 * מזהה העובד המבצע, מתוך עוגיית auth_token. מיוצא כדי שראוטים שכותבים שורות יומן
 * בעצמם (updateMany, שאינו עובר דרך התוסף) ירשמו גם הם מי ביצע את הפעולה.
 */
export async function getActingEmployeeId() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    if (token.includes('.')) {
      try {
        const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        return decoded.id || decoded.employeeId || null;
      } catch (e) {
        return null;
      }
    }
    return token;
  } catch (e) {
    return null;
  }
}

const createPrismaClient = (url) => {
  const baseClient = (url && process.env.IS_OFFLINE_MODE !== 'true')
    ? new PrismaClient({ datasources: { db: { url } } })
    : new PrismaClient();

  // NOTE: `$transaction` is intentionally NOT overridden here. A `client` extension cannot
  // call the method it overrides - `Prisma.getExtensionContext(this).$transaction` resolves
  // back to the override itself, so every interactive transaction in the app recursed until
  // it died with "Maximum call stack size exceeded". The AsyncLocalStorage wrapping now
  // happens in the proxy below, which can reach the real implementation.
  return baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // התיאור המפורש לרישום (מ-auditAs) מוסר מהארגומנטים תמיד — גם עבור מודלים
          // שאינם מתועדים ועבור פעולות קריאה — כדי ש-Prisma לא יקבל מפתח שאינו מכיר.
          let named = null;
          if (args && args.__audit) {
            named = args.__audit;
            args = { ...args };
            delete args.__audit;
          }

          if (model === 'AuditLog' || model === 'PageVisitLog' || model === 'Shift') {
            return query(args);
          }

          if (['create', 'update', 'delete'].includes(operation)) {
             const employeeId = await getActingEmployeeId();

             const result = await query(args);
             if (!result) return result;

             // changes ריק = הכתיבה לא שינתה כלום בפועל; אין טעם בשורת היסטוריה
             if (named && named.changes && Object.keys(named.changes).length === 0) return result;

             const entityId = String(result.id || result.orderId || "");
             let changesJson = '{}';
             if (named && named.changes) {
               changesJson = JSON.stringify(named.changes);
             } else if (operation === 'update') {
               changesJson = JSON.stringify(args.data || {});
             } else if (operation === 'create') {
               changesJson = JSON.stringify(result || {});
             } else if (operation === 'delete') {
               changesJson = JSON.stringify({ deleted: true });
             }

             try {
               // If we're inside an interactive transaction, write the audit row through
               // that same tx client so it lands on the same connection and is rolled
               // back along with everything else if the transaction fails.
               const txClient = txStorage.getStore();
               const auditClient = txClient || baseClient;
               await auditClient.auditLog.create({
                 data: {
                   entityType: model,
                   entityId: entityId,
                   action: named ? named.action : operation.toUpperCase(),
                   changesJson: changesJson,
                   employeeId: employeeId || null,
                 }
               });
             } catch (err) {
               console.error("Audit log error:", err);
             }
             return result;
          }

          return query(args);
        }
      }
    }
  });
};

const globalForPrisma = globalThis;

// The clients are cached on globalThis so dev hot-reloads don't open a new connection pool
// on every edit. That cache also survives edits to THIS file, so a client built by an older
// version of `createPrismaClient` keeps being handed out until the process itself restarts -
// which is why a fix to the extension setup above can look like it did nothing. Bump this
// whenever `createPrismaClient` changes, and the cached clients are rebuilt on next load.
const CLIENT_SETUP_VERSION = 5;

if (globalForPrisma.prismaSetupVersion !== CLIENT_SETUP_VERSION) {
  for (const stale of [globalForPrisma.prismaProd, globalForPrisma.prismaTest]) {
    // Let the superseded pool go away instead of leaking it for the life of the process.
    if (stale?.$disconnect) Promise.resolve(stale.$disconnect()).catch(() => {});
  }
  globalForPrisma.prismaProd = undefined;
  globalForPrisma.prismaTest = undefined;
  globalForPrisma.prismaSetupVersion = CLIENT_SETUP_VERSION;
}

if (!globalForPrisma.prismaProd) {
  globalForPrisma.prismaProd = createPrismaClient(process.env.PROD_DATABASE_URL || process.env.DATABASE_URL);
}
if (!globalForPrisma.prismaTest && process.env.TEST_DATABASE_URL) {
  globalForPrisma.prismaTest = createPrismaClient(process.env.TEST_DATABASE_URL);
}

if (!globalForPrisma.activeDbMode) {
  let initialMode = 'prod';
  try {
    const dbFile = path.join(process.cwd(), '.active-db');
    if (fs.existsSync(dbFile)) {
      initialMode = fs.readFileSync(dbFile, 'utf8').trim();
    }
  } catch(e) {}
  globalForPrisma.activeDbMode = initialMode;
}

const prismaProxy = new Proxy({}, {
  get(target, prop) {
    const isTest = globalForPrisma.activeDbMode === 'test' && globalForPrisma.prismaTest;
    const activeClient = isTest ? globalForPrisma.prismaTest : globalForPrisma.prismaProd;

    // Interactive transactions stash their `tx` client in AsyncLocalStorage for the duration
    // of the callback, so the audit-log extension can write through the same transaction
    // instead of racing it on a separate connection. Doing this here rather than in a client
    // extension keeps `activeClient.$transaction` pointing at Prisma's real implementation
    // (an extension override has no way to call the method it replaces), and the `tx` handed
    // to the callback is still the extended one, so writes inside a transaction stay audited.
    // Array-form `$transaction([...])` has no callback and is passed through untouched.
    if (prop === '$transaction') {
      return (arg, options) => (typeof arg === 'function'
        ? activeClient.$transaction((tx) => txStorage.run(tx, () => arg(tx)), options)
        : activeClient.$transaction(arg, options));
    }

    const value = activeClient[prop];
    if (typeof value === 'function') {
      return value.bind(activeClient);
    }
    return value;
  }
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prismaProxy;
}

/**
 * Best-effort reconciliation of anything written to the local SQLite fallback while
 * this machine was offline, back into Postgres - see lib/offlineSync.js for the
 * actual sync logic and lib/offlineSync design notes.
 *
 * Runs once per process, only when we're NOT in offline mode (i.e. right after the
 * app has been restarted with internet back), and only if @prisma/local-client was
 * ever generated (`npm run generate:offline`) - most deployments (e.g. Vercel) never
 * generate it and this is a silent no-op for them.
 */
export async function syncOfflineChangesIfAny({ log = console.log } = {}) {
  if (process.env.IS_OFFLINE_MODE === 'true') return null; // still offline, nothing to push yet
  let LocalPrismaClient;
  try {
    LocalPrismaClient = require(/* webpackIgnore: true */ '@prisma/local-client').PrismaClient;
  } catch (e) {
    return null; // local client never generated on this machine - offline mode was never used
  }

  let localClient;
  try {
    localClient = new LocalPrismaClient();
    // Always syncs to prismaProd specifically (not the prismaProxy / activeDbMode toggle) -
    // offline-collected data is real gemach data and must always land in the real database,
    // regardless of whatever the prod/test admin toggle happens to be set to right now.
    const summary = await runOfflineSync({ localClient, cloudClient: globalForPrisma.prismaProd, log });
    if (summary.totalSynced > 0 || summary.totalFailed > 0) {
      log(`[offline-sync] reconciliation complete: ${summary.totalSynced} row(s) synced to Postgres, ${summary.totalFailed} failed (see logs above).`);
    }
    return summary;
  } catch (e) {
    // Most common cause: the local sqlite db file/tables don't exist yet (offline mode
    // was generated but never actually used) - not a real error, just nothing to do.
    log(`[offline-sync] skipped: ${e.message}`);
    return null;
  } finally {
    if (localClient) await localClient.$disconnect().catch(() => {});
  }
}

if (process.env.IS_OFFLINE_MODE !== 'true' && !globalForPrisma.offlineSyncAttempted) {
  globalForPrisma.offlineSyncAttempted = true;
  // Fire-and-forget: must not delay server startup or block the first request.
  syncOfflineChangesIfAny().catch((e) => console.error('[offline-sync] unexpected error:', e));
}

export default prismaProxy;
