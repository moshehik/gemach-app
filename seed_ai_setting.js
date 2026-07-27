const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.systemSetting.upsert({
    where: { key: 'enable_ai_specific_employees' },
    update: {},
    create: {
      key: 'enable_ai_specific_employees',
      value: 'false',
      name: 'תצוגת AI לעובדים מסוימים בלבד',
      category: 'הגדרות מתקדמות',
      notes: 'אם מופעל, ה-AI יוצג רק לעובדים שהוגדרו בכרטיס עובד',
      type: 'boolean',
    },
  });
  console.log('Setting added');
}

main().catch(console.error).finally(() => prisma.$disconnect());
