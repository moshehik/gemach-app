import { sortSizeRows } from './sizeSort';

export function addDaysSkippingWeekends(date, days, skipWeekends = true) {
  let result = new Date(date);
  let daysAdded = 0;
  const direction = days > 0 ? 1 : -1;
  const absDays = Math.abs(days);
  while (daysAdded < absDays) {
    result.setDate(result.getDate() + direction);
    if (skipWeekends && (result.getDay() === 5 || result.getDay() === 6)) continue;
    daysAdded++;
  }
  return result;
}

export function getOccupiedDays(minDate, maxDate) {
  const minTime = minDate.getTime();
  const maxTime = maxDate.getTime();
  const days = [];
  if (minTime === maxTime) days.push(minTime);
  else {
    let current = minTime;
    while (current < maxTime) {
      days.push(current);
      current += 24 * 60 * 60 * 1000;
    }
  }
  return days;
}

export function isDayOccupiedByBooking(dTime, bMinTime, bMaxTime) {
  if (bMinTime === bMaxTime) return dTime === bMinTime;
  return dTime >= bMinTime && dTime < bMaxTime;
}

/*
  פריט שכבר נשמר בהזמנה מגיע מהשרת בלי dressModelId משלו — הדגם והמידה יושבים
  על dressItem. המטמון ממילא מדלג על ההזמנה הנוכחית (excludeOrderId), ולכן בלי
  קריאת השדות האלה פריטים שנוספו זה עתה באותה הזמנה לא היו יורדים מהמלאי.
*/
function getCartItemModelId(item) {
  return item.dressModelId || item.dressItem?.dressModelId || item.dressItem?.dress?.id || null;
}

function getCartItemSize(item) {
  return item.sizeText || item.dressItem?.sizeText || item.dressItem?.size || 'כללי';
}

// חישוב הביקוש המקסימלי לכל מידה עבור bufferDays נתון.
// שימו לב: הביקוש של הזמנות אחרות מחושב לפי ה-buffer של החישוב הנוכחי —
// כלומר ציפוף (buffer קטן) גם "רואה" חלונות קצרים יותר סביב ההזמנות האחרות,
// בדיוק כמו getAvailableInventory בשרת.
function computeMaxBooked(modelBookings, validDates, bufferDays, skipWeekends) {
  const daysBefore = 0;
  const daysAfter = bufferDays + 1;
  const maxBookedQuantities = {};

  for (const tDate of validDates) {
    const boundMin = addDaysSkippingWeekends(tDate, -daysBefore, skipWeekends);
    const boundMax = addDaysSkippingWeekends(tDate, daysAfter, skipWeekends);
    const targetDays = getOccupiedDays(boundMin, boundMax);
    const maxDayDemand = {};

    for (const dTime of targetDays) {
      const currentDayDemand = {};

      for (const booking of modelBookings) {
        const customStart = booking.fD ? new Date(booking.fD) : null;
        const customEnd = booking.tD ? new Date(booking.tD) : customStart;
        const bookingEventDate = booking.eD ? new Date(booking.eD) : null;

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
          const size = booking.s || 'כללי';
          currentDayDemand[size] = (currentDayDemand[size] || 0) + booking.q;
        }
      }

      for (const size in currentDayDemand) {
        maxDayDemand[size] = Math.max(maxDayDemand[size] || 0, currentDayDemand[size]);
      }
    }

    for (const size in maxDayDemand) {
      maxBookedQuantities[size] = Math.max(maxBookedQuantities[size] || 0, maxDayDemand[size]);
    }
  }

  return maxBookedQuantities;
}

export function calculateDynamicAvailability(modelId, targetMinDate, targetMaxDate, cachedData, currentCartItems = [], customSpacing = null) {
  if (!cachedData || !cachedData.stock || !cachedData.bookings) return [];
  const { stock, bookings, settings } = cachedData;
  const defaultBufferDays = settings?.bufferDays !== undefined ? settings.bufferDays : 3;
  const skipWeekends = settings?.skipWeekends !== undefined ? settings.skipWeekends : true;
  const hasCustomSpacing = customSpacing !== null && customSpacing !== undefined;

  const minDate = new Date(targetMinDate);
  minDate.setHours(0, 0, 0, 0);
  const maxDate = targetMaxDate ? new Date(targetMaxDate) : minDate;
  maxDate.setHours(0, 0, 0, 0);

  const modelStock = stock[modelId] || {};
  const modelBookings = bookings.filter(b => b.m === modelId);

  let validDates = [];
  let d = new Date(minDate);
  while (d <= maxDate) {
    if (!skipWeekends || (d.getDay() !== 5 && d.getDay() !== 6)) {
      validDates.push(new Date(d));
    }
    d.setDate(d.getDate() + 1);
  }

  // חישוב רגיל — תמיד. חישוב ציפוף — רק אם הוגדר להזמנה הזו.
  const normalBooked = computeMaxBooked(modelBookings, validDates, defaultBufferDays, skipWeekends);
  const customBooked = hasCustomSpacing
    ? computeMaxBooked(modelBookings, validDates, parseInt(customSpacing, 10), skipWeekends)
    : null;

  const result = [];
  for (const size in modelStock) {
    const totalInStock = modelStock[size]?.total || 0;
    const sampleItemId = modelStock[size]?.itemId || '';

    // Subtract items of the current order — both rows still open in the window and
    // rows already saved to it (the cache excludes this order's bookings entirely).
    const inCartQty = currentCartItems
      .filter(item => !item.isDeleted && !item.isReturned
        && getCartItemModelId(item) === modelId
        && getCartItemSize(item) === size)
      .reduce((sum, item) => sum + (item.quantity || 1), 0);

    const normalAvail = Math.max(0, totalInStock - (normalBooked[size] || 0) - inCartQty);
    const customAvail = hasCustomSpacing
      ? Math.max(0, totalInStock - (customBooked[size] || 0) - inCartQty)
      : null;

    result.push({
      sizeText: size,
      totalInStock,
      sampleItemId,
      // הכמות "בתוקף" להזמנה הזו: עם ציפוף אם הוגדר, אחרת רגילה.
      // נשמר לתאימות עם קוראים שבודקים availableQuantity ישירות.
      availableQuantity: hasCustomSpacing ? customAvail : normalAvail,
      // אותו מבנה כמו getAvailableInventoryWithComparison בשרת
      withNormalBuffer: {
        availableQuantity: normalAvail,
        bufferDays: defaultBufferDays
      },
      withCustomSpacing: hasCustomSpacing ? {
        availableQuantity: customAvail,
        bufferDays: parseInt(customSpacing, 10),
        gain: Math.max(0, customAvail - normalAvail)
      } : null
    });
  }

  return sortSizeRows(result);
}
