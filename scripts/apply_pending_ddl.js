// מחיל קובץ DDL תוספתי ממתין (טבלה חדשה בלבד) על DB של ארגון אחד - לשתי הטבלאות שאין להן סקריפט apply ייעודי:
//   station-event  = scripts/station_event_table.sql            (StationEvent - מדדי העמדה הציבורית /station-analytics)
//   auth-throttle  = prisma/migrations-pending/2026-10-11-auth-throttle.sql   (AuthThrottle - הגבלת ניסיונות verify-pin, #273)
// (CustomerConsent: scripts/apply_customer_consent_table.js ; DressItem.branch: scripts/apply_branches_ddl.js.)
// *** לא הורץ. dry-run כברירת מחדל: מדפיס את ה-host, אם הטבלה כבר קיימת ואת ה-SQL. כתיבה רק עם --apply וגם --expect-host=<תחילית ה-host שהודפסה> ***
//   node scripts/apply_pending_ddl.js --file=station-event --org=1                       # dry-run
//   node scripts/apply_pending_ddl.js --file=station-event --org=2 --apply --expect-host=ep-young-math
//   node scripts/apply_pending_ddl.js --file=auth-throttle --org=1 --apply --expect-host=ep-weathered-tree
// תוספתי בלבד (CREATE TABLE / INDEX IF NOT EXISTS) - בטוח להריץ פעמיים. רשימת הקבצים סגורה (allow-list): אי אפשר להפנות לקובץ SQL אחר.
// אין prisma db push (סחף סכמה ידוע). org2: ה-endpoint מפיל לפעמים חיבורים - יש retry.
'use strict';
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { parseOrgArg, resolveDbUrl } = require('./lib/db-env');

const FILES = {
  'station-event': { sql: path.join(__dirname, 'station_event_table.sql'), table: 'StationEvent' },
  'auth-throttle': { sql: path.join(__dirname, '..', 'prisma', 'migrations-pending', '2026-10-11-auth-throttle.sql'), table: 'AuthThrottle' },
};

function parse(argv) {
  const { org, rest } = parseOrgArg(argv);
  let apply = false; let expectHost = null; let file = null;
  for (const a of rest) {
    if (a === '--apply') apply = true;
    else if (a.startsWith('--expect-host=')) expectHost = a.slice('--expect-host='.length).trim() || null;
    else if (a.startsWith('--file=')) file = a.slice('--file='.length).trim();
    else throw new Error(`unknown argument ${a}`);
  }
  if (!file || !FILES[file]) throw new Error(`--file must be one of: ${Object.keys(FILES).join(', ')}`);
  if (apply && !expectHost) throw new Error('--apply requires --expect-host=<host prefix printed by the dry run>');
  return { org, apply, expectHost, def: FILES[file] };
}

async function withRetry(fn, tries = 8) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try { return await fn(); } catch (e) { last = e; console.error(`attempt ${i}/${tries} failed: ${e.message}`); await new Promise((r) => setTimeout(r, 4000)); }
  }
  throw last;
}

async function main() {
  const { org, apply, expectHost, def } = parse(process.argv.slice(2));
  const url = resolveDbUrl(org);
  const host = new URL(url).hostname;
  console.log(`org${org}: target host ${host}`);
  if (apply && !host.startsWith(expectHost)) throw new Error(`SAFETY ABORT: host ${host} does not start with --expect-host=${expectHost}`);
  const sql = fs.readFileSync(def.sql, 'utf8');
  await withRetry(async () => {
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      const exists = await client.query('SELECT to_regclass($1) AS t', [`public."${def.table}"`]);
      console.log(`org${org}: ${def.table} ${exists.rows[0].t ? 'ALREADY EXISTS' : 'does not exist'}`);
      if (!apply) { console.log(`DRY RUN - nothing written. Then: --apply --expect-host=${host.split('.')[0]}\n\n${sql}`); return; }
      await client.query(sql);
      const after = await client.query('SELECT to_regclass($1) AS t', [`public."${def.table}"`]);
      console.log(`org${org}: applied. table present: ${!!after.rows[0].t}`);
    } finally {
      await client.end();
    }
  });
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
