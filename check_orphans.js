const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const c = await prisma.orderItem.count({ where: { dressItemId: null } });
  console.log('Orphaned order items remaining:', c);
  await prisma.$disconnect();
}
run();
