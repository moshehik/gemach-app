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

export function isDayOccupiedByBooking(dTime, bMinTime, bMaxTime) {
  if (bMinTime === bMaxTime) return dTime === bMinTime;
  return dTime >= bMinTime && dTime < bMaxTime;
}

// Reproduces Access's real occupancy formula - kept identical to occupancyFormula in
// lib/inventory.js (see that file's comment and docs/fix-protocol-error-reports.md #15 for the
// full derivation). Duplicated rather than imported because lib/inventory.js pulls in the
// server-only @/app/lib/prisma client, which can't be bundled into client code.
function occupancyFormula(o, bufferDays) {
  if (bufferDays <= 0) return o(0) || 0;
  let total = 0;
  for (let k = -bufferDays; k <= 0; k++) total += (o(k) || 0);
  let prevDay = null;
  for (let j = 1; j <= bufferDays; j++) {
    const carry = prevDay !== null ? Math.max(0, prevDay) : 0;
    const dayJ = carry + (o(j) || 0) - (o(j - 1 - bufferDays) || 0);
    total += Math.max(0, dayJ);
    prevDay = dayJ;
  }
  return total;
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

// חישוב הביקוש המקסימלי לכל מידה עבור bufferDays נתון - זהה בדיוק לאלגוריתם בשרת
// (occupancyFormula ב-lib/inventory.js, ר' docs/fix-protocol-error-reports.md #15). עד
// 2026-09-15 הקובץ הזה החזיק גרסה ישנה ושגויה (buffer א-סימטרי + הרחבה כפולה + מקסימום-ליום)
// שכבר תוקנה בשרת קודם - כלומר תצוגת הזמינות הזאת (מסך יצירת הזמנה) יכלה להראות מספר שונה
// מהבדיקה האמיתית שרצה בפועל בשמירה. תוקן כדי שלא יסטו שוב.
function computeMaxBooked(modelBookings, validDates, bufferDays, skipWeekends) {
  const maxBookedQuantities = {};

  for (const tDate of validDates) {
    const occBySize = {};

    for (let k = -bufferDays; k <= bufferDays; k++) {
      const dDate = k === 0 ? tDate : addDaysSkippingWeekends(tDate, k, skipWeekends);
      const dTime = dDate.getTime();

      for (const booking of modelBookings) {
        const customStart = booking.fD ? new Date(booking.fD) : null;
        const customEnd = booking.tD ? new Date(booking.tD) : customStart;
        const bookingEventDate = booking.eD ? new Date(booking.eD) : null;

        if (customStart) customStart.setHours(0, 0, 0, 0);
        if (customEnd) customEnd.setHours(0, 0, 0, 0);
        if (bookingEventDate) bookingEventDate.setHours(0, 0, 0, 0);

        let occupies = false;
        if (customStart && customEnd) {
          occupies = isDayOccupiedByBooking(dTime, customStart.getTime(), customEnd.getTime());
        } else if (bookingEventDate) {
          occupies = (dTime === bookingEventDate.getTime());
        }

        if (occupies) {
          const size = booking.s || 'כללי';
          if (!occBySize[size]) occBySize[size] = {};
          occBySize[size][k] = (occBySize[size][k] || 0) + booking.q;
        }
      }
    }

    for (const size in occBySize) {
      const booked = occupancyFormula(k => occBySize[size][k], bufferDays);
      maxBookedQuantities[size] = Math.max(maxBookedQuantities[size] || 0, booked);
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
