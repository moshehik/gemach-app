const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const barcodePrefix = 193; // Just pick a valid one
  const size = '08';
  
  // Find an actual order item that exists to test with
  const anOccupiedItem = await prisma.orderItem.findFirst({
    where: { barcodePrefix: 193, isDeleted: false },
    include: { order: true }
  });
  
  console.log("Found an occupied item:", anOccupiedItem ? { id: anOccupiedItem.id, orderEventDate: anOccupiedItem.order.eventDate } : "None");
  if (!anOccupiedItem) return;

  const eventDate = anOccupiedItem.order.eventDate;
  // Try to search a range around this date
  const fromDateParam = new Date(eventDate.getTime() - 24*60*60*1000).toISOString().split('T')[0];
  const toDateParam = new Date(eventDate.getTime() + 24*60*60*1000).toISOString().split('T')[0];
  
  console.log(`Testing range: ${fromDateParam} to ${toDateParam}`);

  const fromDateLimit = new Date(new Date(fromDateParam).getTime() - 12 * 60 * 60 * 1000);
  const toDateLimit = new Date(new Date(toDateParam).getTime() + 12 * 60 * 60 * 1000);
  
  console.log("fromDateLimit:", fromDateLimit);
  console.log("toDateLimit:", toDateLimit);

  const occupiedOrdersList = await prisma.orderItem.findMany({
    where: {
      barcodePrefix: anOccupiedItem.barcodePrefix,
      size: anOccupiedItem.size,
      isDeleted: false,
      order: {
        isDeleted: false,
        eventDate: {
          lte: toDateLimit,
        },
      }
    },
    include: { order: true }
  });

  const validOccupiedOrders = occupiedOrdersList.filter(item => {
    const order = item.order;
    if (!order) return false;
    const endDate = order.returnDate || order.eventDate;
    if (!endDate) return false;
    return endDate >= fromDateLimit;
  });

  console.log("Occupied count:", validOccupiedOrders.length);
}

main().finally(() => prisma.$disconnect());
