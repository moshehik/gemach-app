# Database backups

Three independent layers protect the production data. None replaces the others.

## Layer 0: cloud backup to Google Drive (current system, both gemachs)

[scripts/cloud_backup.js](scripts/cloud_backup.js), run by
[.github/workflows/backup-to-drive.yml](.github/workflows/backup-to-drive.yml) on GitHub's own
infrastructure - not this machine. Covers **both** gemachs (main + Neve Yaakov, separate DBs),
each backed up to Google Drive via the **same shared** Apps Script "archive bridge"
([scripts/lib/driveBridge.js](scripts/lib/driveBridge.js)) that already runs print-center's and
the bagrut site's Drive archiving (`apps-script-send`/`ArchiveBridge.js`, same Google account) -
reused as-is per the owner's decision (2026-09-17): one bridge, one secret, separation between
orgs is purely a distinct Drive **root folder name** per org (`backup_drive_folder_id` setting,
default `gemach-backup-org1`/`gemach-backup-org2` - see "Status" below for why this replaced the
originally-planned per-org GAS mailer routing).

- **Trigger:** a `schedule` cron once daily (cheap - the script itself decides per org whether a
  backup is actually due, based on that org's `backup_interval_hours` setting - see "Why the
  schedule is once daily, not every 15 minutes" below) plus an instant `repository_dispatch`
  fired by the admin's **"גיבוי מיידי"** button on `/admin/backups`
  ([gemach-app-uyh4-beryl.vercel.app/admin/backups](https://gemach-app-uyh4-beryl.vercel.app/admin/backups)
  for the main gemach,
  [gmach-neve-yaakov.vercel.app/admin/backups](https://gmach-neve-yaakov.vercel.app/admin/backups)
  for Neve Yaakov - `app/api/admin/backups/trigger/route.js`) - same instant-trigger pattern as
  the fix-reports agent (`claude-fix-reports.yml`). The button always runs immediately regardless
  of the daily schedule.
- **Managed from the app:** the same `/admin/backups` page (each gemach scoped to its own DB) -
  toggle automatic backups on/off, set the interval (preset hours or a custom number - the field
  still accepts any value, but see the daily-schedule caveat below for what actually happens if
  it's set below 24h), set the Drive root-folder name and the owner email backups are shared to,
  trigger an immediate backup, and see the run history / error log (`BackupRun` rows in
  `prisma/schema.prisma`).
- **Upload path:** a resumable direct-to-Drive REST upload (`archive_token` gets a short-lived
  OAuth token from the bridge, then the calling server talks straight to
  `googleapis.com/drive/v3/...`) - this bypasses GAS's own ~50MB/request ceiling entirely, which
  matters since backups only grow over time (already ~29MB gzipped for org1).
- **Security:** files land in the bridge's Drive account **private by default** (the bridge never
  calls `setSharing` on anything); unlike client-facing email attachments (shared "anyone with
  the link"), each backup is additionally shared only to the specific `backup_owner_email`
  address configured per org via an explicit read-only permission - they contain full
  customer/financial data. The bridge itself is gated by a shared secret (`archiveCheck_` in
  `ArchiveBridge.js`) - `DRIVE_BRIDGE_URL`/`DRIVE_BRIDGE_SECRET` are GitHub secrets, not
  `SystemSetting` rows, since they aren't per-org data (same treatment as `DATABASE_URL`/
  `DATABASE_URL_ORG2`).
- **Retention:** same policy as the old local script - last 14 daily + one per ISO week for the
  8 weeks before that, applied per org against that org's own root folder.
- **Requires**: GitHub secrets `DATABASE_URL`/`DATABASE_URL_ORG2` (already configured from the
  `claude-fix-reports.yml` setup, reused unchanged) plus `DRIVE_BRIDGE_URL`/`DRIVE_BRIDGE_SECRET`
  (added 2026-09-17 - same values already used by `apps-script-send`'s other consumers, see
  `scripts/lib/driveBridge.js`'s header comment for where to find them again if they ever need
  rotating), and Vercel env vars `GH_DISPATCH_TOKEN`/`GH_DISPATCH_REPO` on both projects.

### Why this replaced the old local Task Scheduler job

The old job (Layer 2 below) only ever covered the main gemach (Neve Yaakov had **no** backup at
all beyond Neon's 7-day PITR) and depended on this one Windows machine being powered on and
logged in - if it was off at 03:30, that night was silently skipped. Moving execution to GitHub
Actions removes both problems and covers both orgs from one shared workflow.

### Why the schedule is once daily, not every 15 minutes (2026-09-17)

The workflow originally polled every 15 minutes ("cheap - most ticks just log and exit"), on the
assumption that a no-op due-check costs nothing. That assumption broke while the upload step was
failing (see "Status" below): a run that never reaches `status: 'ok'` never updates "last ok
backup", so **every single 15-minute tick still saw the backup as overdue and ran a brand new
full production DB dump** - not a cheap no-op at all. For roughly a day, org-1 was dumping its
entire database up to ~96 times/day instead of once, burning GitHub Actions minutes and real
Postgres read load for nothing (a contributing factor considered alongside the separate, larger
`/api/error-report` polling leak documented in
[docs/neon-quota-error-report-poll-2026-09-17.md](docs/neon-quota-error-report-poll-2026-09-17.md)
- both are instances of the same pattern: a background loop that looks cheap on paper but isn't,
once its own "am I actually needed right now" check can get stuck permanently answering "yes").
Now that uploads work, this specific case is resolved - but as defense-in-depth against the exact
same waste pattern if some *other* future failure ever gets a run stuck below `ok` again, the
`schedule` trigger was reduced to once daily (`cron: '0 1 * * *'`, ~03:00-04:00 Israel time
depending on DST - see the agent-digest cron entry in [CLAUDE.md](CLAUDE.md) for why a fixed UTC
anchor drifts seasonally, same accepted trade-off here). A stuck run can now waste at most one
extra full dump per day, not up to 96.

**This does not reduce how often backups actually happen** - `backup_interval_hours` (default 24)
already meant one real backup per day for both orgs even under the old 15-minute polling; the
schedule was always just a cheap-looking "is it time yet" check layered on top of that setting,
never the thing deciding the real cadence. The one real behavior change: if an admin sets
`backup_interval_hours` below 24 hours expecting genuinely more-frequent *automatic* backups,
the daily schedule tick is now the ceiling on how often that automatic check even runs - a
6-hour setting, for example, would still only be evaluated once a day and so would still produce
only one backup a day automatically. For anything more frequent than daily, use the **"גיבוי
מיידי"** button on `/admin/backups` (linked above) as many times as needed - it always fires
immediately, independent of both the schedule and the interval setting.

### Status (2026-09-17): live and verified end-to-end for org-1

Merged to `main` on 2026-09-16 ([PR #85](https://github.com/moshehik/gemach-app/pull/85)) still
routing through the org's own mailer GAS project (`email_link_a`) - but every run failed at the
final upload step, because (see the "Cloud backup to Drive" entry in [CLAUDE.md](CLAUDE.md) for
the full investigation) the live mailer script doesn't actually have any Drive-upload code
deployed, only `MailApp` email sending, which hit `Limit Exceeded: Email Total Attachments Size`
on every attempt; org2 was skipped outright (no GAS URL configured for it at all).

**Fixed 2026-09-17**, per the owner's decision: rather than deploy new code into the gemach's own
mailer project, `cloud_backup.js` now uploads through the already-deployed, already-proven shared
"archive bridge" GAS project (see the Layer-0 description above) - zero new GAS code, zero new
deployment, only two new GitHub secrets. Verified for real: a full manual run completed org-1's
dump (29,163,542 bytes, 112s) and uploaded it directly to Drive via the bridge's resumable REST
path; the file was independently confirmed present in the `gemach-backup-org1` root folder
afterward. Org2 will get its first real run once `DATABASE_URL_ORG2` is available to the
workflow (already a configured GitHub secret) on the next scheduled tick.

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

## Layer 2: nightly logical dump (this repo) - superseded by Layer 0

**Superseded by the cloud backup above**, once it has completed a verified successful run for
both orgs - at that point the Windows Scheduled Task (`GemachApp-ProdDbBackup`) gets disabled
(not deleted). `scripts/backup_prod_db.js` stays in place as a manual local fallback (same
treatment `scripts/neon_keepalive.ps1` got when it was retired) - it still works if run by hand
(`npm run backup:prod`), it's just no longer meant to run automatically once the task above is
off. The description below is kept for that manual-fallback use and for historical context.

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

## Log retention cleanup (PageVisitLog / QueryLog)

Two tables grow without bound as the app is used and are excluded from normal business-data
concerns (they're telemetry, not customer/order/payment data):

- `PageVisitLog` - every page view / API call (see `app/management/history/page.js`, which
  also offers manual cleanup - select rows, delete all, or "מחק ישן מ-90 יום" - all gated by
  the same manager-credential check in `app/api/history/route.js`'s `DELETE` handler).
- `QueryLog` - every raw-SQL statement run from the admin Data Explorer
  (`app/admin/data-explorer/page.js` / `app/api/admin/query/route.js`). Its `GET` route only
  ever reads the most recent 50 rows for display - nothing was deleting old ones.

[scripts/cleanup_old_logs.js](scripts/cleanup_old_logs.js) deletes rows older than 90 days
from both tables in one run. It connects directly with the `pg` driver (same approach as
`scripts/backup_prod_db.js`) rather than through `app/lib/prisma.js`, both because that module
is Next-coupled and because a raw `DELETE` avoids flooding `AuditLog` via the app's automatic
audit-logging Prisma extension (see CLAUDE.md). It's idempotent - deleting rows that are
already gone is a no-op - so a missed or duplicate run is harmless.

- **Task name:** `GemachApp-LogCleanup`
- **Trigger:** daily at 03:45 local time (15 minutes after `GemachApp-ProdDbBackup`, to avoid
  the two jobs contending for the same DB connection window)
- **Action:** `node.exe "<repo>\scripts\cleanup_old_logs.js"` - same path-resolution and
  `.env.local`/`.env` loading approach as the backup script, so no `cd` step is needed
- **Runs as:** the current Windows user, only while logged on - same trade-off as the backup
  task; a missed night just means that day's 90-day-old rows get swept up on the next run
- **Run log:** `backups/log-cleanup.log`, one line appended per run (`OK cutoff=... PageVisitLog=<deleted> QueryLog=<deleted> ...s`, or `FAILED <error>`)

### How to verify it ran

```powershell
Get-ScheduledTaskInfo -TaskName "GemachApp-LogCleanup"
Get-Content "<repo>\backups\log-cleanup.log" -Tail 5
```

### To run it manually at any time

```bash
npm run cleanup:logs
# or directly:
node scripts/cleanup_old_logs.js
```

To point it at a different database (e.g. TEST, for verification) without touching
production, override the connection string for that one run:

```bash
CLEANUP_DATABASE_URL="$TEST_DATABASE_URL" node scripts/cleanup_old_logs.js
```

## 2026-09-01 - ביטול keep-alive כל 5 דקות

Task GemachApp-NeonKeepAlive (כל 5 דקות 07:55-21:55) בוטל ונמחק לבקשת הבעלים (01/09/2026). Neon מורשה לישון כדי לחסוך compute. נשאר רק cron יומי 04:00 ב-vercel.json (הוסר גם הוא ב-2026-09-20). התכנית החדשה: דגל ב-Vercel יעיר את Neon רק כשיש שינויים. קובץ scripts/neon_keepalive.ps1 נשאר כמזכרת עם הערת DEPRECATED. החלון השחור כל 5 דקות נפסק.

## Full copy every time - there is no "changes only" mode (2026-09-20)
`scripts/cloud_backup.js` (and the local `scripts/backup_prod_db.js`) read **every row of every table** in a single `REPEATABLE READ, READ ONLY` transaction on each run - `backup_interval_hours` only decides *whether* to run, never *what* to copy. Nothing compares against the previous backup. Current live DBs the backups read (verified 2026-09-20): org1 `ep-weathered-tree-avpypjjr` (us-east-1, GitHub secret `DATABASE_URL` / local `.env`), org2 `ep-broad-night-b1fxha9e` (eu-central-1, GitHub secret `DATABASE_URL_ORG2`). The two backup projects created 2026-09-20 are a one-time snapshot, not a backup target of this system.

## Backups count against Neon egress (2026-09-20)
Neon Free caps **data transfer at 5GB per project per month**, and a backup is a full read of the DB over the wire: org1's dump is ~148MB raw (~29MB after gzip - the gzip happens *after* the transfer). One dump a day ≈ 4.5GB/month; the cloud backup (`backup-to-drive.yml`, daily) **plus** the local `GemachApp-ProdDbBackup` task (03:30, now pointed at the new org1 project) is two dumps a day - more than the whole quota on backups alone. Rules: (1) once the cloud backup has a verified `ok` run for both orgs, disable the local task (`Disable-ScheduledTask -TaskName GemachApp-ProdDbBackup`) - it is meant to be a manual fallback only; (2) don't lower `backup_interval_hours` below 24 without checking the project's current egress in the Neon console; (3) the 7-day PITR (Layer 1) is not egress and already covers short-range recovery, so 48-72h intervals are a reasonable trade if the quota is tight. Context: [docs/vercel-resource-audit-2026-09-20.md](docs/vercel-resource-audit-2026-09-20.md).
