const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.order.count({where: {employeeId: {not: null}}});
  console.log('Orders with employeeId:', count);
  
  // Try to find if legacy code is stored somewhere else in the raw data
  const rawOrder = await prisma.$queryRaw`SELECT "employeeId", "legacyId" FROM "Order" WHERE "orderId" = 25604`;
  console.log('Raw order:', rawOrder);
}

main().catch(console.error).finally(() => process.exit(0));
