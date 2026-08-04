import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';

/**
 * היסטוריית ההשכרות של דגם שלם — כל ההשכרות של כל הפריטים הפיזיים שלו.
 * (המקבילה ברמת הפריט הבודד היא /api/dresses/items/[itemId]/history).
 */
export async function GET(request, { params }) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;

    if (!id) {
      return NextResponse.json({ error: 'קוד דגם חסר' }, { status: 400 });
    }

    const orderItems = await prisma.orderItem.findMany({
      where: { dressItem: { dressModelId: id } },
      include: {
        dressItem: {
          select: { sizeText: true, serialNumber: true, dressBarcode: true }
        },
        order: {
          include: { customer: true }
        }
      },
      orderBy: { id: 'desc' }
    });

    const now = new Date();
    const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    const rentals = orderItems.map(oi => ({
      orderId: oi.order?.orderId,
      customerName: oi.order?.customer
        ? `${oi.order.customer.firstName || ''} ${oi.order.customer.lastName || ''}`.trim()
        : 'לקוח לא ידוע',
      sizeText: oi.dressItem?.sizeText || null,
      serialNumber: oi.dressItem?.serialNumber ?? null,
      dressBarcode: oi.dressItem?.dressBarcode || null,
      eventDate: oi.order?.eventDate,
      eventDateHebrew: oi.order?.eventDateHebrew,
      isTaken: oi.isTaken,
      isReturned: oi.isReturned,
      returnedOk: oi.returnedOk,
      takenDate: oi.takenDate,
      returnDate: oi.returnDate
    }));

    const stats = {
      total: rentals.length,
      lastYear: rentals.filter(r => r.eventDate && new Date(r.eventDate) >= yearAgo).length,
      // "מושכר כרגע" = נלקח וטרם הוחזר; "ממתין להחזרה" = כנ"ל וגם תאריך האירוע כבר עבר
      outNow: rentals.filter(r => r.isTaken && !r.isReturned).length,
      overdue: rentals.filter(r => r.isTaken && !r.isReturned && r.eventDate && new Date(r.eventDate) < now).length
    };

    return NextResponse.json({ rentals, stats });
  } catch (error) {
    console.error('Error fetching dress rentals:', error);
    return NextResponse.json({ error: 'שגיאה בשליפת השכרות הדגם' }, { status: 500 });
  }
}
