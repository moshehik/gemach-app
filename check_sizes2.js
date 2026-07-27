const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const models = await prisma.$queryRaw`
    SELECT DM."name", DM."id", COUNT(DISTINCT DI."sizeText") as "count"
    FROM "DressModel" DM 
    JOIN "DressItem" DI ON DM."id" = DI."dressModelId" 
    WHERE DM."isDeleted" = false 
      AND DI."isDeleted" = false 
      AND DI."notInUse" = false 
      AND DI."inRepair" = false 
      AND DI."sizeText" IN ('02','04','06','08') 
    GROUP BY DM."id", DM."name" 
    HAVING COUNT(DISTINCT CASE WHEN DI."sizeText" IN ('02','04','06','08') THEN DI."sizeText" END) = 4;
  `;
  console.log('Models with ALL of these sizes:', models);
}

main().finally(() => prisma.$disconnect());
