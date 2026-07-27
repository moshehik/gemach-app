import { getBulkAvailableInventory, getAvailableInventory } from './lib/inventory.js';
import prisma from './app/lib/prisma.js';

async function test() {
  const targetDate = new Date('2026-06-23T00:00:00.000Z'); // 8th of Tammuz roughly
  console.log('Testing for date:', targetDate);
  
  // Find an order on that date to get a modelId that should be booked
  const orderOnDate = await prisma.order.findFirst({
    where: { 
      eventDate: targetDate,
      status: { notIn: ['מבוטל', 'מחוק'] },
      isDeleted: false
    },
    include: { items: true }
  });
  
  if (!orderOnDate) {
    console.log('No order exactly on', targetDate);
    return;
  }
  
  console.log('Found order:', orderOnDate.id, 'eventDate:', orderOnDate.eventDate);
  
  const bookedItem = orderOnDate.items.find(i => !i.isDeleted);
  if (!bookedItem) {
    console.log('No valid item in order');
    return;
  }
  
  const modelId = bookedItem.dressModelId || bookedItem.dressId;
  const size = bookedItem.sizeText;
  console.log('Booked model:', modelId, 'Size:', size, 'Qty:', bookedItem.quantity);
  
  // Now call the functions
  const bulk = await getBulkAvailableInventory(targetDate, [modelId]);
  console.log('Bulk Result for model:', JSON.stringify(bulk[modelId], null, 2));
  
  const single = await getAvailableInventory(modelId, targetDate, 3, true, false, null, null);
  console.log('Single Result for size', size, ':', JSON.stringify(single.find(s => s.sizeText === size), null, 2));
  
  await prisma.$disconnect();
}

test().catch(console.error);
