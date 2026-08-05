# Database backups

Two independent layers protect the production Neon database. Neither replaces the other.

## Layer 1: Neon PITR (point-in-time restore)

The `gemach-db` Neon project has `history_retention_seconds` set to `604800` (7 days) - the
maximum retention window on the org's current "Launch" plan. This is Neon's built-in
continuous WAL-based history: from the Neon console (or API) you can branch/restore the
production branch to any instant within the last 7 days.

**What it covers:** accidental writes, bad migrations, "oops I deleted the wrong rows" -
anything within the last 7 days.

**What it does *not* cover:**
- Anything older than 7 days.
- A portable, off-Neon copy of the data. PITR only gets you back to a point *inside Neon* -
  if the Neon project itself were lost, misconfigured, or the account inaccessible, PITR is
  gone with it. There is no "export a PITR snapshot to a file" operation.
- Confirmed by inspecting the project via the Neon Management API (`GET /projects/{id}`):
  there is no scheduled-export / scheduled-backup-to-file endpoint on this plan - branching
  and restore are the only built-in mechanisms.

## Layer 2: nightly logical dump (this repo)

[scripts/backup_prod_db.js](scripts/backup_prod_db.js) is the additional layer: a portable,
compressed plain-SQL export you can keep outside Neon entirely.

- **What it covers:** a full logical copy of every table's data (all 23 models in
  `prisma/schema.prisma`), as of one consistent instant (it runs inside a single
  `REPEATABLE READ, READ ONLY` transaction so nothing is torn mid-dump).
- **Why not `pg_dump`:** real `pg_dump`/`psql` are not installed on this machine (verified
  with `pg_dump --version`). The script reimplements the relevant slice of `pg_dump --inserts`
  using the `pg` driver already in `package.json`: it introspects `information_schema` for
  every base table and foreign key in the `public` schema, topologically sorts tables
  (parents before children) so the dump loads cleanly without disabling constraints, and
  streams each table out as batched `INSERT INTO ... VALUES (...), (...);` statements.
- **Schema is not included in the dump** - it doesn't need to be. `prisma/schema.prisma` is
  already the version-controlled source of truth for the schema and is restored separately
  (see below).
- **Where dumps land:** `backups/gemach-prod-YYYY-MM-DD.sql.gz` (gitignored - see
  `.gitignore`). One file per calendar day.
- **Retention/rotation:** the script keeps the most recent 14 daily dumps, plus one dump per
  ISO calendar week for the 8 weeks before that; everything older is deleted automatically
  at the end of each run.
- **Run log:** `backups/backup.log`, one line appended per run (`OK ...` with row/byte/timing
  summary, or `FAILED <error>`).

### Restoring from a dump (disaster recovery)

1. Recreate the schema on the target database (a fresh Neon branch, a new project, wherever
   you're restoring to) from the versioned Prisma schema:

   ```bash
   DATABASE_URL="<target-connection-string>" npx prisma db push --schema=prisma/schema.prisma
   ```

2. Load the data from a dump file with `psql` (get `psql`/`pg_dump` via the PostgreSQL
   installer if this machine still doesn't have it - or run this step from any machine that
   does, pointed at the target connection string):

   ```bash
   gunzip -c backups/gemach-prod-2026-08-05.sql.gz | psql "<target-connection-string>"
   ```

   The dump wraps everything in a single `BEGIN; ... COMMIT;` - if anything fails partway,
   nothing is left half-loaded (`psql` stops on the first error by default; add `-v ON_ERROR_STOP=1`
   to be explicit).

   Use a **non-pooled** target connection string when restoring a large dump (drop `-pooler`
   from the Neon host, e.g. `ep-royal-dawn-asr9j84y.c-4.eu-central-1.aws.neon.tech`) - the
   restore is a single long-lived session and a pgbouncer transaction-pooled endpoint can be
   more prone to idling out mid-restore.

3. Restore into a **fresh/empty** target - the dump does not `TRUNCATE` first, so restoring
   on top of an already-populated database will fail on primary-key/unique conflicts. That's
   intentional: it stops you from accidentally clobbering a live database with an old dump.

## Scheduling

A Windows Task Scheduler job runs the backup automatically:

- **Task name:** `GemachApp-ProdDbBackup` (visible in Task Scheduler's root folder, or via
  `schtasks /Query /TN "GemachApp-ProdDbBackup" /V /FO LIST`)
- **Trigger:** daily at 03:30 local time
- **Action:** `node.exe "<repo>\scripts\backup_prod_db.js"` - the script resolves its own
  paths (`.env.local`/`.env`, `backups/`) relative to its own file location, not the working
  directory, so no `cd` step is needed in the task action.
- **Runs as:** the current Windows user, only while logged on (no stored credentials -
  nothing to rotate, nothing that required entering a password to set up). If this machine
  is off or the user is logged out at 03:30, that day's run is simply skipped - the 14-day
  daily retention absorbs the occasional missed night.
- This project has no other cron/scheduler already in use (checked `.claude/` and the repo
  for existing scheduled-task references before choosing this), so Task Scheduler - already
  built into Windows - was used rather than introducing new infrastructure.

### How to verify it ran

```powershell
# Task Scheduler's own record of the last/next run and result code
Get-ScheduledTaskInfo -TaskName "GemachApp-ProdDbBackup"

# The script's own run log (one line per run)
Get-Content "<repo>\backups\backup.log" -Tail 5

# The actual dump files present, with size/date
Get-ChildItem "<repo>\backups" -Filter "gemach-prod-*.sql.gz" | Sort-Object LastWriteTime -Descending
```

A `LastTaskResult` of `0` and a matching `OK ...` line in `backup.log` for today's date means
last night's backup succeeded. Anything else (nonzero result code, or a `FAILED ...` line)
means it needs attention - the underlying error message is in `backup.log` and in the Task
Scheduler history tab for that task.

### To run a backup manually at any time

```bash
npm run backup:prod
# or directly:
node scripts/backup_prod_db.js
```
