
import prisma from '@/app/lib/prisma';

async function main() {
  const latestOrder = await prisma.order.findFirst({
    orderBy: { id: 'desc' },
    include: { items: true }
  });
  console.log('Latest Order:', latestOrder);
}

main().catch(console.error).finally(() => prisma.$disconnect());
