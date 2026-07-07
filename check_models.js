const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const models = await prisma.dressModel.findMany({ include: { items: true } });
  console.log(JSON.stringify(models.slice(0, 10).map(m => ({id: m.id, itemsCount: m.items.length})), null, 2));
  console.log('Total models: ', models.length);
  console.log('Models with 0 items: ', models.filter(m => m.items.length === 0).length);
}
check().finally(() => prisma.$disconnect());
