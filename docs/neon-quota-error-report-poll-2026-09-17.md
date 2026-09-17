# חריגת מכסת נאון (Neve Yaakov) — אבחון ותיקון (2026-09-17)

## התלונה
המשתמש דיווח שקונסולת Neon הראתה חריגה של 100% מתוך מכסת "5GB" עבור טוקן/פרויקט
מסוים. בפועל תוכנית ה-Free של Neon נותנת **5GB תעבורת רשת (egress) לחודש, לכל
פרויקט בנפרד** (לא לכל החשבון) — יחד עם 0.5GB אחסון ו-100 שעות-CU, גם הן per-project.

## מיפוי חשבונות נאון (התגלה כחלק מהאבחון)
יש **שני חשבונות/ארגונים נפרדים** של נאון, עם מכסות נפרדות לגמרי:

1. **חשבון א'** — הקונסולה `moshehik@gmail.com` (`org-young-fire-22908884`, plan
   `free`). מכיל 5 פרויקטים, כל אחד עם 5GB תעבורה משלו:
   - `gemach-dresses-2` (`jolly-silence-63127698`) — **זה נווה יעקב האמיתי, בשימוש
     חי**. `PROD_DATABASE_URL` הנוכחי ב-`scratch/new_gemach_db.env` מצביע לענף
     `reimport-staging-2026-09-15` שלו (`ep-broad-night-b1fxha9e`) — הענף הזה משמש
     בפועל כ-production מאז ה-cutover של 15/09 (ר' `docs/neve-yaakov-full-reimport-2026-09-15.md`),
     למרות שם הענף עדיין "staging". **זה הפרויקט שחרג ממכסת התעבורה.**
   - `gemach-db` (`morning-morning-55300514`, 390MB) — **פרויקט מיותם**: עותק ישן/כפול
     של מסד הגמ"ח הראשי (27,371 הזמנות / 22,033 לקוחות נכון לבדיקה, כמעט זהה
     ל-27,394/22,039 בייצור האמיתי), קפוא מאז ~25/08, ללא פעילות. לא מזיק (0 תעבורה
     החודש) אבל תופס 76% מהאחסון שלו בחינם. מועמד למחיקה לאחר אישור המשתמש.
   - `print-center-NOW`, `print-center`, `bagrut-materials` — לא קשורים לגמ"ח, לא
     פעילים (0 תעבורה).
2. **חשבון ב'** — פרויקט Neon שנוצר אוטומטית דרך אינטגרציית Vercel (`prj_ZZT2jYlvQZbQtN2evU5cfL3dOZzQ`,
   team `mosheihiks-projects`), מארח את מסד הגמ"ח הראשי האמיתי
   (`ep-orange-waterfall-avthvs1g`, us-east-1) + מסד ה-TEST שלו
   (`ep-raspy-brook-avvyd9g5`). **אין למפתח ה-API שנבדק (`napi_xpnrnqqsjm...`
   ב-`.env`, וגם הישן `napi_ktjywuj9...` שהיה ב-`.env.local`) גישה לחשבון הזה** —
   הוא חי תחת login/ארגון נאון אחר, ככל הנראה זה שמקושר לאינטגרציית ה-Marketplace
   של Vercel. **לא נבדקה המכסה שלו בסבב הזה** — דורש כניסה נפרדת (`vercel login`
   או קונסולת Neon תחת אותה אינטגרציה) כדי לאתר את הפרויקט ולבדוק אם גם הוא קרוב
   לחריגה.

## מציאת הגורם בפועל (נווה יעקב)
נבדקו ישירות ה-DB של `gemach-dresses-2` (133MB בפועל) וטבלת `PageVisitLog`
(`responseSize`/`executionTime` נשמרים לכל בקשת API):

| נקודת קצה | קריאות/יומיים | סה"כ בייטים | הערה |
|---|---|---|---|
| **`GET /api/error-report`** | **3,886** | **~508MB** | הדומיננטי בהרבה מכל השאר יחד |
| `/api/dresses?eventDate=...&limit=10000` | ~150 (מפוזר על תאריכים) | ~140MB | תגובה קבועה של ~922KB לכל תאריך |
| `/api/orders?...&limit=2000` | 85 | 52MB | |
| `/api/settings` | 730 | 41MB | |
| `/api/dresses?page=1&limit=50...` | 94 | 37MB | 395KB בממוצע לעמוד של 50 פריטים - חשוד, לא נחקר בסבב הזה |

**`/api/error-report` הוא 60%+ מהתעבורה של יומיים.** בדיקת גודל התגובות גילתה
פילוג bimodal: חציון 68 בייט, אבל p90=671KB ו-p99=726KB, עם עשרות תגובות בגודל
קבוע 739,328 בייט — כולן משויכות לאותו `employeeId` אחד, מרוכזות בשעות עבודה
(שיא של 400 קריאות בשעה אחת ב-16/09).

### שורש הבעיה בקוד
`ErrorReportButton.js` (הכפתור/פאנל הצף שמופיע בכל עמוד לכל עובד מחובר) מריץ
`setInterval(fetchReports, 30000)` **כל עוד הטאב פתוח בפוקוס, גם כשהפאנל עצמו
סגור** (יש כבר אופטימיזציה קיימת שמשהה את הטיימר כש-`document.hidden`, אך לא
כשהטאב בפוקוס ברקע). `fetchReports()` קורא ל-`GET /api/error-report`, וזו
בדיוק אותה שאילתה שמזינה את הרשימה המלאה בפאנל הפתוח:
`prisma.errorReport.findMany({ include: { employee, replies: { include: { employee } } } })`
— **כל הדיווחים בכל הארגון (למתכנת, `roleId===2`) כולל כל התגובות המקוננות,
ללא limit/pagination**. עובד אחד (מתכנת) שמשאיר טאב פתוח בפוקוס מוריד עותק מלא
של כל הדיווחים+תגובות כל 30 שניות, 24/7 — זה ה-~722-739KB הקבוע שחוזר על עצמו.

הפאנל הסגור צריך בפועל רק ארבעה שדות (`ErrorReportButton.js:492-493`):
```js
const unreadCount = reports.filter(r => r.status !== 'ARCHIVED' &&
  ((isProgrammer && !r.isReadByProgrammer) || (!isProgrammer && !r.isReadByUser))).length;
```
כלומר `id`, `status`, `isReadByProgrammer`, `isReadByUser` — לא `title`/`userText`/
`attachmentUrls`/`replies`/`employee`, שנחוצים רק כשהפאנל בפועל פתוח (רשימה/ארכיון/
שרשור/חיפוש).

## התיקון
בוצע ב-worktree מבודד (`fix/error-report-quota-leak`, מבוסס על `origin/main`) כדי
לא להתנגש עם עבודה מקבילה שהייתה כבר בעץ המשותף (`feature/ai-assistant-capture`,
כולל שינויים לא-committed בקבצי הגיבוי-לענן — לא נגעתי בהם).

- **`app/api/error-report/route.js`** — ה-`GET` מקבל פרמטר `?light=1`. כשקיים,
  משתמשים ב-`select` צר (`id, status, isReadByProgrammer, isReadByUser`) במקום
  ה-`include` הכבד עם התגובות. בלי הפרמטר ההתנהגות זהה לגמרי להיום (ברירת מחדל
  = מלא, לא הפוך — כדי לא לשנות שום קורא אחר של ה-endpoint הזה בטעות).
- **`app/components/ErrorReportButton.js`** — `fetchReports` מקבל כעת `{ light }`
  אופציונלי ומעביר את `?light=1` בהתאם. שלוש נקודות הקריאה שרצות **כשהפאנל סגור**
  עודכנו ל-`fetchReports({ light: true })`: הטיימר של 30 שניות, החזרה-לפוקוס אחרי
  שהטאב היה מוסתר, והטעינה הראשונית בעת mount. כל שאר נקודות הקריאה (פתיחת פאנל,
  רענון ידני, תגובה, סימון "טופל", חזרה מ-thread לרשימה) **נשארו ללא שינוי** — שם
  באמת נחוצים הנתונים המלאים (כולל לשדה החיפוש בתוך userText/replies).

זה קוד משותף לשני הגמ"חים (`app/components/ErrorReportButton.js` לא org-specific),
כך שהתיקון מפחית את אותה בעיה גם בחשבון ב' (הגמ"ח הראשי), גם אם היא לא נבדקה שם
ישירות הפעם.

## מה לא טופל בסבב הזה (במפורש, לא נשכח)
1. **מכסת חשבון ב' (הגמ"ח הראשי) לא נבדקה** — אין לי גישת API אליו. יש לבדוק
   דרך `vercel login` (הטוקן שנשלח בצ'אט השתמשתי בו רק לאיתור פרויקט Vercel,
   `prj_ZZT2jYlvQZbQtN2evU5cfL3dOZzQ`) או כניסה ישירה לקונסולת Neon.
2. **`.github/workflows/backup-to-drive.yml` (גיבוי לענן, org1) נכשל בכל ריצה**
   עם `GAS error: Exception: Limit Exceeded: Email Total Attachments Size` —
   ולפני הכישלון הוא **מבצע dump מלא של כל טבלאות ה-DB** (הריצה שנבדקה ארכה
   ~1.5 דקות בין "starting backup" ל-FAILED). כיוון שהוא אף פעם לא מגיע לסטטוס
   `ok`, כל טיק שהוא "due" (לפי `backup_interval_hours`, ברירת מחדל 24 שעות
   כשאין `SystemSetting` — ור' `scripts/cloud_backup.js:330-345`) מריץ dump מלא
   נוסף על מסד הגמ"ח הראשי בחשבון ב' — תעבורה/compute מבוזבזים בכל ריצה, על
   חשבון נפרד מזה שתוקן כאן. **לא נגעתי בזה** — זו עבודה פעילה ומתועדת (ר'
   `CLAUDE.md` סעיף "Cloud backup to Drive — code complete, GAS deployment blocked
   on an open decision") עם החלטת ארכיטקטורה פתוחה על ה-GAS, ויש שינויים
   לא-committed על הקבצים האלה בעץ המשותף כרגע. אם רוצים לעצור את הדימום המיידי
   בלי לפתור את כל הסוגיה: לכבות `backup_enabled=false` ל-org1 ב-`/admin/backups`
   עד שהחלטת ה-GAS תתקבל.
3. **`gemach-db` (הפרויקט המיותם בחשבון א')** — לא נמחק, ממתין לאישור מפורש
   (מחיקה היא בלתי הפיכה).
4. **נקודות קצה כבדות נוספות** שנמצאו ב-`PageVisitLog` (`/api/dresses?eventDate=...`
   בגודל תגובה קבוע ~922KB, ו-`/api/dresses?page=1&limit=50...` ב-395KB בממוצע
   ל"50 פריטים" בלבד) — לא נחקרו לעומק, סה"כ נמוך משמעותית מ-`/api/error-report`
   אבל שווה מבט בעתיד אם החריגה תחזור.

## איך לוודא שהתיקון עובד אחרי deploy
ב-DevTools/Network על טאב עם פאנל הדיווחים סגור: הבקשות התקופתיות ל-
`/api/error-report?light=1` אמורות לחזור בגודל דו-ספרתי/תלת-ספרתי בבייטים (כמו
ה-68 בייט שנצפו לפני התיקון), לא מאות KB. פתיחת הפאנל עצמו (`/api/error-report`
בלי `light`) אמורה להמשיך להחזיר את הרשימה המלאה כרגיל.
