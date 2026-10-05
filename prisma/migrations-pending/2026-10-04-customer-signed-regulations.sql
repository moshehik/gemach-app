-- חתימה על התקנון ברמת הלקוח (כרטיס הלקוח החדש, תשובת הבעלים 4.10.2026 "sig: להכניס לאתר").
-- היום החתימה קיימת רק פר הזמנה (Order.hasSignedRegulations). בלי העמודות האלה הכרטיס החדש מציג את החתימה כנגזרת לקריאה
-- בלבד ("חתמה בהזמנה #N") והלחצן "חתמה על התקנון" לא משנה דבר (customerCardLogic.js: signatureState / SIGNATURE_COLUMNS_READY).
--
-- לא הורץ ולא ייווצר אוטומטית. להרצה ידנית, בשני הגמ"חים (שני ה-DB ב-Neon), אחרי אישור הבעלים. תוספתי בלבד: אין DROP
-- ואין שינוי בעמודות קיימות. אחרי ההרצה: (1) להוסיף את שני השדות ל-model Customer ב-prisma/schema.prisma (למטה) כדי ש-db push
-- עתידי לא ימחק אותם; (2) להוסיף אותם ל-data של PUT /api/customers/[id]; (3) להדליק SIGNATURE_COLUMNS_READY בכרטיס.

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "hasSignedRegulations" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "regulationsSignedAt" TIMESTAMP(3);

-- המודל המתאים ל-prisma/schema.prisma (להוסיף ל-model Customer אחרי ההרצה):
--   hasSignedRegulations Boolean   @default(false) // חתמה על התקנון (ברמת הלקוח)
--   regulationsSignedAt  DateTime? // מתי נחתם
