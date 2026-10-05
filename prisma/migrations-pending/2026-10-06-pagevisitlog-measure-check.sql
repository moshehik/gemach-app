-- קריאה בלבד (SELECT בלבד) - להריץ לפני ואחרי 2026-10-06-pagevisitlog-measure.sql על כל DB. לא משנה שום דבר.

-- 1. זהות ה-DB (חובה לפני כל DDL): שם הגמ"ח + בסיס הנתונים הנוכחי
SELECT current_database() AS db, (SELECT value FROM "SystemSetting" WHERE key = 'gmach_name') AS gmach_name;

-- 2. העמודות הנוכחיות של PageVisitLog
SELECT ordinal_position, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'PageVisitLog'
ORDER BY ordinal_position;

-- 3. האם עמודות המדידה כבר קיימות? (0 = עוד לא; 3 = כבר הורץ)
SELECT count(*) AS measure_columns_present
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'PageVisitLog'
  AND column_name IN ('serverCpuMs', 'navigationType', 'serverBootId');

-- 4. גודל הטבלה (כדי לדעת מה ה-ALTER נוגע בו)
SELECT pg_size_pretty(pg_total_relation_size('"PageVisitLog"')) AS total_size, (SELECT count(*) FROM "PageVisitLog") AS rows;
