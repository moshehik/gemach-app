const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Starting fix for orphaned OrderItems...");
  
  // Find all order items where dressItemId is null but barcodePrefix is not null
  const orphanedItems = await prisma.orderItem.findMany({
    where: {
      dressItemId: null,
      barcodePrefix: { not: null }
    }
  });
  
  console.log(`Found ${orphanedItems.length} orphaned OrderItems.`);
  let linkedCount = 0;
  
  for (const item of orphanedItems) {
    if (!item.barcodePrefix) continue;
    
    // Find a matching DressItem
    const dressItem = await prisma.dressItem.findFirst({
      where: {
        barcodePrefix: item.barcodePrefix,
        sizeText: item.sizeText
      }
    });
    
    if (dressItem) {
      await prisma.orderItem.update({
        where: { id: item.id },
        data: { dressItemId: dressItem.id }
      });
      linkedCount++;
    } else {
      // If we don't have an exact size match, maybe we can just link to any DressItem with this prefix 
      // just to get the model name (though it's better to match size if possible).
      // Since they just want the model name, we can link it to the first available if size doesn't matter,
      // but sizeText does matter for inventory. For historical display, let's just use the first match.
      const fallbackItem = await prisma.dressItem.findFirst({
        where: {
          barcodePrefix: item.barcodePrefix
        }
      });
      if (fallbackItem) {
        await prisma.orderItem.update({
          where: { id: item.id },
          data: { dressItemId: fallbackItem.id }
        });
        linkedCount++;
      }
    }
  }
  
  console.log(`Successfully linked ${linkedCount} OrderItems to their DressItems!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
