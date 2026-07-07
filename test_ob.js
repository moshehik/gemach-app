const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const obs = await prisma.paymentObligation.findMany({ take: 5 });
  console.log(obs);
}
main().finally(() => prisma.$disconnect());
