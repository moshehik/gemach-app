const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.systemSetting.upsert({
    where: { key: 'hide_ai_features' },
    update: {},
    create: {
      key: 'hide_ai_features',
      name: 'הסתר תכונות AI',
      value: 'false',
      category: 'תצוגה',
      type: 'boolean',
      notes: 'מסתיר את כפתורי הצאט של AI וכן את שורת חיפוש AI בטאבים'
    }
  });
  console.log('Setting added');
}

main().catch(console.error).finally(() => prisma.$disconnect());
