const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const c = await prisma.paymentObligation.count({ where: { orderItemId: { not: null } } });
  console.log('Count of obligations with orderItemId:', c);
  await prisma.$disconnect();
}
run();
