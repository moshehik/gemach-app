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
בנוסף נוצרו ב-2026-09-20 שני פרויקטי גיבוי נפרדים (**מכסת 5GB נפרדת**, בניגוד ל-branches): `gemach-main-backup` (`proud-mountain-79208831`, us-east-1) ו-`gemach-neve-yaakov-backup` (`winter-sea-73672567`, eu-central-1), בארגון `GMACH`. הם snapshot חד-פעמי (מתיישן), והם היעד של מתג "מסד נתונים" בהגדרות (`web_backup_mode` → `TEST_DATABASE_URL`).

## מה תוקן (ענף `perf/vercel-resource-savings-2026-09-20`)
1. **אזור פונקציות לכל גמח בנפרד (השפעה הגדולה ביותר על זמני ריצה).** `vercel.json` נעל `"regions": ["fra1"]`
   לשני הפרויקטים - אבל ה-DB של org1 עבר ל-us-east-1. נמדד ב-2026-09-20: `SELECT 1` ב-`/api/health` לקח
   **~459ms בגמח הראשי מול 2ms בנווה יעקב** (כל invocation שילם חציית אוקיינוס). זה גם מסביר למה `gemach-app-uyh4` כבד
   פי ~6.7 ב-GB-hours לכל invocation. תיקון: הוסר `regions` מהקובץ; האזור נקבע בהגדרות כל פרויקט ב-Vercel:
   org1 = `iad1` (כבר היה), org2 = `fra1` (נקבע ב-API בזמן הביקורת). **אחרי הדיפלוי לבדוק:**
   `curl https://gemach-app-uyh4-beryl.vercel.app/api/health` צריך להחזיר `ms` בעשרות בודדות (לא ~460).
   **כלל קבוע: אם ה-DB של גמח עובר אזור, לעדכן את `serverlessFunctionRegion` של *הפרויקט שלו* ב-Vercel - לא ב-`vercel.json`.**
2. **`/api/log-visit` בצורת אצווה.** לפני: כל קריאת `/api/*` מהקליינט יצרה POST נוסף (invocation + auth + employee lookup +
   insert). **נמדד ב-`PageVisitLog` של ה-DB-ים החיים:** בשיא (13-15.9) נווה יעקב קיבל עד 10,487 POST-ים כאלה ביום (מול 9,473
   קריאות API אמיתיות באותו יום - כלומר כמעט כפל) ≈ 26% מכלל ה-invocations בשיא (~40K ליום); הגמח הראשי עד 2,093 ביום.
   (ההערכה הראשונית של הסוכנים, 35-50%, הייתה גבוהה מהמדידה.) עכשיו ה-interceptor ב-`app/layout.js` אוסף רשומות ושולח אצווה אחת
   (כל ~20 שנ', מיד ב-25 רשומות, ובסגירת הדף דרך `sendBeacon`); `app/api/log-visit/route.js` מקבל `{ entries: [...] }`
   (וגם רשומה בודדת - דפי `app/print/*` עדיין שולחים כך) ועושה `createMany` יחיד. חותמת הזמן של הקליינט נשמרת;
   `requestQuery` נחתך ל-4000 תווים. קריאות `?light=1` (polling רקע) לא נרשמות בהיסטוריה.
   `PageTracker` משתמש באותו תור. היסטוריית `PageVisitLog` ו-`/management/history` ממשיכות לעבוד כרגיל.
3. **פעמון ההתראות** (בפועל נמדד כמעט לא פעיל - 10 קריאות `/api/notifications` בשבוע בנווה יעקב, ולכן התועלת כאן קטנה; השינוי בטוח ונשאר): `GET /api/notifications?light=1` מחזיר רק `unreadCount` (אותם where/take/חישוב כמו הרשימה, אבל
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
   ממילא מכסה את הטווח הקצר). **עדכון 2026-09-20: המשימה המקומית הושבתה** (state=Disabled, לא נמחקה; הקבצים ב-`backups/` נשארו;
   פירוט, מה משתנה ואיך להחזיר - ב-BACKUPS.md, "Local backup task disabled"). **עדיין פתוח:** העלאת `backup_interval_hours` של org1
   (הגיבוי הענני היומי לבדו = ~4.4GB בחודש), והגדרת `backup_owner_email` ב-`/admin/backups`.
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

## אימות מצביעי מסדי הנתונים (2026-09-20, אחרי החלפת ה-Neon)
נבדק ישירות מול ה-DB-ים החיים (שאילתות קריאה בלבד; ה-`BackupRun` שנכתב ע"י ה-workflow ב-GitHub נמצא בתוך ה-DB החי = הוכחה שה-secret מצביע אליו):

| מצביע | היעד בפועל | סטטוס |
|---|---|---|
| `.env` `DATABASE_URL` / `PROD_DATABASE_URL` (המכונה המקומית, הגיבוי המקומי) | `ep-weathered-tree-avpypjjr` (org1 חי) | תקין |
| GitHub secret `DATABASE_URL` (עודכן 19.9 23:36) | org1 חי - `BackupRun` ok מ-19.9 20:36 UTC נמצא ב-DB החי | תקין |
| GitHub secret `DATABASE_URL_ORG2` (עודכן 15.9) | org2 חי `ep-broad-night-b1fxha9e` - `BackupRun` ok מ-19.9 20:33 UTC נמצא ב-DB החי | תקין |
| Vercel `DATABASE_URL` Production של `gemach-app-uyh4` (עודכן 18.9) | האתר חי ו-`/api/health` מחזיר `db:"up"` (הבסיס הישן חסום ומחזיר `down`) | תקין |
| Vercel `DATABASE_URL` Production של `gmach-neve-yaakov` (עודכן 15.9) | `ep-broad-night-b1fxha9e` (cutover 15.9) | תקין |
| Vercel `TEST_DATABASE_URL` Production, שני הפרויקטים (עודכן 20.9) | פרויקטי הגיבוי (`ep-fancy-pine-aw5fbjvp` / `ep-aged-sunset-b2liz6y8`) | תקין |
| `scripts/seed_phase1_settings.js` - שומר ה-host | הצביע ל-`ep-orange-waterfall` הישן (היה מונע הרצה על ה-DB החדש) | **תוקן** ל-`ep-weathered-tree-avpypjjr` |
| `docs/fix-protocol-error-reports.md` - טבלת ה-DB-ים | ציין את הבסיס החסום כ"חי" | **תוקן** |
| `test-db.js` (tracked) | חיבור עם סיסמה בטקסט גלוי ל-`ep-royal-dawn` הישן | **נמחק** |
| `.env` `POSTGRES_URL` + Vercel `POSTGRES_URL` של org1 (Production+Preview) | עדיין `ep-orange-waterfall` החסום. **אין בקוד שום קריאה ל-`POSTGRES_URL`** - שריד של אינטגרציית Vercel↔Neon הישנה | לא בשימוש; מומלץ למחוק |
| Vercel org1 `DATABASE_URL` לסביבת **Preview** | לא קיים (נמחק בעת ה-cutover של 18.9, שנעשה רק ל-Production) | previews של org1 לא מתחברים ל-DB - מכוון או לתקן לפי הצורך |
| Vercel `TEST_DATABASE_URL` Preview של org1 (8.9) / `DATABASE_URL` Preview של org2 (8.9) | hosts ישנים | לא בשימוש בייצור |

## איך עובד הגיבוי - מלא או רק שינויים?
**מלא, בכל פעם - אין שום מנגנון של שינויים בלבד.** `scripts/cloud_backup.js` פותח טרנזקציית `REPEATABLE READ, READ ONLY` וקורא **כל שורה
בכל טבלה** (`SELECT ... ORDER BY id`, מעמוד לעמוד), בונה קובץ SQL מלא, דוחס (gzip) בזיכרון ומעלה ל-Drive של הגמח. רק ההחלטה *אם* לרוץ
תלויה בזמן (`backup_interval_hours`, ברירת מחדל 24, ו"גיבוי מיידי"); אין השוואה למה שהשתנה מאז הגיבוי הקודם. חשוב: הדחיסה קורית
**אחרי** שהנתונים כבר עברו על החוט, ולכן מכסת ה-5GB של Neon נספרת לפי הנפח הגולמי:

| גמח | גודל DB | קובץ דחוס | נפח גולמי על החוט (הערכה) | גיבוי יומי בחודש |
|---|---|---|---|---|
| org1 ראשי | 183MB | 28.8MB | ~148MB | **~4.4GB (89% מהמכסה)** |
| org2 נווה יעקב | 134MB | 15.2MB | ~78MB | ~2.3GB (47%) |

עם המשימה המקומית `GemachApp-ProdDbBackup` שרצה במקביל, org1 עמד על ~8.9GB בחודש - וזה הסבר סביר לחריגה של 17-18.9.
**גם אחרי כיבוי המשימה המקומית, גיבוי יומי מלא לבדו אוכל כמעט את כל המכסה של org1.** אפשרויות (לא בוצעו - דורשות החלטה):
(א) `backup_interval_hours` = 72 (או 168) ב-`/admin/backups` ל-org1 - PITR של 7 ימים ב-Neon כבר מכסה שחזור לטווח קצר;
(ב) "דילוג כשלא השתנה כלום": לפני ה-dump לבדוק `max(createdAt)` ב-`AuditLog` מול הגיבוי האחרון ולוותר על ריצה חסרת שינויים
(כל כתיבה באפליקציה נרשמת ב-`AuditLog`) - **לא נעשה כי `scripts/cloud_backup.js` נמצא בעריכה בסשן מקביל**;
(ג) גיבוי אמיתי אינקרמנטלי לפי `updatedAt` - מורכב יותר ולא תופס מחיקות פיזיות.

## צריכת משאבים: לפני ואחרי
"לפני" = **נמדד** (PageVisitLog של ה-DB-ים החיים, Vercel `/v2/usage`, מדידת `/api/health`) אלא אם כתוב אחרת. "אחרי" = **הערכה** מהקוד -
עדיין לא נמדד בייצור; לאמת כמה ימים אחרי המיזוג.

| משאב | על מה | לפני | אחרי (הערכה) |
|---|---|---|---|
| Vercel invocations - `/api/log-visit` | POST נפרד לכל קריאת API | עד 10,487 ליום (org2), 2,093 (org1) בשיא; ~26% מהכלל | ~10 פעמים פחות (אצווה כל ~20 שנ') - כ-1,000 ליום בשיא |
| Vercel invocations - polling רקע | מונה דיווחי תקלות / פעמון התראות | תקלות: כל 30 שנ' לטאב; פעמון: כל 60 שנ' (בפועל כמעט לא רץ) | כל 120 שנ' לכל אחד = פי 4 פחות (ופי 2 לפעמון), ולא נרשם ב-log-visit |
| זמן ריצת פונקציות org1 (GB-hours) | חציית אוקיינוס: פונקציה ב-fra1 מול DB ב-us-east-1 | `SELECT 1` = 459ms; 0.17 GB-hr לכל 1K invocations (פי ~6.7 מנווה יעקב) | ~2-5ms; קרוב ל-0.025 - ירידה של כ-80% בזמן ריצה לכל בקשה |
| Neon egress - מונה דיווחי תקלות | `GET /api/error-report` מלא כל 30 שנ' | org2: 8,014 קריאות x 121KB = **~950MB בשבוע** (org1: ~95MB) - **טופל כבר ב-17.9** (light: 2.8KB, -97%) | ההאטה ל-120 שנ' חוסכת עוד פי 4 בקריאות |
| Neon egress - גיבוי | dump מלא בכל ריצה | org1 ~148MB + org2 ~78MB ליום; + משימה מקומית = ~8.9GB/חודש ל-org1 | **ללא שינוי** עד החלטה (ר' למעלה) |
| Vercel deployments | כל push = 2 builds, כולל תיעוד וענפי org2 בפרויקט הראשי | 284 ב-34 יום: 258 חסומים (seat) + 26 builds אמיתיים; 6 זוגות SHA זהים + 2 previews מיותרים | דילוג על קומיטי תיעוד וענפי `fix-reports/org2-*` בראשי (~5 מתוך 19 builds של הגמחים). החסימות ימשיכו עד תיקון קישור GitHub↔Vercel |
| Vercel cron | `/api/health` יומי | 1 invocation ליום לפרויקט + הערת Neon | 0 |
| GitHub Actions | `claude-fix-reports`: 278 ריצות ב-12 יום, חלקן חופפות | ללא `concurrency` | ריצה אחת בכל רגע |
| Vercel storage | Upstash Redis יתום `upstash-kv-beige-school` | קיים, לא מחובר לאף פרויקט, אפס שימוש בקוד | **נמחק** ב-2026-09-20 |

**מה עדיין הכי יקר ב-Neon egress (נמדד, לא שונה כאן):** `/api/dresses` (~1.3MB לקריאה, 169MB בשבוע ב-org1), `/api/orders`
(85-105KB, 367MB בשבוע ב-org2) ו-`/api/settings` (43-53KB x 372-1,957 קריאות, עד 100MB בשבוע) - מועמדים לסבב הבא (cache שרת /
`limit` קטן יותר / `Cache-Control`).
