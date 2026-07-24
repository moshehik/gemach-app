
import prisma from '@/app/lib/prisma';

async function main() {
  const pl = await prisma.priceList.findMany({ take: 5 });
  console.log(pl);
}
main().finally(() => prisma.$disconnect());
