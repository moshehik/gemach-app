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

export function calculateDynamicAvailability(modelId, targetMinDate, targetMaxDate, cachedData, currentCartItems = []) {
  if (!cachedData || !cachedData.stock || !cachedData.bookings) return [];
  const { stock, bookings, settings } = cachedData;
  const bufferDays = settings?.bufferDays !== undefined ? settings.bufferDays : 3;
  const skipWeekends = settings?.skipWeekends !== undefined ? settings.skipWeekends : true;

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

  const result = [];
  for (const size in modelStock) {
    const totalInStock = modelStock[size]?.total || 0;
    const sampleItemId = modelStock[size]?.itemId || '';
    const booked = maxBookedQuantities[size] || 0;

    // Subtract items currently un-submitted in the frontend cart
    const inCartQty = currentCartItems
      .filter(item => !item.isDeleted && item.dressModelId === modelId && item.sizeText === size)
      .reduce((sum, item) => sum + (item.quantity || 1), 0);

    const availableQuantity = Math.max(0, totalInStock - booked - inCartQty);

    result.push({
      sizeText: size,
      totalInStock,
      availableQuantity,
      sampleItemId
    });
  }

  return result;
}
