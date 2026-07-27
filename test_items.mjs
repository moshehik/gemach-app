import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function test() {
  const orders = await prisma.order.findMany({
    where: {
      status: { notIn: ['מבוטל', 'מחוק'] },
      isDeleted: false,
      eventDate: { gte: new Date('2026-06-10'), lte: new Date('2026-07-20') }
    },
    include: { items: true }
  });
  
  if (orders.length > 0) {
    console.log("Order Date:", orders[0].eventDate);
    console.log("Items:", orders[0].items);
  }
}
test().catch(console.error).finally(() => prisma.$disconnect());
