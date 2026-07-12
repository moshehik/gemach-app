const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const item = await prisma.dressItem.findFirst({
    where: { notInUse: false, isDeleted: false, dressModelId: { not: null } }
  });
  if (!item) {
    console.log("No item found");
    return;
  }
  const modelId = item.dressModelId;
  
  const order = await prisma.order.create({
    data: {
      orderId: Math.floor(Math.random() * 1000000),
      eventDate: new Date('2026-08-01'),
      isDeleted: false
    }
  });
  
  const oi = await prisma.orderItem.create({
    data: {
      orderId: order.orderId,
      dressItemId: item.id,
      sizeText: item.sizeText,
      quantity: 1,
      isDeleted: false
    }
  });
  
  // Now try to fetch it
  const dateLimitStart = new Date('2026-08-01');
  dateLimitStart.setDate(dateLimitStart.getDate() - 60);
  const dateLimitEnd = new Date('2026-08-01');
  dateLimitEnd.setDate(dateLimitEnd.getDate() + 60);

  const bookingsWhere = {
    dressItem: { dressModelId: parseInt(modelId) },
    isDeleted: false,
    isReturned: false, 
    order: {
      isDeleted: false,
      OR: [
        { eventDate: { gte: dateLimitStart, lte: dateLimitEnd } },
        { fromDate: { gte: dateLimitStart, lte: dateLimitEnd } },
        { toDate: { gte: dateLimitStart, lte: dateLimitEnd } }
      ]
    }
  };
  
  const bookings = await prisma.orderItem.findMany({
    where: bookingsWhere,
    include: {
      order: true,
      dressItem: true
    }
  });
  
  console.log("Found bookings for our new order:", bookings.find(b => b.orderId === order.orderId) ? "YES" : "NO");
  
  // Clean up
  await prisma.orderItem.delete({ where: { id: oi.id } });
  await prisma.order.delete({ where: { id: order.id } });
}

test().catch(console.error).finally(() => prisma.$disconnect());
