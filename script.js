const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.systemSetting.upsert({
    where: { key: 'ALLOWED_PAYMENT_METHODS' },
    update: {},
    create: {
      key: 'ALLOWED_PAYMENT_METHODS',
      value: 'אשראי (דרך נדרים פלוס),יציאה באישור מנהל',
      name: 'אפשרויות תשלום',
      category: 'תשלומים',
      notes: 'הזן אפשרויות תשלום מופרדות בפסיק (לדוגמה: מזומן,אשראי,העברה)',
      type: 'text'
    }
  });
  console.log('Setting added');
}

main().catch(console.error).finally(() => prisma.$disconnect());
