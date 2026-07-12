const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const c = await prisma.orderItem.count({ where: { dressItemId: null } });
  console.log('Orphaned order items:', c);
  const orphans = await prisma.orderItem.findMany({ where: { dressItemId: null, barcodePrefix: { not: null } }, take: 5, select: { id: true, barcodePrefix: true, sizeText: true, size: true }});
  console.log('Sample orphans:', orphans);
  const dresses = await prisma.dressItem.findMany({ take: 5, select: { id: true, barcodePrefix: true, sizeText: true }});
  console.log('Sample dress items:', dresses);
  await prisma.$disconnect();
}
run();
