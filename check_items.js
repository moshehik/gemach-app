const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const items = await prisma.dressItem.findMany();
  console.log('Total items: ' + items.length);
  const nulls = items.filter(i => !i.dressModelId);
  console.log('Items with null dressModelId: ' + nulls.length);
}

check().catch(console.error).finally(() => prisma.$disconnect());
