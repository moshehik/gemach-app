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
  
  const orders = await prisma.order.findMany({
    where,
    orderBy: { eventDate: 'desc' },
    take: 10,
    select: { orderId: true, orderDate: true, eventDate: true }
  });
  console.log("Top 10 orders by eventDate desc:");
  console.log(orders);
}
main().catch(console.error).finally(() => prisma.$disconnect());
