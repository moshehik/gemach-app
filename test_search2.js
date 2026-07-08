const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const all = await prisma.order.findMany();
    console.log('Total orders:', all.length);
  } catch (e) {
    console.error(e.message);
  }
}
test().then(() => process.exit(0));
