-- טבלת סימוני "בוצע" של הלו״ז היומי (/schedule) - ScheduleStageMark.
--
-- מה: שורה אחת לכל (הזמנה, שלב, יום ישראלי) עם "בוצע / בוטל", מי סימן ומתי, ומצב ההחזרה (תקין / לא תקין)
--      לשלבים 8 ו-9. המודל המתאים כבר נמצא ב-prisma/schema.prisma (model ScheduleStageMark); הקוד:
--      lib/schedule/marks.js, app/api/schedule/marks/route.js.
-- למה: החלטת הבעלים C1 (1.10.2026): "טבלה חדשה במסד לשמירת 'בוצע, מי ומתי'" לשלבים שאין להם שדה כזה
--      (הכנה, משלוח הלוך, איסוף מקומי - החלטה C2, משלוח חזור). הבעלים אישר במפורש (2.10.2026) ליצור את
--      הטבלה עכשיו בשני הגמ"חים (ראשי + נווה יעקב, שני פרויקטי Neon נפרדים).
-- איך: תוספת בלבד - CREATE TABLE / CREATE INDEX עם IF NOT EXISTS, בלי לגעת בשום טבלה קיימת. בטוח להריץ
--      פעמיים (idempotent). להריץ ידנית על שני ה-DB של הייצור (ועל TEST) עם בדיקת host לפני הפריסה;
--      עד שהטבלה קיימת הקוד מסתיר את הסימון ("בוצע" לא זמין) ולא נופל (P2021 / 42P01 נתפסים).
--      העמודות והאינדקסים זהים למה ש-`prisma migrate diff --to-schema-datamodel prisma/schema.prisma`
--      מפיק עבור המודל (updatedAt בלי DEFAULT - Prisma ממלא אותו בכל כתיבה, כמו בשאר הטבלאות).
--      אזהרה: אין להריץ `prisma db push` במקום הקובץ הזה - הוא ימחק את ErrorReport.isArchivedByUser
--      שקיימת בשני ה-DB ולא בסכימה (docs/branches-and-worktrees.md).
--
-- ביטול (לא להריץ - לתיעוד בלבד; מוחק את כל הסימונים):
--   -- DROP TABLE IF EXISTS "ScheduleStageMark";

CREATE TABLE IF NOT EXISTS "ScheduleStageMark" (
    "id"         TEXT NOT NULL,
    "orderId"    INTEGER NOT NULL,
    "stageKey"   TEXT NOT NULL,
    "dayKey"     TEXT NOT NULL,
    "done"       BOOLEAN NOT NULL DEFAULT true,
    "outcome"    TEXT,
    "source"     TEXT,
    "markedById" TEXT,
    "markedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneById" TEXT,
    "undoneAt"   TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleStageMark_pkey" PRIMARY KEY ("id")
);

-- ייחודיות: סימון אחד לכל (הזמנה, שלב, יום) - מגן גם מפני שתי עובדות שמסמנות בו-זמנית (P2002 נתפס בקוד)
CREATE UNIQUE INDEX IF NOT EXISTS "ScheduleStageMark_orderId_stageKey_dayKey_key" ON "ScheduleStageMark"("orderId", "stageKey", "dayKey");

-- שאילתת היום של הלו״ז (כל הסימונים של יום X), והיסטוריית הזמנה (כל הסימונים של הזמנה)
CREATE INDEX IF NOT EXISTS "ScheduleStageMark_dayKey_stageKey_idx" ON "ScheduleStageMark"("dayKey", "stageKey");
CREATE INDEX IF NOT EXISTS "ScheduleStageMark_orderId_idx" ON "ScheduleStageMark"("orderId");
