
import prisma from '@/app/lib/prisma';
const { getAvailableInventory } = require('./lib/inventory.js');

async function test() {
  const item = await prisma.dressItem.findFirst({
    where: { notInUse: false, isDeleted: false, dressModelId: { not: null } }
  });
  if (!item) {
    console.log("No item found");
    return;
  }
  const modelId = item.dressModelId;
  
  const stockBefore = await getAvailableInventory(modelId, new Date('2026-08-01'));
  console.log("Stock before:", stockBefore.find(s => s.sizeText === item.sizeText)?.availableQuantity);
  
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
  
  const stockAfter = await getAvailableInventory(modelId, new Date('2026-08-01'));
  console.log("Stock after:", stockAfter.find(s => s.sizeText === item.sizeText)?.availableQuantity);
  
  await prisma.orderItem.delete({ where: { id: oi.id } });
  await prisma.order.delete({ where: { id: order.id } });
}

test().catch(console.error).finally(() => prisma.$disconnect());
