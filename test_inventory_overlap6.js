const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getAvailableInventory } = require('./lib/inventory.js');

async function test() {
  const item = await prisma.dressItem.findFirst({
    where: { notInUse: false, isDeleted: false, dressModelId: { not: null } }
  });
  
  // Make sure we have 3 items
  const sizesMap = await getAvailableInventory(item.dressModelId, new Date('2026-08-05'));
  console.log(sizesMap.find(s => s.sizeText === item.sizeText));
}

test().catch(console.error).finally(() => prisma.$disconnect());
