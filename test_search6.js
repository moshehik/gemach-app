const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const o = await prisma.order.findFirst();
    const numQ = o.orderId;
    
    // Using ? placeholders instead of $1, $2
    const likeQ = `%${numQ}%`;

    const orders = await prisma.$queryRawUnsafe(`
      SELECT o.*, c.firstName, c.lastName 
      FROM "Order" o
      LEFT JOIN "Customer" c ON o.customerId = c.id
      WHERE o.isDeleted = 0
      AND (
        o.orderId = ? OR 
        o.id = ? OR 
        c.firstName LIKE ? OR
        c.lastName LIKE ? OR
        c.phone1 LIKE ? OR
        o.eventDateHebrew LIKE ?
      )
      LIMIT 10
    `, numQ, numQ, likeQ, likeQ, likeQ, likeQ);
    console.log('Orders found with ? placeholders:', orders.length);

  } catch (e) {
    console.error(e.message);
  }
}
test().then(() => process.exit(0));
