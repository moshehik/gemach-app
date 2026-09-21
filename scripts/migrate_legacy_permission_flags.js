// One-off, idempotent: moves the old per-employee checkboxes into the ONE permissions model.
//   Employee.showAi          = true  ->  EmployeePermissionOverride feature:ai            = true
//   Employee.canReportErrors = true  ->  EmployeePermissionOverride feature:error_reports = true
// The columns are left untouched (rollback-safe) and are no longer read by the app (2026-09-20).
// An employee who already has an override row for that key is left alone; head management (roleId 0)
// and programmer (roleId 2) are skipped (always allowed, nothing to store).
// The override is created even when the employee's department already allows the item, so that
// removing the department's access later can't silently take the employee's personal grant away
// (the old flag was additive and survived that).
//
// Usage:  node scripts/migrate_legacy_permission_flags.js <ENV_FILE> <ENV_VAR> [--apply]
//   e.g.  node scripts/migrate_legacy_permission_flags.js .env TEST_DATABASE_URL          (dry run)
//         node scripts/migrate_legacy_permission_flags.js .env PROD_DATABASE_URL --apply
// The host being written to is printed first; check it before passing --apply.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const crypto = require('crypto');

const [envFile, envVar, flag] = process.argv.slice(2);
if (!envFile || !envVar) { console.error('usage: node migrate_legacy_permission_flags.js <ENV_FILE> <ENV_VAR> [--apply]'); process.exit(1); }
const apply = flag === '--apply';

const raw = fs.readFileSync(path.resolve(envFile), 'utf8');
const m = raw.match(new RegExp('^' + envVar + '="?([^"\\r\\n]+)"?', 'm'));
if (!m) { console.error(envVar + ' not found in ' + envFile); process.exit(1); }
const url = m[1];
const host = url.match(/@([^/:]+)/)[1];

const MAP = [
  { column: 'showAi', key: 'feature:ai' },
  { column: 'canReportErrors', key: 'feature:error_reports' },
];
const NOTE = 'הועבר מתיבת הסימון הישנה בכרטיס העובד (2026-09-20)';

(async () => {
  console.log(`${apply ? 'APPLY' : 'DRY RUN'} against host ${host}`);
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    const cols = (await db.query(`select column_name from information_schema.columns where table_name='Employee'`)).rows.map((r) => r.column_name);
    let created = 0;
    for (const { column, key } of MAP) {
      if (!cols.includes(column)) { console.log(`  column ${column} does not exist here - skipped`); continue; }
      const rows = (await db.query(
        `select e.id, e."firstName", e."lastName", e."roleId",
                exists (select 1 from "EmployeePermissionOverride" o where o."employeeId" = e.id and o.key = $1) as has_override
           from "Employee" e
          where e."${column}" = true and (e."roleId" is null or e."roleId" not in (0, 2))`, [key])).rows;
      console.log(`  ${column}: ${rows.length} flagged employees`);
      for (const r of rows) {
        const name = `${r.firstName || ''} ${r.lastName || ''}`.trim();
        if (r.has_override) { console.log(`    - ${name}: already has an override for ${key}, left as is`); continue; }
        console.log(`    + ${name} (roleId ${r.roleId}) -> ${key} = true`);
        if (apply) {
          await db.query(
            `insert into "EmployeePermissionOverride"(id, "employeeId", key, value, note, "updatedAt") values ($1,$2,$3,'true',$4,now())
             on conflict ("employeeId", key) do nothing`, [crypto.randomUUID(), r.id, key, NOTE]);
        }
        created++;
      }
    }
    console.log(`${apply ? 'created' : 'would create'} ${created} override rows`);
  } finally {
    await db.end();
  }
})().catch((e) => { console.error(e); process.exit(1); });
