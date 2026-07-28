const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.systemSetting.updateMany({
    where: { key: 'hide_ai_features' },
    data: { name: '׳”׳¡׳×׳¨ ׳×׳›׳•׳ ׳•׳× AI' }
  });

  await prisma.systemSetting.updateMany({
    where: { key: 'hide_gregorian_calendar' },
    data: { name: '׳”׳¡׳×׳¨ ׳×׳׳¨׳™׳ ׳׳•׳¢׳–׳™' }
  });

  await prisma.systemSetting.updateMany({
    where: { key: 'hide_internal_messaging' },
    data: { name: '׳”׳¡׳×׳¨ ׳׳¢׳¨׳›׳× ׳”׳•׳“׳¢׳•׳×' }
  });
  
  await prisma.systemSetting.updateMany({
    where: { key: 'enable_ai_specific_employees' },
    data: { 
      name: '׳×׳¦׳•׳’׳× AI ׳׳¢׳•׳‘׳“׳™׳ ׳׳¡׳•׳™׳׳™׳ ׳‘׳׳‘׳“',
      category: '׳×׳¦׳•׳’׳”' 
    }
  });

  await prisma.systemSetting.updateMany({
    where: { key: 'require_login' },
    data: { name: '׳“׳¨׳•׳© ׳”׳×׳—׳‘׳¨׳•׳× ׳׳׳¢׳¨׳›׳×' }
  });

  console.log('Fixed names and categories');
}

main().catch(console.error).finally(() => prisma.$disconnect());
