-- סטטוס: ממתין להרצה. ההרצה נעשית בסקריפט scripts/create_log_indexes.js (בודק זהות DB, CREATE INDEX CONCURRENTLY, בודק indisvalid), לא ידנית מהקובץ הזה.
-- הורץ ב-11.10.2026 על PROD גמח ראשי (ep-weathered-tree-avpypjjr, "מכובד- השכרת שמלות") ועל PROD נווה יעקב (ep-young-math-b1veujp3, "גמ"ח שמלות נווה יעקב") על ידי scripts/create_log_indexes.js --apply: AuditLog_createdAt_idx + EmailLog_sentAt_idx, CONCURRENTLY, תקינים בשני ה-DB.
-- ה-@@index המתאים כבר הוכרז ב-prisma/schema.prisma (השם זהה לברירת המחדל של Prisma, ולכן prisma db push לא ינסה ליצור/למחוק אותו).
-- המלצה בלבד - לא הורץ באף DB (אסור DDL בענף feature/a5-admin-logs-history-departments-2026-10-11). אינדקס על AuditLog.createdAt.
-- למה: "היסטוריית נתונים" (/admin/data-history) ממיינת לפי createdAt (החדש ראשון) ואין ל-AuditLog אינדקס על העמודה, ולכן כל עמוד = סריקה מלאה + top-N heapsort.
-- נמדד על טבלה זמנית של 400,000 שורות (docs/a5-staff-models/data-history-notes.md): רשימה ללא סינון 283 ms, עם אינדקס אמורה לרדת למילישניות (סריקה לאחור על האינדקס + LIMIT 50).
-- סדר ההרצה (כמו שאר הקבצים כאן): 1. SELECT הזהות למטה, 2. אישור הבעלים, 3. CREATE INDEX CONCURRENTLY (לא נועל כתיבות; מחוץ לטרנזקציה), 4. הוספת @@index([createdAt]) ל-AuditLog ב-schema.prisma.

SELECT current_database() AS db, (SELECT value FROM "SystemSetting" WHERE key = 'gmach_name') AS gmach_name, (SELECT reltuples::bigint FROM pg_class WHERE oid = '"AuditLog"'::regclass) AS approx_rows;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt");
