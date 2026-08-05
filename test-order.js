const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const order = await prisma.order.findFirst({ include: { items: true }, orderBy: { orderId: 'desc' } });
  console.log(JSON.stringify(order, null, 2));
}
main().finally(() => prisma.$disconnect());
