
import prisma from '@/app/lib/prisma';

async function main() {
  const item26987 = await prisma.dressItem.findUnique({ where: { id: 26987 } });
  console.log('Item 26987 location:', item26987.location);
  
  const allItems = await prisma.dressItem.findMany({ where: { dressModelId: 483 } });
  const nullLocs = allItems.filter(i => i.location === null).length;
  console.log(`Out of ${allItems.length} items, ${nullLocs} have location: null`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
