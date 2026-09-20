# ביקורת משאבי Vercel + Neon ותיקונים (2026-09-20)

הביקורת נעשתה ע"י 4 סוכנים במקביל (builds, runtime, קוד, אחסון/Neon/GitHub) מול ה-API של
Vercel וקוד הריפו. **אזהרה על שיטה:** הסוכנים קראו את העץ המשותף (ענף `feature/ai-assistant-capture`
הישן, עם שינויים לא-committed של סשן אחר) ולא את `main` - לכן כל ממצא נבדק מחדש מול `origin/main`
לפני תיקון. ממצאים שכבר טופלו ב-`main` (cron הגיבוי כבר יומי; `?light=1` של `/api/error-report` כבר קיים -
ר' `docs/neon-quota-error-report-poll-2026-09-17.md`) לא תוקנו שוב.

## תמונת מצב (Hobby, לפי `/v2/usage`)
| מדד | ספטמבר (תחזית) | מכסה |
|---|---|---|
| Function invocations | ~420K (עד ~585K לפי מחזור חיוב) | 1M |
| GB-hours | ~24 | 100 |
| Bandwidth | ~1.7GB | 100GB |
| Build minutes | ~24 דק' ב-34 יום | זניח |

נווה יעקב = 78% מה-invocations. **המגבלה הממשית אינה Vercel אלא Neon Free: 5GB data transfer לפרויקט
בחודש** (האתר כבר קרס על זה ב-18.9 - ר' CLAUDE.md, "Org1 outage 2026-09-18").

## מצב Neon הנוכחי (הוחלף ב-2026-09-18 - לא להסתמך על hosts ישנים בתיעוד ישן)
| גמח | פרויקט Vercel | פרויקט Neon | אזור |
|---|---|---|---|
| ראשי (org1) | `gemach-app-uyh4` (`prj_ZZT2jYlvQZbQtN2evU5cfL3dOZzQ`) | `gemach-main-prod` (`misty-darkness-06917297`, ארגון `GMACH-KOPAT`, `ep-weathered-tree-avpypjjr`) | **us-east-1** |
| נווה יעקב (org2) | `gmach-neve-yaakov` (`prj_nha4IxNtvyP6B0Try78r6ApWkRBa`) | `gemach-dresses-2` (`jolly-silence-63127698`, `ep-broad-night-b1fxha9e`) | **eu-central-1** |

הפרויקט הישן `purple-term-91836431` (ארגון `gmach-RASY`) חסום ומחזיק את הדלתא של 17-18.9 - לא למחוק.

## מה תוקן (ענף `perf/vercel-resource-savings-2026-09-20`)
1. **אזור פונקציות לכל גמח בנפרד (השפעה הגדולה ביותר על זמני ריצה).** `vercel.json` נעל `"regions": ["fra1"]`
   לשני הפרויקטים - אבל ה-DB של org1 עבר ל-us-east-1. נמדד ב-2026-09-20: `SELECT 1` ב-`/api/health` לקח
   **~459ms בגמח הראשי מול 2ms בנווה יעקב** (כל invocation שילם חציית אוקיינוס). זה גם מסביר למה `gemach-app-uyh4` כבד
   פי ~6.7 ב-GB-hours לכל invocation. תיקון: הוסר `regions` מהקובץ; האזור נקבע בהגדרות כל פרויקט ב-Vercel:
   org1 = `iad1` (כבר היה), org2 = `fra1` (נקבע ב-API בזמן הביקורת). **אחרי הדיפלוי לבדוק:**
   `curl https://gemach-app-uyh4-beryl.vercel.app/api/health` צריך להחזיר `ms` בעשרות בודדות (לא ~460).
   **כלל קבוע: אם ה-DB של גמח עובר אזור, לעדכן את `serverlessFunctionRegion` של *הפרויקט שלו* ב-Vercel - לא ב-`vercel.json`.**
2. **`/api/log-visit` בצורת אצווה.** לפני: כל קריאת `/api/*` מהקליינט יצרה POST נוסף (invocation + auth + employee lookup +
   insert) - כפל invocations ופעילות DB. עכשיו ה-interceptor ב-`app/layout.js` אוסף רשומות ושולח אצווה אחת
   (כל ~20 שנ', מיד ב-25 רשומות, ובסגירת הדף דרך `sendBeacon`); `app/api/log-visit/route.js` מקבל `{ entries: [...] }`
   (וגם רשומה בודדת - דפי `app/print/*` עדיין שולחים כך) ועושה `createMany` יחיד. חותמת הזמן של הקליינט נשמרת;
   `requestQuery` נחתך ל-4000 תווים. קריאות `?light=1` (polling רקע) לא נרשמות בהיסטוריה.
   `PageTracker` משתמש באותו תור. היסטוריית `PageVisitLog` ו-`/management/history` ממשיכות לעבוד כרגיל.
3. **פעמון ההתראות:** `GET /api/notifications?light=1` מחזיר רק `unreadCount` (אותם where/take/חישוב כמו הרשימה, אבל
   בלי include ובלי תוכן ההודעות ובלי שאילתת outgoing). `NotificationBell.js` עושה polling קל כל 120 שנ' (היה: רשימה מלאה
   של עד 250 שורות כל 60 שנ' + בכל ניווט), והרשימה המלאה נטענת רק בפתיחת הפעמון.
4. **`ErrorReportButton.js`:** polling הרקע (כבר `light`) הואט מ-30 ל-120 שנ'.
5. **הוסר cron `/api/health` היומי** מ-`vercel.json` (keep-alive בוטל ב-2026-09-01; הוא רק העיר את Neon בלי סיבה).
   ה-endpoint עצמו נשאר לבדיקות ידניות.
6. **דילוג על builds מיותרים - `scripts/vercel-ignore-build.sh`** (`ignoreCommand` ב-`vercel.json`): דילוג כש-(א) הענף הוא
   `fix-reports/org2-*` והפרויקט הוא הגמח הראשי (מזוהה לפי `uyh4` ב-URL), (ב) הקומיט לא נגע בקבצים שנכנסים ל-build
   (`app components lib prisma public package-lock.json next.config.mjs middleware.js jsconfig.json vercel.json`, כשה-`app/version.json`
   מוחרג כי ה-pre-commit hook מעדכן אותו בכל קומיט). **לכפות build בכל זאת: `[force-deploy]` בהודעת הקומיט** - חשוב ל"קומיט
   ניסיון חוזר" אחרי rate-limit (כמו `335c10f`, שהוא שינוי version.json בלבד ועכשיו היה מדולג). ברירת המחדל תמיד "לבנות".
   נבדק על קומיטים אמיתיים: קומיט תיעוד בלבד → דילוג; קומיט שנוגע ב-`app/` → build; שינוי version.json בלבד → דילוג.
7. **`.github/workflows/claude-fix-reports.yml`:** נוסף `concurrency` (ריצה אחת בכל רגע, בלי קטיעת ריצה פעילה).

## לא תוקן בכוונה
- **`/api/settings` GET בלי cache** - הרווח קטן (~40MB ל-2 ימים) ו-cache שרת עם TTL יציג הגדרה מיושנת עד 30 שנ' אחרי שמירה
  באדמין (אינסטנסים אחרים לא מתבטלים). לא שווה את הסיכון.
- **cron `*/5` של fix-reports** - נשאר (רשת ביטחון כש-`repository_dispatch` לא הגיע). בפועל GitHub מריץ אותו ~6 פעמים ביום.
- **Middleware/prefetch/`/api/pdf`** - השפעה נמוכה יחסית; לא נגעתי.
- **קבצי הגיבוי (`scripts/cloud_backup.js`, `backup-to-drive.yml`)** - סשן אחר עובד עליהם כעת (שינויים לא-committed) - לא נגעתי.

## דורש החלטה / פעולה שלך (לא ניתן או לא נכון לעשות מהקוד)
1. **גיבויים כפולים אוכלים את מכסת ה-5GB של Neon.** dump מלא של org1 = ~148MB גולמיים (~29MB דחוס) שעוברים על החוט. גיבוי ענני
   יומי + `GemachApp-ProdDbBackup` המקומי (03:30, עכשיו מצביע ל-DB החדש) = שני dumps ביום ≈ 8-9GB בחודש > 5GB. לפי
   `BACKUPS.md` המשימה המקומית אמורה להיות מושבתת ברגע שהגיבוי הענני מאומת לשני הארגונים. מומלץ: להשבית את המקומית
   (`Disable-ScheduledTask -TaskName GemachApp-ProdDbBackup`) ואולי להעלות את `backup_interval_hours` מ-24 ל-48-72 (PITR של 7 ימים
   ממילא מכסה את הטווח הקצר) - **לא בוצע**, כי זה הגיבוי היחיד שמחוץ ל-Neon עד שהענני מאומת ב-org2.
2. **חשבון GitHub ↔ Vercel:** 258 מתוך 284 deployments ב-34 ימים הם `BLOCKED` (`seatBlock: TEAM_ACCESS_REQUIRED`) - ה-GitHub user
   מקושר לחשבון Vercel אחר שאינו חבר בצוות. כמעט כולם ב-`print-center` (מושהה) וב-`bagrut-materials` (לא חלק מהריפו הזה). לתקן ב-Vercel:
   Settings → Authentication, או לנתק את ה-Git integration של שני הפרויקטים. `bagrut-materials` עדיין מקבל ~13K invocations
   בחודש (כנראה בוטים) - לבדוק אם נחוץ.
3. **Vercel Blob `gemach-images` לא קיים ואין `BLOB_READ_WRITE_TOKEN` בשני הפרויקטים.** לפי `lib/dressImageStorage.js` בלי טוקן
   ההעלאות נכתבות ל-`public/uploads` (read-only ב-Vercel) - **לאמת בפועל שהעלאת תמונת שמלה עובדת בפרודקשן**.
4. **Upstash Redis `upstash-kv-beige-school`** לא מחובר לאף פרויקט - מועמד למחיקה באישורך. ושני ה-Blob stores של פרויקטי הצד
   (`bagrut-files`, `print-center-files`, יחד 1.14GB) מושעים על חריגת מכסה.
5. **ימי שגיאות ב-Vercel** (30.8, 3.9, 6-7.9, 18.9 עם 7.4%) - אי אפשר לשייך ל-route בלי runtime logs (Hobby שומר שעה בלבד).
6. **הטוקן של Vercel שהודבק בצ'אט** - לבטל ב-Account Settings → Tokens.
