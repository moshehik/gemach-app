

import prisma from '@/app/lib/prisma';

async function main() {
  console.log("Starting cursor-based batched fix...");
  
  let matchByBarcode = 0;
  let matchByPrefixAndSize = 0;
  let noMatch = 0;
  
  let cursorId = 0;
  const take = 1000;
  let totalProcessed = 0;

  while (true) {
    const unlinkedItems = await prisma.orderItem.findMany({
      where: { 
        dressItemId: null,
        id: { gt: cursorId }
      },
      take: take,
      orderBy: { id: 'asc' }
    });

    if (unlinkedItems.length === 0) {
      break;
    }

    console.log(`Processing batch... total processed so far: ${totalProcessed}`);

    // Fetch all DressItems into a lookup map? That would be much faster!
    // Since there are 77k items, doing findFirst for each in a loop will take forever.
    // Let's optimize!
    const prefixes = [...new Set(unlinkedItems.map(i => i.barcodePrefix).filter(Boolean))];
    const barcodes = [...new Set(unlinkedItems.map(i => i.barcode).filter(Boolean))];
    
    const possibleDresses = await prisma.dressItem.findMany({
      where: {
        OR: [
          { dressBarcode: { in: barcodes } },
          { barcodePrefix: { in: prefixes } }
        ]
      }
    });

    const dressByBarcode = new Map();
    const dressByPrefixAndSize = new Map();
    const dressByPrefix = new Map();

    for (const d of possibleDresses) {
      if (d.dressBarcode) {
        dressByBarcode.set(d.dressBarcode, d);
      }
      if (d.barcodePrefix && d.sizeText) {
        dressByPrefixAndSize.set(`${d.barcodePrefix}_${d.sizeText}`, d);
      }
      if (d.barcodePrefix) {
        dressByPrefix.set(d.barcodePrefix, d);
      }
    }

    // Now process the batch
    const updates = [];

    for (const item of unlinkedItems) {
      let matchedDressItem = null;
      
      if (item.barcode && dressByBarcode.has(item.barcode)) {
        matchedDressItem = dressByBarcode.get(item.barcode);
        matchByBarcode++;
      } else if (item.barcodePrefix) {
        const sizeToUse = item.size || item.sizeText;
        if (sizeToUse && dressByPrefixAndSize.has(`${item.barcodePrefix}_${sizeToUse}`)) {
          matchedDressItem = dressByPrefixAndSize.get(`${item.barcodePrefix}_${sizeToUse}`);
          matchByPrefixAndSize++;
        } else if (dressByPrefix.has(item.barcodePrefix)) {
          matchedDressItem = dressByPrefix.get(item.barcodePrefix);
          matchByPrefixAndSize++;
        }
      }
      
      if (matchedDressItem) {
        updates.push({
          id: item.id,
          dressItemId: matchedDressItem.id
        });
      } else {
        noMatch++;
      }
      
      cursorId = item.id;
    }

    // Perform updates in parallel chunked
    for (let i = 0; i < updates.length; i += 100) {
      const chunk = updates.slice(i, i + 100);
      await Promise.all(chunk.map(u => 
        prisma.orderItem.update({
          where: { id: u.id },
          data: { dressItemId: u.dressItemId }
        }).catch(err => console.error(`Failed to update OrderItem ID: ${u.id}`, err.message))
      ));
    }
    
    totalProcessed += unlinkedItems.length;
  }

  console.log("--- סיום ---");
  console.log(`סה"כ פריטים שעברו בדיקה: ${totalProcessed}`);
  console.log(`תוקנו לפי ברקוד מלא: ${matchByBarcode}`);
  console.log(`תוקנו לפי קידומת ברקוד (ומידה): ${matchByPrefixAndSize}`);
  console.log(`לא נמצאו להם פריטים תואמים במלאי: ${noMatch}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
