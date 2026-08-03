const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runFastBackfill() {
  console.log("=== STARTING INSTANT RAW SQL BACKFILL FOR ALL ORDERS & ITEMS ===");

  // 1. Order returnDate
  console.log("Step 1: Setting Order.returnDate for orders with eventDate...");
  const res1 = await prisma.$executeRawUnsafe(`
    UPDATE "Order"
    SET "returnDate" = "eventDate" + INTERVAL '2 days'
    WHERE "eventDate" IS NOT NULL AND "returnDate" IS NULL AND "isDeleted" = false;
  `);
  console.log(`Orders returnDate updated: ${res1}`);

  // 2. Order orderDate
  console.log("Step 2: Setting Order.orderDate for orders with eventDate...");
  const res2 = await prisma.$executeRawUnsafe(`
    UPDATE "Order"
    SET "orderDate" = "eventDate" - INTERVAL '30 days'
    WHERE "eventDate" IS NOT NULL AND "orderDate" IS NULL AND "isDeleted" = false;
  `);
  console.log(`Orders orderDate updated: ${res2}`);

  // 3. OrderItem takenDate & isTaken for items with barcode or isTaken=true
  console.log("Step 3: Setting OrderItem.takenDate & isTaken for items with barcode...");
  const res3 = await prisma.$executeRawUnsafe(`
    UPDATE "OrderItem" AS item
    SET 
      "isTaken" = true,
      "takenDate" = COALESCE(item."takenDate", ord."eventDate", ord."orderDate", ord."fromDate", item."createdAt", NOW())
    FROM "Order" AS ord
    WHERE item."orderId" = ord."orderId"
      AND item."isDeleted" = false
      AND (item."barcode" IS NOT NULL OR item."isTaken" = true);
  `);
  console.log(`OrderItems takenDate updated: ${res3}`);

  // 4. OrderItem returnDate & isReturned for items returned or with past event
  console.log("Step 4: Setting OrderItem.returnDate & isReturned for past/returned items...");
  const res4 = await prisma.$executeRawUnsafe(`
    UPDATE "OrderItem" AS item
    SET 
      "isTaken" = true,
      "isReturned" = true,
      "takenDate" = COALESCE(item."takenDate", ord."eventDate", ord."orderDate", item."createdAt", NOW()),
      "returnDate" = COALESCE(item."returnDate", ord."returnDate", ord."eventDate" + INTERVAL '2 days', ord."toDate", item."takenDate" + INTERVAL '2 days', NOW())
    FROM "Order" AS ord
    WHERE item."orderId" = ord."orderId"
      AND item."isDeleted" = false
      AND (item."isReturned" = true OR (ord."eventDate" IS NOT NULL AND ord."eventDate" < NOW()));
  `);
  console.log(`OrderItems returnDate & isReturned updated: ${res4}`);

  console.log("\n=== BACKFILL COMPLETE! ===");

  // Verification: Check Order 25652
  console.log("\nVerifying Order 25652:");
  const o25652 = await prisma.order.findUnique({
    where: { orderId: 25652 },
    include: { items: true }
  });
  console.log(JSON.stringify(o25652, null, 2));
}

runFastBackfill().catch(console.error).finally(() => prisma.$disconnect());
