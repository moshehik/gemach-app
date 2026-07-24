
import prisma from '@/app/lib/prisma';

async function main() {
  const targetBarcode = "1220808";
  console.log(`Looking for DressItem with barcode: ${targetBarcode}`);
  
  const dressItem = await prisma.dressItem.findFirst({
    where: { dressBarcode: targetBarcode }
  });
  
  if (!dressItem) {
    console.log("DressItem not found!");
    return;
  }
  
  console.log(`Found DressItem ID: ${dressItem.id}`);
  
  const orderItemToFix = await prisma.orderItem.findFirst({
    where: { id: 671772 }
  });
  
  console.log("Before update:", JSON.stringify(orderItemToFix, null, 2));
  
  if (orderItemToFix) {
    const updated = await prisma.orderItem.update({
      where: { id: orderItemToFix.id },
      data: { dressItemId: dressItem.id }
    });
    console.log("After update:", JSON.stringify(updated, null, 2));
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
