const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  const items = await prisma.dressItem.findMany();
  const models = await prisma.dressModel.findMany();
  let count = 0;
  for(const item of items) {
    if (!item.dressModelId) {
      const matchedModel = models.find(m => m.barcodePrefix === item.barcodePrefix || (m.name && m.name === item.dressName));
      if (matchedModel) {
        await prisma.dressItem.update({ where: { id: item.id }, data: { dressModelId: matchedModel.id }});
        count++;
      }
    }
  }
  console.log('Updated ' + count + ' items');
}

fix().catch(console.error).finally(() => prisma.$disconnect());
