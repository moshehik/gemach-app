# neon_keepalive.ps1 - DEPRECATED 2026-09-01 - מבוטל לבקשת הבעלים
# היה שומר את Neon ער כל 5 דקות בשעות פעילות (07:55-21:55) דרך /api/health
# בוטל ב-01/09/2026: Task GemachApp-NeonKeepAlive נמחק מהמחשב - Neon מורשה לישון
# כדי לחסוך שעות חישוב. נשאר רק cron יומי 04:00 ב-vercel.json (פעם ביום).
# התכנית החדשה: דגל ב-Vercel יעיר את Neon רק כשיש שינויים, לא כל 5 דקות.
# אם צריך להחזיר: צור מחדש Task עם: powershell.exe -WindowStyle Hidden -File "$PSScriptRoot\neon_keepalive.ps1"
# ראה BACKUPS.md ו-CLAUDE.md
try {
    Invoke-RestMethod -Uri 'https://gemach-app-uyh4-beryl.vercel.app/api/health' -TimeoutSec 30 | Out-Null
} catch {
    # Best-effort: no logging needed, a missed ping just means one cold start.
}