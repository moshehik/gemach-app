import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';

export async function GET(request, { params }) {
  try {
    const resolvedParams = await params;
    const itemId = parseInt(resolvedParams.itemId);
    
    if (isNaN(itemId)) {
      return NextResponse.json({ error: 'קוד פריט לא תקין' }, { status: 400 });
    }

    const item = await prisma.dressItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        entryDateToRepo: true,
      }
    });

    if (!item) {
      return NextResponse.json({ error: 'פריט לא נמצא' }, { status: 404 });
    }

    const rentals = await prisma.orderItem.findMany({
      where: { dressItemId: itemId },
      include: {
        order: {
          include: {
            customer: true
          }
        }
      },
      orderBy: {
        id: 'desc'
      }
    });

    const history = rentals.map(rental => ({
      orderId: rental.order?.orderId,
      customerName: rental.order?.customer ? `${rental.order.customer.firstName || ''} ${rental.order.customer.lastName || ''}`.trim() : 'לקוח לא ידוע',
      eventDate: rental.order?.eventDate,
      eventDateHebrew: rental.order?.eventDateHebrew,
      isReturned: rental.isReturned,
      returnedOk: rental.returnedOk,
      returnDate: rental.returnDate,
      takenDate: rental.takenDate
    }));

    return NextResponse.json({
      entryDateToRepo: item.entryDateToRepo,
      rentals: history
    });

  } catch (error) {
    console.error('Error fetching item history:', error);
    return NextResponse.json({ error: 'שגיאה בהבאת נתוני היסטוריה' }, { status: 500 });
  }
}
