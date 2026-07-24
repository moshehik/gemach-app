
import prisma from '@/app/lib/prisma';

async function test() {
  try {
    const likeQ = '%דוד%';
    const o = await prisma.$queryRawUnsafe(`
      SELECT o.*, c.firstName, c.lastName 
      FROM "Order" o
      LEFT JOIN "Customer" c ON o.customerId = c.id
      WHERE o.isDeleted = 0
      AND (
        c.firstName LIKE $1 OR
        c.lastName LIKE $1 OR
        c.phone1 LIKE $1 OR
        o.eventDateHebrew LIKE $1 OR
        o.orderId = $2 OR 
        o.id = $2
      )
      LIMIT 10
    `, likeQ, -1);
    console.log('Orders found with reordered $1 $2:', o.length);
  } catch (e) {
    console.error(e.message);
  }
}
test().then(() => process.exit(0));
