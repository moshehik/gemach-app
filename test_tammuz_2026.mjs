import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  const minDate = new Date('2026-06-01');
  const maxDate = new Date('2026-07-31');

  const orders = await prisma.order.findMany({
    where: {
      status: { notIn: ['מבוטל', 'מחוק'] },
      isDeleted: false,
      eventDate: { gte: minDate, lte: maxDate }
    },
    select: { id: true, eventDate: true, eventDateHebrew: true, fromDate: true, toDate: true }
  });
  
  console.log('Orders in June-July 2026:', orders.length);
  
  const tammuzOrders = orders.filter(o => o.eventDateHebrew && o.eventDateHebrew.includes('תמוז'));
  console.log('Tammuz orders in 2026:', tammuzOrders.length);
  
  if (tammuzOrders.length > 0) {
    console.log(tammuzOrders.slice(0, 5));
  }
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
