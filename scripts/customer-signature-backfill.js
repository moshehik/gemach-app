// מילוי חתימת התקנון ברמת הלקוח מההזמנות החתומות, לגמח אחד. ברירת מחדל = DRY-RUN (קריאה בלבד); כתיבה רק עם --write.
//   node scripts/customer-signature-backfill.js --org=1 --db-env=<קובץ env>            (dry-run: זהות DB + עמודות + מספרים + דגימה מוצפנת)
//   node scripts/customer-signature-backfill.js --org=2 --db-env=<קובץ env>
//   node scripts/customer-signature-backfill.js --org=1 --db-env=<קובץ env> --write    (מריץ את ה-UPDATE בטרנזקציה אחת; מתבטל אם מספר השורות שונה מה-DRY-RUN)
// חיבור: **רק** PROD_DATABASE_URL (גמח 1) ו-PROD_DATABASE_URL_ORG2 (גמח 2), ושניהם חובה (כדי לבדוק שה-host של האחד שונה מהשני). הם נקראים מ-
// --db-env=<קובץ> (עדיפות; למשל .env.local של הריפו הראשי) או מהסביבה / .env.local / .env של ה-worktree. הסקריפט **לא נופל בשקט** ל-DATABASE_URL
// (שיכול להצביע על TEST/מקומי) - משתנה חסר = עצירה. בכל ריצה מודפס שם המשתנה, מקורו וה-host - להשוות ל-host ה-DB של פרויקט ה-Vercel של אותו גמח.
// ה-SQL עצמו נקרא מהקבצים שב-prisma/migrations-pending (2026-10-05-customer-signature-backfill*.sql) - מקור אמת יחיד, כך שמה שנבדק
// כ-dry-run הוא בדיוק מה שמורץ. ה-host נבדק (לא ריק ושונה מה-host של הגמח השני) לפני כל פעולה, ומודפס.
// לא מריץ שום DDL, לא נוגע ב-AuditLog, לא נוגע ב-Customer.updatedAt. סדר הפעולות המלא: docs/customer-signature-rollout-2026-10-05.md.
'use strict';

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { loadEnvFiles, parseOrgArg } = require('./lib/db-env');

const DIR = path.join(__dirname, '..', 'prisma', 'migrations-pending');
const DRYRUN_FILE = path.join(DIR, '2026-10-05-customer-signature-backfill-dryrun.sql');
const BACKFILL_FILE = path.join(DIR, '2026-10-05-customer-signature-backfill.sql');

/** מפצל קובץ SQL לפקודות: מסיר שורות הערה שלמות (--) ומפצל לפי ';' (בקבצים האלה אין ';' בתוך מחרוזות). */
function statementsOf(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  return text.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').split(';').map((s) => s.trim()).filter(Boolean);
}

const hostOf = (url) => (String(url).match(/@([^/?]+)/) || [])[1] || '';

/** קובץ env (KEY=VALUE, הערות #, גרשיים אופציונליים) -> אובייקט. */
function parseEnvFile(file) {
  const out = {};
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[line.slice(0, eq).trim()] = v;
  }
  return out;
}

/**
 * מחבר לגמח org אחרי בדיקות: PROD_DATABASE_URL (org1) / PROD_DATABASE_URL_ORG2 (org2) חובה, ושניהם קיימים; ה-host של היעד לא ריק ושונה מה-host של הגמח
 * השני. אין נפילה ל-DATABASE_URL. מחזיר { prisma, host }; הקורא מנתק.
 */
function connectStrict(org, write, dbEnvFile) {
  const fileVars = dbEnvFile ? parseEnvFile(path.resolve(dbEnvFile)) : {};
  if (!dbEnvFile) loadEnvFiles();
  const names = { 1: 'PROD_DATABASE_URL', 2: 'PROD_DATABASE_URL_ORG2' };
  const pick = (n) => (fileVars[names[n]] ? { url: fileVars[names[n]], src: `--db-env ${dbEnvFile}` } : { url: process.env[names[n]], src: 'process env / .env.local / .env' });
  const mine = pick(org);
  const other = pick(org === 1 ? 2 : 1);
  if (!mine.url || !other.url) {
    const missing = [!mine.url && names[org], !other.url && names[org === 1 ? 2 : 1]].filter(Boolean).join(', ');
    throw new Error(`ABORT: ${missing} not set (both PROD_DATABASE_URL and PROD_DATABASE_URL_ORG2 are required; there is NO fallback to DATABASE_URL). Pass --db-env=<env file> or export them.`);
  }
  const host = hostOf(mine.url);
  const otherHost = hostOf(other.url);
  if (!host || host === otherHost) throw new Error(`ABORT: org${org} host "${host}" is empty or equals the other org's host "${otherHost}"`);
  console.log(`org${org} uses ${names[org]} from ${mine.src}`);
  console.log(`org${org} DB host: ${host} (other org: ${otherHost}) | mode: ${write ? 'WRITE' : 'dry-run'} - compare with the DB host of the matching Vercel project`);
  return { prisma: new PrismaClient({ datasources: { db: { url: mine.url } } }), host };
}

// BigInt (count(*)) -> Number כדי ש-console/JSON יציגו
const plain = (rows) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v])));

async function main() {
  const { org, rest } = parseOrgArg(process.argv.slice(2));
  const write = rest.includes('--write');
  const dbEnvArg = rest.find((a) => a.startsWith('--db-env='));
  const { prisma, host } = connectStrict(org, write, dbEnvArg ? dbEnvArg.slice('--db-env='.length) : null);
  try {
    const cols = plain(await prisma.$queryRawUnsafe(
      `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'Customer' AND column_name IN ('hasSignedRegulations','regulationsSignedAt') ORDER BY column_name`));
    console.log(`org${org} (${host}) Customer signature columns:`, JSON.stringify(cols));
    if (cols.length !== 2) throw new Error('ABORT: both signature columns must exist on "Customer" before the backfill (run 2026-10-04-customer-signed-regulations.sql first)');

    const [counts, sample] = statementsOf(DRYRUN_FILE);
    const c = plain(await prisma.$queryRawUnsafe(counts))[0];
    console.log('counts:', JSON.stringify(c));
    console.log('sample (anonymised):', JSON.stringify(plain(await prisma.$queryRawUnsafe(sample))));
    if (!write) { console.log('dry-run - pass --write to apply'); return; }

    const stmts = statementsOf(BACKFILL_FILE);
    if (stmts.length !== 1) throw new Error('ABORT: backfill file must contain exactly one statement');
    const expected = c.would_change;
    const updated = await prisma.$transaction(async (tx) => {
      const n = await tx.$executeRawUnsafe(stmts[0]);
      if (n !== expected) throw new Error(`ABORT (rolled back): updated ${n} rows but the dry-run said ${expected}`);
      return n;
    }, { timeout: 120000 });
    console.log(`org${org}: backfill updated ${updated} customers`);
    const after = plain(await prisma.$queryRawUnsafe(counts))[0];
    console.log('counts after (would_change must be 0):', JSON.stringify(after));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
