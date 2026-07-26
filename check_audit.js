const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.auditLog.findMany({
    where: { entityType: 'Order', entityId: '25604' }
  });
  console.log('Logs for 25604 (by orderId string):', logs);

  const order = await prisma.order.findUnique({where: {orderId: 25604}});
  const logs2 = await prisma.auditLog.findMany({
    where: { entityType: 'Order', entityId: order.id }
  });
  console.log('Logs for 25604 (by uuid):', logs2);
}

main().catch(console.error).finally(() => process.exit(0));
