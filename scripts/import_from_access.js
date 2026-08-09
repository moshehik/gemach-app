/**
 * scripts/import_from_access.js
 * ============================================================================
 * PERMANENT, REUSABLE tool to (re-)import data from the legacy Access source
 * file into production Postgres. Safe to re-run whenever the Access file has
 * new data — it is a FULL reload using upsert-on-conflict, never a
 * delete-then-insert and never a blanket deleteMany().
 *
 * WHY A FULL RELOAD (not an incremental diff)
 * --------------------------------------------------------------------------
 * Investigated and confirmed (2026-08): Access has no per-row updatedAt, and
 * its changelog table ("שינוים") is ~75% incomplete and doesn't cover several
 * tables at all. There is no reliable way to diff. So every run re-reads the
 * relevant Access tables in full and upserts.
 *
 * USAGE
 * --------------------------------------------------------------------------
 *   node scripts/import_from_access.js                  # DRY RUN (default) - reports
 *                                                         # counts only, no writes.
 *   node scripts/import_from_access.js --write           # Actually writes to PROD.
 *   node scripts/import_from_access.js --write --limit=500   # cap rows/table (testing).
 *   node scripts/import_from_access.js --db-path="C:\...\file.accdb"  # override source path.
 *
 * Reads PROD_DATABASE_URL from .env at the repo root (same pattern as
 * scratch/apply_fix.mjs) and connects a raw PrismaClient directly to it -
 * NOT through app/lib/prisma.js, which needs a Next.js runtime and the
 * dual prod/test Proxy switch (irrelevant here; this always targets PROD).
 *
 * WHAT IT DOES
 * --------------------------------------------------------------------------
 *  - Customer, Employee, DressModel, DressItem: full upsert keyed on
 *    legacyId <-> the corresponding Access primary key (קוד_לקוח / קוד_עובד /
 *    קוד_שמלה / קוד). Existing rows get their Access-sourced fields refreshed;
 *    app-only fields that have no Access column (e.g. Customer bank details,
 *    Employee themeColor/profileImage, DressModel imageUrl/isDeleted) are
 *    NEVER touched - they simply aren't part of the SQL at all.
 *  - Employee.password is the one exception among Access-sourced fields: it
 *    is set on INSERT (brand-new employee) but deliberately never overwritten
 *    on UPDATE, since it's a live login credential that may have been
 *    changed in the app since the last Access edit. See "Employee.password"
 *    section below.
 *  - Order: full upsert keyed on orderId <-> קוד_הזמנה (per investigation,
 *    NOT legacyId - Order.legacyId is a stale synthetic value from an old
 *    SQLite migration step and is never read from or written to). This
 *    updates core order fields (totalAmount, isPaid, dates, customer/employee
 *    links, notes, etc.) for BOTH brand-new orders and pre-existing ones, so
 *    edits made in Access to an existing order's header do get picked up.
 *  - OrderItem, Payment, PaymentObligation: INSERT-ONLY, and only for orders
 *    that are brand new in this run (orderId not already present in the DB
 *    before this run started). See LIMITATION below for why pre-existing
 *    orders' sub-records are NOT touched.
 *  - Shift (עובדים_נוכחות, employee attendance/punch-clock): full upsert keyed
 *    on legacyId <-> קוד (verified 2026-08-06: this join is reliable, unlike
 *    the synthetic-junk-polluted OrderItem/Payment/PaymentObligation legacyIds
 *    - see LIMITATION below). Access-sourced fields (entry/exit time, Hebrew
 *    date, the plain shift date) are refreshed every run, even for shifts
 *    that already exist. The derived pay fields (totalMinutes,
 *    hourlyWageSnapshot, travelExpensesSnapshot, totalCalculated) are
 *    computed ONLY when a shift is brand-new to the DB, mirroring
 *    lib/shiftCalc.js's once-per-day travel-expense dedup - never
 *    recomputed for an existing shift, so a re-run can't silently drift a
 *    historical shift's pay if the employee's wage changed since.
 *  - SystemSetting (הגדרות_ראשי, general app config): INSERT-ONLY, and only
 *    for a hand-curated list of Access settings confirmed (2026-08-06, full
 *    67-row audit) to have no live equivalent yet - see the
 *    SYSTEM_SETTING_BACKFILL comment above processSystemSettings() for the
 *    full reasoning. Unlike every other table here, existing rows are NEVER
 *    matched or refreshed by legacyId, because SystemSetting.legacyId in
 *    PROD turned out to be the OLD SQLITE APP'S autoincrement id (copied in
 *    by migrate-db.js), not Access's own קוד - so an existing row's
 *    value/name/category are simply never touched by this tool, full stop.
 *
 * WHAT IT DOES NOT DO
 * --------------------------------------------------------------------------
 *  - Never deletes anything. Rows removed/soft-deleted in Access do carry
 *    their מחוק/isDeleted flag into the corresponding isDeleted column where
 *    that column exists and is Access-sourced (Customer, Order, OrderItem,
 *    PaymentObligation), but nothing is ever hard-deleted from Postgres.
 *  - Does not resolve OrderItem.dressItemId (which physical dress a rented
 *    item refers to). Access's הזמנות_פרטים table has no direct dress-item
 *    foreign key, only barcode/barcodePrefix/size - exactly mirroring how the
 *    live OrderItem schema already carries those as first-class columns
 *    instead of a hard link. This matches the historical import script's
 *    behavior (dressItemId left null) and is out of scope here; a separate,
 *    existing reconciliation pass (see scratch/link_order_items.js /
 *    scratch/fix_barcode_prefixes.js precedent) is responsible for that.
 *  - IMPORTANT KNOWN GAP: OrderItem/Payment/PaymentObligation rows are only
 *    inserted for orders that are brand-new to the DB in a given run. If a
 *    payment or item is added in Access to an order that ALREADY existed in
 *    the DB before this tool's first run, this tool will NOT pick it up.
 *    Why: the DB's legacyId on these three tables was populated with
 *    SYNTHETIC, sequential junk numbers by the original SQLite -> Postgres
 *    UUID migration (confirmed 2026-08-05: contiguous range with no gaps,
 *    all sharing one createdAt timestamp, unrelated to Access's own
 *    קוד_פריט/קוד). A hypothesis that this junk sequence was assigned by
 *    row_number() over Access's own PK ascending (which would let us recover
 *    the true key positionally) matched perfectly for the first 10 rows but
 *    was empirically REFUTED by row ~77825 of ~77834 (orderId sequence
 *    diverged completely - see git history / commit message for the probe
 *    output). Given no safe way to map existing rows to Access rows without
 *    risking duplicate financial records, the conservative choice was made:
 *    leave pre-existing orders' sub-records untouched. From THIS tool's
 *    first run onward, legacyId on newly-inserted rows in these three tables
 *    DOES store the real Access key, so future runs can safely detect
 *    duplicates for anything this tool itself inserted, and a scoped
 *    reconciliation pass for the pre-existing backlog can be built later
 *    with a deliberately-chosen matching strategy (out of scope tonight).
 *  - Does not touch Refund, PriceRule, or any other model - only the 12
 *    tables handled above (Customer, Department, Employee, DressModel,
 *    DressItem, Order, OrderItem, Payment, PaymentObligation, Shift,
 *    SystemSetting, PriceList). PriceList (מחירים) and Department (מחלקות)
 *    were added 2026-08-09 as full legacyId-keyed upserts - see the comments
 *    above processPriceList()/processDepartments() for the verification that
 *    their legacyIds are genuine Access keys (no synthetic-junk problem).
 *
 * DATA-QUALITY GUARDS BUILT IN (see git history / commit message for the
 * concrete investigation numbers behind each of these)
 * --------------------------------------------------------------------------
 *  - node-adodb serializes a NULL Access Date/Time column as the JS epoch
 *    "1970-01-01T00:00:00Z" (confirmed via a direct IS NULL check against a
 *    row that displayed that value - it is a serialization artifact, not
 *    real data). Also guards Access/VBA's own zero-date, 1899-12-30. Both are
 *    treated as null everywhere a "true" Date/Time column is read.
 *  - Hebrew-date text columns (e.g. "ו כסלו תשפג") are parsed via
 *    @hebcal/core's gematriyaStrToNum + HDate, with the month-name table
 *    derived from lib/hebrewDate.js's own HEBREW_MONTHS (the single canonical
 *    source), extended with the alternate spellings actually observed in the
 *    live file (e.g. "סיון"/"חשון" without the double vav). Unlike the old
 *    scripts' ad-hoc HEB_MONTHS table, an unrecognized month name is NEVER
 *    silently defaulted to Tishrei - it's logged to the run's "unparsed
 *    dates" report and the field is left null.
 *  - Some date-ish text columns mix formats within the same column over time
 *    (e.g. הזמנות_פרטים.תאריך_השכרה has old rows as Hebrew text and recent
 *    rows as "DD/MM/YYYY HH:MM:SS" - verified directly against the live
 *    file). The parser tries, in order: Hebrew text, DD/MM/YYYY[ HH:MM:SS],
 *    then a generic Date parse, before giving up and logging.
 *  - The Customer<->Order link bug from the old scripts/import_all_data.js
 *    (parseInt(קוד_לקוח) compared against a Set of Customer UUID strings -
 *    always false, silently null'd every order's customer) is fixed: the
 *    join goes through a freshly-queried Customer.legacyId -> id map.
 *
 * ============================================================================
 */

const ADODB = require('node-adodb');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const limitArg = args.find(a => a.startsWith('--limit='));
const ROW_LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
const TAIL = args.includes('--tail'); // testing helper: sample the END of each table (recent/new rows) instead of the start
const dbPathArg = args.find(a => a.startsWith('--db-path='));
const DEFAULT_ACCESS_PATH =
  'C:\\Users\\moshe\\Desktop\\\u200f\u200f\u05e0\u05ea\u05d5\u05e0\u05d9\u05dd \u05e9\u05de\u05dc\u05d5\u05ea \u05d0\u05d9\u05df \u05dc\u05d2\u05e2\u05ea - \u05e2\u05d5\u05ea\u05e7 (10).accdb';
const ACCESS_PATH = dbPathArg ? dbPathArg.split('=').slice(1).join('=') : DEFAULT_ACCESS_PATH;

console.log('='.repeat(78));
console.log(`Access -> Postgres import  |  mode: ${WRITE ? '*** WRITE (PRODUCTION) ***' : 'DRY RUN (no writes)'}`);
if (ROW_LIMIT) console.log(`Row limit per table: ${ROW_LIMIT} (testing mode)`);
console.log(`Access source: ${ACCESS_PATH}`);
console.log('='.repeat(78));

// ---------------------------------------------------------------------------
// Source file freshness check - this file is actively edited by the owner in
// parallel with the live app, so always confirm we're reading current data.
// ---------------------------------------------------------------------------
try {
  const stat = fs.statSync(ACCESS_PATH);
  const ageMin = (Date.now() - stat.mtimeMs) / 60000;
  console.log(`Access file last modified: ${stat.mtime.toISOString()} (${ageMin.toFixed(1)} min ago), size: ${(stat.size / 1024 / 1024).toFixed(1)} MB`);
} catch (e) {
  console.error(`FATAL: could not stat Access file at ${ACCESS_PATH}:`, e.message);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// PROD DB connection (raw - not app/lib/prisma.js, no Next.js runtime here)
// ---------------------------------------------------------------------------
const envPath = path.resolve(__dirname, '../.env');
const envText = fs.readFileSync(envPath, 'utf8');
const prodUrlMatch = envText.match(/^PROD_DATABASE_URL="(.+)"$/m);
if (!prodUrlMatch) {
  console.error(`FATAL: PROD_DATABASE_URL not found in ${envPath}`);
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: prodUrlMatch[1] } } });

// ---------------------------------------------------------------------------
// Access connection (ADODB/OLEDB COM, x64 cscript - the 32-bit provider is
// not registered on this machine, confirmed via probe on 2026-08-05)
// ---------------------------------------------------------------------------
const connection = ADODB.open(`Provider=Microsoft.ACE.OLEDB.12.0;Data Source=${ACCESS_PATH};`, true);

async function accessQuery(sql) {
  return connection.query(sql);
}

// ---------------------------------------------------------------------------
// Date parsing helpers
// ---------------------------------------------------------------------------
const EPOCH_SENTINELS = new Set([
  Date.UTC(1970, 0, 1),   // node-adodb's NULL-date serialization artifact (verified)
  Date.UTC(1899, 11, 30), // Access/VBA's own internal zero-date
]);

function isSentinelDate(d) {
  return !(d instanceof Date) || isNaN(d.getTime()) || EPOCH_SENTINELS.has(d.getTime());
}

/** For columns that are TRUE Access Date/Time columns (never Hebrew text). */
function parseTrueDate(val) {
  if (val === null || val === undefined || val === '') return null;
  const d = val instanceof Date ? val : new Date(val);
  return isSentinelDate(d) ? null : d;
}

let HEBREW_MONTHS, HDate, gematriyaStrToNum;
let MONTH_NAME_MAP;
const unparsedDates = [];

async function initHebrewDateSupport() {
  const hebcal = await import('@hebcal/core');
  HDate = hebcal.HDate;
  gematriyaStrToNum = hebcal.gematriyaStrToNum;

  // Reuse the app's own canonical month table - do NOT invent a second one.
  const hebrewDateLib = await import(pathToFileUrl(path.resolve(__dirname, '../lib/hebrewDate.js')));
  HEBREW_MONTHS = hebrewDateLib.HEBREW_MONTHS;

  MONTH_NAME_MAP = new Map();
  for (const [numStr, canonicalName] of Object.entries(HEBREW_MONTHS)) {
    const n = Number(numStr);
    MONTH_NAME_MAP.set(canonicalName, n);
    MONTH_NAME_MAP.set(canonicalName.replace(/['\u05f3\u05f4]/g, ''), n); // strip ' / ׳ / ״
  }
  // Alternate spellings actually observed in the live Access file (probed 2026-08-05):
  MONTH_NAME_MAP.set('סיון', 3);   // סיוון without the double vav
  MONTH_NAME_MAP.set('חשון', 8);   // חשוון without the double vav
  MONTH_NAME_MAP.set('מרחשון', 8);
  MONTH_NAME_MAP.set('אדרא', 12); MONTH_NAME_MAP.set('אדר א', 12);
  MONTH_NAME_MAP.set('אדרב', 13); MONTH_NAME_MAP.set('אדר ב', 13);
}

function pathToFileUrl(p) {
  return 'file:///' + p.replace(/\\/g, '/').replace(/^\/?/, '');
}

function parseHebrewDateString(rawStr) {
  const str = rawStr.trim();
  const parts = str.split(/\s+/).filter(Boolean);
  if (parts.length < 2) { unparsedDates.push(str); return null; }

  const yearToken = parts[parts.length - 1].replace(/["'\u05f3\u05f4]/g, '');
  const dayToken = parts[0].replace(/["'\u05f3\u05f4]/g, '');
  const monthToken = parts.slice(1, -1).join('').replace(/["'\u05f3\u05f4]/g, '');

  let year, day;
  try {
    year = gematriyaStrToNum(yearToken);
    day = gematriyaStrToNum(dayToken);
  } catch (e) {
    unparsedDates.push(str);
    return null;
  }
  if (!year || !day) { unparsedDates.push(str); return null; }
  if (year < 1000) year += 5000;

  const monthNum = MONTH_NAME_MAP.get(monthToken);
  if (monthNum === undefined) {
    unparsedDates.push(`${str}  [unrecognized month token: "${monthToken}"]`);
    return null;
  }

  try {
    const isLeap = HDate.isLeapYear(year);
    if (monthNum === 12 && monthToken === 'אדר' && isLeap) {
      // Ambiguous: plain "אדר" in a leap year could mean Adar I or Adar II.
      // Never guess on this - log and leave null.
      unparsedDates.push(`${str}  [ambiguous: plain אדר in leap year ${year}]`);
      return null;
    }
    const hd = new HDate(day, monthNum, year);
    return hd.greg();
  } catch (e) {
    unparsedDates.push(`${str}  [${e.message}]`);
    return null;
  }
}

const DDMMYYYY_RE = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

/** For text columns that mix Hebrew-date text and Gregorian DD/MM/YYYY text over time. */
function parseFlexibleDate(val) {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) return isSentinelDate(val) ? null : val;

  const str = String(val).trim();
  if (!str) return null;

  if (/[\u05d0-\u05ea]/.test(str)) {
    return parseHebrewDateString(str);
  }

  const m = str.match(DDMMYYYY_RE);
  if (m) {
    const [, dd, mm, yyyy, hh = '0', min = '0', ss = '0'] = m;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(ss));
    return isNaN(d.getTime()) || isSentinelDate(d) ? null : d;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) return isSentinelDate(d) ? null : d;

  unparsedDates.push(str);
  return null;
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------
function toInt(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}
function toFloat(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}
function toStr(v) {
  if (v === null || v === undefined) return null;
  return String(v);
}
function toBool(v) {
  return v === true || v === 1 || v === -1; // Access/VBA True is often -1
}
function applyLimit(rows) {
  if (!ROW_LIMIT) return rows;
  return TAIL ? rows.slice(-ROW_LIMIT) : rows.slice(0, ROW_LIMIT);
}

// ---------------------------------------------------------------------------
// Password hashing (Employee create path only)
// ---------------------------------------------------------------------------
// Access stores סיסמא as PLAINTEXT. The live app stores only bcrypt hashes
// (see lib/passwordAuth.js hashSecret + scripts/migrate_hash_passwords.js), and
// login uses bcrypt.compare - so inserting the Access plaintext as-is produced
// employees who could never log in (bug fixed 2026-08-09). Mirror the live
// create path (app/api/employees/route.js): hash the password AND derive
// pinHash from the last 4 chars while the plaintext is still in hand, so the
// trusted-device fast login works for imported employees too.
// Guard against double-hashing: a value that already looks like a bcrypt hash
// is stored as-is (pinHash can't be derived from a hash - left null).
const BCRYPT_HASH_RE = /^\$2[aby]\$\d{2}\$/;
const SALT_ROUNDS = 10; // same work factor as lib/passwordAuth.js

function hashAccessPassword(rawPassword) {
  if (!rawPassword) return { password: null, pinHash: null };
  const s = String(rawPassword);
  if (BCRYPT_HASH_RE.test(s)) return { password: s, pinHash: null }; // already hashed - never double-hash
  const last4 = s.length <= 4 ? s : s.slice(-4);
  return {
    password: bcrypt.hashSync(s, SALT_ROUNDS),
    pinHash: bcrypt.hashSync(last4, SALT_ROUNDS),
  };
}

/**
 * Bulk INSERT ... ON CONFLICT (<conflictCol>) DO UPDATE, chunked, with native
 * JS param binding (no manual SQL-escaping of Hebrew text needed). On dry
 * run, does nothing (counts are computed separately by the caller from the
 * pre-fetched existing-key set).
 */
async function bulkUpsert({ label, table, conflictCol, columns, updateColumns, rows, chunkSize = 500 }) {
  if (!WRITE) return { attempted: rows.length };
  if (rows.length === 0) return { attempted: 0 };

  const colList = columns.map(c => `"${c}"`).join(', ');
  // Insert-only tables (updateColumns = []) get DO NOTHING - re-running this
  // script is then a safe no-op for rows it already inserted.
  const conflictClause = updateColumns.length
    ? `DO UPDATE SET ${updateColumns.map(c => `"${c}" = EXCLUDED."${c}"`).join(', ')}`
    : `DO NOTHING`;

  // `done` tracks ROWS ACTUALLY AFFECTED (per $executeRawUnsafe's own return
  // value), not rows attempted. Bug found 2026-08-05: an earlier version of
  // this function counted `chunk.length` unconditionally, so when every
  // Payment insert silently no-op'd via `ON CONFLICT DO NOTHING` (colliding
  // with an unrelated synthetic legacyId left over from the original
  // migration), the script's own summary still reported "written=3595" while
  // the true number of rows actually inserted was 0. Never regress this -
  // always trust the driver's affected-row count, and surface a loud warning
  // when it diverges from what was attempted, so a silent-conflict class of
  // bug like that one is impossible to miss in the run's own output.
  let done = 0;
  let noopedByConflict = 0;
  const failedRows = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const params = [];
    const valueGroups = chunk.map(row => {
      const placeholders = row.map(v => { params.push(v); return `$${params.length}`; });
      return `(${placeholders.join(', ')})`;
    });
    const sql = `INSERT INTO "${table}" (${colList}) VALUES ${valueGroups.join(', ')}
      ON CONFLICT ("${conflictCol}") ${conflictClause}`;
    try {
      const affected = await prisma.$executeRawUnsafe(sql, ...params);
      done += affected;
      if (affected < chunk.length) noopedByConflict += (chunk.length - affected);
    } catch (e) {
      // Isolate the failure to this chunk: retry row-by-row so one bad row
      // (e.g. a DressModel name unique-constraint collision) doesn't drop an
      // entire batch of otherwise-good rows.
      console.warn(`  [${label}] chunk ${i}-${i + chunk.length} failed as a batch (${e.message.split('\n')[0]}), retrying row-by-row...`);
      for (const row of chunk) {
        const rowParams = row;
        const placeholders = row.map((_, idx) => `$${idx + 1}`);
        const rowSql = `INSERT INTO "${table}" (${colList}) VALUES (${placeholders.join(', ')})
          ON CONFLICT ("${conflictCol}") ${conflictClause}`;
        try {
          const affected = await prisma.$executeRawUnsafe(rowSql, ...rowParams);
          done += affected;
          if (affected === 0) noopedByConflict += 1;
        } catch (rowErr) {
          failedRows.push({ row, error: rowErr.message.split('\n')[0] });
        }
      }
    }
    if (rows.length > chunkSize) {
      process.stdout.write(`\r  [${label}] ${Math.min(i + chunkSize, rows.length)} / ${rows.length}`);
    }
  }
  if (noopedByConflict > 0) {
    console.warn(`  [${label}] WARNING: ${noopedByConflict} / ${rows.length} rows hit an existing "${conflictCol}" and were ${updateColumns.length ? 're-upserted (expected on a re-run)' : 'SKIPPED via DO NOTHING (unexpected for an insert-only table unless this is a re-run - if this number is large on a first run, STOP and investigate a possible legacyId-namespace collision before trusting the data)'}.`);
  }
  if (rows.length > chunkSize) process.stdout.write('\n');
  return { attempted: rows.length, written: done, failed: failedRows };
}

// ---------------------------------------------------------------------------
// Table processors
// ---------------------------------------------------------------------------

async function processCustomers() {
  console.log('\n--- Customer (לקוחות) ---');
  const rows = applyLimit(await accessQuery(`SELECT * FROM [\u05dc\u05e7\u05d5\u05d7\u05d5\u05ea]`));
  const existing = await prisma.customer.findMany({ where: { legacyId: { not: null } }, select: { legacyId: true } });
  const existingSet = new Set(existing.map(r => r.legacyId));

  let toCreate = 0, toUpdate = 0;
  const dbRows = [];
  for (const c of rows) {
    const legacyId = toInt(c['\u05e7\u05d5\u05d3_\u05dc\u05e7\u05d5\u05d7']); // קוד_לקוח
    if (!legacyId) continue;
    if (existingSet.has(legacyId)) toUpdate++; else toCreate++;

    dbRows.push([
      crypto.randomUUID(), legacyId,
      toStr(c['\u05e9\u05dd_\u05e4\u05e8\u05d8\u05d9']),      // שם_פרטי
      toStr(c['\u05e9\u05dd_\u05de\u05e9\u05e4\u05d7\u05d4']), // שם_משפחה
      toStr(c['\u05d8\u05dc\u05e4\u05d5\u05df_1']),            // טלפון_1
      toStr(c['\u05d8\u05dc\u05e4\u05d5\u05df_2']),            // טלפון_2
      toStr(c['\u05e2\u05d9\u05e8']),                          // עיר
      toStr(c['\u05e8\u05d7\u05d5\u05d1']),                    // רחוב
      toInt(c['\u05d1\u05d9\u05ea']),                          // בית
      toStr(c['\u05de\u05d9\u05d9\u05dc']),                    // מייל
      toStr(c['\u05e1\u05d9\u05d5\u05de\u05ea_\u05de\u05d9\u05d9\u05dc']), // סיומת_מייל
      toStr(c['\u05d4\u05e2\u05e8\u05d5\u05ea']),              // הערות
      toStr(c['\u05ea\u05d0\u05e8\u05d9\u05da_\u05e8\u05d9\u05e9\u05d5\u05dd']), // תאריך_רישום (raw string, per schema)
      toBool(c['\u05dc\u05e7\u05d5\u05d7_\u05de\u05d7\u05d5\u05e7']), // לקוח_מחוק
      new Date(),
    ]);
  }

  console.log(`  Access rows: ${rows.length} | will create: ${toCreate} | will update: ${toUpdate}`);

  const result = await bulkUpsert({
    label: 'Customer', table: 'Customer', conflictCol: 'legacyId',
    columns: ['id', 'legacyId', 'firstName', 'lastName', 'phone1', 'phone2', 'city', 'street', 'houseNum', 'email', 'emailSuffix', 'notes', 'registrationDate', 'isDeleted', 'updatedAt'],
    updateColumns: ['firstName', 'lastName', 'phone1', 'phone2', 'city', 'street', 'houseNum', 'email', 'emailSuffix', 'notes', 'registrationDate', 'isDeleted', 'updatedAt'],
    rows: dbRows,
  });

  return { accessCount: rows.length, toCreate, toUpdate, ...result };
}

async function processEmployees() {
  console.log('\n--- Employee (עובדים) ---');
  const rows = applyLimit(await accessQuery(`SELECT * FROM [\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd]`));
  const existing = await prisma.employee.findMany({ where: { legacyId: { not: null } }, select: { legacyId: true } });
  const existingSet = new Set(existing.map(r => r.legacyId));

  let toCreate = 0, toUpdate = 0;
  const createRows = [], updateRows = [];
  for (const e of rows) {
    const legacyId = toInt(e['\u05e7\u05d5\u05d3_\u05e2\u05d5\u05d1\u05d3']); // קוד_עובד
    if (!legacyId) continue;
    const isNew = !existingSet.has(legacyId);
    if (isNew) toCreate++; else toUpdate++;

    const common = [
      toStr(e['\u05e9\u05dd_\u05e4\u05e8\u05d8\u05d9']),       // שם_פרטי
      toStr(e['\u05e9\u05dd_\u05de\u05e9\u05e4\u05d7\u05d4']),  // שם_משפחה
      toStr(e['\u05d8\u05dc\u05e4\u05d5\u05df_1']),             // טלפון_1
      toStr(e['\u05d8\u05dc\u05e4\u05d5\u05df_2']),             // טלפון_2
      toStr(e['\u05e2\u05d9\u05e8']),                           // עיר
      toStr(e['\u05e8\u05d7\u05d5\u05d1']),                     // רחוב
      toStr(e['\u05d1\u05d9\u05ea']),                           // בית (String on Employee, unlike Customer)
      toStr(e['\u05de\u05d9\u05d9\u05dc']),                     // מייל
      parseTrueDate(e['\u05ea\u05d0\u05e8\u05d9\u05da_\u05db\u05e0\u05d9\u05e1\u05d4_\u05dc\u05d0\u05e8\u05d2\u05d5\u05df']), // תאריך_כניסה_לארגון
      toStr(e['\u05e9\u05dd_\u05de\u05dc\u05d0']),              // שם_מלא
      toStr(e['\u05d4\u05e2\u05e8\u05d5\u05ea']),               // הערות
      toStr(e['\u05e1\u05d9\u05d5\u05de\u05ea_\u05de\u05d9\u05d9\u05dc']), // סיומת_מייל
      toInt(e['\u05de\u05e1_\u05de\u05d7\u05dc\u05e7\u05d4']),  // מס_מחלקה
      !toBool(e['\u05dc\u05d0_\u05e4\u05e2\u05d9\u05dc']),      // isActive = NOT לא_פעיל
      toFloat(e['\u05e9\u05db\u05e8_\u05e9\u05e2\u05d4']),      // שכר_שעה
      toStr(e['\u05d0\u05d5\u05e4\u05df_\u05ea\u05e9\u05dc\u05d5\u05dd']), // אופן_תשלום
      toBool(e['\u05e0\u05e1\u05d9\u05e2\u05d5\u05ea']),        // נסיעות
      new Date(),
    ];

    if (isNew) {
      // Only on CREATE do we also set the login password from Access - hashed
      // via hashAccessPassword (bcrypt + derived pinHash), NEVER plaintext
      // (bug fixed 2026-08-09: the Access plaintext used to be stored as-is,
      // so bcrypt.compare at login always failed for imported employees).
      const hashedPw = hashAccessPassword(toStr(e['סיסמא']));
      createRows.push([crypto.randomUUID(), legacyId, ...common, hashedPw.password, hashedPw.pinHash]); // סיסמא
    } else {
      updateRows.push([crypto.randomUUID(), legacyId, ...common]);
    }
  }

  console.log(`  Access rows: ${rows.length} | will create: ${toCreate} | will update: ${toUpdate}`);
  console.log(`  NOTE: password is set on create only, never overwritten for existing employees.`);

  const baseCols = ['firstName', 'lastName', 'phone1', 'phone2', 'city', 'street', 'houseNum', 'email', 'joinDate', 'fullName', 'notes', 'emailSuffix', 'roleId', 'isActive', 'hourlyWage', 'paymentMethod', 'travelExpenses', 'updatedAt'];

  const createResult = await bulkUpsert({
    label: 'Employee (new)', table: 'Employee', conflictCol: 'legacyId',
    columns: ['id', 'legacyId', ...baseCols, 'password', 'pinHash'],
    updateColumns: baseCols, // irrelevant path for brand-new legacyIds, but harmless if hit
    rows: createRows,
  });
  const updateResult = await bulkUpsert({
    label: 'Employee (existing)', table: 'Employee', conflictCol: 'legacyId',
    columns: ['id', 'legacyId', ...baseCols],
    updateColumns: baseCols, // password intentionally excluded
    rows: updateRows,
  });

  return {
    accessCount: rows.length, toCreate, toUpdate,
    written: WRITE ? (createResult.written || 0) + (updateResult.written || 0) : undefined,
    failed: [...(createResult.failed || []), ...(updateResult.failed || [])],
  };
}

async function processDressModels() {
  console.log('\n--- DressModel (\u05e9\u05de\u05dc\u05d5\u05ea_\u05d3\u05d2\u05de\u05d9\u05dd) ---');
  const rows = applyLimit(await accessQuery(`SELECT * FROM [\u05e9\u05de\u05dc\u05d5\u05ea_\u05d3\u05d2\u05de\u05d9\u05dd]`));
  const existing = await prisma.dressModel.findMany({ select: { legacyId: true, name: true } });
  const existingByLegacyId = new Map(existing.filter(r => r.legacyId != null).map(r => [r.legacyId, r.name]));
  const nameToLegacyId = new Map(existing.filter(r => r.legacyId != null).map(r => [r.name, r.legacyId]));

  let toCreate = 0, toUpdate = 0, nameCollisions = 0;
  const dbRows = [];
  for (const m of rows) {
    const legacyId = toInt(m['\u05e7\u05d5\u05d3_\u05e9\u05de\u05dc\u05d4']); // קוד_שמלה
    if (!legacyId) continue;
    const isNew = !existingByLegacyId.has(legacyId);
    if (isNew) toCreate++; else toUpdate++;

    let name = toStr(m['\u05e9\u05dd_\u05e9\u05de\u05dc\u05d4']) || `\u05dc\u05dc\u05d0 \u05e9\u05dd - ${legacyId}`; // שם_שמלה
    const collidingOwner = nameToLegacyId.get(name);
    if (collidingOwner !== undefined && collidingOwner !== legacyId) {
      // Name collides with a DIFFERENT model's existing name. Keep the DB's
      // existing name for this row rather than crash the unique constraint
      // or silently rename another model.
      nameCollisions++;
      name = existingByLegacyId.get(legacyId) || `${name} (legacy ${legacyId})`;
    }

    dbRows.push([
      crypto.randomUUID(), legacyId, name,
      toInt(m['\u05d1\u05e8_\u05e7\u05d5\u05d3_\u05e7\u05d9\u05d3\u05d5\u05de\u05ea']), // בר_קוד_קידומת
      parseFlexibleDate(m['\u05ea\u05d0\u05e8\u05d9\u05da_\u05db\u05e0\u05d9\u05e1\u05d4_\u05dc\u05de\u05d0\u05d2\u05e8']), // תאריך_כניסה_למאגר
      parseFlexibleDate(m['\u05ea\u05d0\u05e8\u05d9\u05da_\u05d9\u05e6\u05d9\u05d0\u05d4_\u05de\u05d4\u05de\u05d0\u05d2\u05e8']), // תאריך_יציאה_מהמאגר
      toStr(m['\u05e7\u05d8\u05d2\u05d5\u05e8\u05d9\u05ea_\u05de\u05d7\u05d9\u05e8']), // קטגורית_מחיר
      toStr(m['\u05d4\u05e2\u05e8\u05d5\u05ea']), // הערות
      toBool(m['\u05d4\u05e6\u05d2_\u05d1\u05d1\u05d3\u05d9\u05e7\u05d4']), // הצג_בבדיקה
      new Date(),
    ]);
  }

  console.log(`  Access rows: ${rows.length} | will create: ${toCreate} | will update: ${toUpdate} | name collisions kept as-is: ${nameCollisions}`);

  const result = await bulkUpsert({
    label: 'DressModel', table: 'DressModel', conflictCol: 'legacyId',
    columns: ['id', 'legacyId', 'name', 'barcodePrefix', 'entryDateToRepo', 'exitDateFromRepo', 'priceCategory', 'notes', 'inInspection', 'updatedAt'],
    updateColumns: ['name', 'barcodePrefix', 'entryDateToRepo', 'exitDateFromRepo', 'priceCategory', 'notes', 'inInspection', 'updatedAt'],
    rows: dbRows,
  });

  return { accessCount: rows.length, toCreate, toUpdate, nameCollisions, ...result };
}

async function processDressItems() {
  console.log('\n--- DressItem (\u05e9\u05de\u05dc\u05d5\u05ea_\u05e0\u05ea\u05d5\u05e0\u05d9\u05dd) ---');
  const rows = applyLimit(await accessQuery(`SELECT * FROM [\u05e9\u05de\u05dc\u05d5\u05ea_\u05e0\u05ea\u05d5\u05e0\u05d9\u05dd]`));
  const existing = await prisma.dressItem.findMany({ where: { legacyId: { not: null } }, select: { legacyId: true } });
  const existingSet = new Set(existing.map(r => r.legacyId));
  const models = await prisma.dressModel.findMany({ select: { id: true, barcodePrefix: true } });
  const modelByPrefix = new Map(models.filter(m => m.barcodePrefix != null).map(m => [m.barcodePrefix, m.id]));

  let toCreate = 0, toUpdate = 0;
  const dbRows = [];
  for (const it of rows) {
    const legacyId = toInt(it['\u05e7\u05d5\u05d3']); // קוד
    if (!legacyId) continue;
    if (existingSet.has(legacyId)) toUpdate++; else toCreate++;

    const barcodePrefix = toInt(it['\u05d1\u05e8_\u05e7\u05d5\u05d3_\u05e7\u05d9\u05d3\u05d5\u05de\u05ea']); // בר_קוד_קידומת
    const dressModelId = barcodePrefix != null ? (modelByPrefix.get(barcodePrefix) || null) : null;

    dbRows.push([
      crypto.randomUUID(), legacyId, barcodePrefix, dressModelId,
      toStr(it['\u05e9\u05dd_\u05e9\u05de\u05dc\u05d4']), // שם_שמלה
      toStr(it['\u05de\u05d9\u05d3\u05d4_\u05d8\u05e7\u05e1\u05d8'] || it['\u05de\u05d9\u05d3\u05d4']), // מידה_טקסט || מידה
      toInt(it['\u05de\u05e1\u05e4\u05e8_\u05e1\u05d9\u05d3\u05d5\u05e8\u05d9']), // מספר_סידורי
      toStr(it['\u05d1\u05e8_\u05e7\u05d5\u05d3_\u05e9\u05de\u05dc\u05d4']), // בר_קוד_שמלה
      toStr(it['\u05de\u05d9\u05e7\u05d5\u05dd']), // מיקום
      toInt(it['\u05de\u05d9\u05e7\u05d5\u05dd_\u05de\u05e1']), // מיקום_מס
      toInt(it['\u05db\u05de\u05d5\u05ea']) || 1, // כמות
      toBool(it['\u05e9\u05de\u05dc\u05d4_\u05d1\u05ea\u05d9\u05e7\u05d5\u05df']), // שמלה_בתיקון
      toBool(it['\u05dc\u05d0_\u05d1\u05e9\u05d9\u05de\u05d5\u05e9']), // לא_בשימוש
      parseFlexibleDate(it['\u05dc\u05d0_\u05d1\u05e9\u05d9\u05de\u05d5\u05e9_\u05de\u05ea\u05d0\u05e8\u05d9\u05da']), // לא_בשימוש_מתאריך
      parseFlexibleDate(it['\u05ea\u05d0\u05e8\u05d9\u05da_\u05db\u05e0\u05d9\u05e1\u05d4_\u05dc\u05de\u05d0\u05d2\u05e8']), // תאריך_כניסה_למאגר
      new Date(),
    ]);
  }

  console.log(`  Access rows: ${rows.length} | will create: ${toCreate} | will update: ${toUpdate}`);

  const result = await bulkUpsert({
    label: 'DressItem', table: 'DressItem', conflictCol: 'legacyId',
    columns: ['id', 'legacyId', 'barcodePrefix', 'dressModelId', 'dressName', 'sizeText', 'serialNumber', 'dressBarcode', 'location', 'locationNum', 'quantity', 'inRepair', 'notInUse', 'notInUseSince', 'entryDateToRepo', 'updatedAt'],
    updateColumns: ['barcodePrefix', 'dressModelId', 'dressName', 'sizeText', 'serialNumber', 'dressBarcode', 'location', 'locationNum', 'quantity', 'inRepair', 'notInUse', 'notInUseSince', 'entryDateToRepo', 'updatedAt'],
    rows: dbRows,
  });

  return { accessCount: rows.length, toCreate, toUpdate, ...result };
}

async function processOrders() {
  console.log('\n--- Order (\u05d4\u05d6\u05de\u05e0\u05d5\u05ea) ---');
  const rows = applyLimit(await accessQuery(`SELECT * FROM [\u05d4\u05d6\u05de\u05e0\u05d5\u05ea]`));

  const existingOrders = await prisma.order.findMany({ select: { orderId: true } });
  const existingOrderIdSet = new Set(existingOrders.map(o => o.orderId));

  const customers = await prisma.customer.findMany({ where: { legacyId: { not: null } }, select: { id: true, legacyId: true } });
  const customerByLegacyId = new Map(customers.map(c => [c.legacyId, c.id]));
  const employees = await prisma.employee.findMany({ where: { legacyId: { not: null } }, select: { id: true, legacyId: true } });
  const employeeByLegacyId = new Map(employees.map(e => [e.legacyId, e.id]));

  let toCreate = 0, toUpdate = 0, custUnresolved = 0, empUnresolved = 0;
  const dbRows = [];
  const newOrderIds = new Set();
  for (const o of rows) {
    const orderId = toInt(o['\u05e7\u05d5\u05d3_\u05d4\u05d6\u05de\u05e0\u05d4']); // קוד_הזמנה
    if (!orderId) continue;
    const isNew = !existingOrderIdSet.has(orderId);
    if (isNew) { toCreate++; newOrderIds.add(orderId); } else toUpdate++;

    const custLegacy = toInt(o['\u05e7\u05d5\u05d3_\u05dc\u05e7\u05d5\u05d7']); // קוד_לקוח
    const customerId = custLegacy != null ? (customerByLegacyId.get(custLegacy) || null) : null;
    if (custLegacy != null && !customerId) custUnresolved++;

    const empLegacy = toInt(o['\u05e7\u05d5\u05d3_\u05e2\u05d5\u05d1\u05d3']); // קוד_עובד
    const employeeId = empLegacy != null ? (employeeByLegacyId.get(empLegacy) || null) : null;
    if (empLegacy != null && !employeeId) empUnresolved++;

    const toDateVal = parseTrueDate(o['\u05e2\u05d3_\u05ea\u05d0\u05e8\u05d9\u05da']); // עד_תאריך

    dbRows.push([
      crypto.randomUUID(), orderId, customerId,
      toFloat(o['\u05ea\u05e9\u05dc\u05d5\u05dd_\u05e1\u05db\u05d5\u05dd']), // תשלום_סכום
      toBool(o['\u05e9\u05d5\u05dc\u05dd']), // שולם -> isPaid
      toBool(o['\u05de\u05d7\u05d5\u05e7']), // מחוק -> isDeleted
      toStr(o['\u05d4\u05e2\u05e8\u05d5\u05ea_\u05dc\u05d4\u05d6\u05de\u05e0\u05d4']), // הערות_להזמנה -> orderNotes
      parseTrueDate(o['\u05ea\u05d0\u05e8\u05d9\u05da_\u05d0\u05d9\u05e8\u05d5\u05e2_\u05dc\u05d5\u05e2\u05d6\u05d9']), // תאריך_אירוע_לועזי -> eventDate
      toStr(o['\u05ea\u05d0\u05e8\u05d9\u05da_\u05d0\u05d9\u05e8\u05d5\u05e2']), // תאריך_אירוע (raw string) -> eventDateHebrew
      toDateVal, // עד_תאריך -> returnDate
      parseTrueDate(o['\u05ea\u05d0\u05e8\u05d9\u05da_\u05d4\u05d6\u05de\u05e0\u05d4']), // תאריך_הזמנה -> orderDate
      employeeId,
      parseTrueDate(o['\u05ea\u05d0\u05e8\u05d9\u05da_\u05de\u05d7\u05d9\u05e7\u05d4']), // תאריך_מחיקה -> deletedAt
      toBool(o['\u05d0\u05d9\u05e8\u05d5\u05e2_\u05d7\u05d5\u05dc']), // אירוע_חול -> isAbroad (see header notes)
      parseTrueDate(o['\u05de\u05ea\u05d0\u05e8\u05d9\u05da']), // מתאריך -> fromDate
      toDateVal, // עד_תאריך -> toDate (same source as returnDate, matches historical precedent)
      new Date(),
    ]);
  }

  console.log(`  Access rows: ${rows.length} | will create: ${toCreate} | will update: ${toUpdate}`);
  console.log(`  Customer link unresolved (קוד_לקוח with no matching Customer.legacyId): ${custUnresolved}`);
  console.log(`  Employee link unresolved (קוד_עובד with no matching Employee.legacyId): ${empUnresolved}`);

  const result = await bulkUpsert({
    label: 'Order', table: 'Order', conflictCol: 'orderId',
    columns: ['id', 'orderId', 'customerId', 'totalAmount', 'isPaid', 'isDeleted', 'orderNotes', 'eventDate', 'eventDateHebrew', 'returnDate', 'orderDate', 'employeeId', 'deletedAt', 'isAbroad', 'fromDate', 'toDate', 'updatedAt'],
    updateColumns: ['customerId', 'totalAmount', 'isPaid', 'isDeleted', 'orderNotes', 'eventDate', 'eventDateHebrew', 'returnDate', 'orderDate', 'employeeId', 'deletedAt', 'isAbroad', 'fromDate', 'toDate', 'updatedAt'],
    rows: dbRows,
  });

  return { accessCount: rows.length, toCreate, toUpdate, custUnresolved, empUnresolved, newOrderIds, ...result };
}

/** OrderItem/Payment/PaymentObligation - insert-only, new orders only. See header LIMITATION. */
async function processOrderSubRecords(newOrderIds) {
  console.log('\n--- OrderItem / Payment / PaymentObligation (new orders only - see LIMITATION in header) ---');

  const [items, obligations, payments] = await Promise.all([
    accessQuery(`SELECT * FROM [\u05d4\u05d6\u05de\u05e0\u05d5\u05ea_\u05e4\u05e8\u05d8\u05d9\u05dd]`),      // הזמנות_פרטים
    accessQuery(`SELECT * FROM [\u05d4\u05d6\u05de\u05e0\u05d5\u05ea_\u05ea\u05e9\u05dc\u05d5\u05dd]`),     // הזמנות_תשלום
    accessQuery(`SELECT * FROM [\u05d4\u05d6\u05de\u05e0\u05d5\u05ea_\u05ea\u05e9\u05dc\u05d5\u05dd_\u05d1\u05d9\u05e6\u05d5\u05e2]`), // הזמנות_תשלום_ביצוע
  ]);

  const relevantItems = applyLimit(items.filter(i => newOrderIds.has(toInt(i['\u05e7\u05d5\u05d3_\u05d4\u05d6\u05de\u05e0\u05d4']))));
  const relevantObligations = applyLimit(obligations.filter(p => newOrderIds.has(toInt(p['\u05e7\u05d5\u05d3_\u05d4\u05d6\u05de\u05e0\u05d4']))));
  const relevantPayments = applyLimit(payments.filter(p => newOrderIds.has(toInt(p['\u05e7\u05d5\u05d3_\u05d4\u05d6\u05de\u05e0\u05d4']))));

  console.log(`  New orders this run: ${newOrderIds.size}`);
  console.log(`  OrderItem rows to insert: ${relevantItems.length} (of ${items.length} total in Access)`);
  console.log(`  PaymentObligation rows to insert: ${relevantObligations.length} (of ${obligations.length} total in Access)`);
  console.log(`  Payment rows to insert: ${relevantPayments.length} (of ${payments.length} total in Access)`);

  // --- OrderItem ---
  const itemLegacyToNewId = new Map();
  const itemRows = [];
  for (const i of relevantItems) {
    const legacyId = toInt(i['\u05e7\u05d5\u05d3_\u05e4\u05e8\u05d9\u05d8']); // קוד_פריט
    if (!legacyId) continue;
    const orderId = toInt(i['\u05e7\u05d5\u05d3_\u05d4\u05d6\u05de\u05e0\u05d4']); // קוד_הזמנה
    const id = crypto.randomUUID();
    itemLegacyToNewId.set(legacyId, id);
    const sizeVal = toStr(i['\u05de\u05d9\u05d3\u05d4']); // מידה
    itemRows.push([
      id, legacyId, orderId,
      toInt(i['\u05db\u05de\u05d5\u05ea']) || 1, // כמות
      sizeVal, // sizeText
      toStr(i['\u05e4\u05d9\u05e8\u05d5\u05d8_\u05ea\u05d9\u05e7\u05d5\u05df']), // פירוט_תיקון -> alterationDetails
      toBool(i['\u05d1\u05d5\u05e6\u05e2_\u05ea\u05d9\u05e7\u05d5\u05df']), // בוצע_תיקון -> alterationDone
      toStr(i['\u05ea\u05d9\u05e7\u05d5\u05df_\u05d0\u05d5\u05e8\u05da']), // תיקון_אורך -> lengthAlteration
      toBool(i['\u05ea\u05d9\u05e7\u05d5\u05df_\u05e6\u05d5\u05d5\u05d0\u05e8']) ? 1 : 0, // תיקון_צוואר -> neckAlteration
      toBool(i['\u05ea\u05d9\u05e7\u05d5\u05df_\u05e9\u05e8\u05d5\u05d5\u05dc']) ? 1 : 0, // תיקון_שרוול -> sleeveAlteration
      toStr(i['\u05d1\u05e8\u05e7\u05d5\u05d3']), // ברקוד -> barcode
      toInt(i['\u05d1\u05e8_\u05e7\u05d5\u05d3_\u05e7\u05d9\u05d3\u05d5\u05de\u05ea']), // בר_קוד_קידומת -> barcodePrefix
      sizeVal, // size
      toBool(i['\u05e0\u05dc\u05e7\u05d7']), // נלקח -> isTaken
      toBool(i['\u05d4\u05d5\u05d7\u05d6\u05e8']), // הוחזר -> isReturned
      toBool(i['\u05d7\u05d6\u05e8_\u05ea\u05e7\u05d9\u05df']), // חזר_תקין -> returnedOk
      parseFlexibleDate(i['\u05ea\u05d0\u05e8\u05d9\u05da_\u05d4\u05e9\u05db\u05e8\u05d4']), // תאריך_השכרה -> takenDate
      parseFlexibleDate(i['\u05ea\u05d0\u05e8\u05d9\u05da_\u05d4\u05d7\u05d6\u05e8\u05d4']), // תאריך_החזרה -> returnDate
      parseTrueDate(i['\u05ea\u05d0\u05e8\u05d9\u05da_\u05d4\u05d6\u05de\u05e0\u05d4']), // תאריך_הזמנה -> orderDate (true date col)
      toBool(i['\u05de\u05d7\u05d5\u05e7']), // מחוק -> isDeleted
      parseTrueDate(i['\u05ea\u05d0\u05e8\u05d9\u05da_\u05de\u05d7\u05d9\u05e7\u05d4']), // תאריך_מחיקה -> deletedAt
      // cartStatus MUST be 'confirmed', never left at the schema default ('pending').
      // Bug found 2026-08-05: schema default + a stale cartStatusDate makes the
      // orders-list PendingTimer treat every imported historical OrderItem as an
      // active, expired shopping-cart hold badge - never true for a rental imported
      // from Access. Do not remove this.
      'confirmed',
      new Date(), new Date(), // createdAt, updatedAt
    ]);
  }

  const itemResult = await bulkUpsert({
    label: 'OrderItem', table: 'OrderItem', conflictCol: 'legacyId',
    columns: ['id', 'legacyId', 'orderId', 'quantity', 'sizeText', 'alterationDetails', 'alterationDone', 'lengthAlteration', 'neckAlteration', 'sleeveAlteration', 'barcode', 'barcodePrefix', 'size', 'isTaken', 'isReturned', 'returnedOk', 'takenDate', 'returnDate', 'orderDate', 'isDeleted', 'deletedAt', 'cartStatus', 'createdAt', 'updatedAt'],
    updateColumns: [], // insert-only path; ON CONFLICT here would only fire on a re-run of this same tool
    rows: itemRows,
  });
  // For insert-only tables we still want idempotent re-runs to no-op cleanly instead of erroring;
  // give ON CONFLICT a trivial no-op update so re-running this script twice in a row is safe.
  if (itemResult.written === undefined && !WRITE) { /* dry run, nothing to do */ }

  // --- Payment (actual payments, הזמנות_תשלום_ביצוע) ---
  const orderCustomerMap = await getOrderCustomerMap(newOrderIds);
  const paymentRows = [];
  for (const p of relevantPayments) {
    const legacyId = toInt(p['\u05e7\u05d5\u05d3']); // קוד
    if (!legacyId) continue;
    const orderId = toInt(p['\u05e7\u05d5\u05d3_\u05d4\u05d6\u05de\u05e0\u05d4']); // קוד_הזמנה
    const amount = toFloat(p['\u05e1\u05db\u05d5\u05dd']) || 0; // סכום
    paymentRows.push([
      crypto.randomUUID(), legacyId, orderCustomerMap.get(orderId) || null, orderId, amount,
      parseTrueDate(p['\u05ea\u05d0\u05e8\u05d9\u05da_\u05ea\u05e9\u05dc\u05d5\u05dd']) || new Date(), // תאריך_תשלום
      toStr(p['\u05e6\u05d5\u05e8\u05ea_\u05ea\u05e9\u05dc\u05d5\u05dd']), // צורת_תשלום
      toStr(p['\u05d4\u05e2\u05e8\u05d5\u05ea']), // הערות
      false, // isDeleted - no מחוק-equivalent column exists on this Access table
      amount < 0, // isRefund heuristic (no dedicated flag column here)
      new Date(),
    ]);
  }

  const paymentResult = await bulkUpsert({
    label: 'Payment', table: 'Payment', conflictCol: 'legacyId',
    columns: ['id', 'legacyId', 'customerId', 'orderId', 'amount', 'paymentDate', 'paymentMethod', 'notes', 'isDeleted', 'isRefund', 'updatedAt'],
    updateColumns: [],
    rows: paymentRows,
  });

  // --- PaymentObligation (charges, הזמנות_תשלום) ---
  const obligationRows = [];
  for (const p of relevantObligations) {
    const legacyId = toInt(p['\u05e7\u05d5\u05d3']); // קוד
    if (!legacyId) continue;
    const orderId = toInt(p['\u05e7\u05d5\u05d3_\u05d4\u05d6\u05de\u05e0\u05d4']); // קוד_הזמנה
    const price = toFloat(p['\u05de\u05d7\u05d9\u05e8']); // מחיר
    const qty = toInt(p['\u05db\u05de\u05d5\u05ea']); // כמות
    const itemLegacy = toInt(p['\u05e7\u05d5\u05d3_\u05e4\u05e8\u05d9\u05d8']); // קוד_פריט
    const orderItemId = itemLegacy != null ? (itemLegacyToNewId.get(itemLegacy) || null) : null;
    obligationRows.push([
      crypto.randomUUID(), legacyId, orderId,
      toStr(p['\u05e7\u05d5\u05d3_\u05de\u05d5\u05e6\u05e8']), // קוד_מוצר -> productId
      price || 0, qty || 1,
      toStr(p['\u05ea\u05d9\u05d0\u05d5\u05e8']), // תיאור
      parseTrueDate(p['\u05ea\u05d0\u05e8\u05d9\u05da_\u05ea\u05e9\u05dc\u05d5\u05dd']) || new Date(), // תאריך_תשלום -> createdAt
      toBool(p['\u05e4\u05e8\u05d9\u05d8_\u05de\u05d7\u05d5\u05e7']), // פריט_מחוק -> isDeleted
      toBool(p['\u05d6\u05d9\u05db\u05d5\u05d9']) || toBool(p['\u05d6\u05d9\u05db\u05d5\u05d9_\u05de\u05d1\u05d5\u05d8\u05dc']) || (price != null && price < 0) || (qty != null && qty < 0), // isRefund
      orderItemId,
      new Date(),
    ]);
  }

  const obligationResult = await bulkUpsert({
    label: 'PaymentObligation', table: 'PaymentObligation', conflictCol: 'legacyId',
    columns: ['id', 'legacyId', 'orderId', 'productId', 'amount', 'quantity', 'description', 'createdAt', 'isDeleted', 'isRefund', 'orderItemId', 'updatedAt'],
    updateColumns: [],
    rows: obligationRows,
  });

  return {
    item: { accessRelevant: relevantItems.length, ...itemResult },
    payment: { accessRelevant: relevantPayments.length, ...paymentResult },
    obligation: { accessRelevant: relevantObligations.length, ...obligationResult },
  };
}

/**
 * Shift (עובדים_נוכחות) - full upsert keyed on legacyId <-> קוד. Unlike OrderItem/Payment/
 * PaymentObligation, this legacyId join was verified reliable (2026-08-06 probe: every one
 * of 13,807 existing Shift.legacyId values matches a real Access קוד, zero synthetic-junk
 * collisions), so this is a full reload like Customer/Employee/Order - not insert-only.
 *
 * Access-sourced fields (entryTime/exitTime/hebrewDate/date) are refreshed on every run, even
 * for shifts that already exist, so a correction made in Access (e.g. a mistyped punch time)
 * flows through. The derived PAY fields (totalMinutes/hourlyWageSnapshot/travelExpensesSnapshot/
 * totalCalculated) are computed ONLY on first insert and deliberately never recomputed for a
 * shift that already exists - they're pay-affecting snapshots, and re-deriving them from
 * *today's* employee.hourlyWage on every re-run would silently drift historical pay if a wage
 * changed since (the live app has the same no-historical-wage-tracking limitation for brand-new
 * shifts - see lib/shiftCalc.js - but at least existing rows won't keep changing under repeated
 * runs of this tool).
 */
async function processShifts() {
  console.log('\n--- Shift (עובדים_נוכחות) ---');
  const rows = applyLimit(await accessQuery(`SELECT * FROM [עובדים_נוכחות]`));

  const existing = await prisma.shift.findMany({ where: { legacyId: { not: null } }, select: { legacyId: true } });
  const existingSet = new Set(existing.map(r => r.legacyId));

  const employees = await prisma.employee.findMany({ where: { legacyId: { not: null } }, select: { id: true, legacyId: true, hourlyWage: true, travelExpenses: true } });
  const employeeByLegacyId = new Map(employees.map(e => [e.legacyId, e]));

  // Days that already carry a travel-expense credit in PROD (from the live app or a prior run of
  // this tool) - so newly-inserted historical shifts don't double-credit a day already covered.
  const creditedShifts = await prisma.shift.findMany({
    where: { travelExpensesSnapshot: { gt: 0 } },
    select: { employeeId: true, date: true },
  });
  const creditedDaySet = new Set(creditedShifts.map(s => `${s.employeeId}|${s.date ? s.date.toISOString().slice(0, 10) : ''}`));

  let toCreate = 0, toUpdate = 0, empUnresolved = 0;
  const parsed = [];
  for (const s of rows) {
    const legacyId = toInt(s['קוד']);
    if (!legacyId) continue;
    const empLegacy = toInt(s['קוד_עובד']);
    const employee = empLegacy != null ? employeeByLegacyId.get(empLegacy) : null;
    if (!employee) { empUnresolved++; continue; } // Shift.employeeId is a required FK - can't insert/match without it

    const isNew = !existingSet.has(legacyId);
    if (isNew) toCreate++; else toUpdate++;

    const entryTime = parseTrueDate(s['שעת_כניסה']);
    const exitTime = parseTrueDate(s['שעת_יציאה']);
    const hebrewDate = toStr(s['תאריך_עברי']);
    const dateSource = entryTime || exitTime;
    const date = dateSource ? new Date(dateSource.getFullYear(), dateSource.getMonth(), dateSource.getDate()) : null;

    parsed.push({ legacyId, employee, entryTime, exitTime, hebrewDate, date, isNew });
  }

  console.log(`  Access rows: ${rows.length} | will create: ${toCreate} | will update (Access-sourced fields only): ${toUpdate}`);
  console.log(`  Employee link unresolved (קוד_עובד with no matching Employee.legacyId, row skipped): ${empUnresolved}`);

  // Sort brand-new rows chronologically per employee so the once-per-day travel dedup below
  // credits the actual earliest shift of the day, not whatever order Access happened to return.
  const newOnes = parsed.filter(p => p.isNew);
  newOnes.sort((a, b) => {
    if (a.employee.id !== b.employee.id) return a.employee.id < b.employee.id ? -1 : 1;
    const at = a.entryTime ? a.entryTime.getTime() : Infinity;
    const bt = b.entryTime ? b.entryTime.getTime() : Infinity;
    return at - bt;
  });

  const dbRows = [];
  for (const p of newOnes) {
    const { legacyId, employee, entryTime, exitTime, hebrewDate, date } = p;
    const hourlyWageSnapshot = employee.hourlyWage || 0;

    let travelExpensesSnapshot = 0;
    const travelAmount = typeof employee.travelExpenses === 'number' ? employee.travelExpenses : 0;
    if (travelAmount > 0 && date) {
      const dayKey = `${employee.id}|${date.toISOString().slice(0, 10)}`;
      if (!creditedDaySet.has(dayKey)) {
        travelExpensesSnapshot = travelAmount;
        creditedDaySet.add(dayKey);
      }
    }

    let totalMinutes = null, totalCalculated = null;
    if (entryTime && exitTime) {
      totalMinutes = Math.max(0, Math.floor((exitTime.getTime() - entryTime.getTime()) / 60000));
      totalCalculated = parseFloat((((totalMinutes / 60) * hourlyWageSnapshot) + travelExpensesSnapshot).toFixed(2));
    }

    dbRows.push([
      crypto.randomUUID(), legacyId, employee.id, entryTime, exitTime, hebrewDate, date,
      totalMinutes, hourlyWageSnapshot, travelExpensesSnapshot, totalCalculated,
      new Date(),
    ]);
  }
  for (const p of parsed) {
    if (p.isNew) continue;
    const { legacyId, employee, entryTime, exitTime, hebrewDate, date } = p;
    dbRows.push([
      crypto.randomUUID(), legacyId, employee.id, entryTime, exitTime, hebrewDate, date,
      null, null, null, null, // pay fields - ignored on conflict (see updateColumns below), placeholder only
      new Date(),
    ]);
  }

  const result = await bulkUpsert({
    label: 'Shift', table: 'Shift', conflictCol: 'legacyId',
    columns: ['id', 'legacyId', 'employeeId', 'entryTime', 'exitTime', 'hebrewDate', 'date', 'totalMinutes', 'hourlyWageSnapshot', 'travelExpensesSnapshot', 'totalCalculated', 'updatedAt'],
    updateColumns: ['entryTime', 'exitTime', 'hebrewDate', 'date', 'updatedAt'],
    rows: dbRows,
  });

  return { accessCount: rows.length, toCreate, toUpdate, empUnresolved, ...result };
}

// ---------------------------------------------------------------------------
// SystemSetting (הגדרות_ראשי)
// ---------------------------------------------------------------------------
// UNLIKE every other table here, SystemSetting.legacyId in PROD is NOT a
// reliable cross-reference to Access's own קוד column. Investigated 2026-08-06:
// migrate-db.js (the one-time SQLite -> Postgres migration, see its
// `newSettings = settings.map(s => ({ ...s, legacyId: s.id, ... }))`) copied
// the OLD SQLITE APP'S OWN AUTOINCREMENT id into legacyId - a value that
// reflects row-creation order in a completely different, already-modernized
// settings table, not Access's קוד. Confirmed empirically: PROD legacyId=13
// is "max_items_per_order"/100, which is actually Access קוד=59, not קוד=13
// (Access קוד=13 is "אחוז החזר"/50, a wholly unrelated setting that DOES
// exist in PROD - just under legacyId=195). This is the same class of
// synthetic-junk-legacyId problem already documented above for
// OrderItem/Payment/PaymentObligation, just discovered independently here.
// So: existing PROD<->Access rows are matched by CONTENT (category+
// description+value), not by legacyId, and that matching was done by hand
// (see git history / commit message for the full row-by-row audit of all 67
// Access rows against PROD's 52). Of the 67:
//  - 29 already exist in PROD under a different legacyId (or none), matched
//    by content - left untouched.
//  - 6 are genuine gaps with no PROD equivalent and no reason to think the
//    concept was deliberately dropped (rental min/max days, max advance-
//    booking distance, catalog size range/even-only) - these are the only
//    ones this function inserts, via BACKFILL below.
//  - 32 are old Access/desktop-app concepts confirmed superseded or removed
//    (local backup path/schedule, LAN computer name, "close all users",
//    plaintext master password, stale one-time skip-date range, a deliveries
//    feature that was never rebuilt, per-menu-item ACLs replaced by named
//    permission strings, report toggles for report sections that are now
//    either hardcoded-on or don't exist) or are blank/junk rows in Access
//    itself (קוד 57, 71) - never inserted.
// Going forward, newly-inserted rows DO get legacyId = the real Access קוד
// (so a future re-run of this tool is a safe no-op for them via the usual
// ON CONFLICT (legacyId) DO NOTHING), guarded against colliding with one of
// the pre-existing synthetic legacyIds already occupying that same number.
const SYSTEM_SETTING_BACKFILL = [
  { accessCode: 5, key: 'min_rental_days', name: 'מינימום ימי השכרה לשמלה', category: 'הזמנה', type: 'number' },
  { accessCode: 6, key: 'max_rental_days', name: 'מקסימום ימי השכרה לשמלה', category: 'הזמנה', type: 'number' },
  { accessCode: 7, key: 'max_order_days_ahead', name: 'מרחק ימים מרבי להזמנה מראש', category: 'הזמנה', type: 'number' },
  { accessCode: 9, key: 'dress_size_min', name: 'מידה מינימלית במאגר השמלות', category: 'מאגר', type: 'number' },
  { accessCode: 10, key: 'dress_size_max', name: 'מידה מקסימלית במאגר השמלות', category: 'מאגר', type: 'number' },
  { accessCode: 11, key: 'dress_size_even_only', name: 'מידות זוגיות בלבד במאגר השמלות', category: 'מאגר', type: 'boolean' },
];

async function processSystemSettings() {
  console.log('\n--- SystemSetting (הגדרות_ראשי) ---');
  const rows = applyLimit(await accessQuery(`SELECT * FROM [הגדרות_ראשי]`));

  const existing = await prisma.systemSetting.findMany({ select: { legacyId: true, key: true } });
  const existingLegacyIds = new Set(existing.filter(r => r.legacyId != null).map(r => r.legacyId));
  const existingKeys = new Set(existing.map(r => r.key));

  const byCode = new Map(rows.map(r => [toInt(r['קוד']), r]));

  let toCreate = 0, alreadyExists = 0, legacyIdCollisions = 0;
  const dbRows = [];
  for (const def of SYSTEM_SETTING_BACKFILL) {
    const r = byCode.get(def.accessCode);
    if (!r) continue; // Access row not present in this run's export - nothing to backfill from
    if (existingKeys.has(def.key)) { alreadyExists++; continue; } // this tool already inserted it on a prior run

    let legacyId = def.accessCode;
    if (existingLegacyIds.has(legacyId)) {
      // Guards against colliding with one of the pre-existing synthetic
      // (SQLite-era) legacyIds described above - insert without a legacyId
      // rather than corrupt/skip the row via the unique constraint.
      legacyIdCollisions++;
      legacyId = null;
    }

    const value = toStr(r['תוכן']);
    const notes = toStr(r['הערות']);
    toCreate++;
    dbRows.push([
      crypto.randomUUID(), legacyId, def.key, value, def.name, def.category, notes, def.type, new Date(),
    ]);
  }

  console.log(`  Access rows: ${rows.length} | backfill candidates: ${SYSTEM_SETTING_BACKFILL.length} | will create: ${toCreate} | already inserted by a prior run: ${alreadyExists}` +
    (legacyIdCollisions ? ` | legacyId collisions (inserted with legacyId=null instead): ${legacyIdCollisions}` : ''));

  const result = await bulkUpsert({
    label: 'SystemSetting', table: 'SystemSetting', conflictCol: 'legacyId',
    columns: ['id', 'legacyId', 'key', 'value', 'name', 'category', 'notes', 'type', 'updatedAt'],
    updateColumns: [], // INSERT-ONLY: never overwrite value/name/category on an existing row - see header docstring.
    rows: dbRows,
  });

  return { accessCount: rows.length, toCreate, toUpdate: 0, alreadyExists, legacyIdCollisions, ...result };
}

// ---------------------------------------------------------------------------
// PriceList (מחירים) - added 2026-08-09. lib/pricingEngine.js reads PriceList
// live, but this table was previously skipped by this tool, so a price change
// made in Access never reached the app. Full upsert keyed on legacyId <-> קוד
// (verified 2026-08-09: all 9 PROD rows carry a legacyId that matches Access's
// קוד exactly - no synthetic-junk problem here). Access is the source of truth
// for this table; every Access-sourced field is refreshed on each run.
// Both date columns are TRUE Access Date/Time columns (probed 2026-08-09:
// תאריך_סיום_מחיר is the 1970-01-01 NULL-serialization sentinel on every row),
// so parseTrueDate's 1899/1970 sentinel guard applies.
// ---------------------------------------------------------------------------
async function processPriceList() {
  console.log('\n--- PriceList (מחירים) ---');
  const rows = applyLimit(await accessQuery(`SELECT * FROM [מחירים]`));

  const existing = await prisma.priceList.findMany({ where: { legacyId: { not: null } }, select: { legacyId: true } });
  const existingSet = new Set(existing.map(r => r.legacyId));

  let toCreate = 0, toUpdate = 0;
  const dbRows = [];
  for (const p of rows) {
    const legacyId = toInt(p['קוד']); // קוד
    if (!legacyId) continue;
    if (existingSet.has(legacyId)) toUpdate++; else toCreate++;

    dbRows.push([
      crypto.randomUUID(), legacyId,
      toStr(p['תיאור']),                    // תיאור -> description
      toInt(p['ממידה']),                    // ממידה -> fromSize (can legitimately be -1)
      toInt(p['עד_מידה']),                  // עד_מידה -> toSize
      toFloat(p['מחיר']),                   // מחיר -> price
      parseTrueDate(p['תאריך_התחלת_מחיר']), // תאריך_התחלת_מחיר -> startDate
      parseTrueDate(p['תאריך_סיום_מחיר']),  // תאריך_סיום_מחיר -> endDate (sentinel -> null)
      toStr(p['קטגוריה']),                  // קטגוריה -> category (links to DressModel.priceCategory)
      toFloat(p['החזר']),                   // החזר -> deposit
      new Date(),
    ]);
  }

  console.log(`  Access rows: ${rows.length} | will create: ${toCreate} | will update: ${toUpdate}`);

  const result = await bulkUpsert({
    label: 'PriceList', table: 'PriceList', conflictCol: 'legacyId',
    columns: ['id', 'legacyId', 'description', 'fromSize', 'toSize', 'price', 'startDate', 'endDate', 'category', 'deposit', 'updatedAt'],
    updateColumns: ['description', 'fromSize', 'toSize', 'price', 'startDate', 'endDate', 'category', 'deposit', 'updatedAt'],
    rows: dbRows,
  });

  return { accessCount: rows.length, toCreate, toUpdate, ...result };
}

// ---------------------------------------------------------------------------
// Department (מחלקות) - added 2026-08-09. Only 6 rows, but until now nothing
// kept them in sync with Access. Full upsert keyed on legacyId <-> קוד
// (verified 2026-08-09: all 6 PROD rows already carry the exact Access קוד,
// including the special קוד=-2 "הנהלה ראשית" row).
// NOTE Department.roleId (מס_מחלקה) is ALSO unique in the schema; if Access
// ever re-assigns a מס_מחלקה that a DIFFERENT department already holds in the
// DB, blindly upserting would blow the unique constraint mid-batch - such rows
// are skipped with a loud warning instead, for manual resolution.
// ---------------------------------------------------------------------------
async function processDepartments() {
  console.log('\n--- Department (מחלקות) ---');
  const rows = applyLimit(await accessQuery(`SELECT * FROM [מחלקות]`));

  const existing = await prisma.department.findMany({ select: { legacyId: true, roleId: true } });
  const existingSet = new Set(existing.filter(r => r.legacyId != null).map(r => r.legacyId));
  const roleIdOwner = new Map(existing.filter(r => r.legacyId != null).map(r => [r.roleId, r.legacyId]));

  let toCreate = 0, toUpdate = 0, skipped = 0;
  const dbRows = [];
  for (const d of rows) {
    const legacyId = toInt(d['קוד']); // קוד (can legitimately be negative, e.g. -2)
    if (legacyId === null) continue;
    const roleId = toInt(d['מס_מחלקה']); // מס_מחלקה
    const name = toStr(d['שם_מחלקה']);   // שם_מחלקה
    if (roleId === null || !name) { skipped++; continue; } // both NOT NULL in schema

    const owner = roleIdOwner.get(roleId);
    if (owner !== undefined && owner !== legacyId) {
      skipped++;
      console.warn(`  [Department] SKIPPED legacyId=${legacyId} ("${name}"): its roleId=${roleId} is already held by department legacyId=${owner} in the DB (roleId is unique) - resolve manually.`);
      continue;
    }

    if (existingSet.has(legacyId)) toUpdate++; else toCreate++;
    dbRows.push([crypto.randomUUID(), legacyId, roleId, name]);
  }

  console.log(`  Access rows: ${rows.length} | will create: ${toCreate} | will update: ${toUpdate} | skipped: ${skipped}`);

  const result = await bulkUpsert({
    label: 'Department', table: 'Department', conflictCol: 'legacyId',
    columns: ['id', 'legacyId', 'roleId', 'name'], // no updatedAt column on this model
    updateColumns: ['roleId', 'name'],
    rows: dbRows,
  });

  return { accessCount: rows.length, toCreate, toUpdate, skipped, ...result };
}

async function getOrderCustomerMap(orderIdSet) {
  const orders = await prisma.order.findMany({
    where: { orderId: { in: Array.from(orderIdSet) } },
    select: { orderId: true, customerId: true },
  });
  return new Map(orders.map(o => [o.orderId, o.customerId]));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  await initHebrewDateSupport();

  const summary = {};
  summary.customer = await processCustomers();
  summary.department = await processDepartments(); // before Employee - Employee.roleId FKs Department.roleId
  summary.employee = await processEmployees();
  summary.dressModel = await processDressModels();
  summary.dressItem = await processDressItems();
  summary.order = await processOrders();
  summary.subRecords = await processOrderSubRecords(summary.order.newOrderIds);
  summary.shift = await processShifts();
  summary.systemSetting = await processSystemSettings();
  summary.priceList = await processPriceList();

  console.log('\n' + '='.repeat(78));
  console.log(`SUMMARY  (mode: ${WRITE ? 'WRITE' : 'DRY RUN'})`);
  console.log('='.repeat(78));
  for (const key of ['customer', 'department', 'employee', 'dressModel', 'dressItem', 'order', 'shift', 'systemSetting', 'priceList']) {
    const s = summary[key];
    console.log(`${key.padEnd(13)} access=${s.accessCount}  create=${s.toCreate}  update=${s.toUpdate}` +
      (s.written !== undefined ? `  written=${s.written}` : '') +
      (s.failed && s.failed.length ? `  FAILED=${s.failed.length}` : ''));
  }
  const sr = summary.subRecords;
  console.log(`OrderItem    relevant=${sr.item.accessRelevant}` + (sr.item.written !== undefined ? `  written=${sr.item.written}` : '') + (sr.item.failed && sr.item.failed.length ? `  FAILED=${sr.item.failed.length}` : ''));
  console.log(`Payment      relevant=${sr.payment.accessRelevant}` + (sr.payment.written !== undefined ? `  written=${sr.payment.written}` : '') + (sr.payment.failed && sr.payment.failed.length ? `  FAILED=${sr.payment.failed.length}` : ''));
  console.log(`PaymentObl.  relevant=${sr.obligation.accessRelevant}` + (sr.obligation.written !== undefined ? `  written=${sr.obligation.written}` : '') + (sr.obligation.failed && sr.obligation.failed.length ? `  FAILED=${sr.obligation.failed.length}` : ''));

  if (unparsedDates.length) {
    console.log(`\nUnparsed date strings (${unparsedDates.length}) - left null, review if this seems high:`);
    const sample = unparsedDates.slice(0, 25);
    for (const s of sample) console.log(`  - ${s}`);
    if (unparsedDates.length > sample.length) console.log(`  ... and ${unparsedDates.length - sample.length} more`);
  }

  // Print any per-row failures in full for investigation.
  for (const key of ['customer', 'department', 'employee', 'dressModel', 'dressItem', 'order', 'shift', 'systemSetting', 'priceList']) {
    const s = summary[key];
    if (s.failed && s.failed.length) {
      console.log(`\n${key} failed rows:`);
      for (const f of s.failed.slice(0, 20)) console.log(`  ${JSON.stringify(f.row)} -> ${f.error}`);
    }
  }
  for (const [name, r] of [['OrderItem', sr.item], ['Payment', sr.payment], ['PaymentObligation', sr.obligation]]) {
    if (r.failed && r.failed.length) {
      console.log(`\n${name} failed rows:`);
      for (const f of r.failed.slice(0, 20)) console.log(`  ${JSON.stringify(f.row)} -> ${f.error}`);
    }
  }

  console.log('\nDone.' + (WRITE ? '' : '  (dry run - nothing was written; re-run with --write to apply)'));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('FATAL:', e);
  await prisma.$disconnect();
  process.exit(1);
});
