const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  await prisma.systemSetting.updateMany({
    where: { key: 'enable_ai_specific_employees' },
    data: {
      name: 'תצוגת AI לעובדים מורשים בלבד',
      notes: 'אם מופעל, גישה ל-AI תינתן רק לעובדים שצוינו בכרטיס עובד.',
      category: 'בינה מלאכותית'
    }
  });
  console.log('Fixed enable_ai_specific_employees in DB');
}

fix().catch(console.error).finally(() => prisma.$disconnect());
