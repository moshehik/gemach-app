-- סטטוס: ממתין להרצה. ההרצה נעשית בסקריפט scripts/create_log_indexes.js (בודק זהות DB, CREATE INDEX CONCURRENTLY, בודק indisvalid), לא ידנית מהקובץ הזה.
-- הורץ ב-____ (תאריך/שעה) על ____ (TEST / PROD גמח ראשי / PROD נווה יעקב; host + gmach_name) על ידי scripts/create_log_indexes.js   <- המתאם ממלא אחרי ההרצה
-- ה-@@index המתאים כבר הוכרז ב-prisma/schema.prisma (השם זהה לברירת המחדל של Prisma, ולכן prisma db push לא ינסה ליצור/למחוק אותו).
-- המלצה בלבד - לא הורץ באף DB (אסור DDL בענף feature/a5-admin-logs-history-departments-2026-10-11). נכתב בביקורת האבטחה / ביצועים של 11.10.2026.
-- הקשר: שלוש רשימות היומנים החדשות (/admin/site-settings/email-logs, /admin/data-history, /management/history). נמדד ב-EXPLAIN (ANALYZE, BUFFERS) מול TEST על טבלאות זמניות
-- בגודל ~414,000 שורות (AuditLog) ו-~510,000 (PageVisitLog) עם אותם אינדקסים כמו בסכמה; כל השאילתות נשארות הרבה מתחת לתקציב ה-statement_timeout (8 שנ'), ראו security-audit.md סעיף 10.
--
-- 1. AuditLog.createdAt  - כבר מומלץ ב-2026-10-11-auditlog-createdat-index.sql (רשימה בלי סינון: 548 ms ב-414k שורות, סריקה מלאה + top-N sort; עם האינדקס מילישניות).
--    הסינונים "תקופה" / "פעולה" / "עובד מערכת" אותו דבר (330-600 ms) ויישאבו לאותו אינדקס.
-- 2. EmailLog.sentAt     - למטה. הטבלה קטנה כיום (עשרות שורות ב-TEST) ולכן זה לא דחוף; הרשימה ממיינת לפי sentAt (החדש ראשון) ואין אינדקס על העמודה. זול ובטוח.
-- 3. PageVisitLog        - יש כבר אינדקס על timestamp (רשימה ברירת מחדל 3 ms @510k). מיונים לפי נפח / עובד / נתיב / תקלות (~450 ms) וחיפוש טקסט (~470-725 ms) הם סריקה:
--    אינם ניתנים לאינדקס רגיל (ILIKE '%x%'). לא ממליצים על pg_trgm (אינדקס GIN גדול על pageUrl / requestQuery בטבלה שגדלה בכל ביקור); במקום זה: מחיקת רשומות ישנות מ-90 יום
--    (ניהול רשומות בדף עצמו / scripts/cleanup_old_logs.js) שומרת את הטבלה קטנה. אם הטבלה תגדל מעל ~5M שורות - לבחון partition לפי חודש.
-- 4. AuditLog חיפוש טקסט ב-changesJson (470-590 ms @414k, ~2 שנ' לחיפוש של תו בודד שמתאים כמעט לכל שורה כי כל שורה נבדקת גם מול ביטוי הסודות): אין אינדקס מתאים. התקציב
--    (8 שנ') + תקרת הספירה (100,000) + מגבלת ה-4 בקשות במקביל + דיבאונס 400 ms בלקוח מגבילים את העלות. אופציונלי: מינימום 2 תווים לחיפוש בצד הלקוח.
--
-- סדר ההרצה (כמו שאר הקבצים כאן): 1. SELECT הזהות למטה, 2. אישור הבעלים, 3. CREATE INDEX CONCURRENTLY (לא נועל כתיבות; מחוץ לטרנזקציה), 4. הוספת @@index ל-schema.prisma.

SELECT current_database() AS db, (SELECT value FROM "SystemSetting" WHERE key = 'gmach_name') AS gmach_name, (SELECT reltuples::bigint FROM pg_class WHERE oid = '"EmailLog"'::regclass) AS approx_rows;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "EmailLog_sentAt_idx" ON "EmailLog" ("sentAt");
-- schema.prisma, מודל EmailLog:  @@index([sentAt])
