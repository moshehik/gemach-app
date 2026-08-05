const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const prices = await prisma.priceList.findMany();
  console.log(prices);
}

main().finally(() => prisma.$disconnect());
