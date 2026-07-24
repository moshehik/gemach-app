
import prisma from '@/app/lib/prisma';

async function test() {
  try {
    const o = await prisma.order.findFirst({ where: { orderId: 1 }});
    console.log('Order 1:', o ? o.orderId : 'not found');
    const o2 = await prisma.order.findFirst({ where: { id: 1 }});
    console.log('Order ID 1:', o2 ? o2.id : 'not found');
  } catch (e) {
    console.error(e.message);
  }
}
test().then(() => process.exit(0));
