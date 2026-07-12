const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const unlinkedItems = await prisma.orderItem.findMany({
    where: { dressItemId: null },
  });
  
  let matchByBarcode = 0;
  let matchByPrefixAndSize = 0;
  let noMatch = 0;
  
  for (const item of unlinkedItems) {
    let matched = false;
    
    // First try by full barcode
    if (item.barcode) {
      const dressItem = await prisma.dressItem.findFirst({
        where: { dressBarcode: item.barcode }
      });
      if (dressItem) {
        matchByBarcode++;
        matched = true;
      }
    }
    
    // If no match by barcode, try by prefix and size
    if (!matched && item.barcodePrefix && (item.size || item.sizeText)) {
      const sizeToUse = item.size || item.sizeText;
      const dressItem = await prisma.dressItem.findFirst({
        where: { 
          barcodePrefix: item.barcodePrefix,
          sizeText: sizeToUse
        }
      });
      if (dressItem) {
        matchByPrefixAndSize++;
        matched = true;
      }
    }
    
    if (!matched) {
      noMatch++;
    }
  }
  
  console.log(`Total unlinked items: ${unlinkedItems.length}`);
  console.log(`Can link by full barcode: ${matchByBarcode}`);
  console.log(`Can link by prefix and size: ${matchByPrefixAndSize}`);
  console.log(`Cannot link at all: ${noMatch}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
