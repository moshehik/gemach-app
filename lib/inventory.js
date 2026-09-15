
import prisma from '@/app/lib/prisma';
import { getCachedSetting, getAllCachedSettings } from '@/lib/settingsCache';
import { toIsraelCalendarDate } from '@/lib/hebrewDate';

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
//
// זו נקודת האמת היחידה ל"מה נחשב הזמנה תופסת-מלאי פעילה" — גם לחישוב יחיד (loadInventoryContext,
// דרך dressModelId/barcodePrefix) וגם לחישוב מרובה (getBulkAvailableInventory, דרך
// dressModelIds/barcodePrefixes). לפני 2026-09-14 היו כאן שני מימושים נפרדים שסטו זה מזה —
// getBulkAvailableInventory (מסך עמדת הלקוח) הוסיף לבד סינון order.status שכמעט תמיד NULL, וב-SQL
// "NOT IN" עם NULL מחזיר unknown/false - כך שכמעט כל הזמנה נעלמה בשקט מהחישוב שם, בלי שנתיב
// יצירת ההזמנה האמיתי (שדרכו עובר קובץ זה) הושפע בכלל. איחוד לפונקציה אחת מבטיח ששני הנתיבים
// לא יוכלו לסטות שוב באותה צורה.
function buildBookingsWhere({ dressModelId, dressModelIds, barcodePrefix, barcodePrefixes, dateLimitStart, dateLimitEnd, ignoreOrderId, holdMinutes }) {
  const cutoffDate = new Date(Date.now() - holdMinutes * 60 * 1000);

  // No model scope at all (getBulkAvailableInventory's modelIds=null case, e.g. the AI route
  // wanting availability across every model) means "don't filter by model" - omit OR entirely
  // rather than leaving it as [], which Prisma treats as "match nothing".
  const modelOr = [
    dressModelId ? { dressItem: { dressModelId } } : null,
    dressModelIds && dressModelIds.length > 0 ? { dressItem: { dressModelId: { in: dressModelIds } } } : null,
    barcodePrefix ? { barcodePrefix } : null,
    barcodePrefixes && barcodePrefixes.length > 0 ? { barcodePrefix: { in: barcodePrefixes } } : null
  ].filter(Boolean);

  const where = {
    ...(modelOr.length > 0 ? { OR: modelOr } : {}),
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
      // True interval-overlap test (not "does either endpoint fall inside the window") - so a
      // date-range (isAbroad) booking that fully spans dateLimitStart..dateLimitEnd is still
      // caught even if neither its fromDate nor toDate individually falls inside the window.
      OR: [
        { eventDate: { gte: dateLimitStart, lte: dateLimitEnd } },
        { fromDate: { lte: dateLimitEnd }, toDate: { gte: dateLimitStart } }
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

  const minDate = toIsraelCalendarDate(targetMinDate);
  const maxDate = targetMaxDate ? toIsraelCalendarDate(targetMaxDate) : minDate;

  // 1 - אם hide_custom_spacing מופעל, ציפוף מותאם מוסתר גם בחישובי מלאי (מתעלמים מ-customSpacing)
  let effectiveCustomSpacing = customSpacing;
  try {
    const hideSpacingTmp = await getCachedSetting('hide_custom_spacing', client);
    if (hideSpacingTmp?.value === 'true') effectiveCustomSpacing = null;
  } catch {}
  const effectiveBufferDays = (effectiveCustomSpacing !== null && effectiveCustomSpacing !== undefined)
    ? parseInt(effectiveCustomSpacing, 10)
    : bufferDays;

  const [warehouseSetting, holdSetting, reserveSetting] = await Promise.all([
    getCachedSetting('inventory_include_warehouse', client),
    getCachedSetting('inventory_hold_minutes', client),
    getCachedSetting('allow_renting_reserve_items', client)
  ]);
  const includeWarehouse = warehouseSetting && warehouseSetting.value === 'true';
  // allow_renting_reserve_items (SystemSetting, default missing/false = old behavior - reserve
  // items excluded, same as today). Kept as its own toggle rather than folded into
  // inventory_include_warehouse: a client explicitly asked to be able to rent items marked
  // "רזרבה", which is a different real-world meaning ("held back" but physically present) than
  // מחסן/warehouse (physically not on the rack) - see docs/fix-protocol-error-reports.md #3.
  const allowRentingReserve = reserveSetting && reserveSetting.value === 'true';
  const holdMinutes = holdSetting && !isNaN(parseInt(holdSetting.value, 10)) ? parseInt(holdSetting.value, 10) : 15;

  // 1. Get total active stock
  // In Access, dresses marked 'בתיקון' or 'לא בשימוש' or with location 'מחסן' or 'רזרבה' were excluded.
  const excludeLocationTerms = [
    ...(includeWarehouse ? [] : ['מחסן', 'warehouse']),
    ...(allowRentingReserve ? [] : ['רזרבה', 'reserve'])
  ];
  const stockItems = await client.dressItem.findMany({
    where: {
      dressModelId: dressModelId,
      notInUse: false,
      isDeleted: false,
      inRepair: false,
      // Exclude location containing מחסן (unless inventory_include_warehouse) and/or רזרבה
      // (unless allow_renting_reserve_items) - or their English equivalents.
      ...(excludeLocationTerms.length > 0 ? {
        OR: [
          { location: null },
          { AND: excludeLocationTerms.map(term => ({ location: { not: { contains: term } } })) }
        ]
      } : {})
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

  // daysBefore/daysAfter are symmetric, both sized to bufferDays - matches Access's real
  // production query (שמלות_מקור_שורה_לפי in the הזמנות module), which always applies the
  // same day-count on both sides. Confirmed 2026-09-15 by running that live VBA function
  // against fresh Access data and comparing side-by-side with this file's own output - see
  // docs/fix-protocol-error-reports.md #12/#13/#14. The former daysAfter=bufferDays+1 asymmetry
  // was unexplained and is the reason this file's numbers diverged from Access's.
  //
  // The buffer is applied on ONE side only - the target's own sweep window (targetDays below) -
  // NOT a second time to each other booking's own date. Applying it on both sides doubled the
  // effective gap enforced between two different customers' bookings to 2*bufferDays instead of
  // bufferDays - see docs/fix-protocol-error-reports.md #13.
  //
  // Every OTHER booking whose date falls anywhere inside the target's swept window is SUMMED,
  // not maxed against a single "worst calendar day". Confirmed 2026-09-15 by hand-tracing
  // Access's real generating SQL (קוד_למחרוזת's delta-sum, שמלות_מקור_שורה_לפי case 1/4) against
  // model 549: two other bookings landing on two DIFFERENT exact days inside the same window
  // (never overlapping on one calendar day) still both count - Access's own formula is a sum of
  // positive deltas across the whole window, not a true per-day max, and matches the real
  // business need (the buffer window represents days the unit may not be free to re-spring into
  // service, regardless of which specific day within it each other booking sits on). Verified
  // against fresh live Access data across all 18 real sizes of model 549: matches exactly on
  // 17/18 (size 06 - the case above - now closes). The one remaining mismatch (size 42) is NOT
  // an algorithm difference - it's order 52367, already known (docs/fix-protocol-error-reports.md
  // #12) to be soft-deleted on the site but still active in Access; Access counts its booking,
  // this file correctly doesn't. See docs/fix-protocol-error-reports.md #14 for the full trace.
  const daysAfter = parseInt(bufferDays, 10) || 0;
  const daysBefore = parseInt(bufferDays, 10) || 0;

  for (const tDate of validDates) {
    const boundMin = addDaysSkippingWeekends(tDate, -daysBefore, skipWeekends);
    const boundMax = addDaysSkippingWeekends(tDate, daysAfter, skipWeekends);

    const targetDays = getOccupiedDays(boundMin, boundMax);
    const targetDaySet = new Set(targetDays);
    const windowDemand = {};

    for (const booking of bookings) {
      if (!booking.order) continue;

      const bookingIsAbroad = booking.order.isAbroad;
      const customStart = bookingIsAbroad && booking.order.fromDate ? toIsraelCalendarDate(booking.order.fromDate) : null;
      const customEnd = bookingIsAbroad && booking.order.toDate ? toIsraelCalendarDate(booking.order.toDate) : customStart;

      const bookingEventDate = booking.order.eventDate ? toIsraelCalendarDate(booking.order.eventDate) : null;
      if (!customStart && !bookingEventDate) continue;

      const size = booking.sizeText || booking.dressItem?.sizeText || 'כללי';
      const qty = booking.quantity || 1;

      let qualifies = false;
      if (customStart && customEnd) {
        qualifies = targetDays.some(dTime => isDayOccupiedByBooking(dTime, customStart.getTime(), customEnd.getTime()));
      } else if (bookingEventDate) {
        // No buffer expansion here - the buffer is already applied once, on targetDays above.
        qualifies = targetDaySet.has(bookingEventDate.getTime());
      }

      if (qualifies) {
        if (!windowDemand[size]) windowDemand[size] = 0;
        windowDemand[size] += qty;
      }
    }

    for (const size in windowDemand) {
      if (!maxBookedQuantities[size]) maxBookedQuantities[size] = 0;
      maxBookedQuantities[size] = Math.max(maxBookedQuantities[size], windowDemand[size]);
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

  const minDate = toIsraelCalendarDate(targetDate);

  // 1. Get settings (cached 30s - חוסך findMany מלא בכל GET /api/dresses)
  const settingsRaw = await getAllCachedSettings();
  let bufferDays = 3;
  let skipWeekends = true;
  
  const bufferSetting = settingsRaw.find(s => s.key === 'inventory_buffer_days');
  if (bufferSetting) bufferDays = parseInt(bufferSetting.value, 10);
  
  const weekendSetting = settingsRaw.find(s => s.key === 'inventory_skip_weekends');
  if (weekendSetting) skipWeekends = weekendSetting.value === 'true';
  const warehouseSetting = settingsRaw.find(s => s.key === 'inventory_include_warehouse');
  const includeWarehouse = warehouseSetting && warehouseSetting.value === 'true';
  // See loadInventoryContext above for why this is a separate toggle from inventory_include_warehouse.
  const reserveSetting = settingsRaw.find(s => s.key === 'allow_renting_reserve_items');
  const allowRentingReserve = reserveSetting && reserveSetting.value === 'true';

  const holdSetting = settingsRaw.find(s => s.key === 'inventory_hold_minutes');
  const holdMinutes = holdSetting && !isNaN(parseInt(holdSetting.value, 10)) ? parseInt(holdSetting.value, 10) : 15;

  // 2. Fetch all active stock items
  const excludeLocationTerms = [
    ...(includeWarehouse ? [] : ['מחסן', 'warehouse']),
    ...(allowRentingReserve ? [] : ['רזרבה', 'reserve'])
  ];
  const allItems = await prisma.dressItem.findMany({
    where: {
      ...(modelIds ? { dressModelId: { in: modelIds } } : {}),
      notInUse: false,
      isDeleted: false,
      inRepair: false,
      ...(excludeLocationTerms.length > 0 ? {
        OR: [
          { location: null },
          { AND: excludeLocationTerms.map(term => ({ location: { not: { contains: term } } })) }
        ]
      } : {})
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

  // Same shared query builder loadInventoryContext uses (see its comment above) - the
  // 2026-09-14 kiosk-availability bug was exactly this function hand-rolling its own,
  // slightly different "which orders count as active bookings" logic instead of reusing it.
  const bookings = await prisma.orderItem.findMany({
    where: buildBookingsWhere({
      dressModelIds: modelIds || undefined,
      barcodePrefixes: targetPrefixes.length > 0 ? targetPrefixes : undefined,
      dateLimitStart: searchMin,
      dateLimitEnd: searchMax,
      holdMinutes
    }),
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

  // 4. Calculate overlap for the specific date - symmetric daysBefore/daysAfter, both sized
  // to bufferDays, matching Access's real production query. The buffer applies once, to
  // targetDays below, not a second time to each other booking's own date, and every other
  // booking landing inside the window is SUMMED rather than maxed against a single "worst
  // calendar day" - see the long comment above computeInventoryAvailability's identical block
  // for the full explanation (docs/fix-protocol-error-reports.md #13/#14).
  const daysAfter = bufferDays;
  const daysBefore = bufferDays;
  const boundMin = addDaysSkippingWeekends(minDate, -daysBefore, skipWeekends);
  const boundMax = addDaysSkippingWeekends(minDate, daysAfter, skipWeekends);
  const targetDays = getOccupiedDays(boundMin, boundMax);
  const targetDaySet = new Set(targetDays);
  const bookedQuantities = {};

  for (const booking of bookings) {
    if (!booking.order) continue;
    const modelId = booking.dressModelId || booking.dressItem?.dressModelId || (booking.barcodePrefix ? prefixToModelMap[booking.barcodePrefix] : null);
    if (!modelId) continue;

    const size = booking.sizeText || booking.dressItem?.sizeText || 'כללי';
    const qty = booking.quantity || 1;

    const isAbroad = booking.order.isAbroad;
    const customStart = isAbroad && booking.order.fromDate ? toIsraelCalendarDate(booking.order.fromDate) : null;
    const customEnd = isAbroad && booking.order.toDate ? toIsraelCalendarDate(booking.order.toDate) : customStart;
    const bookingEventDate = booking.order.eventDate ? toIsraelCalendarDate(booking.order.eventDate) : null;

    let qualifies = false;
    if (customStart && customEnd) {
      qualifies = targetDays.some(dTime => isDayOccupiedByBooking(dTime, customStart.getTime(), customEnd.getTime()));
    } else if (bookingEventDate) {
      // No buffer expansion here - the buffer is already applied once, on targetDays above.
      qualifies = targetDaySet.has(bookingEventDate.getTime());
    }

    if (qualifies) {
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

  // Fetch with normal buffer (cached)
  const settingsRaw = await getAllCachedSettings();
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

// #21 (בקשה 21, print_mark_missing_dresses) - "סימון שמלה חסרה" בדף ההכנה להדפסה.
// שונה במהותו מ-getAvailableInventory/getBulkAvailableInventory: אלה בודקים התנגשות
// שריון לפי חלון תאריכים עתידי סביב eventDate+bufferDays ("אם אזמין לתאריך X, יש מספיק?").
// כאן השאלה פיזית ונקודתית - "האם יש כרגע, ברגע ההדפסה, יחידה של הדגם/מידה הזו בגמ״ח" -
// ולכן נבדק ישירות מצב ה-OrderItem הפעיל (isTaken=true, isReturned=false) של יחידות הדגם,
// לא חלון תאריכים. שאילתת "מלאי פעיל" (notInUse/isDeleted/inRepair/מחסן-רזרבה) זהה בכוונה
// להגדרה ב-loadInventoryContext למעלה, כדי שתישאר עקבית עם שאר המערכת.
// מחזיר { familyName, returnOrderId } כשאין יחידה פנויה כרגע וקיימת יחידה "בחוץ" שאמורה
// לחזור מחר מהזמנה אחרת (לפי אותה נוסחת fallback ל"תאריך החזרה" כמו app/print/order/page.js:
// toDate/returnDate ואם אין - יום אחרי האירוע, מדלג על סופ״ש) - אחרת null. קריאה בלבד.
export async function checkMissingDressForItem({ dressModelId, sizeText, excludeOrderId = null }) {
  if (!dressModelId) return null;
  const normalizedSize = sizeText || null;

  const warehouseSetting = await getCachedSetting('inventory_include_warehouse');
  const includeWarehouse = warehouseSetting && warehouseSetting.value === 'true';
  // See loadInventoryContext above for why this is a separate toggle from inventory_include_warehouse.
  const reserveSetting = await getCachedSetting('allow_renting_reserve_items');
  const allowRentingReserve = reserveSetting && reserveSetting.value === 'true';

  const excludeLocationTerms = [
    ...(includeWarehouse ? [] : ['מחסן', 'warehouse']),
    ...(allowRentingReserve ? [] : ['רזרבה', 'reserve'])
  ];
  const stockWhere = {
    dressModelId,
    notInUse: false,
    isDeleted: false,
    inRepair: false,
    ...(normalizedSize ? { sizeText: normalizedSize } : {}),
    ...(excludeLocationTerms.length > 0 ? {
      OR: [
        { location: null },
        { AND: excludeLocationTerms.map(term => ({ location: { not: { contains: term } } })) }
      ]
    } : {})
  };

  const stockItems = await prisma.dressItem.findMany({ where: stockWhere, select: { id: true } });
  // אין בכלל יחידות מהדגם/מידה הזו במערכת - זו בעיית קטלוג, לא "חסרה" זמנית; אין מה לסמן.
  if (stockItems.length === 0) return null;
  const stockIds = stockItems.map(i => i.id);

  const outItems = await prisma.orderItem.findMany({
    where: {
      dressItemId: { in: stockIds },
      isDeleted: false,
      isTaken: true,
      isReturned: false,
      ...(excludeOrderId ? { order: { orderId: { not: excludeOrderId } } } : {})
    },
    include: { order: { include: { customer: true } } }
  });

  const availableNow = stockItems.length - outItems.length;
  if (availableNow > 0) return null;

  const today = toIsraelCalendarDate(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = tomorrow.toISOString().split('T')[0];

  for (const oi of outItems) {
    const ord = oi.order;
    if (!ord) continue;
    const returnBy = ord.toDate || ord.returnDate || (ord.eventDate ? addDaysSkippingWeekends(toIsraelCalendarDate(ord.eventDate), 1) : null);
    if (!returnBy) continue;
    const key = toIsraelCalendarDate(returnBy).toISOString().split('T')[0];
    if (key === tomorrowKey) {
      const familyName = ord.customer?.lastName
        || [ord.customer?.firstName, ord.customer?.lastName].filter(Boolean).join(' ')
        || null;
      if (!familyName) continue;
      return { familyName, returnOrderId: ord.orderId };
    }
  }

  return null;
}

// באג אמיתי, תועד 2026-09-15 (docs/fix-protocol-error-reports.md #12): מסכי הזמנה חדשה/טיוטה
// שולחים dressModelId + sampleItemId נפרדים לכל פריט - sampleItemId הוא "פריט מייצג" לתצוגה
// (ר' sampleItemId ב-sizesMap למעלה), לא בהכרח פריט שנבדק מול dressModelId בזמן השמירה עצמה.
// כשהם לא תואמים (למשל דגם/מידה הוחלפו מהר במסך וsampleItemId נשאר מהבחירה הקודמת), ה-OrderItem
// נשמר עם dressItemId שמצביע על דגם אחר - וההזמנה נעלמת בשקט מספירת הזמינות של הדגם הנכון
// (buildBookingsWhere מתאים לפי dressItem.dressModelId בפועל, לא לפי מה שהמסך התכוון לשלוח).
// נקראת פעם אחת, מחוץ לטרנזקציה, ומתקנת כל sampleItemId שלא תואם את דגם הפריט שנשלח בפועל.
export async function reconcileDressItemIds(items) {
  if (!items || !Array.isArray(items)) return items;

  const candidates = items.filter(i => i && !i.isDeleted && i.sampleItemId && i.dressModelId);
  if (candidates.length === 0) return items;

  const sampleIds = [...new Set(candidates.map(i => i.sampleItemId))];
  const sampleDressItems = await prisma.dressItem.findMany({
    where: { id: { in: sampleIds } },
    select: { id: true, dressModelId: true }
  });
  const sampleMap = new Map(sampleDressItems.map(d => [d.id, d.dressModelId]));

  const mismatched = candidates.filter(i => sampleMap.get(i.sampleItemId) !== i.dressModelId);
  if (mismatched.length === 0) return items;

  const comboKey = (i) => `${i.dressModelId}__${i.sizeText}`;
  const combos = [...new Map(mismatched.map(i => [comboKey(i), i])).values()];
  const replacementByCombo = new Map();
  for (const combo of combos) {
    const replacement = await prisma.dressItem.findFirst({
      where: {
        dressModelId: combo.dressModelId,
        sizeText: combo.sizeText,
        isDeleted: false,
        notInUse: false,
        inRepair: false
      },
      select: { id: true }
    });
    replacementByCombo.set(comboKey(combo), replacement?.id || null);
  }

  return items.map(item => {
    if (!mismatched.includes(item)) return item;
    const replacementId = replacementByCombo.get(comboKey(item));
    const claimedWrongModel = sampleMap.get(item.sampleItemId);
    if (replacementId) {
      console.error(`[inventory] reconciled mismatched dressItemId: item requested model ${item.dressModelId} size ${item.sizeText} but sampleItemId ${item.sampleItemId} belonged to model ${claimedWrongModel || '(unknown)'}. Replaced with ${replacementId}.`);
      return { ...item, sampleItemId: replacementId };
    }
    console.error(`[inventory] could not reconcile mismatched dressItemId for model ${item.dressModelId} size ${item.sizeText} - no active DressItem found; leaving original sampleItemId ${item.sampleItemId}.`);
    return item;
  });
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

  // 1 - אם hide_custom_spacing מופעל, מתעלמים מציפוף מותאם גם בולידציית מלאי
  try {
    const hideSetting = await getCachedSetting('hide_custom_spacing');
    if (hideSetting?.value === 'true') customSpacing = null;
  } catch {}

  // Batch-fetch dressModelId for items that don't already carry it, instead of one
  // prisma.dressItem.findUnique per item inside the loop below.
  const idsNeedingModelLookup = [...new Set(
    activeItems
      .filter(item => !(item.dressModelId || item.dressId || item.modelId) && (item.sampleItemId || item.dressItemId))
      .map(item => item.sampleItemId || item.dressItemId)
  )];

  let dressItemModelMap = {};
  if (idsNeedingModelLookup.length > 0) {
    const dressItemsFound = await prisma.dressItem.findMany({
      where: { id: { in: idsNeedingModelLookup } },
      select: { id: true, dressModelId: true }
    });
    dressItemModelMap = Object.fromEntries(dressItemsFound.map(di => [di.id, di.dressModelId]));
  }

  // Group required items by model and size
  const requiredItems = {};
  for (const item of activeItems) {
    // For validation, we need the dressModelId. It might be passed as dressModelId, dressId, or we might need to fetch it.
    const modelId = item.dressModelId || item.dressId || item.modelId;

    let finalModelId = modelId;
    if (!finalModelId && (item.sampleItemId || item.dressItemId)) {
      finalModelId = dressItemModelMap[item.sampleItemId || item.dressItemId] || null;
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
  
   // Fetch settings to get bufferDays (cached)
   let bufferDays = 3;
   let skipWeekends = true;
   try {
      const settings = await getAllCachedSettings();
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

  // B5 - הרצה מקבילית במקום לולאה סדרתית - חוסך סבבי DB מיותרים להזמנה עם כמה דגמים.
  // כל בדיקת זמינות לדגם היא עצמאית (loadInventoryContext בונה קונטקסט טרי לכל קריאה,
  // בלי state משותף/מוטציה בין קריאות), אז אין סיכון בהרצה מקבילית.
  const availabilityByModel = await Promise.all(
    modelsToCheck.map(modelId => getAvailableInventory(
      modelId,
      targetMinDate,
      bufferDays,
      skipWeekends,
      isAbroad,
      targetMaxDate,
      orderId,
      customSpacing
    ))
  );

  modelsToCheck.forEach((modelId, idx) => {
    const availability = availabilityByModel[idx];

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
  });

  return {
    valid: errors.length === 0,
    errors
  };
}
