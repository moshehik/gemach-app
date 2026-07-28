const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.systemSetting.update({
    where: { key: 'hide_dress_images' },
    data: {
      name: 'הסתר תמונות דגמים',
      category: 'תצוגה'
    }
  });
  console.log(result);
}

main().catch(console.error).finally(() => prisma.$disconnect());
