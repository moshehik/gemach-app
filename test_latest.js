const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const latestOrder = await prisma.order.findFirst({
    orderBy: { id: 'desc' },
    include: { items: true }
  });
  console.log('Latest Order:', latestOrder);
}

main().catch(console.error).finally(() => prisma.$disconnect());
