import { NextResponse } from 'next/server';
import prisma, { getActingEmployeeId } from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { getIsraelDayRange } from '@/lib/hebrewDate';

export async function POST(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const body = await request.json();
    const { orderItemId, date } = body;

    if (orderItemId) {
      // Mark a single alteration as done
      const updated = await prisma.orderItem.update({
        where: { id: orderItemId },
        data: { alterationDone: true }
      });
      return NextResponse.json({ success: true, updated });
    }

    if (date) {
      // Mark all alterations for a specific date as done.
      // `date` is a plain "YYYY-MM-DD" string picked in Israel-local terms; the day
      // window must be computed against the Israel/Jerusalem calendar day rather than
      // via setHours() (which uses the SERVER's local timezone and can silently shift
      // the window by a day - see the getIsraelDayRange comment in lib/hebrewDate.js).
      const { start: startOfDay, end: endOfDay } = getIsraelDayRange(date);

      const where = {
        isDeleted: false,
        alterationDone: false,
        order: {
          isDeleted: false,
          eventDate: {
            gte: startOfDay,
            lte: endOfDay
          }
        },
        OR: [
          { neckAlteration: { gt: 0 } },
          { lengthAlteration: { not: null, not: "" } },
          { sleeveAlteration: { gt: 0 } }
        ]
      };

      // updateMany has no per-row result for the audit extension to log against, so the
      // affected items are collected first and each gets its own history line - otherwise a
      // whole day's worth of alterations could be marked done with no trace of who did it or
      // which items were included.
      const itemsToMark = await prisma.orderItem.findMany({ where, select: { id: true, orderId: true } });

      if (itemsToMark.length === 0) {
        return NextResponse.json({ success: true, count: 0 });
      }

      const markedBy = await getActingEmployeeId();
      const updated = await prisma.orderItem.updateMany({ where, data: { alterationDone: true } });

      // eslint-disable-next-line no-restricted-syntax -- updateMany אינו מייצר שורות יומן, ר' ההסבר למעלה
      await prisma.auditLog.createMany({
        data: itemsToMark.map(item => ({
          entityType: 'OrderItem',
          entityId: String(item.id),
          action: 'ALTERATION_DONE',
          changesJson: JSON.stringify({
            alterationDone: { from: false, to: true },
            orderId: item.orderId,
            note: `סומן כהושלם במסך "השלמת תיקונים לפי תאריך" עבור אירועי ${date}`
          }),
          employeeId: markedBy
        }))
      });

      return NextResponse.json({ success: true, count: updated.count });
    }

    return NextResponse.json({ error: 'Missing orderItemId or date' }, { status: 400 });

  } catch (error) {
    console.error('Error marking alterations as done:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
