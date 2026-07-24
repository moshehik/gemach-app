
import prisma from '@/app/lib/prisma';

async function main() {
  console.log("Running SQL migrations to link OrderItems to DressItems...");

  // Update using barcode
  const result1 = await prisma.$executeRaw`
    UPDATE "OrderItem" AS oi
    SET "dressItemId" = di."id"
    FROM "DressItem" AS di
    WHERE oi."dressItemId" IS NULL
      AND oi."barcode" = di."dressBarcode"
      AND oi."barcode" IS NOT NULL;
  `;
  console.log(`Updated by full barcode: ${result1} rows`);

  // Update using barcodePrefix + size/sizeText (using DISTINCT ON to pick any one DressItem per prefix+size)
  const result2 = await prisma.$executeRaw`
    UPDATE "OrderItem" AS oi
    SET "dressItemId" = di."id"
    FROM (
      SELECT DISTINCT ON ("barcodePrefix", "sizeText") "id", "barcodePrefix", "sizeText"
      FROM "DressItem"
    ) AS di
    WHERE oi."dressItemId" IS NULL
      AND oi."barcodePrefix" = di."barcodePrefix"
      AND (oi."size" = di."sizeText" OR oi."sizeText" = di."sizeText")
      AND oi."barcodePrefix" IS NOT NULL;
  `;
  console.log(`Updated by prefix and size: ${result2} rows`);

  // Update using only barcodePrefix as a last resort
  const result3 = await prisma.$executeRaw`
    UPDATE "OrderItem" AS oi
    SET "dressItemId" = di."id"
    FROM (
      SELECT DISTINCT ON ("barcodePrefix") "id", "barcodePrefix"
      FROM "DressItem"
    ) AS di
    WHERE oi."dressItemId" IS NULL
      AND oi."barcodePrefix" = di."barcodePrefix"
      AND oi."barcodePrefix" IS NOT NULL;
  `;
  console.log(`Updated by prefix only: ${result3} rows`);

  console.log("Migration via raw SQL complete.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
