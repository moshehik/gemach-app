import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// דיווח 7dad77c4 (נווה יעקב, 2026-09-14): "חלונית של מושכר שצריך לחזור - האירוע אתמול
// או לפני אתמול". שונה במכוון מ-/api/orders/overdue (lib/lateReturn.js, סף 7 ימים
// ממועד ההחזרה הצפוי toDate/returnDate) - כאן הבקשה המפורשת היא לפי תאריך האירוע עצמו,
// בלי סף של כמה ימים, כדי לתפוס הזמנות שכבר "צריכות" להיות בחזרה יום אחרי האירוע.
export async function GET() {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);

    const candidates = await prisma.order.findMany({
      where: {
        isDeleted: false,
        eventDate: { lte: yesterday, not: null },
        items: { some: { isTaken: true, isReturned: false, isDeleted: false } },
      },
      select: {
        orderId: true,
        eventDate: true,
        customer: { select: { firstName: true, lastName: true } },
      },
      orderBy: { eventDate: 'asc' },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const orders = candidates.map((o) => {
      const eventDay = new Date(o.eventDate);
      eventDay.setHours(0, 0, 0, 0);
      const daysSinceEvent = Math.floor((today - eventDay) / (1000 * 60 * 60 * 24));
      return {
        orderId: o.orderId,
        customerName: `${o.customer?.firstName || ''} ${o.customer?.lastName || ''}`.trim() || 'לקוח ללא שם',
        daysSinceEvent,
      };
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Error fetching rented-past-event orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}
