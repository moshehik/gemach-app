const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const order = await prisma.order.findFirst({ where: { status: 'טיוטה' }, include: { items: true }, orderBy: { orderId: 'desc' } });
  if (!order || order.items.length === 0) return console.log('No order');
  const item = order.items[0];
  const updateData = { neckAlteration: item.neckAlteration === 1 ? 0 : 1 };
  const updated = await prisma.orderItem.update({ where: { id: item.id }, data: updateData });
  console.log('Updated item:', updated.neckAlteration);
  const { recalculateOrderObligations } = require('./lib/pricingEngine');
  await recalculateOrderObligations(order.orderId);
  const finalOrder = await prisma.order.findUnique({ where: { orderId: order.orderId }, include: { items: true } });
  console.log('Final price:', finalOrder.items.find(i=>i.id===item.id).finalPrice);
  const obs = await prisma.paymentObligation.findMany({ where: { orderId: order.orderId, orderItemId: item.id } });
  console.log('Obligations:', obs);
}
main().finally(() => prisma.$disconnect());
