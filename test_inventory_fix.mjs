import { getBulkAvailableInventory, getAvailableInventory } from './lib/inventory.js';
import prisma from './app/lib/prisma.js';

async function test() {
  const targetDate = new Date('2026-06-10T21:00:00.000Z');
  
  const orderOnDate = await prisma.order.findFirst({
    where: { 
      eventDate: targetDate,
      status: { notIn: ['מבוטל', 'מחוק'] },
      isDeleted: false
    },
    include: { items: true }
  });
  
  if (!orderOnDate) return;
  const bookedItem = orderOnDate.items.find(i => !i.isDeleted);
  if (!bookedItem) return;
  
  let modelId = null;
  if (bookedItem.dressItemId) {
    const item = await prisma.dressItem.findUnique({where: {id: bookedItem.dressItemId}});
    modelId = item?.dressModelId;
  } else if (bookedItem.barcodePrefix) {
    const model = await prisma.dressModel.findFirst({where: {barcodePrefix: bookedItem.barcodePrefix}});
    modelId = model?.id;
  }
  
  if (!modelId) {
    return;
  }
  
  console.log('Booked model:', modelId, 'Qty:', bookedItem.quantity, 'Size:', bookedItem.sizeText);
  const bulk = await getBulkAvailableInventory(targetDate, [modelId]);
  console.log('Bulk Result for model:', bulk[modelId]);
}
test().catch(console.error).finally(()=>prisma.$disconnect());
