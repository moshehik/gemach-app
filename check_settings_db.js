const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const all = await prisma.systemSetting.findMany({});
  console.log(all.map(s => ({ key: s.key, name: s.name, category: s.category, notes: s.notes })));
}

check().catch(console.error).finally(() => prisma.$disconnect());
