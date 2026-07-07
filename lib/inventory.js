import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export function addDaysSkippingWeekends(date, days, skipWeekends = true) {
  let result = new Date(date);
  let daysAdded = 0;
  const direction = days > 0 ? 1 : -1;
  const absDays = Math.abs(days);

  while (daysAdded < absDays) {
    result.setDate(result.getDate() + direction);
    if (skipWeekends) {
      const day = result.getDay();
      // In JS, 0 is Sunday, 5 is Friday, 6 is Saturday.
      if (day === 5 || day === 6) {
        continue;
      }
    }
    daysAdded++;
  }
  return result;
}

export async function getAvailableInventory(
  dressModelId,
  targetMinDate,
  bufferDays = 3,
  skipWeekends = true,
  isAbroad = false,
  targetMaxDate = null,
  ignoreOrderId = null
) {
  if (!dressModelId || !targetMinDate) return [];

  const minDate = new Date(targetMinDate);
  const maxDate = targetMaxDate ? new Date(targetMaxDate) : minDate;

  // 1. Get total active stock
  // In Access, dresses marked 'בתיקון' or 'לא בשימוש' or with location 'מחסן' or 'רזרבה' were excluded.
  const items = await prisma.dressItem.findMany({
    where: { 
      dressModelId: parseInt(dressModelId), 
      notInUse: false, 
      isDeleted: false,
      inRepair: false,
      // Exclude location containing מחסן or רזרבה (or warehouse/reserve)
      AND: [
        { location: { not: { contains: 'מחסן' } } },
        { location: { not: { contains: 'רזרבה' } } },
        { location: { not: { contains: 'warehouse' } } },
        { location: { not: { contains: 'reserve' } } }
      ]
    }
  });

  if (items.length === 0) return [];

  const sizesMap = {};
  items.forEach(item => {
    const size = item.sizeText || 'כללי';
    if (!sizesMap[size]) {
      sizesMap[size] = {
        sizeText: size,
        sampleItemId: item.id,
        totalInStock: 0,
        availableQuantity: 0,
        itemIds: []
      };
    }
    sizesMap[size].totalInStock += (item.quantity || 1);
    sizesMap[size].availableQuantity += (item.quantity || 1);
    sizesMap[size].itemIds.push(item.id);
  });

  // 2. Determine date bounds to reduce data (similar to Access -60 / +60 days)
  const dateLimitStart = new Date(minDate);
  dateLimitStart.setDate(dateLimitStart.getDate() - 60);

  const dateLimitEnd = new Date(maxDate);
  dateLimitEnd.setDate(dateLimitEnd.getDate() + 60);

  // 3. Fetch existing bookings for this model within the date window
  const bookingsWhere = {
    dressItem: { dressModelId: parseInt(dressModelId) },
    isDeleted: false,
    isReturned: false, 
    order: {
      isDeleted: false,
      OR: [
        { eventDate: { gte: dateLimitStart, lte: dateLimitEnd } },
        { fromDate: { gte: dateLimitStart, lte: dateLimitEnd } },
        { toDate: { gte: dateLimitStart, lte: dateLimitEnd } }
      ]
    }
  };
  
  if (ignoreOrderId) {
    bookingsWhere.order.orderId = { not: parseInt(ignoreOrderId) };
  }

  const bookings = await prisma.orderItem.findMany({
    where: bookingsWhere,
    include: {
      order: true,
      dressItem: true
    }
  });

  // 4. Generate valid target dates
  let validDates = [];
  let d = new Date(minDate);
  while (d <= maxDate) {
    if (!skipWeekends || (d.getDay() !== 5 && d.getDay() !== 6)) {
      validDates.push(new Date(d));
    }
    d.setDate(d.getDate() + 1);
  }

  // 4. Check overlaps per valid date
  const maxBookedQuantities = {};

  // bufferDays is applied fully before AND after the event day
  const daysBefore = parseInt(bufferDays, 10) || 0;
  const daysAfter = parseInt(bufferDays, 10) || 0;

  for (const tDate of validDates) {
    const boundMin = addDaysSkippingWeekends(tDate, -daysBefore, skipWeekends);
    const boundMax = addDaysSkippingWeekends(tDate, daysAfter, skipWeekends);

    const currentDayBooked = {};

    for (const booking of bookings) {
      if (!booking.order) continue;
      
      const bookingIsAbroad = booking.order.isAbroad;
      const customStart = bookingIsAbroad && booking.order.fromDate ? new Date(booking.order.fromDate) : null;
      const customEnd = bookingIsAbroad && booking.order.toDate ? new Date(booking.order.toDate) : customStart;
      
      const bookingEventDate = booking.order.eventDate ? new Date(booking.order.eventDate) : null;
      if (!customStart && !bookingEventDate) continue;

      const size = booking.sizeText || booking.dressItem?.sizeText || 'כללי';
      const qty = booking.quantity || 1;
      
      let overlaps = false;
      if (customStart && customEnd) {
        // Custom booking overlaps if targetDate falls within its custom range
        if (tDate >= customStart && tDate <= customEnd) {
          overlaps = true;
        }
      } else if (bookingEventDate) {
        // Standard booking overlaps if its event date falls within target bounds
        if (bookingEventDate >= boundMin && bookingEventDate <= boundMax) {
          overlaps = true;
        }
      }

      if (overlaps) {
        if (!currentDayBooked[size]) currentDayBooked[size] = 0;
        currentDayBooked[size] += qty;
      }
    }

    // Update maxBookedQuantities with the max of this day vs previous days
    for (const size in currentDayBooked) {
      if (!maxBookedQuantities[size]) maxBookedQuantities[size] = 0;
      maxBookedQuantities[size] = Math.max(maxBookedQuantities[size], currentDayBooked[size]);
    }
  }

  // 5. Subtract max booked from available
  for (const size in sizesMap) {
    const booked = maxBookedQuantities[size] || 0;
    sizesMap[size].availableQuantity = Math.max(0, sizesMap[size].totalInStock - booked);
  }

  return Object.values(sizesMap);
}


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
