const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function count() {
  console.log('Models: ' + await prisma.dressModel.count());
  console.log('Items: ' + await prisma.dressItem.count());
  console.log('Orders: ' + await prisma.order.count());
}
count().finally(() => prisma.$disconnect());
