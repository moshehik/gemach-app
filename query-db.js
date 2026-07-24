
import prisma from '@/app/lib/prisma';
async function main() {
  const count = await prisma.dressItem.count();
  const withBarcode = await prisma.dressItem.count({ where: { dressBarcode: { not: null } } });
  console.log(`Total dress items: ${count}, with barcode: ${withBarcode}`);
  
  const sample = await prisma.dressItem.findMany({ take: 5, where: { dressBarcode: null } });
  console.log("Sample without barcode:");
  console.log(sample.map(i => ({ id: i.id, dressBarcode: i.dressBarcode, quantity: i.quantity })));
}
main().finally(() => prisma.$disconnect());
