-- כותרת AI קצרה לכל דיווח שגיאה - ErrorReport."aiTitle" (בקשת הבעלים 4.10.2026, חלון "דיווח על שגיאות" בעיצוב B).
--
-- מה: עמודה אחת, nullable, בלי DEFAULT. Gemini (המודל הקל שכבר ראשון ב-lib/ai/gemini.js) מייצר כותרת של 2-5 מילים מתוך תיאור
--      הדיווח, מיד אחרי השמירה (POST /api/error-report); בכשל העמודה נשארת NULL והחלון מציג את 5 המילים הראשונות של התיאור.
--      ErrorReport."title" לא משתנה - הוא שם העמוד (document.title) ומשמש את המיילים, "העתק פרטי מערכת" וזיהוי שרשור
--      "יומן הסוכן האוטומטי" (scripts/agent-log-report.js).
-- הקוד: lib/errorReportAiTitle.js (SQL גולמי בלבד; העמודה בכוונה לא ב-prisma/schema.prisma עד שהיא קיימת בשני ה-DB),
--      app/api/error-report/route.js (GET מצרף aiTitle, POST מייצר ושומר).
-- מצב: לא הורץ. עד שהעמודה קיימת וגם ההגדרה error_report_ai_title = 'true' - אין קריאה ל-Gemini ואין כתיבה; הקוד מזהה עמודה
--      חסרה (42703) ולא נופל.
-- איך: תוספת בלבד, בטוח להריץ פעמיים. להריץ ידנית אחרי אישור הבעלים, על שני ה-DB של הייצור (ראשי + נווה יעקב, שני פרויקטי
--      Neon נפרדים) ועל TEST, עם בדיקת host לפני ההרצה. אין להריץ `prisma db push` (ימחק את ErrorReport.isArchivedByUser
--      שקיימת ב-DB ולא בסכימה - docs/branches-and-worktrees.md).

ALTER TABLE "ErrorReport" ADD COLUMN IF NOT EXISTS "aiTitle" TEXT;

-- בדיקה אחרי ההרצה (צריכה להחזיר שורה אחת):
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
--  WHERE table_name = 'ErrorReport' AND column_name = 'aiTitle';

-- הפעלת ההגדרה (נפרד מה-DDL; לכל גמ"ח בנפרד, רק כשהבעלים מבקש - ר' docs/error-report-new-design-2026-10-04.md):
-- INSERT INTO "SystemSetting" ("id", "key", "value", "name", "category", "type", "updatedAt")
-- VALUES (gen_random_uuid()::text, 'error_report_ai_title', 'true', 'כותרת AI לדיווחי שגיאות', 'תצוגה', 'boolean', CURRENT_TIMESTAMP)
-- ON CONFLICT ("key") DO UPDATE SET "value" = 'true', "updatedAt" = CURRENT_TIMESTAMP;

-- אחרי שהעמודה קיימת בשני ה-DB אפשר (לא חובה) להוסיף ל-model ErrorReport ב-prisma/schema.prisma:
--   aiTitle            String?   // כותרת קצרה שנוצרה ע"י Gemini (lib/errorReportAiTitle.js); null = כותרת חלופית
-- הקוד ממשיך לעבוד גם אחרי ההוספה (הקריאה הגולמית פשוט כותבת את אותו ערך).
