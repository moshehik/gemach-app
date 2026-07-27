const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.systemSetting.upsert({
    where: { key: 'hide_dress_images' },
    update: {},
    create: {
      key: 'hide_dress_images',
      name: 'הסתר תמונות דגמים',
      value: 'false',
      category: 'תצוגה',
      type: 'boolean',
      notes: 'מסתיר תמונות דגמים ומקומות של תמונות במסך ניהול דגמים ובכרטיסי הדגמים'
    }
  });
  console.log('Setting added');
}

main().catch(console.error).finally(() => prisma.$disconnect());
