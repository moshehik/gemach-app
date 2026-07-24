
import prisma from '@/app/lib/prisma';

async function main() {
  const items = await prisma.orderItem.findMany({ take: 100 });
  
  let matchOrderId = 0;
  let matchId = 0;
  
  for (const item of items) {
    if (!item.orderId) continue;
    
    const byOrderId = await prisma.order.findFirst({ where: { orderId: item.orderId } });
    if (byOrderId) matchOrderId++;
    
    const byId = await prisma.order.findFirst({ where: { id: item.orderId } });
    if (byId) matchId++;
  }
  
  console.log(`Out of ${items.length} items:`);
  console.log(`Matched by Order.orderId: ${matchOrderId}`);
  console.log(`Matched by Order.id: ${matchId}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
