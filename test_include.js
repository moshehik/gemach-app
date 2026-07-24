
import prisma from '@/app/lib/prisma';

async function main() {
  const parsedId = 254;
  
  const orderWithItems = await prisma.order.findUnique({
    where: { orderId: parsedId },
    include: { items: true }
  });
  console.log('Order items via include:', orderWithItems.items);
}

main().catch(console.error).finally(() => prisma.$disconnect());
