const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const minDate = new Date('2026-07-01');
  const maxDate = new Date('2026-11-01');
  
  const bookings = await prisma.orderItem.findMany({
    where: {
      dressItem: { dressModelId: 483, sizeText: '04' },
      isDeleted: false,
      isReturned: false,
      order: {
        isDeleted: false,
        OR: [
          { eventDate: { gte: minDate, lte: maxDate } },
          { fromDate: { lte: maxDate }, toDate: { gte: minDate } }
        ]
      }
    },
    include: {
      order: true
    }
  });
  
  console.log(`Found ${bookings.length} overlapping bookings for size 04 around Sep 2026`);
  bookings.forEach(b => {
    console.log(`Order ${b.order.orderId}: EventDate=${b.order.eventDate}, Qty=${b.quantity}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
