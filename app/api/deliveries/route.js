import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { checkAuth } from '@/lib/auth';
import { calculateOrderStatus } from '@/lib/orderStatus';
import { getHebrewDateString } from '@/lib/hebrewDate';

export const dynamic = 'force-dynamic';

// 'YYYY-MM-DD' -> local midnight Date (avoids the UTC-parse day-shift you'd get
// from `new Date('YYYY-MM-DD')` in negative-offset timezones); falls back to
// today (server-local) when missing/malformed, per the route's contract.
function parseDateParam(dateParam) {
  if (dateParam) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateParam);
    if (match) {
      const [, y, m, d] = match;
      const parsed = new Date(Number(y), Number(m) - 1, Number(d));
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

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

// GET /api/deliveries?date=YYYY-MM-DD — orders whose event date puts them in the
// outbound ("משלוח הלוך") or return ("משלוח חזור") delivery window for the given
// day. Real-world direction: the dress must go OUT before the event and gets
// picked back up AFTER it, so:
//   outbound due date = Order.eventDate - delivery_days_before
//   return due date   = Order.eventDate + delivery_days_after
// i.e. an order is "due for outbound delivery" on `date` when
// eventDate = date + delivery_days_before, and "due for return" when
// eventDate = date - delivery_days_after.
export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { searchParams } = new URL(request.url);
    const requestedDate = parseDateParam(searchParams.get('date'));

    const allSettings = await getAllCachedSettings();
    const settingsRows = allSettings.filter(s => ['delivery_days_before', 'delivery_days_after'].includes(s.key));
    const settingsMap = settingsRows.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
    const parsedBefore = parseInt(settingsMap.delivery_days_before, 10);
    const parsedAfter = parseInt(settingsMap.delivery_days_after, 10);
    const daysBefore = isNaN(parsedBefore) ? 1 : parsedBefore;
    const daysAfter = isNaN(parsedAfter) ? 1 : parsedAfter;

    const outboundRange = dayRange(addDays(requestedDate, daysBefore));
    // 19 - הזמנה עם deliveryOneDayBefore (פר-הזמנה) יוצאת יום לפני האירוע במקום
    // delivery_days_before הרגיל - טווח נוסף כדי לתפוס גם הזמנות כאלה בשאילתה,
    // הסינון הסופי לפי דגל ההזמנה עצמו קורה בלולאה למטה.
    const outboundOneDayBeforeRange = daysBefore !== 1 ? dayRange(addDays(requestedDate, 1)) : null;
    const returnRange = dayRange(addDays(requestedDate, -daysAfter));

    const orders = await prisma.order.findMany({
      where: {
        isDeleted: false,
        // בלי הסינון הזה כל הזמנה שתאריך האירוע שלה נופל בחלון היה מופיע כאן, גם
        // הזמנות שלא ביקשו משלוח בכלל (רק כי מקרית התאריך שלהן חופף) - ר' דיווח
        // תקלה 226bda09, 2026-09-10.
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
      // Reuse the app's single source of truth for order status instead of
      // re-deriving "is this order still active" — a soft-deleted/cancelled
      // order ('מחוק') has no business showing up on a dispatch dashboard.
      if (calculateOrderStatus(order) === 'מחוק') continue;
      if (!order.eventDate) continue;

      const eventTime = new Date(order.eventDate).getTime();
      const effectiveOutboundRange = order.deliveryOneDayBefore ? (outboundOneDayBeforeRange || outboundRange) : outboundRange;
      const directions = [];
      if (eventTime >= effectiveOutboundRange.start.getTime() && eventTime <= effectiveOutboundRange.end.getTime()) directions.push('out');
      if (eventTime >= returnRange.start.getTime() && eventTime <= returnRange.end.getTime()) directions.push('return');
      if (directions.length === 0) continue;

      const dressModelNames = [...new Set(order.items.map(i => i.description).filter(Boolean))];

      // כתובת המשלוח בפועל: כתובת שונה שהוזנה בהזמנה (בקשה 15, delivery_allow_address_override)
      // גוברת על כתובת המגורים הרגילה של הלקוח - עיר המשלוח (deliveryCity, לחישוב מחיר) גוברת
      // באותו אופן על עיר הלקוח. אותו היגיון צירוף "רחוב, עיר" כמו ב-print/order/page.js.
      const street = order.deliveryAddress || [order.customer?.street, order.customer?.houseNum].filter(Boolean).join(' ');
      const city = order.deliveryCity || order.customer?.city || '';
      const address = street && city ? `${street}, ${city}` : (street || city || '');

      data.push({
        orderId: order.orderId,
        customerName: `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || 'לא ידוע',
        customerPhone: order.customer?.phone1 || '',
        customerPhone2: order.customer?.phone2 || '',
        address,
        eventDate: order.eventDate,
        eventDateHebrew: order.eventDateHebrew || getHebrewDateString(order.eventDate) || null,
        dressModelNames,
        directions,
        chargeExists: {
          out: order.obligations.some(o => o.description === 'משלוח הלוך'),
          return: order.obligations.some(o => o.description === 'משלוח חזור')
        }
      });
    }

    return NextResponse.json({
      date: `${requestedDate.getFullYear()}-${String(requestedDate.getMonth() + 1).padStart(2, '0')}-${String(requestedDate.getDate()).padStart(2, '0')}`,
      deliveryDaysBefore: daysBefore,
      deliveryDaysAfter: daysAfter,
      data
    });
  } catch (error) {
    console.error('GET /api/deliveries error:', error);
    return NextResponse.json({ error: 'שגיאה בטעינת נתוני משלוחים' }, { status: 500 });
  }
}