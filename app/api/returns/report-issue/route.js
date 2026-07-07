import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';

export async function POST(request) {
  try {
    const { orderItemId, issueType } = await request.json(); // issueType: 'not-returned' | 'returned-bad'

    if (!orderItemId || !issueType) {
      return NextResponse.json({ error: 'חסרים נתונים' }, { status: 400 });
    }

    const item = await prisma.orderItem.findUnique({
      where: { id: parseInt(orderItemId) },
      include: { order: { include: { customer: true } } }
    });

    if (!item) {
      return NextResponse.json({ error: 'פריט לא נמצא' }, { status: 404 });
    }

    let notePrefix = '';
    const dateStr = new Date().toLocaleDateString('he-IL');
    
    if (issueType === 'not-returned') {
      notePrefix = `[${dateStr}] אוטומטי: שמלה ${item.description || item.barcode} (הזמנה ${item.order?.orderId}) לא הוחזרה.`;
      // Don't change isReturned/returnedOk, it's already not returned. Just add the note.
    } else if (issueType === 'returned-bad') {
      notePrefix = `[${dateStr}] אוטומטי: שמלה ${item.description || item.barcode} (הזמנה ${item.order?.orderId}) חזרה לא תקינה.`;
      
      await prisma.orderItem.update({
        where: { id: parseInt(orderItemId) },
        data: { returnedOk: false }
      });
    }

    if (item.order?.customerId) {
      const customer = item.order.customer;
      const currentNotes = customer.notes ? customer.notes + '\n' : '';
      await prisma.customer.update({
        where: { id: customer.id },
        data: { notes: currentNotes + notePrefix }
      });

      // Log the note addition
      await prisma.auditLog.create({
        data: {
          entityType: 'Customer',
          entityId: customer.id,
          action: 'ADD_AUTO_NOTE',
          changesJson: JSON.stringify({ issueType, orderItemId }),
          employeeId: null
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reporting issue:', error);
    return NextResponse.json({ error: 'שגיאה בדיווח' }, { status: 500 });
  }
}
