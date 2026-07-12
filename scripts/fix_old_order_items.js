const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("מתחיל תהליך קישור פריטים ישנים למלאי...");
  const unlinkedItems = await prisma.orderItem.findMany({
    where: { dressItemId: null },
  });
  
  let matchByBarcode = 0;
  let matchByPrefixAndSize = 0;
  let noMatch = 0;
  
  for (const item of unlinkedItems) {
    let matchedDressItem = null;
    
    // אופציה 1: חיפוש לפי ברקוד מלא (הכי מדויק)
    if (item.barcode) {
      matchedDressItem = await prisma.dressItem.findFirst({
        where: { dressBarcode: item.barcode }
      });
      if (matchedDressItem) {
        matchByBarcode++;
      }
    }
    
    // אופציה 2: משתמשים בקידומת הברקוד ובמידה כפי שהצעת
    if (!matchedDressItem && item.barcodePrefix) {
      const sizeToUse = item.size || item.sizeText;
      if (sizeToUse) {
        matchedDressItem = await prisma.dressItem.findFirst({
          where: { 
            barcodePrefix: item.barcodePrefix,
            sizeText: sizeToUse
          }
        });
        if (matchedDressItem) {
          matchByPrefixAndSize++;
        }
      } else {
        // ניסיון לחפש רק לפי קידומת ברקוד אם אין מידה בכלל
        matchedDressItem = await prisma.dressItem.findFirst({
          where: { barcodePrefix: item.barcodePrefix }
        });
        if (matchedDressItem) {
          matchByPrefixAndSize++;
        }
      }
    }
    
    if (matchedDressItem) {
      try {
        await prisma.orderItem.update({
          where: { id: item.id },
          data: { dressItemId: matchedDressItem.id }
        });
      } catch (err) {
        console.error(`Failed to update OrderItem ID: ${item.id}`, err.message);
      }
    } else {
      noMatch++;
    }
  }
  
  console.log("--- סיום ---");
  console.log(`סה"כ פריטים שהיו מנותקים: ${unlinkedItems.length}`);
  console.log(`תוקנו לפי ברקוד מלא: ${matchByBarcode}`);
  console.log(`תוקנו לפי קידומת ברקוד (ומידה): ${matchByPrefixAndSize}`);
  console.log(`לא נמצאו להם פריטים תואמים במלאי: ${noMatch}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
