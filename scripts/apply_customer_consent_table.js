// יוצר את טבלת יומן ההסכמות CustomerConsent (prisma/migrations-pending/2026-10-12-customer-consent.sql) ב-DB של ארגון אחד.
// *** לא הורץ. dry-run כברירת מחדל: מדפיס את ה-host ואת ה-SQL ואם הטבלה כבר קיימת. כתיבה רק עם --apply וגם --expect-host=<תחילית ה-host שהודפסה> ***
//   node scripts/apply_customer_consent_table.js --org=1            # dry-run
//   node scripts/apply_customer_consent_table.js --org=2 --apply --expect-host=ep-xxxx
// תוספתי בלבד (CREATE TABLE/INDEX IF NOT EXISTS + מפתח זר שנבדק קודם). מריצים בשני הגמ"חים. org2: ה-endpoint מפיל חיבורים - יש retry.
'use strict';
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { parseOrgArg, resolveDbUrl } = require('./lib/db-env');

const SQL_FILE = path.join(__dirname, '..', 'prisma', 'migrations-pending', '2026-10-12-customer-consent.sql');

function parse(argv) {
  const { org, rest } = parseOrgArg(argv);
  let apply = false; let expectHost = null;
  for (const a of rest) {
    if (a === '--apply') apply = true;
    else if (a.startsWith('--expect-host=')) expectHost = a.slice('--expect-host='.length).trim() || null;
    else throw new Error(`unknown argument ${a}`);
  }
  if (apply && !expectHost) throw new Error('--apply requires --expect-host=<host prefix printed by the dry run>');
  return { org, apply, expectHost };
}

async function withRetry(fn, tries = 8) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try { return await fn(); } catch (e) { last = e; console.error(`attempt ${i}/${tries} failed: ${e.message}`); await new Promise((r) => setTimeout(r, 4000)); }
  }
  throw last;
}

async function main() {
  const { org, apply, expectHost } = parse(process.argv.slice(2));
  const url = resolveDbUrl(org);
  const host = new URL(url).hostname;
  console.log(`org${org}: target host ${host}`);
  if (apply && !host.startsWith(expectHost)) throw new Error(`SAFETY ABORT: host ${host} does not start with --expect-host=${expectHost}`);
  const sql = fs.readFileSync(SQL_FILE, 'utf8');
  await withRetry(async () => {
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      const exists = await client.query(`SELECT to_regclass('public."CustomerConsent"') AS t`);
      console.log(`org${org}: CustomerConsent ${exists.rows[0].t ? 'ALREADY EXISTS' : 'does not exist'}`);
      if (!apply) { console.log(`DRY RUN - nothing written. Owner approval needed, then: --apply --expect-host=${host.split('.')[0]}\n\n${sql}`); return; }
      await client.query(sql);
      const after = await client.query(`SELECT to_regclass('public."CustomerConsent"') AS t`);
      console.log(`org${org}: applied. table present: ${!!after.rows[0].t}`);
    } finally {
      await client.end();
    }
  });
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
