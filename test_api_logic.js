const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getAvailableInventory } = require('./lib/inventory');

async function test() {
  try {
    const parsedId = 26097;
    const order = await prisma.order.findUnique({ where: { orderId: parsedId } });
    if (!order) {
      console.log('Order not found');
      return;
    }
    console.log('Order:', order);
    
    // We don't know the exact model/size the user chose, but we can list all models that have inventory.
    // Let's just find one model ID from dressItem.
    const item = await prisma.dressItem.findFirst();
    if (!item) {
      console.log('No items in DB');
      return;
    }
    
    // Fetch all models, just run getAvailableInventory for a random model, say modelId = 150 (if exists) or item.dressModelId
    const modelId = item.dressModelId;
    console.log('Testing modelId:', modelId);
    
    const settingsRaw = await prisma.systemSetting.findMany();
    let bufferDays = 3;
    let skipWeekends = true;
    const bufferSetting = settingsRaw.find(s => s.key === 'inventory_buffer_days');
    if (bufferSetting) bufferDays = parseInt(bufferSetting.value, 10);
    const weekendSetting = settingsRaw.find(s => s.key === 'inventory_skip_weekends');
    if (weekendSetting) skipWeekends = weekendSetting.value === 'true';
    if (order.isWeekdayEvent === false) skipWeekends = false;

    const newOrderIsAbroad = order.isAbroad;
    let targetMinDate, targetMaxDate;
    if (newOrderIsAbroad) {
       targetMinDate = order.fromDate;
       targetMaxDate = order.toDate;
    } else {
       targetMinDate = order.eventDate;
       targetMaxDate = order.eventDate;
    }
    
    console.log('Calling getAvailableInventory with:', {
      modelId, targetMinDate, bufferDays, skipWeekends, newOrderIsAbroad, targetMaxDate, parsedId
    });

    const availability = await getAvailableInventory(
      modelId,
      targetMinDate,
      bufferDays,
      skipWeekends,
      newOrderIsAbroad,
      targetMaxDate,
      parsedId
    );
    
    console.log('Availability result:', availability);
  } catch(e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

test();
