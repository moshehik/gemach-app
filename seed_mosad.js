
import prisma from '@/app/lib/prisma';

async function main() {
  const result = await prisma.systemSetting.upsert({
    where: { key: 'NEDARIM_MOSAD' },
    update: { 
      value: '7008300',
      name: 'קוד מוסד נדרים פלוס'
    },
    create: {
      key: 'NEDARIM_MOSAD',
      value: '7008300',
      name: 'קוד מוסד נדרים פלוס'
    }
  });
  console.log('Upserted setting:', result);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
