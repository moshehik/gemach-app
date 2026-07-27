import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  const orders = await prisma.order.findMany({
    where: {
      status: { notIn: ['מבוטל', 'מחוק'] },
      isDeleted: false
    },
    select: { id: true, eventDate: true, eventDateHebrew: true, fromDate: true, toDate: true }
  });
  console.log('Total valid orders:', orders.length);
  
  const tammuzOrders = orders.filter(o => o.eventDateHebrew && o.eventDateHebrew.includes('תמוז'));
  console.log('Tammuz orders:', tammuzOrders.length);
  
  if (tammuzOrders.length > 0) {
    console.log(tammuzOrders.slice(0, 5));
  }
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
