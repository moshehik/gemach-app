const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const items = await prisma.dressItem.findMany({
    select: { id: true, entryDateToRepo: true },
    where: { entryDateToRepo: { not: null } },
    take: 10
  });
  console.log("Items:");
  console.log(items);

  const models = await prisma.dressModel.findMany({
    select: { id: true, entryDateToRepo: true },
    take: 10
  });
  console.log("Models:");
  console.log(models);

  await prisma.$disconnect();
}
run();
