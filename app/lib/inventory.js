import prisma from './prisma';

/**
 * Calculates available stock for a specific dress model on a given date.
 * Replicates the "long and well-calculated model" (שמלות_מלאי_חדש) from Access.
 * 
 * @param {number} dressModelId 
 * @param {Date|string} eventDate 
 * @param {number} bufferDays - Number of days to block before and after the event (ימים_להגבלה)
 */
export async function getAvailableInventory(dressModelId, eventDate, providedBufferDays = null) {
  const modelId = parseInt(dressModelId, 10);
  if (isNaN(modelId)) throw new Error('Invalid dressModelId');

  const event = new Date(eventDate);
  if (isNaN(event.getTime())) throw new Error('Invalid eventDate');

  let bufferDays = providedBufferDays;
  if (bufferDays === null) {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'BUFFER_DAYS' }
    });
    bufferDays = setting && setting.value ? parseInt(setting.value, 10) : 7;
  }

  // 1. Get total active stock per size for this model
  // Equivalent to: שמלות_נתונים.לא_בשימוש=0 AND שמלות_נתונים.שמלה_בתיקון=False AND מיקום<>'רזרבה'
  const stockItems = await prisma.dressItem.findMany({
    where: {
      dressModelId: modelId,
      notInUse: false,
      inRepair: false,
      location: { not: 'רזרבה' }
    }
  });

  const stockBySize = {};
  stockItems.forEach(item => {
    const size = item.sizeText || 'ללא מידה';
    if (!stockBySize[size]) {
      stockBySize[size] = { total: 0, items: [] };
    }
    stockBySize[size].total += (item.quantity || 1);
    stockBySize[size].items.push(item);
  });

  if (Object.keys(stockBySize).length === 0) {
    return []; // No active stock
  }

  // 2. Find overlapping orders
  // Calculates timeframe [eventDate - bufferDays, eventDate + bufferDays]
  const startWindow = new Date(event);
  startWindow.setDate(startWindow.getDate() - bufferDays);
  
  const endWindow = new Date(event);
  endWindow.setDate(endWindow.getDate() + bufferDays);

  const overlappingOrderItems = await prisma.orderItem.findMany({
    where: {
      dressItemId: { in: stockItems.map(i => i.id) },
      order: {
        status: { notIn: ['מבוטל', 'מחוק'] },
        eventDate: {
          gte: startWindow,
          lte: endWindow
        }
      }
    },
    include: {
      dressItem: true
    }
  });

  const bookedBySize = {};
  overlappingOrderItems.forEach(oi => {
    const size = oi.sizeText || oi.dressItem?.sizeText || 'ללא מידה';
    if (!bookedBySize[size]) bookedBySize[size] = 0;
    bookedBySize[size] += (oi.quantity || 1);
  });

  // 3. Calculate availability
  const availability = [];
  for (const [size, data] of Object.entries(stockBySize)) {
    const booked = bookedBySize[size] || 0;
    const available = data.total - booked;
    if (available > 0) {
      availability.push({
        sizeText: size,
        totalInStock: data.total,
        bookedCount: booked,
        availableQuantity: available,
        // Provide the first available dressItemId for binding to the order
        // In a more complex system, we'd pick the specific item that isn't booked
        // but for now, any item of this size is fine if we just track quantities.
        sampleItemId: data.items[0].id 
      });
    }
  }

  // Sort by size logically
  availability.sort((a, b) => {
    const numA = parseFloat(a.sizeText);
    const numB = parseFloat(b.sizeText);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.sizeText.localeCompare(b.sizeText);
  });

  return availability;
}

/**
 * Calculates available stock for ALL dress models on a given date.
 * Returns a nested object: { [modelId]: { [size]: availableQuantity } }
 */
export async function getBulkAvailableInventory(eventDate, providedBufferDays = null) {
  const event = new Date(eventDate);
  if (isNaN(event.getTime())) throw new Error('Invalid eventDate');

  let bufferDays = providedBufferDays;
  if (bufferDays === null) {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'BUFFER_DAYS' }
    });
    bufferDays = setting && setting.value ? parseInt(setting.value, 10) : 7;
  }

  // 1. Get all active stock items
  const stockItems = await prisma.dressItem.findMany({
    where: {
      notInUse: false,
      inRepair: false,
      location: { not: 'רזרבה' }
    }
  });

  const stockByModelAndSize = {};
  stockItems.forEach(item => {
    const modelId = item.dressModelId;
    const size = item.sizeText || 'ללא מידה';
    if (!stockByModelAndSize[modelId]) stockByModelAndSize[modelId] = {};
    if (!stockByModelAndSize[modelId][size]) stockByModelAndSize[modelId][size] = 0;
    
    stockByModelAndSize[modelId][size] += (item.quantity || 1);
  });

  // 2. Find all overlapping orders
  const startWindow = new Date(event);
  startWindow.setDate(startWindow.getDate() - bufferDays);
  
  const endWindow = new Date(event);
  endWindow.setDate(endWindow.getDate() + bufferDays);

  const overlappingOrderItems = await prisma.orderItem.findMany({
    where: {
      order: {
        status: { notIn: ['מבוטל', 'מחוק'] },
        eventDate: {
          gte: startWindow,
          lte: endWindow
        }
      }
    },
    include: {
      dressItem: true
    }
  });

  const bookedByModelAndSize = {};
  overlappingOrderItems.forEach(oi => {
    if (!oi.dressItem) return;
    const modelId = oi.dressItem.dressModelId;
    const size = oi.sizeText || oi.dressItem.sizeText || 'ללא מידה';
    
    if (!bookedByModelAndSize[modelId]) bookedByModelAndSize[modelId] = {};
    if (!bookedByModelAndSize[modelId][size]) bookedByModelAndSize[modelId][size] = 0;
    
    bookedByModelAndSize[modelId][size] += (oi.quantity || 1);
  });

  // 3. Calculate availability
  const availability = {};
  for (const [modelIdStr, sizesObj] of Object.entries(stockByModelAndSize)) {
    const modelId = parseInt(modelIdStr, 10);
    availability[modelId] = {};
    
    for (const [size, total] of Object.entries(sizesObj)) {
      const booked = bookedByModelAndSize[modelId]?.[size] || 0;
      const available = total - booked;
      availability[modelId][size] = Math.max(0, available);
    }
  }

  return availability;
}
