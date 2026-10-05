-- DRY-RUN (קריאה בלבד) למילוי חתימת התקנון - מראה כמה לקוחות היו משתנים בהרצת 2026-10-05-customer-signature-backfill.sql, בלי לשנות כלום.
-- בטוח להרצה בכל גמח ובכל זמן (SELECT בלבד). אחרי ההרצה האמיתית אותו קובץ אמור להחזיר would_change = 0.
-- אותם תנאים בדיוק כמו ב-UPDATE: לקוח פעיל, hasSignedRegulations=false, regulationsSignedAt IS NULL, יש לו הזמנה פעילה חתומה.
-- הדגימה מציגה מזהים מוצפנים (8 תווים ראשונים של md5 של מזהה הלקוח) + מספר ההזמנה + תאריך החתימה שיירשם - בלי שם/טלפון.

-- 1) המספרים (שורה אחת)
WITH first_signed AS (
  SELECT DISTINCT ON (o."customerId")
         o."customerId" AS "customerId",
         o."orderId" AS "orderId",
         COALESCE(o."orderDate", o."updatedAt") AS "firstSignedAt"
  FROM "Order" AS o
  WHERE o."isDeleted" = false
    AND o."hasSignedRegulations" = true
    AND o."customerId" IS NOT NULL
  ORDER BY o."customerId", COALESCE(o."orderDate", o."updatedAt") ASC, o."orderId" ASC
)
SELECT
  (SELECT count(*) FROM "Customer" WHERE "isDeleted" = false) AS active_customers,
  (SELECT count(*) FROM "Customer" WHERE "isDeleted" = false AND "hasSignedRegulations" = true) AS already_signed_stored,
  (SELECT count(*) FROM "Customer" WHERE "isDeleted" = false AND "hasSignedRegulations" = false AND "regulationsSignedAt" IS NOT NULL) AS revoked_kept_as_is,
  (SELECT count(*) FROM first_signed) AS customers_with_signed_order,
  (SELECT count(*) FROM first_signed fs JOIN "Customer" c ON c."id" = fs."customerId"
     WHERE c."isDeleted" = false AND c."hasSignedRegulations" = false AND c."regulationsSignedAt" IS NULL) AS would_change,
  (SELECT count(*) FROM first_signed fs JOIN "Customer" c ON c."id" = fs."customerId"
     WHERE c."isDeleted" = false AND c."hasSignedRegulations" = true) AS signed_order_but_already_stored_kept,
  (SELECT count(*) FROM first_signed fs JOIN "Customer" c ON c."id" = fs."customerId"
     WHERE c."isDeleted" = false AND c."hasSignedRegulations" = false AND c."regulationsSignedAt" IS NOT NULL) AS signed_order_but_revoked_kept,
  (SELECT count(*) FROM first_signed fs JOIN "Customer" c ON c."id" = fs."customerId"
     WHERE c."isDeleted" = true) AS signed_order_deleted_customer_skipped,
  (SELECT count(*) FROM "Order" WHERE "isDeleted" = false AND "hasSignedRegulations" = true AND "customerId" IS NULL) AS signed_orders_without_customer;

-- 2) דגימה של עד 10 לקוחות שיעודכנו (מזהה מוצפן)
SELECT left(md5(c."id"), 8) AS anon_customer,
       fs."orderId" AS first_signed_order,
       fs."firstSignedAt" AS would_set_signed_at
FROM (
  SELECT DISTINCT ON (o."customerId")
         o."customerId" AS "customerId",
         o."orderId" AS "orderId",
         COALESCE(o."orderDate", o."updatedAt") AS "firstSignedAt"
  FROM "Order" AS o
  WHERE o."isDeleted" = false
    AND o."hasSignedRegulations" = true
    AND o."customerId" IS NOT NULL
  ORDER BY o."customerId", COALESCE(o."orderDate", o."updatedAt") ASC, o."orderId" ASC
) AS fs
JOIN "Customer" AS c ON c."id" = fs."customerId"
WHERE c."isDeleted" = false
  AND c."hasSignedRegulations" = false
  AND c."regulationsSignedAt" IS NULL
ORDER BY md5(c."id")
LIMIT 10;
