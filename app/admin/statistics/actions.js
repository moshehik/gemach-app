'use server';

import prisma from '../../lib/prisma';

// Helper for date truncation in JS
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// 1. Daily Statistics
export async function getDailyStatistics(startDate, endDate) {
  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);

  const orders = await prisma.order.findMany({
    where: { orderDate: { gte: start, lte: end }, isDeleted: false },
    select: { orderDate: true, totalAmount: true, items: { select: { id: true } } }
  });

  const returnedItems = await prisma.orderItem.findMany({
    where: { returnDate: { gte: start, lte: end }, isDeleted: false, isReturned: true }
  });

  // Group by day string
  const grouped = {};
  orders.forEach(o => {
    if (!o.orderDate) return;
    const day = startOfDay(o.orderDate).toISOString().split('T')[0];
    if (!grouped[day]) grouped[day] = { date: day, newOrders: 0, revenue: 0, itemsRented: 0, itemsReturned: 0 };
    grouped[day].newOrders += 1;
    grouped[day].revenue += o.totalAmount || 0;
    grouped[day].itemsRented += o.items.length;
  });

  returnedItems.forEach(i => {
    if (!i.returnDate) return;
    const day = startOfDay(i.returnDate).toISOString().split('T')[0];
    if (!grouped[day]) grouped[day] = { date: day, newOrders: 0, revenue: 0, itemsRented: 0, itemsReturned: 0 };
    grouped[day].itemsReturned += 1;
  });

  return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
}

// 2. Statistics By Model
export async function getStatisticsByModel(startDate, endDate) {
  const start = startDate ? new Date(startDate) : new Date(0);
  const end = endDate ? new Date(endDate) : new Date('2100-01-01');
  
  const items = await prisma.orderItem.findMany({
    where: { order: { eventDate: { gte: start, lte: end }, isDeleted: false }, isDeleted: false },
    include: { dressItem: { include: { dress: true } } }
  });

  const grouped = {};
  items.forEach(i => {
    const modelName = i.dressItem?.dress?.name || 'לא ידוע';
    if (!grouped[modelName]) grouped[modelName] = { name: modelName, count: 0, neck: 0, length: 0, sleeve: 0 };
    grouped[modelName].count += i.quantity || 1;
    if (i.neckAlteration > 0) grouped[modelName].neck += 1;
    if (i.lengthAlteration && i.lengthAlteration.trim() !== '') grouped[modelName].length += 1;
    if (i.sleeveAlteration > 0) grouped[modelName].sleeve += 1;
  });
  return Object.values(grouped).sort((a, b) => b.count - a.count);
}

// 3. Statistics By Size
export async function getStatisticsBySize(startDate, endDate) {
  const start = startDate ? new Date(startDate) : new Date(0);
  const end = endDate ? new Date(endDate) : new Date('2100-01-01');
  
  const items = await prisma.orderItem.findMany({
    where: { order: { eventDate: { gte: start, lte: end }, isDeleted: false }, isDeleted: false }
  });

  const grouped = {};
  items.forEach(i => {
    const size = i.sizeText || 'ללא מידה';
    if (!grouped[size]) grouped[size] = { size, count: 0, neck: 0, length: 0, sleeve: 0 };
    grouped[size].count += i.quantity || 1;
    if (i.neckAlteration > 0) grouped[size].neck += 1;
    if (i.lengthAlteration && i.lengthAlteration.trim() !== '') grouped[size].length += 1;
    if (i.sleeveAlteration > 0) grouped[size].sleeve += 1;
  });
  return Object.values(grouped).sort((a, b) => b.count - a.count);
}

// 4. Seamstress Work By Event Date
export async function getSeamstressWork(startDate, endDate) {
  const start = startDate ? new Date(startDate) : new Date(0);
  const end = endDate ? new Date(endDate) : new Date('2100-01-01');
  
  const items = await prisma.orderItem.findMany({
    where: { 
      order: { eventDate: { gte: start, lte: end }, isDeleted: false }, 
      isDeleted: false,
    },
    include: { order: true }
  });

  const grouped = {};
  items.forEach(i => {
    if (!i.order || !i.order.eventDate) return;
    
    // We only count items that actually need fixing
    const hasLengthFix = i.lengthAlteration && i.lengthAlteration.trim() !== '';
    const hasNeckFix = i.neckAlteration > 0;
    const hasSleeveFix = i.sleeveAlteration > 0;
    
    if (hasLengthFix || hasNeckFix || hasSleeveFix) {
        const dateStr = startOfDay(i.order.eventDate).toISOString().split('T')[0];
        if (!grouped[dateStr]) grouped[dateStr] = { date: dateStr, itemsCount: 0, neck: 0, length: 0, sleeve: 0 };
      grouped[dateStr].itemsCount += 1;
      if (hasNeckFix) grouped[dateStr].neck += 1;
      if (hasLengthFix) grouped[dateStr].length += 1;
      if (hasSleeveFix) grouped[dateStr].sleeve += 1;
    }
  });
  return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
}

// 5. Payment Statistics
export async function getPaymentStatistics(startDate, endDate) {
  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const end = endDate ? new Date(endDate) : new Date();

  const orders = await prisma.order.findMany({
    where: { orderDate: { gte: start, lte: end }, isDeleted: false },
    include: { payments: true, customer: true }
  });

  return orders.map(o => {
    const paid = o.payments.reduce((sum, p) => sum + (p.isDeleted ? 0 : p.amount), 0);
    const expected = o.totalAmount || 0;
    return {
      orderId: o.orderId,
      customerName: o.customer ? `${o.customer.firstName} ${o.customer.lastName}` : 'ללא שם',
      orderDate: o.orderDate,
      expectedTotal: expected,
      actualPaid: paid,
      debt: expected - paid
    };
  }).sort((a, b) => b.debt - a.debt);
}

// 6. Dress Consumption (Inventory Overlap Check)
export async function getDressConsumptionStats(startDate, endDate) {
  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const end = endDate ? new Date(endDate) : new Date(new Date().setMonth(new Date().getMonth() + 6));
  
  // 1. Fetch all items in stock
  const allStock = await prisma.dressItem.findMany({
    where: { isDeleted: false, notInUse: false },
    include: { dress: true }
  });
  
  // Group stock by dressModelId and sizeText
  const stockMap = {};
  allStock.forEach(item => {
    const key = `${item.dressModelId}_${item.sizeText || 'ללא'}`;
    if (!stockMap[key]) {
      stockMap[key] = {
        modelId: item.dressModelId,
        modelName: item.dress?.name || 'לא ידוע',
        barcodePrefix: item.barcodePrefix,
        sizeText: item.sizeText || 'ללא',
        totalStock: 0
      };
    }
    stockMap[key].totalStock += (item.quantity || 1);
  });

  // 2. Fetch all active rentals in the date range
  const rentedItems = await prisma.orderItem.findMany({
    where: {
      order: { eventDate: { gte: start, lte: end }, isDeleted: false },
      isDeleted: false,
      dressItemId: { not: null }
    },
    include: { order: true, dressItem: true }
  });

  // 3. For each rented item, it occupies the dress from (eventDate - 2) to (eventDate + 2)
  const rentals = rentedItems.map(ri => {
    const evDate = new Date(ri.order.eventDate);
    const startOccupancy = new Date(evDate);
    startOccupancy.setDate(evDate.getDate() - 2);
    const endOccupancy = new Date(evDate);
    endOccupancy.setDate(evDate.getDate() + 2);
    
    return {
      modelId: ri.dressItem.dressModelId,
      sizeText: ri.dressItem.sizeText || 'ללא',
      key: `${ri.dressItem.dressModelId}_${ri.dressItem.sizeText || 'ללא'}`,
      start: startOccupancy.getTime(),
      end: endOccupancy.getTime(),
      qty: ri.quantity || 1,
      eventDate: evDate
    };
  });

  // 4. Calculate Max Overlap for each Key
  const overlapResults = [];
  
  Object.keys(stockMap).forEach(key => {
    const stockInfo = stockMap[key];
    const itemRentals = rentals.filter(r => r.key === key);
    
    if (itemRentals.length === 0) {
      overlapResults.push({
        ...stockInfo,
        maxRented: 0,
        hasShortage: false,
        peakDates: ''
      });
      return;
    }
    
    const events = [];
    itemRentals.forEach(r => {
      events.push({ time: r.start, change: r.qty, eventDate: r.eventDate });
      events.push({ time: r.end + 1, change: -r.qty }); 
    });
    
    events.sort((a, b) => a.time - b.time);
    
    let currentConcurrent = 0;
    let maxConcurrent = 0;
    let peakDates = new Set();
    
    events.forEach(ev => {
      currentConcurrent += ev.change;
      if (currentConcurrent > maxConcurrent) {
        maxConcurrent = currentConcurrent;
        peakDates = new Set();
        if (ev.eventDate) peakDates.add(ev.eventDate.toISOString().split('T')[0]);
      } else if (currentConcurrent === maxConcurrent && ev.eventDate) {
        peakDates.add(ev.eventDate.toISOString().split('T')[0]);
      }
    });

    overlapResults.push({
      ...stockInfo,
      maxRented: maxConcurrent,
      hasShortage: maxConcurrent > stockInfo.totalStock,
      peakDates: Array.from(peakDates).join(', ')
    });
  });

  return overlapResults.sort((a, b) => b.hasShortage - a.hasShortage || b.maxRented - a.maxRented);
}

// Keep old actions for backward compatibility
export async function getDailyReport() {
  const res = await getDailyStatistics(new Date(new Date().setHours(0,0,0,0)), new Date(new Date().setHours(23,59,59,999)));
  if (res.length > 0) return { newOrders: res[0].newOrders, itemsReturned: res[0].itemsReturned, revenue: res[0].revenue };
  return { newOrders: 0, itemsReturned: 0, revenue: 0 };
}

export async function getOrderSummaryStats() {
  const recentOrders = await prisma.order.findMany({
    take: 10,
    orderBy: { orderDate: 'desc' },
    include: { customer: true, items: true }
  });
  return recentOrders.map(order => ({
    orderId: order.orderId ? order.orderId.toString() : order.id.toString(),
    customerName: order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'לקוח כללי',
    totalItems: order.items.length,
    totalAmount: order.totalAmount,
    date: order.orderDate
  }));
}

export async function getMaxConcurrentEmployees() {
  const attendances = await prisma.shift.findMany({
    where: { entryTime: { not: null }, exitTime: { not: null } },
    orderBy: { entryTime: 'asc' }
  });
  if (attendances.length === 0) return { maxEmployees: 0, peakTime: null };
  const events = [];
  attendances.forEach(att => {
    events.push({ time: att.entryTime.getTime(), change: 1 });
    events.push({ time: att.exitTime.getTime(), change: -1 });
  });
  events.sort((a, b) => a.time === b.time ? a.change - b.change : a.time - b.time);
  let currentEmployees = 0, maxEmployees = 0, peakTime = null;
  events.forEach(event => {
    currentEmployees += event.change;
    if (currentEmployees > maxEmployees) {
      maxEmployees = currentEmployees;
      peakTime = new Date(event.time);
    }
  });
  return { maxEmployees, peakTime };
}
