
import prisma from '@/app/lib/prisma';
const { getBulkAvailableInventory } = require('../lib/inventory.js');

async function main() {
  const targetDate = new Date('2026-09-06T00:00:00.000Z');
  console.log(`Calling getBulkAvailableInventory for ${targetDate.toISOString()}`);
  
  const bulkAvailable = await getBulkAvailableInventory(targetDate);
  console.log("Model 483 (ורוד גוונים) in bulkAvailable:");
  console.log(bulkAvailable[483]);
  
  const model = await prisma.dressModel.findUnique({
    where: { id: 483 },
    include: { items: true }
  });
  
  const adjustedItems = model.items.map(item => {
    const size = item.sizeText || item.size || 'כללי';
    let availableQtyForThisItem = 1;
    const isUnusable = item.inRepair || item.notInUse || item.isDeleted || 
       (item.location && (item.location.includes('מחסן') || item.location.includes('warehouse') || item.location.includes('רזרבה') || item.location.includes('reserve')));

    if (bulkAvailable) {
      if (isUnusable) {
         availableQtyForThisItem = 0;
      } else if (bulkAvailable[483] && bulkAvailable[483][size] > 0) {
         const availableForThis = Math.min(item.quantity || 1, bulkAvailable[483][size]);
         availableQtyForThisItem = availableForThis;
         bulkAvailable[483][size] -= availableForThis;
      } else {
         availableQtyForThisItem = 0;
      }
    }
    return { sizeText: item.sizeText, quantity: availableQtyForThisItem };
  });

  const sizesInStock = Array.from(new Set(
    adjustedItems.filter(i => i.quantity > 0).map(i => i.sizeText)
  ));
  
  console.log("Sizes returned as 'in stock' by catalog logic:");
  console.log(sizesInStock);
  
}

main().catch(console.error).finally(() => prisma.$disconnect());
