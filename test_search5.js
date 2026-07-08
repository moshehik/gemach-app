const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const o = await prisma.order.findFirst();
    console.log('Sample order:', o.orderId, o.customerId);
    
    const likeQ = `%${o.orderId}%`;
    const numQ = o.orderId;
    
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
    `, likeQ, numQ);
    console.log('Orders found with query Raw:', orders.length);

    // Test with customer name
    const c = await prisma.customer.findUnique({where: {id: o.customerId}});
    console.log('Customer name:', c.firstName);
    
    const likeQ2 = `%${c.firstName}%`;
    const orders2 = await prisma.$queryRawUnsafe(`
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
    `, likeQ2, -1);
    console.log('Orders found by name:', orders2.length);

  } catch (e) {
    console.error(e.message);
  }
}
test().then(() => process.exit(0));
