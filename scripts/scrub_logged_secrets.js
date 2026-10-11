#!/usr/bin/env node
/**
 * ניקוי סודות שנשמרו ביומנים (security-audit.md סעיף 10.5, פריטים 1-2; נכתב 11.10.2026). הרצה חד-פעמית על כל DB (TEST, ואז כל אחד מ-PROD אחרי אישור):
 *
 *   (א) EmailLog.body של מיילי איפוס סיסמה / סיסמה זמנית -> SECRET_BODY_PLACEHOLDER (lib/emailCatalog.js).
 *       מזהים לפי הנושאים של מיילי הקטלוג המסומנים containsSecret, או לפי הדפוס "סיסמה זמנית:" בגוף (TEMP_PASSWORD_BODY_RE).
 *   (ב) AuditLog עם entityType='EmailLog': השדות body / confirmToken ב-changesJson -> "[הוסתר]".
 *   (ג) AuditLog עם entityType='Employee' (password, pinHash) ו-'ApiKey' (keyHash): הערכים בתוך changesJson -> "[הוסתר]", בלי לשנות את המבנה
 *       (גם עותק שורה מלא של יצירה, וגם הפרש {field:{from,to}} של עדכון) - נשמר מי שינה מה ומתי, נמחק רק הערך הסודי.
 *   רשימות השדות זהות ל-AUDIT_SECRET_FIELDS ב-app/lib/prisma.js ול-SECRET_FIELDS_BY_ENTITY ב-app/lib/auditLog.js (scripts/test_scrub_logged_secrets.mjs בודק שוויון).
 *
 * שימוש (ברירת מחדל = DRY RUN, לא נכתב כלום):
 *   node scripts/scrub_logged_secrets.js --confirm-host <host מלא | ep-xxxx> [--i-know-this-is-prod | --not-prod]             # dry-run: ספירה בלבד
 *   node scripts/scrub_logged_secrets.js --confirm-host <...> [--i-know-this-is-prod] --report-only                           # ספירה בלבד של שורות עם סוד פתוח, לכל ישות
 *   node scripts/scrub_logged_secrets.js --confirm-host <...> [--i-know-this-is-prod] --apply                                # כותב (אצוות של 500, טרנזקציה לכל אצווה)
 *
 *   --confirm-host  חובה. ה-host המלא של ה-DB או מזהה ה-endpoint (ep-xxxx), לפחות 8 תווים, התאמה מדויקת - בדיוק כמו scripts/set-ui-variant.js.
 *   --i-know-this-is-prod  נדרש לכל DB שלא זוהה בוודאות כ"לא ייצור" (סגור-בכישלון; אותו קוד זיהוי כמו set-ui-variant.js - checkHost מיובא משם), גם ל-dry-run.
 *   --not-prod      רק ל-host מקומי (localhost / *.test / *.local).
 *   --report-only   מדפיס כמה שורות עדיין מחזיקות סוד לא מוסתר (לכל ישות) ויוצא. לא כותב. מיועד להרצה לפני ואחרי על PROD.
 *   --apply         כותב. מדפיס ספירות לפני / אחרי.
 *   --batch-size N  גודל אצווה (1-500, ברירת מחדל 500).
 *
 * ה-DB: DATABASE_URL (מהסביבה, אחרת מ-.env.local/.env). הסקריפט מדפיס host / database ואת gmach_name מה-DB לפני כל פעולה, ומסרב אם --confirm-host לא תואם.
 * אידמפוטנטי: ערכים שכבר מוסתרים ("***" שנכתב ע"י האפליקציה, "[הוסתר]", ממלא המקום) לא נחשבים סוד ולא נכתבים שוב; הרצה שנייה = 0 שינויים.
 * הסקריפט לעולם לא מדפיס ערכים סודיים (רק ספירות).
 * כתיבה מבוססת compare-and-swap (changesJson / body חייבים עדיין להיות מה שנקרא): שורה ששונתה בינתיים מדולגת ונספרת, והרצה חוזרת תטפל בה.
 * הכתיבה היא SQL ישיר ולכן לא נוצרות שורות AuditLog חדשות (כמו שאר סקריפטי התחזוקה בריפו) ו-updatedAt של השורות לא משתנה.
 */

'use strict';

const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const { checkHost, collectKnownDbs, describeDbTarget } = require('./set-ui-variant.js');

// אותן רשימות כמו app/lib/prisma.js (AUDIT_SECRET_FIELDS) ו-app/lib/auditLog.js (SECRET_FIELDS_BY_ENTITY). הבדיקה משווה בין שלושתן.
const SECRET_FIELDS_BY_ENTITY = {
  Employee: ['password', 'pinHash'],
  ApiKey: ['keyHash'],
  EmailLog: ['body', 'confirmToken'],
};
const MASK = '[הוסתר]';
const APP_MASK = '***'; // מה שהאפליקציה כותבת / מציגה (app/lib/prisma.js, app/lib/auditLog.js)
const MAX_BATCH = 500;
const KNOWN_FLAGS = new Set(['confirm-host', 'apply', 'dry-run', 'report-only', 'i-know-this-is-prod', 'not-prod', 'batch-size', 'help']);
const BOOLEAN_FLAGS = new Set(['apply', 'dry-run', 'report-only', 'i-know-this-is-prod', 'not-prod', 'help']);

const USAGE = [
  'Usage:',
  '  node scripts/scrub_logged_secrets.js --confirm-host <full DB host | ep-xxxx> [--i-know-this-is-prod | --not-prod] [--report-only | --apply] [--batch-size N]',
  'DRY RUN by default: nothing is written unless --apply is given. --report-only prints per-entity counts of rows that still hold unmasked secrets.',
  'Refuses to run unless --confirm-host EXACTLY matches the DB host (same rule as scripts/set-ui-variant.js); every DB is treated as PRODUCTION',
  'and needs --i-know-this-is-prod unless it is the TEST_DATABASE_URL host (or a local host with --not-prod). Never prints secret values.',
].join('\n');

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    let name = arg.slice(2);
    let value;
    const eq = name.indexOf('=');
    if (eq !== -1) { value = name.slice(eq + 1); name = name.slice(0, eq); }
    if (!KNOWN_FLAGS.has(name)) throw new Error(`Unknown flag: --${name}`);
    if (BOOLEAN_FLAGS.has(name)) { opts[name] = true; continue; }
    if (value === undefined) {
      value = argv[++i];
      if (value === undefined || value.startsWith('--')) throw new Error(`Flag --${name} needs a value`);
    }
    opts[name] = value;
  }
  if (opts.help) return opts;
  if (!opts['confirm-host']) throw new Error('--confirm-host <full DB host or ep-xxxx endpoint id> is required');
  if (opts['not-prod'] && opts['i-know-this-is-prod']) throw new Error('--not-prod and --i-know-this-is-prod are mutually exclusive');
  if (opts.apply && opts['dry-run']) throw new Error('--apply and --dry-run are mutually exclusive');
  if (opts.apply && opts['report-only']) throw new Error('--apply and --report-only are mutually exclusive');
  if (opts['batch-size'] !== undefined) {
    const n = Number(opts['batch-size']);
    if (!Number.isInteger(n) || n < 1 || n > MAX_BATCH) throw new Error(`--batch-size must be an integer 1-${MAX_BATCH}`);
    opts.batchSize = n;
  } else {
    opts.batchSize = MAX_BATCH;
  }
  return opts;
}

/** ערך שכבר אינו סוד: ריק, null, או אחד מסמני ההסתרה. */
function isCleanScalar(v, placeholder) {
  return v === '' || v === APP_MASK || v === MASK || (placeholder !== undefined && v === placeholder);
}

/**
 * מחליף כל עלה סודי בערך [הוסתר], בלי לשנות את מבנה ה-JSON ({from,to} / {set} / מערך נשארים).
 * null / '' / סמני הסתרה קיימים / בוליאנים נשארים. מחזיר את אותו אובייקט אם לא השתנה כלום.
 */
function maskValue(v, placeholder) {
  if (v === null || v === undefined) return v;
  if (typeof v === 'string') return isCleanScalar(v, placeholder) ? v : MASK;
  if (typeof v === 'number') return MASK;
  if (typeof v === 'boolean') return v;
  if (Array.isArray(v)) {
    let changed = false;
    const out = v.map((x) => { const y = maskValue(x, placeholder); if (y !== x) changed = true; return y; });
    return changed ? out : v;
  }
  if (typeof v === 'object') {
    let changed = false;
    const out = {};
    for (const [k, x] of Object.entries(v)) { const y = maskValue(x, placeholder); if (y !== x) changed = true; out[k] = y; }
    return changed ? out : v;
  }
  return v;
}

/**
 * מסווה את השדות הסודיים של הישות בתוך changesJson.
 * @returns {{changed:boolean, json:string, unparseable?:boolean}} json = המחרוזת החדשה (או המקורית אם לא השתנה / לא JSON)
 */
function maskChangesJson(entityType, changesJson, placeholder) {
  const fields = SECRET_FIELDS_BY_ENTITY[entityType];
  if (!fields || typeof changesJson !== 'string' || !changesJson) return { changed: false, json: changesJson };
  let parsed;
  try { parsed = JSON.parse(changesJson); } catch (e) { return { changed: false, json: changesJson, unparseable: true }; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { changed: false, json: changesJson };
  let changed = false;
  for (const f of fields) {
    if (!(f in parsed)) continue;
    const next = maskValue(parsed[f], placeholder);
    if (next !== parsed[f]) { parsed[f] = next; changed = true; }
  }
  return changed ? { changed: true, json: JSON.stringify(parsed) } : { changed: false, json: changesJson };
}

async function loadCatalog() {
  return import(pathToFileURL(path.join(ROOT, 'lib', 'emailCatalog.js')).href);
}

/** מספר רק מהערך של count(*) */
const num = (rows) => Number(rows && rows[0] && (rows[0].n ?? 0)) || 0;

/** תנאי SQL (במחרוזת, בלי ערכים) לשורות EmailLog של מייל סודי: נושא מהקטלוג, או דפוס הסיסמה בגוף. $1 = ממלא המקום, $2 = נושאים, $3 = regex. */
const EMAIL_PREDICATE = `body IS NOT NULL AND body <> $1 AND (subject = ANY($2::text[]) OR body ~ $3)`;

/** מקביל ל-TEMP_PASSWORD_BODY_RE כ-regex של Postgres (POSIX ARE). */
const PG_TEMP_PASSWORD_RE = 'סיסמה זמנית[[:space:]]*:';

/** ספירות "סוד פתוח" לכל ישות: { EmailLog_body, AuditLog:{EmailLog,Employee,ApiKey}, unparseable }. קריאה בלבד. */
async function reportCounts(prisma, ctx) {
  const { placeholder, subjects, batchSize } = ctx;
  const out = { emailLogBodies: 0, audit: {}, unparseable: {}, auditScanned: {} };
  out.emailLogBodies = num(await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "EmailLog" WHERE ${EMAIL_PREDICATE}`, placeholder, subjects, PG_TEMP_PASSWORD_RE));
  for (const entityType of Object.keys(SECRET_FIELDS_BY_ENTITY)) {
    let last = '';
    let open = 0;
    let scanned = 0;
    let bad = 0;
    for (;;) {
      const rows = await selectAuditBatch(prisma, entityType, last, batchSize);
      if (rows.length === 0) break;
      for (const r of rows) {
        scanned++;
        const m = maskChangesJson(entityType, r.changesJson, placeholder);
        if (m.changed) open++;
        if (m.unparseable) bad++;
      }
      last = rows[rows.length - 1].id;
    }
    out.audit[entityType] = open;
    out.unparseable[entityType] = bad;
    out.auditScanned[entityType] = scanned;
  }
  return out;
}

function auditPatterns(entityType) {
  return SECRET_FIELDS_BY_ENTITY[entityType].map((f) => `%"${f}"%`);
}

function selectAuditBatch(prisma, entityType, afterId, limit) {
  return prisma.$queryRawUnsafe(
    `SELECT id, "changesJson" FROM "AuditLog" WHERE "entityType" = $1 AND id > $2 AND "changesJson" LIKE ANY($3::text[]) ORDER BY id LIMIT ${Number(limit)}`,
    entityType, afterId, auditPatterns(entityType),
  );
}

function printReport(label, c) {
  console.log(`${label}:`);
  console.log(`  EmailLog rows whose body still holds a temporary password ......... ${c.emailLogBodies}`);
  for (const e of Object.keys(SECRET_FIELDS_BY_ENTITY)) {
    console.log(`  AuditLog entityType=${e.padEnd(8)} rows with an unmasked secret ........ ${c.audit[e]}   (scanned ${c.auditScanned[e]}${c.unparseable[e] ? `, ${c.unparseable[e]} not JSON - skipped` : ''})`);
  }
}

const totalOpen = (c) => c.emailLogBodies + Object.values(c.audit).reduce((a, b) => a + b, 0);

/** (א) EmailLog.body. מחזיר { updated }. dry => לא כותב. */
async function scrubEmailBodies(prisma, ctx, { dry }) {
  const { placeholder, subjects, batchSize } = ctx;
  let updated = 0;
  let last = '';
  for (;;) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id FROM "EmailLog" WHERE ${EMAIL_PREDICATE} AND id > $4 ORDER BY id LIMIT ${Number(batchSize)}`,
      placeholder, subjects, PG_TEMP_PASSWORD_RE, last,
    );
    if (rows.length === 0) break;
    const ids = rows.map((r) => r.id);
    last = ids[ids.length - 1];
    if (dry) { updated += ids.length; continue; }
    const n = await prisma.$transaction(async (tx) => tx.$executeRawUnsafe(
      `UPDATE "EmailLog" SET body = $1 WHERE id = ANY($4::text[]) AND ${EMAIL_PREDICATE}`,
      placeholder, subjects, PG_TEMP_PASSWORD_RE, ids,
    ), { timeout: 60000 });
    updated += Number(n);
  }
  return { updated };
}

/** (ב)+(ג) AuditLog. מחזיר { updated, skipped } לישות. */
async function scrubAudit(prisma, ctx, entityType, { dry }) {
  const { placeholder, batchSize } = ctx;
  let updated = 0;
  let skipped = 0;
  let last = '';
  for (;;) {
    const rows = await selectAuditBatch(prisma, entityType, last, batchSize);
    if (rows.length === 0) break;
    last = rows[rows.length - 1].id;
    const ids = [];
    const olds = [];
    const news = [];
    for (const r of rows) {
      const m = maskChangesJson(entityType, r.changesJson, placeholder);
      if (!m.changed) continue;
      ids.push(r.id); olds.push(r.changesJson); news.push(m.json);
    }
    if (ids.length === 0) continue;
    if (dry) { updated += ids.length; continue; }
    const n = Number(await prisma.$transaction(async (tx) => tx.$executeRawUnsafe(
      `UPDATE "AuditLog" a SET "changesJson" = v.new_json
         FROM unnest($1::text[], $2::text[], $3::text[]) AS v(id, old_json, new_json)
        WHERE a.id = v.id AND a."entityType" = $4 AND a."changesJson" = v.old_json`,
      ids, olds, news, entityType,
    ), { timeout: 60000 }));
    updated += n;
    skipped += ids.length - n;
  }
  return { updated, skipped };
}

/** מריץ את כל הפעולות. prisma וקטלוג מוזרקים (הבדיקות משתמשות בזה). */
async function run(prisma, opts, log = console.log) {
  const cat = await loadCatalog();
  const ctx = { placeholder: cat.SECRET_BODY_PLACEHOLDER, subjects: cat.secretEmailSubjects(), batchSize: opts.batchSize || MAX_BATCH };
  if (!ctx.subjects.length) throw new Error('emailCatalog has no containsSecret subjects - refusing (would match nothing / everything)');

  const before = await reportCounts(prisma, ctx);
  printReport(opts['report-only'] ? 'Unmasked secrets in this database' : 'BEFORE', before);
  if (opts['report-only']) return { before };

  const dry = !opts.apply;
  const result = {};
  result.emailBodies = await scrubEmailBodies(prisma, ctx, { dry });
  for (const entityType of Object.keys(SECRET_FIELDS_BY_ENTITY)) {
    result[entityType] = await scrubAudit(prisma, ctx, entityType, { dry });
  }
  log(`${dry ? 'WOULD change' : 'Changed'}:`);
  log(`  EmailLog.body -> placeholder .................. ${result.emailBodies.updated}`);
  for (const e of Object.keys(SECRET_FIELDS_BY_ENTITY)) {
    log(`  AuditLog ${e.padEnd(8)} changesJson masked ....... ${result[e].updated}${result[e].skipped ? `   (${result[e].skipped} changed concurrently - run again)` : ''}`);
  }
  if (dry) {
    log('DRY RUN - nothing written. Add --apply to write.');
    return { before, result };
  }
  const after = await reportCounts(prisma, ctx);
  printReport('AFTER', after);
  log(totalOpen(after) === 0 ? 'OK: no unmasked secrets remain.' : `NOTE: ${totalOpen(after)} row(s) still hold unmasked secrets (changed concurrently?) - run again.`);
  return { before, result, after };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { console.log(USAGE); return; }

  require(path.join(__dirname, 'lib', 'db-env.js')).loadEnvFiles();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const target = describeDbTarget(url);
  if (process.env.PROD_DATABASE_URL && process.env.PROD_DATABASE_URL !== url) {
    console.warn('WARNING: PROD_DATABASE_URL is also set and differs from DATABASE_URL - the app itself reads PROD_DATABASE_URL first. This script uses DATABASE_URL only.');
  }

  console.log(`DB target: host=${target.host} database=${target.database}`);
  const hostCheck = checkHost(target.host, opts['confirm-host'], collectKnownDbs(), { allowProd: !!opts['i-know-this-is-prod'], notProd: !!opts['not-prod'] });
  if (!hostCheck.ok) {
    console.error(`REFUSING TO RUN: ${hostCheck.reason}`);
    process.exit(2);
  }
  console.log(`DB identity: ${hostCheck.label || '(not one of the known PROD/TEST/org2 env URLs - treated as production)'}${hostCheck.prod ? '  ** PRODUCTION **' : ''}`);

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    const nameRow = await prisma.systemSetting.findUnique({ where: { key: 'gmach_name' }, select: { value: true } });
    const gmachName = nameRow && nameRow.value != null ? String(nameRow.value) : '(no gmach_name setting)';
    console.log(`gmach_name: ${gmachName}`);
    console.log(`mode: ${opts.apply ? 'APPLY (writes)' : opts['report-only'] ? 'REPORT ONLY' : 'DRY RUN'}  batch=${opts.batchSize}`);
    await run(prisma, opts);
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { SECRET_FIELDS_BY_ENTITY, MASK, APP_MASK, parseArgs, maskValue, maskChangesJson, run, reportCounts, EMAIL_PREDICATE, PG_TEMP_PASSWORD_RE };

if (require.main === module) {
  main().catch((err) => {
    console.error('FAILED:', err.message);
    process.exit(1);
  });
}
