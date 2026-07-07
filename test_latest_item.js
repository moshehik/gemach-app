const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const o = await prisma.order.findFirst({
    where: { items: { some: {} } },
    include: { items: true },
    orderBy: { orderId: 'desc' }
  });
  console.log(JSON.stringify(o, null, 2));
  prisma.$disconnect();
}
main();
