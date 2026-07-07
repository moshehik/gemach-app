const fs = require('fs');
const content = `

export async function getBulkAvailableInventory(targetDate) {
  if (!targetDate) return {};

  const minDate = new Date(targetDate);
  minDate.setHours(0,0,0,0);

  // 1. Get settings
  const settingsRaw = await prisma.systemSetting.findMany();
  let bufferDays = 3;
  let skipWeekends = true;
  
  const bufferSetting = settingsRaw.find(s => s.key === 'inventory_buffer_days');
  if (bufferSetting) bufferDays = parseInt(bufferSetting.value, 10);
  
  const weekendSetting = settingsRaw.find(s => s.key === 'inventory_skip_weekends');
  if (weekendSetting) skipWeekends = weekendSetting.value === 'true';

  // 2. Fetch all active stock items
  const allItems = await prisma.dressItem.findMany({
    where: { 
      notInUse: false, 
      isDeleted: false,
      inRepair: false,
      AND: [
        { location: { not: { contains: 'מחסן' } } },
        { location: { not: { contains: 'רזרבה' } } },
        { location: { not: { contains: 'warehouse' } } },
        { location: { not: { contains: 'reserve' } } }
      ]
    }
  });

  const sizesMap = {}; // sizesMap[modelId][size] = totalInStock
  for (const item of allItems) {
    if (!item.dressModelId) continue;
    if (!sizesMap[item.dressModelId]) sizesMap[item.dressModelId] = {};
    const size = item.sizeText || item.size || 'כללי';
    if (!sizesMap[item.dressModelId][size]) sizesMap[item.dressModelId][size] = 0;
    sizesMap[item.dressModelId][size] += 1;
  }

  // 3. Fetch future bookings
  const maxBuffer = 14; // Max possible buffer to search back
  const searchMin = new Date(minDate);
  searchMin.setDate(searchMin.getDate() - maxBuffer);
  
  const searchMax = new Date(minDate);
  searchMax.setDate(searchMax.getDate() + maxBuffer);

  const bookings = await prisma.orderItem.findMany({
    where: {
      isDeleted: false,
      isReturned: false,
      order: {
        isDeleted: false,
        status: { notIn: ['מבוטל', 'מחוק'] },
        OR: [
          { eventDate: { gte: searchMin, lte: searchMax } },
          { fromDate: { lte: searchMax }, toDate: { gte: searchMin } }
        ]
      }
    },
    include: {
      order: true,
      dressItem: true
    }
  });

  // 4. Calculate overlap for the specific date
  const bookedQuantities = {};

  for (const booking of bookings) {
    if (!booking.order) continue;
    const modelId = booking.dressModelId || booking.dressItem?.dressModelId;
    if (!modelId) continue;

    const size = booking.sizeText || booking.dressItem?.sizeText || 'כללי';
    const qty = booking.quantity || 1;

    const isAbroad = booking.order.isAbroad;
    const customStart = isAbroad && booking.order.fromDate ? new Date(booking.order.fromDate) : null;
    const customEnd = isAbroad && booking.order.toDate ? new Date(booking.order.toDate) : customStart;
    const bookingEventDate = booking.order.eventDate ? new Date(booking.order.eventDate) : null;

    let overlaps = false;
    if (customStart && customEnd) {
      if (minDate >= customStart && minDate <= customEnd) overlaps = true;
    } else if (bookingEventDate) {
      const bMin = addDaysSkippingWeekends(bookingEventDate, -bufferDays, skipWeekends);
      const bMax = addDaysSkippingWeekends(bookingEventDate, bufferDays, skipWeekends);
      if (minDate >= bMin && minDate <= bMax) overlaps = true;
    }

    if (overlaps) {
      if (!bookedQuantities[modelId]) bookedQuantities[modelId] = {};
      if (!bookedQuantities[modelId][size]) bookedQuantities[modelId][size] = 0;
      bookedQuantities[modelId][size] += qty;
    }
  }

  // 5. Result object
  const result = {}; 
  for (const modelId in sizesMap) {
    result[modelId] = {};
    for (const size in sizesMap[modelId]) {
      const total = sizesMap[modelId][size];
      const booked = (bookedQuantities[modelId] && bookedQuantities[modelId][size]) ? bookedQuantities[modelId][size] : 0;
      result[modelId][size] = Math.max(0, total - booked);
    }
  }

  return result;
}
`;

fs.appendFileSync('c:/Users/moshe/Desktop/גמח שמלות חדש/gemach-app/lib/inventory.js', content, 'utf8');
