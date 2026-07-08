const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const all = await prisma.$queryRawUnsafe(`SELECT * FROM "Order" WHERE isDeleted = 0 LIMIT 10`);
    console.log('Orders with isDeleted = 0:', all.length);
    
    const all2 = await prisma.$queryRawUnsafe(`SELECT * FROM "Order" WHERE isDeleted = false LIMIT 10`);
    console.log('Orders with isDeleted = false:', all2.length);

    const all3 = await prisma.$queryRawUnsafe(`SELECT * FROM "Order" WHERE isDeleted = 'false' OR isDeleted = '0' LIMIT 10`);
    console.log('Orders with isDeleted str:', all3.length);

    const first = await prisma.order.findFirst();
    console.log('isDeleted type:', typeof first.isDeleted, first.isDeleted);
  } catch (e) {
    console.error(e.message);
  }
}
test().then(() => process.exit(0));
