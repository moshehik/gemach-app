
import prisma from '@/app/lib/prisma';
const { getAvailableInventory } = require('./lib/inventory.js');

async function test() {
  const stockBefore = await getAvailableInventory(1, new Date('2026-08-01'));
  console.log("Saturday 2026-08-01 - did it work?", stockBefore.length > 0);
  
  // Now try a Wednesday
  const order = await prisma.order.create({
    data: {
      orderId: Math.floor(Math.random() * 1000000),
      eventDate: new Date('2026-08-05'),
      isDeleted: false
    }
  });
  
  const item = await prisma.dressItem.findFirst({
    where: { notInUse: false, isDeleted: false, dressModelId: { not: null } }
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
  
  const stockWedBefore = await getAvailableInventory(item.dressModelId, new Date('2026-08-05'));
  console.log("Wed booked, checking Wed:", stockWedBefore.find(s => s.sizeText === item.sizeText)?.availableQuantity);
  
  await prisma.orderItem.delete({ where: { id: oi.id } });
  await prisma.order.delete({ where: { id: order.id } });
}

test().catch(console.error).finally(() => prisma.$disconnect());
