// יצירת הטבלה PolicyQuestionnaireResponse (שאלון המדיניות להנהלות) בגמח אחד, ידנית ובאישור הבעלים. **לא רץ אוטומטית, לא מהאפליקציה, לא מהבנייה.**
// ברירת מחדל = DRY-RUN: מדפיס את ה-SQL, את שם משתנה החיבור, את ה-host ואת gmach_name של ה-DB שנבחר, ואת מצב הטבלה (קריאה בלבד:
// שני SELECT-ים, בלי שום כתיבה). כתיבה רק עם --write המפורש, ורק אחרי אישור מפורש של הבעלים בזמן ההרצה (כלל: אין DDL בלי אישור).
//   node scripts/apply_policy_questionnaire_table.js --org=1 --db-env=<קובץ env>            (dry-run)
//   node scripts/apply_policy_questionnaire_table.js --org=2 --db-env=<קובץ env>
//   node scripts/apply_policy_questionnaire_table.js --org=2 --db-env=<קובץ env> --no-connect (מדפיס רק את ה-SQL, בלי להתחבר ל-DB בכלל)
//   node scripts/apply_policy_questionnaire_table.js --org=1 --db-env=<קובץ env> --write    (מריץ את ה-SQL בטרנזקציה אחת)
// --org=1|2 חובה (אין ברירת מחדל). חיבור: **רק** PROD_DATABASE_URL (גמח 1) ו-PROD_DATABASE_URL_ORG2 (גמח 2), ושניהם חובה; נקראים מ---db-env=<קובץ>
// (עדיפות) או מהסביבה / .env.local / .env. אין נפילה ל-DATABASE_URL (שיכול להצביע על TEST/מקומי). בדיקת זהות לפני כל פעולה:
//   1. ה-host של היעד לא ריק ושונה מה-host של הגמח השני.
//   2. gmach_name (SystemSetting) של ה-DB חייב להתאים לגמח שנבחר: org1 = "מכובד" (ולא "נווה"), org2 = "נווה יעקב". אי התאמה = עצירה, גם ב-dry-run.
// ה-SQL נקרא מ-prisma/migrations-pending/2026-10-06-policy-questionnaire-response.sql (מקור אמת יחיד: מה שנבדק ב-dry-run הוא מה שמורץ) ונבדק
// שהוא תוספת בלבד: רק CREATE TABLE / CREATE [UNIQUE] INDEX עם IF NOT EXISTS; כל משפט אחר (DROP / ALTER / DELETE / TRUNCATE / UPDATE...) = עצירה.
// ההרצה בטרנזקציה אחת (DDL ב-Postgres הוא טרנזקציוני) ובסופה בדיקה שהטבלה והאינדקס קיימים. אפשר להריץ שוב בבטחה (idempotent).
// סדר העבודה המלא: docs/refund-questionnaire.md.
'use strict';

const fs = require('fs');
const path = require('path');
const { loadEnvFiles } = require('./lib/db-env');

const SQL_FILE = path.join(__dirname, '..', 'prisma', 'migrations-pending', '2026-10-06-policy-questionnaire-response.sql');
const TABLE = 'PolicyQuestionnaireResponse';
const UNIQUE_INDEX = 'PolicyQuestionnaireResponse_questionnaireKey_employeeId_key';
const ALLOWED_STATEMENT = /^CREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX)\s+IF\s+NOT\s+EXISTS\s+/i;
const KNOWN_FLAGS = new Set(['--write', '--no-connect']);

const hostOf = (url) => (String(url).match(/@([^/?]+)/) || [])[1] || '';

/** מפצל קובץ SQL לפקודות: מסיר שורות הערה שלמות (--) ומפצל לפי ';' (בקובץ הזה אין ';' בתוך מחרוזות). */
function statementsOf(text) {
  return String(text).replace(/\r\n/g, '\n').split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
    .split(';').map((s) => s.trim()).filter(Boolean);
}

/** זורק אם יש משפט שאינו CREATE ... IF NOT EXISTS, או שמופיעה בו מילה הרסנית. מחזיר את רשימת המשפטים. */
function assertAdditiveOnly(statements) {
  if (!statements.length) throw new Error('ABORT: the SQL file has no statements');
  for (const s of statements) {
    if (!ALLOWED_STATEMENT.test(s)) throw new Error(`ABORT: statement is not "CREATE TABLE|INDEX IF NOT EXISTS" (additive only): ${s.slice(0, 60)}`);
    if (/\b(DROP|ALTER|DELETE|TRUNCATE|UPDATE|INSERT|GRANT|REVOKE)\b/i.test(s)) throw new Error(`ABORT: destructive keyword in statement: ${s.slice(0, 60)}`);
  }
  return statements;
}

/** מנרמל שם גמח להשוואה: בלי גרשיים/מקפים/פיסוק ורווחים כפולים. */
function normalizeGmachName(name) {
  return String(name || '').replace(/["'׳״`\-־–—.,]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** האם gmach_name שייך לגמח org (1 = מכובד, 2 = נווה יעקב). */
function gmachNameMatchesOrg(name, org) {
  const n = normalizeGmachName(name);
  if (!n) return false;
  if (org === 1) return n.includes('מכובד') && !n.includes('נווה');
  if (org === 2) return n.includes('נווה יעקב');
  return false;
}

/** מפרק argv: --org=1|2 חובה, --db-env=<קובץ> אופציונלי, --write / --no-connect; כל דגל אחר = עצירה. */
function parseArgs(argv) {
  let org = null;
  let dbEnv = null;
  const flags = new Set();
  for (const a of argv) {
    let m;
    if ((m = /^--org=(.*)$/.exec(a))) {
      if (m[1] !== '1' && m[1] !== '2') throw new Error(`ABORT: --org must be 1 or 2, got "${m[1]}"`);
      org = Number(m[1]);
    } else if ((m = /^--db-env=(.+)$/.exec(a))) {
      dbEnv = m[1];
    } else if (KNOWN_FLAGS.has(a)) {
      flags.add(a);
    } else {
      throw new Error(`ABORT: unknown argument "${a}" (allowed: --org=1|2 --db-env=<file> --write --no-connect)`);
    }
  }
  if (org === null) throw new Error('ABORT: --org=1|2 is required (there is no default org)');
  const write = flags.has('--write');
  const noConnect = flags.has('--no-connect');
  if (write && noConnect) throw new Error('ABORT: --write and --no-connect cannot be combined');
  return { org, dbEnv, write, noConnect };
}

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

/** בוחר את כתובות החיבור של שני הגמחים (חובה ששניהם קיימים, בלי נפילה ל-DATABASE_URL) ובודק host. מחזיר { url, host, otherHost, varName, src }. */
function pickConnection(org, dbEnvFile, env = process.env) {
  const names = { 1: 'PROD_DATABASE_URL', 2: 'PROD_DATABASE_URL_ORG2' };
  const fileVars = dbEnvFile ? parseEnvFile(path.resolve(dbEnvFile)) : {};
  const pick = (n) => (fileVars[names[n]] ? { url: fileVars[names[n]], src: `--db-env ${dbEnvFile}` } : { url: env[names[n]], src: 'process env / .env.local / .env' });
  const mine = pick(org);
  const other = pick(org === 1 ? 2 : 1);
  if (!mine.url || !other.url) {
    const missing = [!mine.url && names[org], !other.url && names[org === 1 ? 2 : 1]].filter(Boolean).join(', ');
    throw new Error(`ABORT: ${missing} not set (both PROD_DATABASE_URL and PROD_DATABASE_URL_ORG2 are required; there is NO fallback to DATABASE_URL). Pass --db-env=<env file> or export them.`);
  }
  const host = hostOf(mine.url);
  const otherHost = hostOf(other.url);
  if (!host || host === otherHost) throw new Error(`ABORT: org${org} host "${host}" is empty or equals the other org's host "${otherHost}"`);
  return { url: mine.url, host, otherHost, varName: names[org], src: mine.src };
}

async function main() {
  const { org, dbEnv, write, noConnect } = parseArgs(process.argv.slice(2));
  const statements = assertAdditiveOnly(statementsOf(fs.readFileSync(SQL_FILE, 'utf8')));
  console.log(`mode: ${write ? 'WRITE' : 'dry-run (no writes)'} | org${org} | SQL file: ${path.relative(path.join(__dirname, '..'), SQL_FILE)}`);
  console.log('--- SQL that would run (additive only, one transaction) ---');
  for (const s of statements) console.log(`${s};\n`);
  if (noConnect) { console.log('--no-connect: no database connection was opened. Nothing else to do.'); return; }

  if (!dbEnv) loadEnvFiles();
  const conn = pickConnection(org, dbEnv, process.env);
  console.log(`org${org} uses ${conn.varName} from ${conn.src}`);
  console.log(`org${org} DB host: ${conn.host} (other org: ${conn.otherHost}) - compare with the DB host of the matching Vercel project`);

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: conn.url } } });
  try {
    // זהות: gmach_name (SELECT בלבד). אי התאמה = עצירה, גם ב-dry-run.
    const nameRows = await prisma.$queryRawUnsafe(`SELECT "value" FROM "SystemSetting" WHERE "key" = 'gmach_name' LIMIT 1`);
    const gmachName = nameRows && nameRows[0] ? nameRows[0].value : null;
    console.log(`org${org} gmach_name in this DB: ${JSON.stringify(gmachName)}`);
    if (!gmachNameMatchesOrg(gmachName, org)) {
      throw new Error(`ABORT: gmach_name ${JSON.stringify(gmachName)} does not match org${org} (${org === 1 ? 'expected "מכובד"' : 'expected "נווה יעקב"'}). Wrong database for --org=${org}.`);
    }
    const state = await prisma.$queryRawUnsafe(`SELECT to_regclass('public."${TABLE}"') IS NOT NULL AS table_exists, to_regclass('public."${UNIQUE_INDEX}"') IS NOT NULL AS index_exists`);
    const st = state && state[0] ? state[0] : {};
    console.log(`table "${TABLE}" exists: ${!!st.table_exists} | unique index exists: ${!!st.index_exists}`);
    if (st.table_exists && st.index_exists) { console.log('Nothing to do - the table and its unique index already exist.'); return; }
    if (!write) { console.log('dry-run - nothing was written. Pass --write (only with the owner\'s explicit approval at execution time) to apply.'); return; }

    await prisma.$transaction(async (tx) => {
      for (const s of statements) await tx.$executeRawUnsafe(s);
      const after = await tx.$queryRawUnsafe(`SELECT to_regclass('public."${TABLE}"') IS NOT NULL AS table_exists, to_regclass('public."${UNIQUE_INDEX}"') IS NOT NULL AS index_exists`);
      if (!after[0] || !after[0].table_exists || !after[0].index_exists) throw new Error('ABORT (rolled back): table or unique index missing after the statements ran');
    }, { timeout: 60000 });
    console.log(`org${org} (${conn.host}): table "${TABLE}" and its unique index are in place.`);
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { statementsOf, assertAdditiveOnly, normalizeGmachName, gmachNameMatchesOrg, parseArgs, pickConnection, SQL_FILE };

if (require.main === module) {
  main().catch((e) => { console.error(e.message || e); process.exit(1); });
}
