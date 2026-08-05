
import prisma from '@/app/lib/prisma';

export function addDaysSkippingWeekends(date, days, skipWeekends = true) {
  let result = new Date(date);
  let daysAdded = 0;
  const direction = days > 0 ? 1 : -1;
  const absDays = Math.abs(days);

  while (daysAdded < absDays) {
    result.setDate(result.getDate() + direction);
    if (skipWeekends) {
      const day = result.getDay();
      if (day === 5 || day === 6) {
        continue;
      }
    }
    daysAdded++;
  }
  return result;
}

function getOccupiedDays(minDate, maxDate) {
  const minTime = minDate.getTime();
  const maxTime = maxDate.getTime();
  const days = [];
  if (minTime === maxTime) {
    days.push(minTime);
  } else {
    let current = minTime;
    while (current < maxTime) {
      days.push(current);
      current += 24 * 60 * 60 * 1000;
    }
  }
  return days;
}

function isDayOccupiedByBooking(dTime, bMinTime, bMaxTime) {
  if (bMinTime === bMaxTime) return dTime === bMinTime;
  return dTime >= bMinTime && dTime < bMaxTime;
}

// תנאי השליפה של ההזמנות התופסות מלאי. מופרד לפונקציה כדי שאפשר יהיה לרענן את
// ההזמנות בלבד (refreshInventoryBookings) בלי לחזור על כל שאר הקריאות — cutoffDate
// מחושב מחדש בכל שליפה כדי שחזקות זמניות שפגו בינתיים יובאו בחשבון.
function buildBookingsWhere({ dressModelId, barcodePrefix, dateLimitStart, dateLimitEnd, ignoreOrderId, holdMinutes }) {
  const cutoffDate = new Date(Date.now() - holdMinutes * 60 * 1000);

  const where = {
    OR: [
      { dressItem: { dressModelId: dressModelId } },
      barcodePrefix ? { barcodePrefix } : null
    ].filter(Boolean),
    isDeleted: false,
    isReturned: false,
    // An expired cart hold releases the unit back into the pool - unless the dress already
    // physically left the gemach (taken, or a barcode scanned onto the row). Handing such a
    // unit out again books a dress that is not on the rail.
    NOT: {
      AND: [
        { cartStatus: 'pending' },
        { cartStatusDate: { lt: cutoffDate } },
        { order: { legacyId: null } },
        { isTaken: false },
        { barcode: null }
      ]
    },
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
    where.order.orderId = { not: ignoreOrderId };
  }

  return where;
}

// רק השדות שהחישוב ב-computeInventoryAvailability באמת קורא. השליפה הזו רצה גם בתוך
// טרנזקציה (refreshInventoryBookings), ושם כל בייט מיותר הוא זמן שהטרנזקציה מוחזקת פתוחה.
const BOOKING_SELECT = {
  sizeText: true,
  quantity: true,
  dressItem: { select: { sizeText: true } },
  order: { select: { isAbroad: true, fromDate: true, toDate: true, eventDate: true } }
};

/**
 * שולף את כל הנתונים הדרושים לחישוב זמינות של דגם, בלי לחשב.
 *
 * ההפרדה בין השליפה לחישוב נועדה לראוטים שכותבים בתוך טרנזקציה: הם טוענים את ההקשר
 * מחוץ לטרנזקציה (זו העבודה הכבדה — 4 שאילתות מול DB מרוחק), ובתוך הטרנזקציה מרעננים
 * רק את שאילתת ההזמנות ומחשבים מחדש. כך הטרנזקציה נשארת קצרה בלי לוותר על אימות
 * הזמינות ברגע הכתיבה.
 *
 * @param {object} client לקוח Prisma (הרגיל, או tx בתוך טרנזקציה)
 * @returns {Promise<object|null>} הקשר ל-computeInventoryAvailability, או null כשאין מה לחשב
 */
export async function loadInventoryContext(client, {
  dressModelId,
  targetMinDate,
  bufferDays = 3,
  skipWeekends = true,
  targetMaxDate = null,
  ignoreOrderId = null,
  customSpacing = null
}) {
  if (!dressModelId || !targetMinDate) return null;

  const minDate = new Date(targetMinDate);
  const maxDate = targetMaxDate ? new Date(targetMaxDate) : minDate;

  const effectiveBufferDays = (customSpacing !== null && customSpacing !== undefined)
    ? parseInt(customSpacing, 10)
    : bufferDays;

  const [warehouseSetting, holdSetting] = await Promise.all([
    client.systemSetting.findUnique({ where: { key: 'inventory_include_warehouse' } }),
    client.systemSetting.findUnique({ where: { key: 'inventory_hold_minutes' } })
  ]);
  const includeWarehouse = warehouseSetting && warehouseSetting.value === 'true';
  const holdMinutes = holdSetting && !isNaN(parseInt(holdSetting.value, 10)) ? parseInt(holdSetting.value, 10) : 15;

  // 1. Get total active stock
  // In Access, dresses marked 'בתיקון' or 'לא בשימוש' or with location 'מחסן' or 'רזרבה' were excluded.
  const stockItems = await client.dressItem.findMany({
    where: {
      dressModelId: dressModelId,
      notInUse: false,
      isDeleted: false,
      inRepair: false,
      // Exclude location containing מחסן or רזרבה (or warehouse/reserve)
      ...(includeWarehouse ? {} : {
        OR: [
          { location: null },
          {
            AND: [
              { location: { not: { contains: 'מחסן' } } },
              { location: { not: { contains: 'רזרבה' } } },
              { location: { not: { contains: 'warehouse' } } },
              { location: { not: { contains: 'reserve' } } }
            ]
          }
        ]
      })
    }
  });

  const context = {
    stockItems,
    bookings: [],
    bookingsQuery: null,
    minDate,
    maxDate,
    bufferDays: effectiveBufferDays,
    skipWeekends
  };

  if (stockItems.length === 0) return context;

  // 2. Determine date bounds to reduce data (similar to Access -60 / +60 days)
  const dateLimitStart = new Date(minDate);
  dateLimitStart.setDate(dateLimitStart.getDate() - 60);

  const dateLimitEnd = new Date(maxDate);
  dateLimitEnd.setDate(dateLimitEnd.getDate() + 60);

  const targetModel = await client.dressModel.findUnique({ where: { id: dressModelId } });

  const bookingsQuery = {
    dressModelId,
    barcodePrefix: targetModel?.barcodePrefix || null,
    dateLimitStart,
    dateLimitEnd,
    ignoreOrderId,
    holdMinutes
  };

  // 3. Fetch existing bookings for this model within the date window
  const bookings = await client.orderItem.findMany({
    where: buildBookingsWhere(bookingsQuery),
    select: BOOKING_SELECT
  });

  return { ...context, bookings, bookingsQuery };
}

/**
 * שולף מחדש רק את ההזמנות התופסות מלאי (שאילתה אחת), על גבי הקשר שכבר נטען.
 * מיועד לאימות חוזר בתוך טרנזקציה, אחרי שהחישוב "האמיתי" כבר רץ מחוצה לה.
 */
export async function refreshInventoryBookings(client, context) {
  if (!context || !context.bookingsQuery) return context;

  const bookings = await client.orderItem.findMany({
    where: buildBookingsWhere(context.bookingsQuery),
    select: BOOKING_SELECT
  });

  return { ...context, bookings };
}

/**
 * החישוב עצמו — טהור, ללא גישה ל-DB. מקבל הקשר מ-loadInventoryContext.
 */
export function computeInventoryAvailability(context) {
  if (!context || context.stockItems.length === 0) return [];

  const { stockItems, bookings, minDate, maxDate, bufferDays, skipWeekends } = context;

  const sizesMap = {};
  stockItems.forEach(item => {
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
  const daysBefore = 0;
  const daysAfter = (parseInt(bufferDays, 10) || 0) + 1;

  for (const tDate of validDates) {
    const boundMin = addDaysSkippingWeekends(tDate, -daysBefore, skipWeekends);
    const boundMax = addDaysSkippingWeekends(tDate, daysAfter, skipWeekends);

    const targetDays = getOccupiedDays(boundMin, boundMax);
    const maxDayDemand = {};

    for (const dTime of targetDays) {
      const currentDayDemand = {};
      
      for (const booking of bookings) {
        if (!booking.order) continue;
        
        const bookingIsAbroad = booking.order.isAbroad;
        const customStart = bookingIsAbroad && booking.order.fromDate ? new Date(booking.order.fromDate) : null;
        const customEnd = bookingIsAbroad && booking.order.toDate ? new Date(booking.order.toDate) : customStart;
        
        const bookingEventDate = booking.order.eventDate ? new Date(booking.order.eventDate) : null;
        if (!customStart && !bookingEventDate) continue;

        if (customStart) customStart.setHours(0,0,0,0);
        if (customEnd) customEnd.setHours(0,0,0,0);
        if (bookingEventDate) bookingEventDate.setHours(0,0,0,0);

        const size = booking.sizeText || booking.dressItem?.sizeText || 'כללי';
        const qty = booking.quantity || 1;
        
        let occupiesDay = false;
        if (customStart && customEnd) {
          occupiesDay = isDayOccupiedByBooking(dTime, customStart.getTime(), customEnd.getTime());
        } else if (bookingEventDate) {
          const bMin = addDaysSkippingWeekends(bookingEventDate, -daysBefore, skipWeekends);
          const bMax = addDaysSkippingWeekends(bookingEventDate, daysAfter, skipWeekends);
          occupiesDay = isDayOccupiedByBooking(dTime, bMin.getTime(), bMax.getTime());
        }

        if (occupiesDay) {
          if (!currentDayDemand[size]) currentDayDemand[size] = 0;
          currentDayDemand[size] += qty;
        }
      }

      for (const size in currentDayDemand) {
        if (!maxDayDemand[size]) maxDayDemand[size] = 0;
        maxDayDemand[size] = Math.max(maxDayDemand[size], currentDayDemand[size]);
      }
    }

    for (const size in maxDayDemand) {
      if (!maxBookedQuantities[size]) maxBookedQuantities[size] = 0;
      maxBookedQuantities[size] = Math.max(maxBookedQuantities[size], maxDayDemand[size]);
    }
  }

  // 5. Subtract max booked from available
  for (const size in sizesMap) {
    const booked = maxBookedQuantities[size] || 0;
    sizesMap[size].availableQuantity = Math.max(0, sizesMap[size].totalInStock - booked);
  }

  return Object.values(sizesMap);
}

// isAbroad נשאר בחתימה לתאימות לאחור בלבד — טווח התאריכים כבר מגיע דרך
// targetMinDate/targetMaxDate, ולכן הפרמטר לא בשימוש בחישוב.
export async function getAvailableInventory(
  dressModelId,
  targetMinDate,
  bufferDays = 3,
  skipWeekends = true,
  isAbroad = false,
  targetMaxDate = null,
  ignoreOrderId = null,
  customSpacing = null
) {
  const context = await loadInventoryContext(prisma, {
    dressModelId,
    targetMinDate,
    bufferDays,
    skipWeekends,
    targetMaxDate,
    ignoreOrderId,
    customSpacing
  });

  return computeInventoryAvailability(context);
}


export async function getBulkAvailableInventory(targetDate, modelIds = null) {
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
  const warehouseSetting = settingsRaw.find(s => s.key === 'inventory_include_warehouse');
  const includeWarehouse = warehouseSetting && warehouseSetting.value === 'true';

  const holdSetting = settingsRaw.find(s => s.key === 'inventory_hold_minutes');
  const holdMinutes = holdSetting && !isNaN(parseInt(holdSetting.value, 10)) ? parseInt(holdSetting.value, 10) : 15;
  const cutoffDate = new Date(Date.now() - holdMinutes * 60 * 1000);

  // 2. Fetch all active stock items
  const allItems = await prisma.dressItem.findMany({
    where: { 
      ...(modelIds ? { dressModelId: { in: modelIds } } : {}),
      notInUse: false, 
      isDeleted: false,
      inRepair: false,
      ...(includeWarehouse ? {} : {
        OR: [
          { location: null },
          {
            AND: [
              { location: { not: { contains: 'מחסן' } } },
              { location: { not: { contains: 'רזרבה' } } },
              { location: { not: { contains: 'warehouse' } } },
              { location: { not: { contains: 'reserve' } } }
            ]
          }
        ]
      })
    }
  });

  const sizesMap = {}; // sizesMap[modelId][size] = totalInStock
  for (const item of allItems) {
    if (!item.dressModelId) continue;
    if (!sizesMap[item.dressModelId]) sizesMap[item.dressModelId] = {};
    const size = item.sizeText || item.size || 'כללי';
    if (!sizesMap[item.dressModelId][size]) sizesMap[item.dressModelId][size] = 0;
    sizesMap[item.dressModelId][size] += (item.quantity || 1);
  }

  // 3. Fetch future bookings
  const maxBuffer = 14; // Max possible buffer to search back
  const searchMin = new Date(minDate);
  searchMin.setDate(searchMin.getDate() - maxBuffer);
  
  const searchMax = new Date(minDate);
  searchMax.setDate(searchMax.getDate() + maxBuffer);

  const targetModels = modelIds ? await prisma.dressModel.findMany({ where: { id: { in: modelIds } }, select: { id: true, barcodePrefix: true } }) : [];
  const targetPrefixes = targetModels.map(m => m.barcodePrefix).filter(Boolean);

  const bookings = await prisma.orderItem.findMany({
    where: {
      ...(modelIds ? {
        OR: [
          { dressItem: { dressModelId: { in: modelIds } } },
          targetPrefixes.length > 0 ? { barcodePrefix: { in: targetPrefixes } } : null
        ].filter(Boolean)
      } : {}),
      isDeleted: false,
      isReturned: false,
      // Same rule as getAvailableInventory: an expired cart hold is only released while the
      // dress is still physically here.
      NOT: {
        AND: [
          { cartStatus: 'pending' },
          { cartStatusDate: { lt: cutoffDate } },
          { order: { legacyId: null } },
          { isTaken: false },
          { barcode: null }
        ]
      },
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

  // 3.5. Preload models for barcodePrefix fallback.
  // When modelIds is provided (the hot path, called on every GET /api/dresses request with an
  // eventDate), the bookings query above is already scoped to those models/prefixes, so
  // targetModels (fetched at step 2 above) already has every {id, barcodePrefix} we could need —
  // no need to re-fetch every DressModel row. Only fall back to an unfiltered fetch when
  // modelIds is null (e.g. the AI route, which wants availability across every model).
  const allModels = modelIds ? targetModels : await prisma.dressModel.findMany({ select: { id: true, barcodePrefix: true } });
  const prefixToModelMap = {};
  for (const m of allModels) {
    if (m.barcodePrefix) prefixToModelMap[m.barcodePrefix] = m.id;
  }

  // 4. Calculate overlap for the specific date
  const daysBefore = 0;
  const daysAfter = bufferDays + 1;
  const boundMin = addDaysSkippingWeekends(minDate, -daysBefore, skipWeekends);
  const boundMax = addDaysSkippingWeekends(minDate, daysAfter, skipWeekends);
  const targetDays = getOccupiedDays(boundMin, boundMax);
  const maxDayDemand = {};

  for (const dTime of targetDays) {
    const currentDayDemand = {};

    for (const booking of bookings) {
      if (!booking.order) continue;
      const modelId = booking.dressModelId || booking.dressItem?.dressModelId || (booking.barcodePrefix ? prefixToModelMap[booking.barcodePrefix] : null);
      if (!modelId) continue;

      const size = booking.sizeText || booking.dressItem?.sizeText || 'כללי';
      const qty = booking.quantity || 1;

      const isAbroad = booking.order.isAbroad;
      const customStart = isAbroad && booking.order.fromDate ? new Date(booking.order.fromDate) : null;
      const customEnd = isAbroad && booking.order.toDate ? new Date(booking.order.toDate) : customStart;
      const bookingEventDate = booking.order.eventDate ? new Date(booking.order.eventDate) : null;

      if (customStart) customStart.setHours(0, 0, 0, 0);
      if (customEnd) customEnd.setHours(0, 0, 0, 0);
      if (bookingEventDate) bookingEventDate.setHours(0, 0, 0, 0);

      let occupiesDay = false;
      if (customStart && customEnd) {
        occupiesDay = isDayOccupiedByBooking(dTime, customStart.getTime(), customEnd.getTime());
      } else if (bookingEventDate) {
        const bMin = addDaysSkippingWeekends(bookingEventDate, -daysBefore, skipWeekends);
        const bMax = addDaysSkippingWeekends(bookingEventDate, daysAfter, skipWeekends);
        occupiesDay = isDayOccupiedByBooking(dTime, bMin.getTime(), bMax.getTime());
      }

      if (occupiesDay) {
        if (!currentDayDemand[modelId]) currentDayDemand[modelId] = {};
        if (!currentDayDemand[modelId][size]) currentDayDemand[modelId][size] = 0;
        currentDayDemand[modelId][size] += qty;
      }
    }

    for (const modelId in currentDayDemand) {
      if (!maxDayDemand[modelId]) maxDayDemand[modelId] = {};
      for (const size in currentDayDemand[modelId]) {
        if (!maxDayDemand[modelId][size]) maxDayDemand[modelId][size] = 0;
        maxDayDemand[modelId][size] = Math.max(maxDayDemand[modelId][size], currentDayDemand[modelId][size]);
      }
    }
  }

  const bookedQuantities = maxDayDemand;

  // 5. Result object
  const result = {}; 
  for (const modelId in sizesMap) {
    result[modelId] = {};
    for (const size in sizesMap[modelId]) {
      const total = sizesMap[modelId][size];
      const booked = (bookedQuantities[modelId] && bookedQuantities[modelId][size]) ? bookedQuantities[modelId][size] : 0;
      result[modelId][size] = {
        available: Math.max(0, total - booked),
        total: total,
        booked: booked
      };
    }
  }

  return result;
}

// חדש: מחזיר שתי כמויות זמינות — עם bufferDays רגיל וגם עם customSpacing (אם קיים)
// משמש להצגה בתצוגה כדי להבהיר לבעל עסק את ההפרש בזמינות
export async function getAvailableInventoryWithComparison(
  dressModelId,
  targetMinDate,
  skipWeekends = true,
  isAbroad = false,
  targetMaxDate = null,
  ignoreOrderId = null,
  customSpacing = null
) {
  if (!dressModelId || !targetMinDate) return [];

  // Fetch with normal buffer
  const settingsRaw = await prisma.systemSetting.findMany();
  let defaultBufferDays = 3;
  const bufferSetting = settingsRaw.find(s => s.key === 'inventory_buffer_days');
  if (bufferSetting) defaultBufferDays = parseInt(bufferSetting.value, 10);

  const normalAvailability = await getAvailableInventory(
    dressModelId,
    targetMinDate,
    defaultBufferDays,
    skipWeekends,
    isAbroad,
    targetMaxDate,
    ignoreOrderId,
    null // ללא customSpacing
  );

  // Fetch with customSpacing (if provided)
  let customAvailability = null;
  if (customSpacing !== null && customSpacing !== undefined) {
    customAvailability = await getAvailableInventory(
      dressModelId,
      targetMinDate,
      defaultBufferDays,
      skipWeekends,
      isAbroad,
      targetMaxDate,
      ignoreOrderId,
      customSpacing
    );
  }

  // Merge results
  const result = normalAvailability.map(normal => {
    const custom = customAvailability ? customAvailability.find(c => c.sizeText === normal.sizeText) : null;
    return {
      sizeText: normal.sizeText,
      totalInStock: normal.totalInStock,
      sampleItemId: normal.sampleItemId,
      // הכמות "בתוקף" להזמנה הזו (עם ציפוף אם הוגדר) — לתאימות עם קוראים ישנים
      availableQuantity: custom ? custom.availableQuantity : normal.availableQuantity,
      withNormalBuffer: {
        availableQuantity: normal.availableQuantity,
        bufferDays: defaultBufferDays
      },
      withCustomSpacing: custom ? {
        availableQuantity: custom.availableQuantity,
        bufferDays: parseInt(customSpacing, 10),
        gain: Math.max(0, custom.availableQuantity - normal.availableQuantity)
      } : null
    };
  });

  return result;
}

export async function validateOrderItemsAvailability(items, eventDate, isAbroad, fromDate, toDate, orderId = null, customSpacing = null) {
  const activeItems = items && Array.isArray(items) ? items.filter(i => i && !i.isDeleted) : [];
  if (activeItems.length === 0) {
    return { valid: true, errors: [] };
  }

  // Determine target dates
  let targetMinDate, targetMaxDate;
  if (isAbroad) {
    if (!fromDate || !toDate) {
       return { valid: true, errors: [] };
    }
    targetMinDate = fromDate;
    targetMaxDate = toDate;
  } else {
    if (!eventDate) {
       return { valid: true, errors: [] };
    }
    targetMinDate = eventDate;
    targetMaxDate = eventDate;
  }

  // Group required items by model and size
  const requiredItems = {};
  for (const item of activeItems) {
    // For validation, we need the dressModelId. It might be passed as dressModelId, dressId, or we might need to fetch it.
    const modelId = item.dressModelId || item.dressId || item.modelId; 
    
    let finalModelId = modelId;
    if (!finalModelId && (item.sampleItemId || item.dressItemId)) {
      const dressItem = await prisma.dressItem.findUnique({
        where: { id: item.sampleItemId || item.dressItemId }
      });
      if (dressItem) finalModelId = dressItem.dressModelId;
    }

    if (!finalModelId) continue;
    
    const key = `${finalModelId}_${item.sizeText}`;
    if (!requiredItems[key]) {
      requiredItems[key] = {
        dressModelId: finalModelId,
        sizeText: item.sizeText,
        quantity: 0,
        dressName: item.dressName || item.description || 'פריט'
      };
    }
    requiredItems[key].quantity += (item.quantity || 1);
  }

  // Check each grouped requirement against available inventory
  const errors = [];
  
  // Group models to minimize getAvailableInventory calls
  const modelsToCheck = [...new Set(Object.values(requiredItems).map(i => i.dressModelId))];
  
  // Fetch settings to get bufferDays
  let bufferDays = 3;
  let skipWeekends = true;
  try {
     const settings = await prisma.systemSetting.findMany();
     const bufferSetting = settings.find(s => s.key === 'inventory_buffer_days');
     if (bufferSetting) bufferDays = parseInt(bufferSetting.value, 10);
     
     const weekendSetting = settings.find(s => s.key === 'inventory_skip_weekends');
     if (weekendSetting) skipWeekends = weekendSetting.value === 'true';
  } catch(e) {
     console.error("Failed to load settings for validation", e);
  }

  if (customSpacing !== null && customSpacing !== undefined) {
    bufferDays = parseInt(customSpacing, 10);
  }

  for (const modelId of modelsToCheck) {
    const availability = await getAvailableInventory(
      modelId,
      targetMinDate,
      bufferDays,
      skipWeekends,
      isAbroad,
      targetMaxDate,
      orderId,
      customSpacing
    );

    // Find requirements for this model
    const modelReqs = Object.values(requiredItems).filter(i => i.dressModelId === modelId);

    for (const req of modelReqs) {
      // Find availability for this size
      const sizeAvail = availability.find(a => (a.sizeText || a.size || 'כללי') === req.sizeText);

      const availableQty = sizeAvail ? sizeAvail.availableQuantity : 0;

      if (req.quantity > availableQty) {
        errors.push({
          dressModelId: req.dressModelId,
          sizeText: req.sizeText,
          dressName: req.dressName,
          requested: req.quantity,
          available: availableQty,
          // הוסף אינדיקטור אם זה בגלל ציפוף
          isCustomSpacingIssue: customSpacing !== null && customSpacing !== undefined
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
