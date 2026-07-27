const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.systemSetting.findUnique({
    where: { key: 'enable_alterations' }
  });

  if (!existing) {
    await prisma.systemSetting.create({
      data: {
        key: 'enable_alterations',
        name: 'הפעל מערכת תיקונים ותפירות',
        value: 'true',
        type: 'boolean',
        category: 'הזמנות',
        notes: 'האם להציג אפשרויות תיקונים במערכת'
      }
    });
    console.log('Added enable_alterations setting.');
  } else {
    console.log('enable_alterations setting already exists.');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
