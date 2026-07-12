const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.order.update({
    where: { orderId: 26097 },
    data: { isDeleted: true }
  });
  
  await prisma.orderItem.updateMany({
    where: { orderId: 26097 },
    data: { isDeleted: true }
  });
  
  console.log("Order 26097 marked as deleted.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
