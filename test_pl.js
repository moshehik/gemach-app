const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const pl = await prisma.priceList.findMany({ take: 5 });
  console.log(pl);
}
main().finally(() => prisma.$disconnect());
