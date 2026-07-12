const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getAvailableInventory } = require('./lib/inventory.js');

async function test() {
  const modelId = 10; // Try a random model
  
  // Find a dress item for model 10
  const item = await prisma.dressItem.findFirst({
    where: { dressModelId: modelId, notInUse: false, isDeleted: false }
  });
  if (!item) {
    console.log("No item found");
    return;
  }
  
  // Check stock before
  const stockBefore = await getAvailableInventory(modelId, new Date('2026-08-01'));
  console.log("Stock before:", stockBefore.find(s => s.sizeText === item.sizeText)?.availableQuantity);
  
  // Create an order
  const order = await prisma.order.create({
    data: {
      orderId: Math.floor(Math.random() * 1000000),
      eventDate: new Date('2026-08-01'),
      isDeleted: false
    }
  });
  
  // Create order item
  const oi = await prisma.orderItem.create({
    data: {
      orderId: order.orderId,
      dressItemId: item.id,
      sizeText: item.sizeText,
      quantity: 1,
      isDeleted: false
    }
  });
  
  // Check stock after
  const stockAfter = await getAvailableInventory(modelId, new Date('2026-08-01'));
  console.log("Stock after:", stockAfter.find(s => s.sizeText === item.sizeText)?.availableQuantity);
  
  // Clean up
  await prisma.orderItem.delete({ where: { id: oi.id } });
  await prisma.order.delete({ where: { id: order.id } });
}

test().catch(console.error).finally(() => prisma.$disconnect());
