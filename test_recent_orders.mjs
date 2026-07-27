import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const orders = await prisma.order.findMany({
    orderBy: { orderId: 'desc' },
    take: 10,
    select: { orderId: true, orderDate: true, eventDate: true, eventDateHebrew: true, isDeleted: true }
  });
  console.log(orders);
}
main().catch(console.error).finally(() => prisma.$disconnect());
