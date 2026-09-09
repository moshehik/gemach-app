import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { getLateReturnInfo, LATE_RETURN_THRESHOLD_DAYS } from '@/lib/lateReturn';

export const dynamic = 'force-dynamic';

// משפחות שעדיין לא החזירו והאיחור עבר את הסף (אותה נוסחה בדיוק כמו בר ההחזרה המהיר
// ב-app/rentals/page.js וב-RentalReturnModal - ר' lib/lateReturn.js). המסנן ב-DB
// רחב-בכוונה (עוד יום מעבר לסף) כדי לכסות דילוג שישי-שבת בלי לסרוק את כל ההזמנות;
// הסינון המדויק (כולל הדילוג) קורה ב-JS דרך getLateReturnInfo על קבוצת המועמדים.
export async function GET() {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (LATE_RETURN_THRESHOLD_DAYS - 1));

    const candidates = await prisma.order.findMany({
      where: {
        isDeleted: false,
        items: { some: { isTaken: true, isReturned: false, isDeleted: false } },
        OR: [
          { toDate: { lte: cutoff } },
          { returnDate: { lte: cutoff } },
          { AND: [{ toDate: null }, { returnDate: null }, { eventDate: { lte: cutoff } }] },
        ],
      },
      select: {
        orderId: true,
        eventDate: true,
        toDate: true,
        returnDate: true,
        customer: { select: { firstName: true, lastName: true } },
      },
    });

    const orders = candidates
      .map((o) => ({ order: o, late: getLateReturnInfo(o) }))
      .filter((o) => o.late.isLate)
      .map((o) => ({
        orderId: o.order.orderId,
        customerName: `${o.order.customer?.firstName || ''} ${o.order.customer?.lastName || ''}`.trim() || 'לקוח ללא שם',
        daysLate: o.late.daysLate,
      }))
      .sort((a, b) => b.daysLate - a.daysLate);

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Error fetching overdue orders:', error);
    return NextResponse.json({ error: 'Failed to fetch overdue orders' }, { status: 500 });
  }
}
