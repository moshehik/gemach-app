# neon_keepalive.ps1
# Pings the production /api/health endpoint so Neon's compute doesn't autosuspend
# during working hours. Scheduled via Windows Task Scheduler task
# "GemachApp-NeonKeepAlive" (daily 07:55, repeats every 5 minutes for 14 hours),
# same pattern as the GemachApp-ProdDbBackup nightly job.
# Vercel Hobby crons only run once a day, so the frequent keep-alive runs from
# this machine instead (see vercel.json for the daily cloud cron).
try {
    Invoke-RestMethod -Uri 'https://gemach-app-uyh4-beryl.vercel.app/api/health' -TimeoutSec 30 | Out-Null
} catch {
    # Best-effort: no logging needed, a missed ping just means one cold start.
}
