
import prisma from '@/app/lib/prisma';

async function main() {
  const unlinkedItems = await prisma.orderItem.findMany({
    where: { dressItemId: null, barcode: { not: null } },
  });
  
  let matchCount = 0;
  for (const item of unlinkedItems) {
    const dressItem = await prisma.dressItem.findFirst({
      where: { dressBarcode: item.barcode }
    });
    if (dressItem) {
      matchCount++;
    }
  }
  
  console.log(`Found ${unlinkedItems.length} unlinked items with barcode.`);
  console.log(`Can link ${matchCount} of them to a DressItem by barcode.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
