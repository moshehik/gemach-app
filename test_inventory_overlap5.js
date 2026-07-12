const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getAvailableInventory } = require('./lib/inventory.js');

async function test() {
  const item = await prisma.dressItem.findFirst({
    where: { notInUse: false, isDeleted: false, dressModelId: { not: null } }
  });
  
  const stockWedBefore = await getAvailableInventory(item.dressModelId, new Date('2026-08-05'));
  console.log("Wed before:", stockWedBefore.find(s => s.sizeText === item.sizeText)?.availableQuantity);
  
  const order = await prisma.order.create({
    data: {
      orderId: Math.floor(Math.random() * 1000000),
      eventDate: new Date('2026-08-05'),
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
  
  const stockWedAfter = await getAvailableInventory(item.dressModelId, new Date('2026-08-05'));
  console.log("Wed after:", stockWedAfter.find(s => s.sizeText === item.sizeText)?.availableQuantity);
  
  await prisma.orderItem.delete({ where: { id: oi.id } });
  await prisma.order.delete({ where: { id: order.id } });
}

test().catch(console.error).finally(() => prisma.$disconnect());
