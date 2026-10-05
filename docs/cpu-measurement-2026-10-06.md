# מדידת CPU + דחיסת לוגו (6.10.2026)

ענף: `perf/logo-and-measure-2026-10-06`. שני חלקים שאושרו ע"י הבעלים: (A) דחיסה אוטומטית של לוגו בכל העלאה, (B) כלי מדידה שיראו
בנתונים אמיתיים מה שורף את ה-CPU של Vercel (לפי נתיב, לפי יום, כמה cold starts, וכמה מהטעינות הן רענון/לשונית חדשה).
בשלב הזה לא הורץ שום דבר על שום DB. כל שלבי ה-DB נכתבו כקבצים ומחכים לאישור בזמן ההרצה.

## A. לוגו

**הבעיה:** הגמח הראשי שמר ב-`SystemSetting.BRAND_LOGO` data URL של ~2.48MB. הוא נקרא מה-DB בכל אינסטנס קר ובכל קריאת הגדרות מלאה.

**מה השתנה (קוד):**
- `lib/logoCompress.js` (שרת בלבד, `sharp` - כבר תלות ישירה ב-package.json): מקטין עד 512px בצד הארוך (בלי הגדלה), שומר שקיפות,
  בוחר את הקטן מבין PNG מצומצם-פלטה לבין WebP עם אלפא, יעד ~100KB (לולאת איכות 85/70/55/40, ואז הקטנת מימדים), תקרה קשיחה 300KB
  (מעליה נזרקת שגיאה בעברית). קובץ שאינו תמונה, ריק, או מעל 12MB - נדחה בהודעה בעברית.
- `app/api/upload-logo/route.js`: כל העלאה עוברת דחיסה; **המקור לעולם לא נשמר**. התשובה כוללת `originalBytes/storedBytes/width/height/format`,
  ובנוסף מתבצע `invalidateSettingsCache('BRAND_LOGO')` כך שהלוגו החדש מוצג מיד.
- שלושת מסכי ההעלאה (`LogoSettings.js`, `SettingsClient.js`, `SettingsSimPage.js`) מציגים "הלוגו כווץ אוטומטית: 2.4MB ← 38KB (512x300)".
  קובץ מעל 3.5MB מוקטן קודם בדפדפן (canvas, `lib/logoClientPrep.js`) כדי לא להיתקל במגבלת גוף הבקשה של Vercel (~4.5MB); הדחיסה האמיתית בשרת.
- `app/api/logo/route.js`: ETag (מ-updatedAt + אורך) ותשובת 304, פענוח base64 נשמר בזיכרון האינסטנס, ופענוח mime רק מראש המחרוזת (לא regex על 2.5MB).
  מדיניות המטמון הארוכה הקיימת (`public, max-age=31536000, immutable`) נשמרה. לוגו ישן וגדול (>300KB) מוגש איתה בתוספת הכותרת `x-logo-oversize: 1`.

**המרה חד-פעמית של הלוגו הקיים** (לא הורצה): `scripts/compress_brand_logo.js`.
```
# 1. dry-run (קריאה בלבד): מדפיס host, gmach_name, לפני/אחרי, ושומר תצוגה מקדימה ב-scratch/brand-logo-backups/
node scripts/compress_brand_logo.js --org=1
# 2. כתיבה: חובה גם --expect-host וגם --expect-name (הסקריפט נעצר אם אחד לא תואם); שומר גיבוי מלא של הערך המקורי לקובץ ומאמת אותו לפני ה-UPDATE
node scripts/compress_brand_logo.js --org=1 --write --expect-host=<חלק מה-host של ה-DB הראשי> --expect-name="מכובד"
# שחזור (אם צריך): 
node scripts/compress_brand_logo.js --org=1 --write --expect-host=... --expect-name=... --restore=scratch/brand-logo-backups/<קובץ הגיבוי>
```
אותו דבר ל-`--org=2` (נווה יעקב, `--expect-name="נווה יעקב"`); אם הלוגו שם כבר קטן הסקריפט לא נוגע בו. הסקריפט משתמש ב-prisma רגיל (לא כותב AuditLog של 2.5MB)
ונוגע בשורה אחת (`key = 'BRAND_LOGO'`).

## B. מדידה

### מה נמדד
| מה | איפה נוצר | איפה נשמר |
|---|---|---|
| CPU של בקשת API (מילי-שניות) | `withCpuTiming` ב-`lib/cpuTiming.js`: כותרות `Server-Timing: cpu;dur=..`, `x-cpu-ms`, `x-cpu-conc` | `PageVisitLog.serverCpuMs` (שורות ה-API) |
| bootId של האינסטנס שענה | `lib/bootInfo.js` (על `globalThis`, אחד לתהליך), כותרת `x-boot-id` | `PageVisitLog.serverBootId` |
| סוג הניווט של הדף | `lib/navMeta.js` ← `PageTracker` | `PageVisitLog.navigationType` (שורות הדפים) |

- **CPU**: `process.cpuUsage()` הוא של התהליך כולו ואינסטנס משרת כמה בקשות במקביל, ולכן ה-CPU מחולק בין הבקשות הפעילות בכל פרוסת זמן
  (הסכום על פני הבקשות = ה-CPU האמיתי של התהליך, בלי ספירה כפולה). בקשה בודדת (`x-cpu-conc: 1`) מדויקת. מגבלה: CPU של רינדור דפים או עבודה אחרת
  שלא עטופה, ושרצה במקביל, נספר לבקשה הפעילה. הערך מעוגל למילי-שנייה שלמה בטבלה.
- **navigationType**: `navigate` / `reload` / `back_forward` / `prerender` לטעינת מסמך, בסיומת `+newtab` כשנראה שנפתח בלשונית חדשה
  (`window.opener`, או היסטוריה באורך 1 בלי referrer); כל מעבר דף נוסף באותו מסמך (ניווט פנימי של Next) הוא `spa`.
- **x-boot-id**: בנוסף `GET /api/health/boot` (מחובר בלבד) מחזיר `bootId/bootAt/uptimeSec/requestsSinceBoot/region/deployment`.
  `/api/health` הציבורי לא שונה.

### נתיבים עטופים
orders (GET, POST), customers (GET, POST), inventory/preload, settings (GET), me (GET), notifications (GET), a5/boot, health/boot.
כל נתיב: ייבוא אחד + הסרת `export` משורת הפונקציה + שתי שורות בסוף (`const GET_timed = withCpuTiming(GET); export { GET_timed as GET };`).
**לא עטופים (בעלות ענפים מקבילים) - למשימת המשך אחרי המיזוג:** `app/api/dresses/route.js` ו-`app/api/error-report/route.js` (wt-slim),
`app/api/log-visit/route.js` ו-`/api/poll` (wt-phase0 / wt-poll). קריאות `light=1` (polling) לא נרשמות בלוג בכלל (ה-interceptor מדלג עליהן), ולכן גם לא יופיעו בנתוני ה-CPU.

### סדר פריסה והרצה
1. הקוד נפרס **לפני** ה-DDL ועובד בלעדיו: `log-visit` מזהה עמודה חסרה (P2022 / "does not exist" / "Unknown argument"), כותב שוב בלי שדות המדידה, ופוסל אותם לאינסטנס
   ל-5 דקות (אחר כך בודק שוב, כך שאחרי ה-DDL הכתיבה מתחילה לבד). `/api/history` עבר ל-`select` מפורש כדי שלא ייכשל ב-DB בלי העמודות.
2. DDL (אחרי אישור, בכל DB בנפרד - MAIN, NEVE, TEST - עם בדיקת זהות gmach_name + host):
   קודם `prisma/migrations-pending/2026-10-06-pagevisitlog-measure-check.sql` (SELECT בלבד), אחר כך `2026-10-06-pagevisitlog-measure.sql`
   (`ADD COLUMN IF NOT EXISTS` x3, nullable, בלי DEFAULT - שינוי מטא-דאטה בלבד, אין שכתוב טבלה). אין להריץ `prisma db push`.
3. אחרי ה-DDL אפשר להריץ `npx prisma generate` מקומית (בבילד של Vercel זה קורה לבד).

### איך קוראים את הנתונים (Postgres, קריאה בלבד)
הזמנים ב-`timestamp` הם UTC; להלן המרה לשעון ישראל. שורות API = `"pageUrl" LIKE '/api/%'`; הנתיב בלי query = `split_part("pageUrl", '?', 1)`.

**1. CPU לפי נתיב ויום (7 ימים אחרונים):**
```sql
SELECT (("timestamp" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jerusalem')::date AS day,
       regexp_replace(split_part("pageUrl", '?', 1), '/([0-9a-f]{8}-[0-9a-f-]{27}|[0-9]+)', '/:id', 'g') AS route,
       count(*)                                          AS calls,
       sum("serverCpuMs")                                AS cpu_ms_total,
       round(avg("serverCpuMs"), 1)                      AS cpu_ms_avg,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY "serverCpuMs") AS cpu_ms_p95,
       round(sum("responseSize") / 1024.0)               AS kb_total
FROM "PageVisitLog"
WHERE "serverCpuMs" IS NOT NULL AND "timestamp" > now() - interval '7 days'
GROUP BY 1, 2
ORDER BY 1 DESC, cpu_ms_total DESC;
```

**2. cold starts ליום (bootId שונים = אינסטנסים שונים שהתחילו לענות, מינימום - רק אינסטנסים שענו בקשה עטופה שנרשמה):**
```sql
SELECT (("timestamp" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jerusalem')::date AS day,
       count(DISTINCT "serverBootId") AS boot_ids,
       count(*)                       AS logged_calls
FROM "PageVisitLog"
WHERE "serverBootId" IS NOT NULL AND "timestamp" > now() - interval '14 days'
GROUP BY 1 ORDER BY 1 DESC;

-- כמה בקשות ו-CPU כל boot שירת, ומתי נראה לראשונה (קר = הבקשה הראשונה שלו):
SELECT "serverBootId", min("timestamp") AS first_seen, max("timestamp") AS last_seen, count(*) AS calls, sum("serverCpuMs") AS cpu_ms
FROM "PageVisitLog" WHERE "serverBootId" IS NOT NULL AND "timestamp" > now() - interval '2 days'
GROUP BY 1 ORDER BY first_seen DESC;
```

**3. פילוח navigationType (דפים בלבד):**
```sql
SELECT (("timestamp" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jerusalem')::date AS day,
       coalesce("navigationType", '(ישן/אין)') AS nav,
       count(*) AS page_views,
       round(100.0 * count(*) / sum(count(*)) OVER (PARTITION BY (("timestamp" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jerusalem')::date), 1) AS pct
FROM "PageVisitLog"
WHERE "pageUrl" NOT LIKE '/api/%' AND "timestamp" > now() - interval '7 days'
GROUP BY 1, 2 ORDER BY 1 DESC, page_views DESC;

-- מי מרענן/פותח לשוניות הכי הרבה:
SELECT "employeeName", count(*) FILTER (WHERE "navigationType" = 'reload') AS reloads,
       count(*) FILTER (WHERE "navigationType" LIKE '%+newtab') AS new_tabs, count(*) AS page_views
FROM "PageVisitLog" WHERE "pageUrl" NOT LIKE '/api/%' AND "navigationType" IS NOT NULL AND "timestamp" > now() - interval '7 days'
GROUP BY 1 ORDER BY reloads DESC LIMIT 20;
```

**4. התאמה לדשבורד Vercel:** `sum("serverCpuMs")` ליום מול ה-CPU של Vercel לאותו יום. הפער הצפוי: רינדור דפים (RSC/`layout.js`), `/api/poll`
ו-`light=1` (לא נרשמים), וקריאות שאבדו ב-`sendBeacon`. אם `cpu_ms_total` של הנתיבים העטופים הוא חלק קטן מהדשבורד - עיקר העומס הוא ברינדור/בנתיבים הלא-עטופים.

### עלות צפויה
שתי קריאות `process.cpuUsage()` (מיקרו-שניות) וארבע כותרות קטנות לכל בקשה עטופה; בלי DB, בלי גישה לגוף התשובה. בצד הלקוח: קריאת שתי כותרות ב-interceptor הקיים
ובדיקת `performance.getEntriesByType('navigation')` פעם אחת. שורות הלוג נכתבות באותה אצווה כמו היום, עם שלוש עמודות קטנות נוספות לשורה.

### ביטול
- כיבוי מהיר בלי DDL: משתנה סביבה `CPU_TIMING=off` מדלג על המדידה בצד השרת (דורש פריסה/אינסטנס חדש כדי להיכנס לתוקף ב-Vercel).
- ביטול מלא: revert של הקומיטים של ענף זה. העמודות החדשות אופציונליות ונשארות בטבלה בלי נזק (קוד ישן פשוט לא כותב אותן); הסרה (לא חובה): ראו את ההערה בתחתית `2026-10-06-pagevisitlog-measure.sql`.

## בדיקות
`node --import ./scripts/logo-measure-tests/register.mjs --test scripts/logo-measure-tests/*.test.mjs` - דחיסת לוגו (תמונה ענקית ורועשת, שקיפות, JPEG, קבצים שאינם תמונה, ריק/ענק),
נתיבי העלאה/הגשה מול prisma בזיכרון, `withCpuTiming`/`bootInfo` (כולל מקביליות, חריגות, Response immutable), סבילות `log-visit` לעמודות חסרות, `navMeta`, ובדיקות סטטיות לחיווט.
