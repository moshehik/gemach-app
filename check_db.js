
import prisma from '@/app/lib/prisma';

async function main() {
  const items = await prisma.orderItem.findMany({ take: 5 });
  console.log('Order Items:', items);
  if (items.length > 0) {
    const orderId = items[0].orderId;
    console.log('Checking Order for orderId:', orderId);
    
    const byId = await prisma.order.findUnique({ where: { id: orderId } });
    console.log('Order by internal id:', byId?.orderId);

    const byOrderId = await prisma.order.findUnique({ where: { orderId: orderId } });
    console.log('Order by orderId:', byOrderId?.orderId);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
