const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const q = '052';
  const isNum = !isNaN(q) && q.trim() !== '';
  const numQ = isNum ? Number(q) : -1;
  const likeQ = `%${q}%`;

  try {
    const customers = await prisma.$queryRawUnsafe(`
      SELECT * FROM "Customer" 
      WHERE "isDeleted" = false 
      AND (
        "firstName" LIKE $1 OR 
        "lastName" LIKE $1 OR 
        phone1 LIKE $1 OR 
        phone2 LIKE $1 OR 
        city LIKE $1 OR 
        id = $2
      )
      LIMIT 1
    `, likeQ, numQ);
    console.log("Customers ok");

    const orders = await prisma.$queryRawUnsafe(`
      SELECT o.*, c."firstName", c."lastName", (SELECT COUNT(*) FROM "OrderItem" oi WHERE oi."orderId" = o."orderId" AND oi."isDeleted" = false) as "itemCount"
      FROM "Order" o
      LEFT JOIN "Customer" c ON o."customerId" = c.id
      WHERE o."isDeleted" = false
      AND (
        c."firstName" LIKE $1 OR
        c."lastName" LIKE $1 OR
        c.phone1 LIKE $1 OR
        o."eventDateHebrew" LIKE $1 OR
        CAST(o."eventDate" AS TEXT) LIKE $1 OR
        o."orderId" = $2 OR 
        o.id = $2
      )
      LIMIT 1
    `, likeQ, numQ);
    console.log("Orders ok");

    const rentals = await prisma.$queryRawUnsafe(`
      SELECT oi.*, d."dressName" as "catalogName", d."barcodePrefix" as "catalogBarcode"
      FROM "OrderItem" oi
      LEFT JOIN "DressItem" d ON oi."dressItemId" = d.id
      WHERE oi."isDeleted" = false
      AND (
        oi.description LIKE $1 OR 
        oi."sizeText" LIKE $1 OR 
        d."dressName" LIKE $1 OR
        oi.barcode LIKE $1 OR
        CAST(oi."barcodePrefix" AS TEXT) LIKE $1 OR
        CAST(d."barcodePrefix" AS TEXT) LIKE $1 OR
        oi."orderId" = $2
      )
      LIMIT 1
    `, likeQ, numQ);
    console.log("Rentals ok");
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
