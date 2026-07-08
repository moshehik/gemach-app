const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.dressItem.count({ where: { dressModelId: null } });
  console.log("Items without model:", c);
  
  const m = await prisma.dressModel.count();
  const modelsWithItems = await prisma.dressModel.findMany({ include: { items: true } });
  let emptyModels = 0;
  for (const model of modelsWithItems) {
      if (model.items.length === 0) emptyModels++;
  }
  console.log("Empty models:", emptyModels, "out of", m);
}

main();
