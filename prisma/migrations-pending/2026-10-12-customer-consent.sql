-- יומן הסכמות של לקוחות (CustomerConsent): תקנון / דיוור שיווקי / אישור מדיניות פרטיות. ר' docs/customer-consents.md.
--
-- לא הורץ ולא ייווצר אוטומטית. להרצה ידנית בשני הגמ"חים (שני ה-DB ב-Neon: org1 + org2), אחרי אישור הבעלים, ולפני שהקוד נפרס
-- (הקוד עובד גם בלי הטבלה - כתיבת ההסכמה ליומן נכשלת בשקט-מתועד ושמירת הלקוח ממשיכה - אבל אז אין ראיה משפטית).
-- תוספתי בלבד: טבלה חדשה + אינדקסים; אין שינוי ואין DROP בשום טבלה קיימת.
-- הרצה בטוחה: npm-script חלופי scripts/apply_customer_consent_table.js (dry-run כברירת מחדל, --write --expect-host=<קידומת host>).
-- אימות אחרי ההרצה: prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.prisma --script  -> ריק.

CREATE TABLE IF NOT EXISTS "CustomerConsent" (
  "id"                   TEXT         NOT NULL,
  "customerId"           TEXT         NOT NULL,
  "kind"                 TEXT         NOT NULL,
  "granted"              BOOLEAN      NOT NULL,
  "channel"              TEXT         NOT NULL,
  "method"               TEXT         NOT NULL,
  "surface"              TEXT,
  "recordedByEmployeeId" TEXT,
  "documentVersion"      TEXT,
  "documentRef"          TEXT,
  "wording"              TEXT,
  "meta"                 TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerConsent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CustomerConsent_customerId_kind_createdAt_idx" ON "CustomerConsent"("customerId", "kind", "createdAt");
CREATE INDEX IF NOT EXISTS "CustomerConsent_kind_granted_createdAt_idx" ON "CustomerConsent"("kind", "granted", "createdAt");

-- המפתח הזר נוצר בנפרד כי ADD CONSTRAINT אינו תומך IF NOT EXISTS: הרצה חוזרת מדלגת עליו.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomerConsent_customerId_fkey') THEN
    ALTER TABLE "CustomerConsent"
      ADD CONSTRAINT "CustomerConsent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ללא ערכי ברירת מחדל לשורות קיימות: לקוחות קיימים נשארים בלי שורות ביומן ("טרם נענתה" / "אושר במערכת הישנה, בלי תיעוד").
