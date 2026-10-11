-- המלצה בלבד - לא הורץ באף DB (אסור DDL בענף feature/a5-admin-logs-history-departments-2026-10-11). אינדקס על AuditLog.createdAt.
-- למה: "היסטוריית נתונים" (/admin/data-history) ממיינת לפי createdAt (החדש ראשון) ואין ל-AuditLog אינדקס על העמודה, ולכן כל עמוד = סריקה מלאה + top-N heapsort.
-- נמדד על טבלה זמנית של 400,000 שורות (docs/a5-staff-models/data-history-notes.md): רשימה ללא סינון 283 ms, עם אינדקס אמורה לרדת למילישניות (סריקה לאחור על האינדקס + LIMIT 50).
-- סדר ההרצה (כמו שאר הקבצים כאן): 1. SELECT הזהות למטה, 2. אישור הבעלים, 3. CREATE INDEX CONCURRENTLY (לא נועל כתיבות; מחוץ לטרנזקציה), 4. הוספת @@index([createdAt]) ל-AuditLog ב-schema.prisma.

SELECT current_database() AS db, (SELECT value FROM "SystemSetting" WHERE key = 'gmach_name') AS gmach_name, (SELECT reltuples::bigint FROM pg_class WHERE oid = '"AuditLog"'::regclass) AS approx_rows;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt");
