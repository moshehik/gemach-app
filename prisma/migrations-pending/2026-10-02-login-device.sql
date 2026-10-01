-- רישום מחשבים בצד השרת לדף הכניסה החדש (החלטת הבעלים 1.10.2026: "רישום בשרת - מדויק יותר").
-- לכל דפדפן/מחשב שנכנסו ממנו (מהימן או לא) נשמרת שורה אחת עם מפתחות העובדים השונים שנכנסו ממנו.
-- מעל 3 עובדים שונים המחשב נחשב "משותף" ו"זכור אותי" לא מוצע (lib/loginDeviceRegistry.js).
--
-- לא הורץ ולא ייווצר אוטומטית: הקוד עובד גם בלי הטבלה (נופל לרישום חתום בעוגייה ארוכת-טווח).
-- להרצה ידנית, בשני הגמ"חים (שני ה-DB ב-Neon), אחרי אישור הבעלים. אין כאן DROP ואין שינוי בטבלאות קיימות.
-- אחרי ההרצה: להוסיף את המודל ל-prisma/schema.prisma (ר' למטה) כדי ש-db push עתידי לא ימחק אותה.

CREATE TABLE IF NOT EXISTS "LoginDevice" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tokenHash"     TEXT NOT NULL UNIQUE,        -- sha256 של הטוקן האקראי שבעוגיית login_device (רק ה-hash נשמר)
  "employeeKeys"  TEXT NOT NULL DEFAULT '[]',  -- JSON: מערך מפתחות עובדים (sha256 מקוצר של Employee.id), מקסימום 12
  "firstSeenAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "label"         TEXT                          -- לשימוש עתידי במסך ניהול (לא בשימוש כרגע)
);

-- המודל המתאים ל-prisma/schema.prisma (להוסיף אחרי ההרצה):
-- model LoginDevice {
--   id           String   @id @default(uuid())
--   tokenHash    String   @unique
--   employeeKeys String   @default("[]")
--   firstSeenAt  DateTime @default(now())
--   lastSeenAt   DateTime @default(now())
--   label        String?
-- }
