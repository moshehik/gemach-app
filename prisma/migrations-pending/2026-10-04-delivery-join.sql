-- טבלת "הצטרפות למשלוח קיים" - DeliveryJoin (R49, DDL-1 בכרטיס ההזמנה החדש).
--
-- מה: שורה אחת להזמנה שמצטרפת למשלוח של הזמנה אחרת (joinedToOrderId = "שורש" הקבוצה) או שמסומנת כ"ראשי"
--      בכתובת (isPrimary). המודל המתאים נמצא ב-prisma/schema.prisma (model DeliveryJoin); הקוד:
--      lib/deliveryJoin.js, app/api/deliveries/join/route.js, app/components/order-card/parts/OcDeliveryJoinPicker.js.
-- למה: עבודת נווה יעקב (feature/neve-batch-2026-09-25) יצרה את הטבלה בעצמה בזמן ריצה (CREATE TABLE IF NOT EXISTS בתוך הקוד) -
--      DDL לא מאושר בתוך קוד, ולכן הוסר בפורט. הבעלים אישר (4.10.2026, DDL-1) ליצור את הטבלה בשני הגמ"חים.
--      **ההרצה עצמה עדיין דורשת אישור מפורש בזמן ההרצה** - הקובץ הזה לא הורץ על אף DB.
-- איך: תוספת בלבד - CREATE TABLE / CREATE INDEX עם IF NOT EXISTS, בלי לגעת בשום טבלה קיימת (idempotent). להריץ ידנית על
--      MAIN (gmach_name "מכובד- השכרת שמלות"), NEVE (gmach_name "גמ"ח שמלות נווה יעקב") ועל TEST - עם בדיקת זהות
--      (gmach_name + host) לכל DB, בתוך טרנזקציה של הסקריפט (כמו ScheduleStageMark ב-2.10.2026), וביקורת byte-for-byte מול
--      `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma` לפני ההרצה. עד אז הקוד מתנהג כ"כבוי":
--      הבורר מוסתר והמסלולים מחזירים enabled:false (P2021 / 42P01 נתפסים, בדיקה חוזרת כל כמה דקות).
--      אזהרה: אין להריץ `prisma db push` במקום הקובץ הזה - הוא ימחק את ErrorReport.isArchivedByUser (docs/branches-and-worktrees.md).
--      אחרי ההרצה על DB: אם ה-dev server רץ, לאתחל אותו (הקליינט המורחב נשמר על globalThis) ולהריץ `npx prisma generate`.
--
-- ביטול (לא להריץ - לתיעוד בלבד; מוחק את כל ההצטרפויות):
--   -- DROP TABLE IF EXISTS "DeliveryJoin";

CREATE TABLE IF NOT EXISTS "DeliveryJoin" (
    "orderId"         INTEGER NOT NULL,
    "joinedToOrderId" INTEGER,
    "isPrimary"       BOOLEAN NOT NULL DEFAULT false,
    "direction"       TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryJoin_pkey" PRIMARY KEY ("orderId")
);

-- חברי קבוצה לפי השורש (getJoinGroup / listJoinCandidates / setGroupPrimary)
CREATE INDEX IF NOT EXISTS "DeliveryJoin_joinedToOrderId_idx" ON "DeliveryJoin"("joinedToOrderId");
