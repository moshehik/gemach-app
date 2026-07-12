const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const oldItems = await prisma.orderItem.findMany({
    take: 20,
    where: {
      dressItemId: null
    },
    orderBy: {
      id: 'asc'
    }
  });
  console.log(JSON.stringify(oldItems, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
