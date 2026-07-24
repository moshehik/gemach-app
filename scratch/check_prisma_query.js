
import prisma from '@/app/lib/prisma';

async function main() {
  const items = await prisma.dressItem.findMany({
    where: { 
      dressModelId: 483, 
      notInUse: false, 
      isDeleted: false,
      inRepair: false,
      OR: [
        { location: null },
        {
          AND: [
            { location: { not: { contains: 'מחסן' } } },
            { location: { not: { contains: 'רזרבה' } } },
            { location: { not: { contains: 'warehouse' } } },
            { location: { not: { contains: 'reserve' } } }
          ]
        }
      ]
    }
  });
  
  console.log(`Prisma query returned ${items.length} items`);
  if (items.length > 0 && items.length < 5) {
    console.log(items);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
