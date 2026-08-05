const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const order = await prisma.order.findUnique({ 
    where: { orderId: 25734 }, 
    include: { 
      items: { include: { dressItem: { include: { dress: true } } } } 
    } 
  });
  console.log(JSON.stringify(order, null, 2));
}
main().finally(() => prisma.$disconnect());
