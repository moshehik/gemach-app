
import prisma from '@/app/lib/prisma';

async function main() {
  await prisma.systemSetting.upsert({
    where: { key: 'max_items_per_order' },
    update: {},
    create: {
      key: 'max_items_per_order',
      value: '',
      name: 'הגבלת כמות פריטים בהזמנה',
      category: 'הזמנות',
      notes: 'השאר ריק או 0 ללא הגבלה',
      type: 'number'
    }
  });
  console.log('Setting added');
}

main().catch(console.error).finally(() => prisma.$disconnect());
