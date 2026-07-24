
import prisma from '@/app/lib/prisma';

async function run() {
  const allItems = await prisma.dressItem.count();
  const nullLocation = await prisma.dressItem.count({ where: { location: null } });
  const notContains = await prisma.dressItem.count({
    where: {
      AND: [
        { location: { not: { contains: 'מחסן' } } },
        { location: { not: { contains: 'רזרבה' } } }
      ]
    }
  });
  
  const fixedContains = await prisma.dressItem.count({
    where: {
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

  console.log("Total items:", allItems);
  console.log("Items with null location:", nullLocation);
  console.log("Items matching not: contains:", notContains);
  console.log("Items matching fixed OR:", fixedContains);
}
run();
