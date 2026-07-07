'use server';

import prisma from '../../lib/prisma';

// מקביל ל- "סטטיסטיקה_דוח_יומי" ב-Access
export async function getDailyReport() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  // הזמנות שנוצרו היום
  const newOrdersToday = await prisma.order.count({
    where: {
      orderDate: {
        gte: today,
        lt: tomorrow
      }
    }
  });

  // החזרות שבוצעו היום (לפי תאריך החזרה של פריטים)
  const itemsReturnedToday = await prisma.orderItem.count({
    where: {
      returnDate: {
        gte: today,
        lt: tomorrow
      }
    }
  });

  // סך הכנסות להיום (לפי תאריך תשלום)
  const revenueTodayAggregation = await prisma.order.aggregate({
    _sum: { totalAmount: true },
    where: {
      paymentDate: {
        gte: today,
        lt: tomorrow
      }
    }
  });

  return {
    newOrders: newOrdersToday,
    itemsReturned: itemsReturnedToday,
    revenue: revenueTodayAggregation._sum.totalAmount || 0
  };
}

// מקביל ל- "סטטיסטיקה_סיכום_להזמנה" ב-Access
export async function getOrderSummaryStats() {
  // סיכום פריטים ומחירים לפי הזמנה
  const recentOrders = await prisma.order.findMany({
    take: 10,
    orderBy: { orderDate: 'desc' },
    include: {
      customer: true,
      items: true
    }
  });

  return recentOrders.map(order => ({
    orderId: order.id,
    customerName: order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'לקוח כללי',
    totalItems: order.items.length,
    totalAmount: order.totalAmount,
    date: order.orderDate
  }));
}

// תרגום מדויק של קוד ה-VBA "סטטיסטיקה_עובדים_מקסימלית"
export async function getMaxConcurrentEmployees() {
  // שולף את זמני הכניסה והיציאה של כל עובדי הנוכחות
  const attendances = await prisma.shift.findMany({
    where: {
      entryTime: { not: null },
      exitTime: { not: null }
    },
    orderBy: {
      entryTime: 'asc'
    }
  });

  if (attendances.length === 0) {
    return { maxEmployees: 0, peakTime: null };
  }

  // בונה מערך אירועים (כניסה = +1, יציאה = -1)
  const events = [];
  attendances.forEach(att => {
    events.push({ time: att.entryTime.getTime(), change: 1 });
    events.push({ time: att.exitTime.getTime(), change: -1 });
  });

  // מיון אירועים לפי זמן. אם אותו זמן, יציאות קודמות לכניסות (כדי לא לנפח זמנית)
  events.sort((a, b) => {
    if (a.time === b.time) return a.change - b.change;
    return a.time - b.time;
  });

  let currentEmployees = 0;
  let maxEmployees = 0;
  let peakTime = null;

  events.forEach(event => {
    currentEmployees += event.change;
    if (currentEmployees > maxEmployees) {
      maxEmployees = currentEmployees;
      peakTime = new Date(event.time);
    }
  });

  return { maxEmployees, peakTime };
}
