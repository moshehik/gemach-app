-- מילוי חתימת התקנון ברמת הלקוח מתוך ההזמנות החתומות (Order.hasSignedRegulations) - BACKFILL חד-פעמי, אידמפוטנטי.
-- לא הורץ ולא יורץ אוטומטית. להרצה ידנית ע"י הבעלים/הליד, בכל גמח בנפרד (שני DB נפרדים ב-Neon), רק אחרי:
--   (1) דיפלוי 1 (schema.prisma מצהיר על העמודות) עלה ואומת, (2) הרצת קובץ ה-DRY-RUN
--   (prisma/migrations-pending/2026-10-05-customer-signature-backfill-dryrun.sql) ושמירת המספרים, (3) אישור שה-host הוא הגמח הנכון.
-- דורש שהעמודות כבר קיימות (2026-10-04-customer-signed-regulations.sql). הסדר המלא: docs/customer-signature-rollout-2026-10-05.md.
--
-- מה זה עושה: לכל לקוח *פעיל* שאין לו חתימה שמורה (hasSignedRegulations=false וגם regulationsSignedAt IS NULL) ויש לו הזמנה פעילה
-- (isDeleted=false) עם hasSignedRegulations=true - מסמן אותו חתום, ומתאריך החתימה לוקח את ההזמנה החתומה *המוקדמת ביותר*
-- (COALESCE(orderDate, updatedAt) - אותו תאריך ייחוס כמו הכרטיס הנגזר; שוויון נשבר לפי orderId הנמוך).
-- מה זה לא עושה: לא דורס לעולם חתימה שמורה (hasSignedRegulations=true נשאר כמו שהוא, כולל חותמת); לא נוגע בלקוח שהחתימה שלו
-- בוטלה בכוונה (hasSignedRegulations=false עם חותמת קיימת = "בוטלה", ר' lib/customerSignature.js); לא נוגע בלקוחות מחוקים;
-- לא נוגע ב-"Customer"."updatedAt" (SQL גולמי) - כך שאין 409 שווא בכרטיסים פתוחים; לא כותב ל-AuditLog (מכוון, מילוי נתונים
-- היסטורי; לא להוסיף שורות יומן ידניות). הרצה חוזרת = 0 שורות (התנאי WHERE כבר לא מתקיים).
--
-- פקודה אחת (אטומית): הרצה בטרנזקציה אחת של הכלי שמריץ אותה. לוודא שמספר השורות שעודכנו שווה למספר ה-"would_change" מה-DRY-RUN.

UPDATE "Customer" AS c
SET "hasSignedRegulations" = true,
    "regulationsSignedAt" = s."firstSignedAt"
FROM (
  SELECT DISTINCT ON (o."customerId")
         o."customerId" AS "customerId",
         COALESCE(o."orderDate", o."updatedAt") AS "firstSignedAt"
  FROM "Order" AS o
  WHERE o."isDeleted" = false
    AND o."hasSignedRegulations" = true
    AND o."customerId" IS NOT NULL
  ORDER BY o."customerId", COALESCE(o."orderDate", o."updatedAt") ASC, o."orderId" ASC
) AS s
WHERE c."id" = s."customerId"
  AND c."isDeleted" = false
  AND c."hasSignedRegulations" = false
  AND c."regulationsSignedAt" IS NULL;
