const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { recalculateOrderObligations } = require('./lib/pricingEngine');
async function main() {
  await recalculateOrderObligations(25734);
  console.log('Order recalculated');
}
main().finally(() => prisma.$disconnect());
