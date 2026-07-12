const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getAvailableInventory } = require('./lib/inventory.js');

async function test() {
  const item = await prisma.dressItem.findFirst({
    where: { notInUse: false, isDeleted: false, dressModelId: { not: null } }
  });
  
  if (item) {
    console.log("Found item:", item.dressModelId);
    const stockAfter = await getAvailableInventory(item.dressModelId, '2026-08-05T21:00:00.000Z');
    console.log("Stock:", stockAfter);
  }
}

test().catch(console.error).finally(() => prisma.$disconnect());
