const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRaw`UPDATE "Order" SET "totalAmount" = COALESCE((SELECT SUM("amount") FROM "PaymentObligation" po WHERE po."orderId" = "Order"."orderId" AND po."isDeleted" = false), 0) WHERE "totalAmount" IS NULL`;
  console.log('Fixed quickly with SQL');
}

main().finally(() => prisma.$disconnect());
