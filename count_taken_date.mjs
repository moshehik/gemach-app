import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.orderItem.count({
    where: { takenDate: { not: null } }
  });
  console.log(`Number of items with takenDate: ${count}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
