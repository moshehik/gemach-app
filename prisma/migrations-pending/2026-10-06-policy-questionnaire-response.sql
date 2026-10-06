-- טבלת תשובות שאלון המדיניות להנהלות (ביטולים וזיכויים) - PolicyQuestionnaireResponse.
--
-- מה: שורה אחת לכל (שאלון, עובדת) עם התשובות (JSONB), הסטטוס (draft / submitted), מועדי השליחה והמייל. המודל המתאים נמצא
--      ב-prisma/schema.prisma (model PolicyQuestionnaireResponse); הקוד: lib/policyQuestionnaire/store.js (SQL גולמי),
--      app/api/policy-questionnaire/**, app/refund-questionnaire/**. תיעוד מלא: docs/refund-questionnaire.md.
-- למה: הגרסה הראשונה יצרה את הטבלה בעצמה בזמן ריצה (CREATE TABLE IF NOT EXISTS בתוך store.js) - DDL לא מאושר בתוך קוד
--      (כלל הבעלים: אין DDL מקוד האפליקציה בייצור, וכל DDL דורש אישור מפורש בזמן ההרצה), ולכן הוסר. הקובץ הזה הוא
--      הדרך היחידה ליצור את הטבלה. **הוא לא הורץ על אף DB.** עד שהטבלה קיימת הדפים מציגים "השאלון עדיין לא הופעל".
-- איך: תוספת בלבד - CREATE TABLE / CREATE INDEX עם IF NOT EXISTS, בלי לגעת בשום טבלה קיימת, בלי DROP / ALTER / DELETE
--      (idempotent). להריץ רק עם הסקריפט scripts/apply_policy_questionnaire_table.js (dry-run כברירת מחדל; --write רק
--      באישור מפורש של הבעלים; --org=1|2 עם בדיקת זהות: host + gmach_name של ה-DB חייבים להתאים לגמח שנבחר), בנפרד לכל
--      גמח (שני פרויקטי Neon נפרדים: MAIN gmach_name "מכובד- השכרת שמלות", NEVE gmach_name "גמ"ח שמלות נווה יעקב"),
--      ובמידת הצורך על TEST. הסקריפט קורא את הקובץ הזה כמקור אמת יחיד (מה שמודפס ב-dry-run הוא בדיוק מה שמורץ).
--      העמודות והאינדקס זהים byte-for-byte (מלבד IF NOT EXISTS) לפלט של
--      `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` עבור המודל (נבדק ב-6.10.2026).
--      אחרי ההרצה על DB: אין צורך באתחול (הקוד ב-SQL גולמי); לרענן את הדף /refund-questionnaire/answers לוודא שהמצב "לא הופעל" נעלם.
--      אזהרה: אין להריץ `prisma db push` במקום הקובץ הזה - הוא ימחק את ErrorReport.isArchivedByUser שקיימת בשני ה-DB
--      ולא בסכימה (docs/branches-and-worktrees.md).
--
-- ביטול (לא להריץ - לתיעוד בלבד; מוחק את כל תשובות השאלון):
--   -- DROP TABLE IF EXISTS "PolicyQuestionnaireResponse";

CREATE TABLE IF NOT EXISTS "PolicyQuestionnaireResponse" (
    "id"               TEXT NOT NULL,
    "questionnaireKey" TEXT NOT NULL,
    "orgKey"           TEXT NOT NULL,
    "employeeId"       TEXT NOT NULL,
    "respondentName"   TEXT NOT NULL DEFAULT '',
    "respondentRole"   TEXT NOT NULL DEFAULT '',
    "answers"          JSONB NOT NULL DEFAULT '{}',
    "status"           TEXT NOT NULL DEFAULT 'draft',
    "submittedAt"      TIMESTAMPTZ(6),
    "emailedAt"        TIMESTAMPTZ(6),
    "emailError"       TEXT,
    "createdAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyQuestionnaireResponse_pkey" PRIMARY KEY ("id")
);

-- שורה אחת חיה לכל (שאלון, עובדת): שמירה אוטומטית ושליחה חוזרת מעדכנות אותה (INSERT ... ON CONFLICT ב-store.js)
CREATE UNIQUE INDEX IF NOT EXISTS "PolicyQuestionnaireResponse_questionnaireKey_employeeId_key" ON "PolicyQuestionnaireResponse"("questionnaireKey", "employeeId");
