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
      AND DI."sizeText" IN ('2','4','6','8') 
    GROUP BY DM."id", DM."name" 
    HAVING COUNT(DISTINCT CASE WHEN DI."sizeText" IN ('2','4','6','8') THEN DI."sizeText" END) > 0;
  `;
  console.log('Models with any of these sizes:', models);
  
  // also let's just see ALL sizes for the model with the most sizes
  const sizes = await prisma.$queryRaw`
    SELECT DI."sizeText", COUNT(*)
    FROM "DressItem" DI
    GROUP BY DI."sizeText"
  `;
  console.log('Sizes in DB:', sizes);
}

main().finally(() => prisma.$disconnect());
