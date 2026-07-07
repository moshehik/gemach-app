import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export async function POST(request) {
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
      // Mark all alterations for a specific date as done
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const updated = await prisma.orderItem.updateMany({
        where: {
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
        },
        data: {
          alterationDone: true
        }
      });
      return NextResponse.json({ success: true, count: updated.count });
    }

    return NextResponse.json({ error: 'Missing orderItemId or date' }, { status: 400 });

  } catch (error) {
    console.error('Error marking alterations as done:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
