const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const maxItem = await prisma.orderItem.findFirst({
    orderBy: { orderId: 'desc' }
  });
  console.log('Max orderId in OrderItem:', maxItem?.orderId);

  const maxOrder = await prisma.order.findFirst({
    orderBy: { orderId: 'desc' }
  });
  console.log('Max orderId in Order:', maxOrder?.orderId);
}

main().catch(console.error).finally(() => prisma.$disconnect());
