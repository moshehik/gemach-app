
import prisma from '@/app/lib/prisma';
async function run() {
  const c = await prisma.paymentObligation.count({ where: { orderItemId: { not: null } } });
  console.log('Count of obligations with orderItemId:', c);
  await prisma.$disconnect();
}
run();
