import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  const where = {
    isDeleted: false,
    OR: [
      { orderDate: { gte: threeMonthsAgo } },
      { eventDate: { gte: threeMonthsAgo } },
      { eventDate: null }
    ]
  };
  
  console.log("threeMonthsAgo:", threeMonthsAgo);
  
  const count = await prisma.order.count({ where });
  console.log("Count:", count);
  
  const orders = await prisma.order.findMany({
    where,
    orderBy: { orderId: 'desc' },
    take: 5,
    select: { orderId: true, orderDate: true, eventDate: true }
  });
  console.log("Top 5 orders:");
  console.log(orders);
}
main().catch(console.error).finally(() => prisma.$disconnect());
