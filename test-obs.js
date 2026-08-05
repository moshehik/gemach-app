const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const obs = await prisma.paymentObligation.findMany({ where: { orderId: 25734 } });
  console.log(JSON.stringify(obs, null, 2));
}
main().finally(() => prisma.$disconnect());
