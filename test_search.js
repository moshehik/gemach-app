
import prisma from '@/app/lib/prisma';

async function test() {
  const q = '1';
  const isNum = !isNaN(q) && q.trim() !== '';
  const numQ = isNum ? Number(q) : undefined;
  const likeQ = `%${q}%`;

  console.log({likeQ, numQ});

  try {
    const orders = await prisma.$queryRawUnsafe(`
      SELECT o.*, c.firstName, c.lastName 
      FROM "Order" o
      LEFT JOIN "Customer" c ON o.customerId = c.id
      WHERE o.isDeleted = 0
      AND (
        o.orderId = $2 OR 
        o.id = $2 OR 
        c.firstName LIKE $1 OR
        c.lastName LIKE $1 OR
        c.phone1 LIKE $1 OR
        o.eventDateHebrew LIKE $1
      )
      LIMIT 10
    `, likeQ, isNum ? numQ : -1);
    console.log('Orders found:', orders.length);
  } catch (e) {
    console.error('Error Orders:', e.message);
  }
}
test().then(() => process.exit(0));
