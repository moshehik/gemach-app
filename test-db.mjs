import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.dressItem.findMany({
    where: {
      sizeText: '36',
      dress: { name: { contains: 'אפור טול' } },
      notInUse: false,
      isDeleted: false
    }
  });

  console.log('Stock items: ', items.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
