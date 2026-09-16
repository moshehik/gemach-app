import prisma from '@/app/lib/prisma';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { calculateOrderStatus } from '@/lib/orderStatus';
import { getHebrewDateString } from '@/lib/hebrewDate';

// הועבר מ-app/api/deliveries/route.js (2026-09-16, §C/§D במסמך docs/deliveries-feature-plan-2026-09-16.md)
// כדי שגם שליחת נתונים למשלוחן במייל (courier-email route) תוכל להשתמש באותה שאילתה
// בדיוק - בלי לשכפל את חישוב חלונות ההלוך/חזור. ההתנהגות של app/api/deliveries/route.js
// עצמו לא השתנתה, רק פוצלה לכאן. שרת-בלבד (מייבא prisma) - לוגיקת הקיבוץ/כותרות
// שגם הדפסה (client-side) צריכה יושבת ב-lib/deliveryCourier.js, בלי תלות בפריזמה.

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function dayRange(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * כל ההזמנות שנופלות לחלון משלוח הלוך/חזור עבור תאריך נתון (Date, חצות מקומית) -
 * אותו חוזה בדיוק כמו GET /api/deliveries?date=, כולל directions/chargeExists לכל שורה.
 */
export async function getDeliveriesForDate(requestedDate) {
  const allSettings = await getAllCachedSettings();
  const settingsRows = allSettings.filter(s => ['delivery_days_before', 'delivery_days_after'].includes(s.key));
  const settingsMap = settingsRows.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
  const parsedBefore = parseInt(settingsMap.delivery_days_before, 10);
  const parsedAfter = parseInt(settingsMap.delivery_days_after, 10);
  const daysBefore = isNaN(parsedBefore) ? 1 : parsedBefore;
  const daysAfter = isNaN(parsedAfter) ? 1 : parsedAfter;

  const outboundRange = dayRange(addDays(requestedDate, daysBefore));
  const outboundOneDayBeforeRange = daysBefore !== 1 ? dayRange(addDays(requestedDate, 1)) : null;
  const returnRange = dayRange(addDays(requestedDate, -daysAfter));

  const orders = await prisma.order.findMany({
    where: {
      isDeleted: false,
      isDelivery: true,
      OR: [
        { eventDate: { gte: outboundRange.start, lte: outboundRange.end } },
        ...(outboundOneDayBeforeRange ? [{ eventDate: { gte: outboundOneDayBeforeRange.start, lte: outboundOneDayBeforeRange.end } }] : []),
        { eventDate: { gte: returnRange.start, lte: returnRange.end } }
      ]
    },
    include: {
      customer: { select: { firstName: true, lastName: true, phone1: true, phone2: true, city: true, street: true, houseNum: true } },
      items: { where: { isDeleted: false }, select: { description: true } },
      obligations: { where: { isDeleted: false }, select: { description: true } }
    },
    orderBy: { eventDate: 'asc' }
  });

  const data = [];
  for (const order of orders) {
    if (calculateOrderStatus(order) === 'מחוק') continue;
    if (!order.eventDate) continue;

    const eventTime = new Date(order.eventDate).getTime();
    const effectiveOutboundRange = order.deliveryOneDayBefore ? (outboundOneDayBeforeRange || outboundRange) : outboundRange;
    const orderDirection = order.deliveryDirection || 'הלוך-חזור';
    const directions = [];
    if (orderDirection !== 'חזור' && eventTime >= effectiveOutboundRange.start.getTime() && eventTime <= effectiveOutboundRange.end.getTime()) directions.push('out');
    if (orderDirection !== 'הלוך' && eventTime >= returnRange.start.getTime() && eventTime <= returnRange.end.getTime()) directions.push('return');
    if (directions.length === 0) continue;

    const dressModelNames = [...new Set(order.items.map(i => i.description).filter(Boolean))];

    const street = order.deliveryAddress || [order.customer?.street, order.customer?.houseNum].filter(Boolean).join(' ');
    const city = order.deliveryCity || order.customer?.city || '';
    const address = street && city ? `${street}, ${city}` : (street || city || '');

    data.push({
      orderId: order.orderId,
      customerFirstName: order.customer?.firstName || '',
      customerLastName: order.customer?.lastName || '',
      customerName: `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || 'לא ידוע',
      customerPhone: order.customer?.phone1 || '',
      customerPhone2: order.customer?.phone2 || '',
      address,
      // עיר לבד (לא "רחוב, עיר" כמו address) - נדרש לפילוח משלוחים לפי עיר (§B,
      // docs/deliveries-feature-plan-2026-09-16.md), שם צריך למנות לפי עיר בלבד.
      city,
      eventDate: order.eventDate,
      eventDateHebrew: order.eventDateHebrew || getHebrewDateString(order.eventDate) || null,
      dressModelNames,
      directions,
      chargeExists: {
        out: order.obligations.some(o => o.description && o.description.includes('הלוך')),
        return: order.obligations.some(o => o.description && o.description.includes('חזור'))
      }
    });
  }

  return { daysBefore, daysAfter, data };
}
