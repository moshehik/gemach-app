---
description: מפעיל את מערכת "11 סוכני הביקורת" של gemach-app (קוד + נתונים בפועל + גיבויים/היסטוריה) ומפיק דוח מרוכז
argument-hint: "[bugs,code-quality,security,orders,attendance,inventory,payments,data-integrity,performance,print-ui,backups-history]"
---

אתה מריץ עכשיו את **מערכת הביקורת של gemach-app** — 11 סוכנים קבועים שכל אחד מתועד ב-`.claude/agents/audit-*.md`. תיעוד מלא ומיועד למשתמש (לא רק לך) נמצא בעמוד `/admin/audit-system` באפליקציה — אם המשתמש שואל "מה זה בכלל", הפנה אותו לשם או סכם את הטבלה משם.

## שלב 0 — קביעת אילו סוכנים להריץ
רשימת ה-11 הסוכנים (slug — subagent_type תואם ב-Agent tool):
`audit-bugs`, `audit-code-quality`, `audit-security`, `audit-orders`, `audit-attendance`, `audit-inventory`, `audit-payments`, `audit-data-integrity`, `audit-performance`, `audit-print-ui`, `audit-backups-history`

הארגומנט שהתקבל (אם בכלל): `$ARGUMENTS`

- אם אין ארגומנט (ריק) — הרץ את **כל 11** הסוכנים.
- אם יש ארגומנט — הוא רשימה מופרדת בפסיקים של שמות קצרים (למשל `orders,inventory` או `bugs`). התאם כל שם לסוכן המתאים (הסירי קידומת `audit-` אם המשתמש כתב אותה במלואה), והרץ **רק** את אלה. אם שם לא מזוהה, ציין זאת למשתמש והתעלם ממנו (אל תיכשל על כל הריצה בגלל שם שגוי אחד).

## שלב 1 — הרצה מקבילית
הפעל את כל הסוכנים הנבחרים דרך כלי ה-`Agent`, **בהודעה אחת** עם קריאה נפרדת לכל סוכן, וב-`run_in_background: false` לכולם (חובה — כדי שכל התוצאות יחזרו לפני שממשיכים לשלב הריכוז). ל-`subagent_type` השתמש בשם המדויק של הסוכן (למשל `audit-orders`). תן לכל אחד prompt קצר שמזכיר: "הרץ את הבדיקה המתועדת שלך על gemach-app עכשיו ודווח לפי הפורמט שהוגדר לך".

## שלב 2 — ריכוז ושמירה ב-DB (לא קובץ)
דוחות **לא** נשמרים כקובץ — הם רשומות בטבלת `AuditReport` בבסיס הנתונים של האפליקציה, מוצגות במסך `/admin/audit-system`. לכל סוכן שרץ, קח את ההודעה הסופית שלו (כבר בפורמט `## <תחום>` + שורות `- [חומרה: X] תיאור — מיקום — המלצה`) ופרסר אותה לאובייקט:

```json
{ "slug": "audit-orders", "label": "הזמנות פגומות", "status": "ok"|"warn"|"error", "findings": [ { "severity": "high"|"medium"|"low", "description": "...", "location": "...", "recommendation": "..." } ] }
```
`status` נגזר מהשורה `**סטטוס:**` שכל סוכן מחזיר (✅→`ok`, ⚠️→`warn`); אם סוכן נכשל/לא החזיר פלט תקין — `status: "error"`, `findings: []`, ותאר את הכשל ב-`description` של ממצא בודד מזוית "שגיאת הרצה" כדי שלא ייעלם בשקט.

1. הרכב אובייקט `{ agents: [ ...כל הסוכנים... ] }` ואת שדות הסיכום: `agentSlugs` (רשימת ה-slugs שרצו, מופרדת בפסיקים), `totalFindings`, `highCount`, `mediumCount`, `lowCount` (סכימה על פני כל הסוכנים).
2. כתוב עם ה-`Write` tool קובץ JSON זמני: `scratch/audit-report-payload-<YYYY-MM-DD-HHmm>.json` בצורה `{ "agentSlugs": "...", "totalFindings": N, "highCount": N, "mediumCount": N, "lowCount": N, "results": { "agents": [...] } }`.
3. הרץ (Bash): `node scripts/insert_audit_report.js scratch/audit-report-payload-<YYYY-MM-DD-HHmm>.json`. הסקריפט קבוע וקיים כבר — אל תכתוב מימוש הכנסה משלך. הוא מדפיס שורת `OK: inserted AuditReport <id>...` בהצלחה, או `FAILED: ...` אם נכשל (למשל DB לא זמין) — אם נכשל, דווח זאת למשתמש במקום להתעלם.

## שלב 3 — סיכום בצ'אט
אחרי ההכנסה המוצלחת, תן למשתמש סיכום קצר בעברית: כמה תחומים ✅ וכמה ⚠️/❌, סה"כ ממצאים, והפניה ל-`/admin/audit-system` לצפייה בדוח המלא בתצוגה המעוצבת. אם יש ממצאי חומרה **גבוה**, ציין אותם בפירוט בגוף הצ'אט — אל תשאיר אותם רק במסך.

## הערות
- זו הרצה יזומה של המפתח/בעל המערכת — אינה מיועדת להרצה אוטומטית ללא פיקוח, ואינה חשופה למשתמשי קצה של האפליקציה.
- סוכני ה-DB (orders/attendance/inventory/payments/data-integrity/backups-history) קוראים בלבד מה-DB הפעיל (PROD/TEST לפי `.active-db`) — הם לא כותבים דבר. אל תשנה את מצב ה-DB הפעיל כחלק מהריצה הזו.
- `audit-backups-history` גם קורא קבצי לוג מקומיים (`backups/*.log`) ומריץ `schtasks /Query` — קריאה בלבד, אף פעם לא מפעיל/מוחק משימות מתוזמנות או קבצי גיבוי.
