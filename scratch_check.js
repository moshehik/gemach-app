const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("--- Old / Problematic Order Items ---");
  const oldItems = await prisma.orderItem.findMany({
    take: 5,
    where: {
      OR: [
        { dressItemId: null },
        { description: { contains: "לקצר" } }
      ]
    },
    include: {
      dressItem: {
        include: {
          dress: true
        }
      }
    },
    orderBy: {
      id: 'asc'
    }
  });
  console.log(JSON.stringify(oldItems, null, 2));

  console.log("\n--- New / Good Order Items ---");
  const newItems = await prisma.orderItem.findMany({
    take: 5,
    where: {
      dressItemId: { not: null }
    },
    include: {
      dressItem: {
        include: {
          dress: true
        }
      }
    },
    orderBy: {
      id: 'desc'
    }
  });
  console.log(JSON.stringify(newItems, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
