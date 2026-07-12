const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function test() {
  const items = await prisma.dressItem.findMany({ where: { dressModelId: 1 } });
  console.log('Items for model 1:');
  for (const i of items) {
    console.log(`ID: ${i.id}, Size: '${i.sizeText}', notInUse: ${i.notInUse}, inRepair: ${i.inRepair}, deleted: ${i.isDeleted}, location: ${i.location}`);
  }
}
test().finally(() => prisma.$disconnect());
