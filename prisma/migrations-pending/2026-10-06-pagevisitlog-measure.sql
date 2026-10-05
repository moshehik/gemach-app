-- מדידת CPU: שלוש עמודות אופציונליות ב-PageVisitLog (docs/cpu-measurement-2026-10-06.md).
--
-- מה: serverCpuMs (INTEGER) - x-cpu-ms של תשובת ה-API; navigationType (TEXT) - navigate/reload/back_forward/prerender/spa (+'+newtab');
--      serverBootId (TEXT) - x-boot-id (ספירת cold starts). המודל המתאים: prisma/schema.prisma (model PageVisitLog);
--      הכותב: app/api/log-visit/route.js דרך lib/visitLogMeasure.js.
-- למה: למדוד היכן נשרף ה-CPU של Vercel (לפי נתיב/יום), כמה cold starts יש, ואיזה חלק מהטעינות הן ניווט חדש/רענון/לשונית חדשה.
-- הקוד נפרס לפני ה-DDL: log-visit מזהה עמודה חסרה (P2022) וכותב בלעדיה; /api/history עבר ל-select מפורש. לכן אין סדר חובה בין פריסה ל-DDL.
-- איך: תוספת בלבד, idempotent, ללא DEFAULT (ב-Postgres 11+ ADD COLUMN nullable בלי default הוא שינוי מטא-דאטה בלבד - אין שכתוב טבלה,
--      נעילה קצרה מאוד). **לא הורץ על אף DB - ההרצה דורשת אישור מפורש בזמן ההרצה.**
--      להריץ על MAIN (gmach_name "מכובד- השכרת שמלות"), על NEVE (gmach_name "גמ"ח שמלות נווה יעקב") ועל TEST - עם בדיקת זהות (gmach_name + host)
--      לכל DB קודם (ר' 2026-10-06-pagevisitlog-measure-check.sql, קריאה בלבד).
--      אזהרה: אין להריץ `prisma db push` במקום הקובץ הזה (docs/branches-and-worktrees.md). אחרי ההרצה: אין צורך באתחול שרת - log-visit בודק שוב
--      אחרי עד 5 דקות מהכישלון האחרון.
--
-- ביטול (לא להריץ - לתיעוד בלבד; מוחק את נתוני המדידה שנצברו):
--   -- ALTER TABLE "PageVisitLog" DROP COLUMN IF EXISTS "serverCpuMs", DROP COLUMN IF EXISTS "navigationType", DROP COLUMN IF EXISTS "serverBootId";

ALTER TABLE "PageVisitLog"
  ADD COLUMN IF NOT EXISTS "serverCpuMs"    INTEGER,
  ADD COLUMN IF NOT EXISTS "navigationType" TEXT,
  ADD COLUMN IF NOT EXISTS "serverBootId"   TEXT;
