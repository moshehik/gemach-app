
import prisma from '@/app/lib/prisma';
const { getAvailableInventory } = require('../lib/inventory.js');

async function main() {
  const models = await prisma.dressModel.findMany({
    where: { name: { contains: 'ורוד גוונים' } },
    include: { items: true }
  });
  
  if (models.length === 0) {
    console.log("Model not found");
    return;
  }
  
  const model = models[0];
  console.log(`Found model: ${model.name} (ID: ${model.id})`);
  
  // Print a summary of items
  console.log(`Total items in DB for this model: ${model.items.length}`);
  
  const activeItems = model.items.filter(item => {
    const isUnusable = item.inRepair || item.notInUse || item.isDeleted || 
      (item.location && (item.location.includes('מחסן') || item.location.includes('warehouse') || item.location.includes('רזרבה') || item.location.includes('reserve')));
    return !isUnusable;
  });
  console.log(`Total ACTIVE AND USABLE items: ${activeItems.length}`);
  console.log(`Sizes available in DB:`, [...new Set(activeItems.map(i => i.sizeText))]);
  
  const size04Items = activeItems.filter(i => i.sizeText === '04');
  console.log(`Active items in size '04':`, size04Items.length);
  const totalQtySize04 = size04Items.reduce((acc, i) => acc + (i.quantity || 1), 0);
  console.log(`Total quantity (sum of quantity fields) in size '04':`, totalQtySize04);
  
  const targetDate = new Date('2026-09-06T00:00:00.000Z');
  console.log(`\nTesting getAvailableInventory for date ${targetDate.toISOString()}...`);
  
  const availability = await getAvailableInventory(model.id, targetDate, 3, true, false, targetDate);
  console.log("Availability Result returned by getAvailableInventory:");
  console.log(JSON.stringify(availability, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
