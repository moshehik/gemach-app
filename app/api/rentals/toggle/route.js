import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';

export async function POST(request) {
  try {
    const { itemId, action, barcode } = await request.json();

    if (!itemId || !action) {
      return NextResponse.json({ error: 'חסרים נתונים' }, { status: 400 });
    }

    let updateData = {};
    if (action === 'rent') {
      updateData = { isTaken: true, takenDate: new Date() };
      if (barcode) updateData.barcode = barcode;
    } else if (action === 'return') {
      updateData = { isReturned: true, returnDate: new Date() };
    } else if (action === 'undoRent') {
      updateData = { isTaken: false, takenDate: null };
    } else if (action === 'undoReturn') {
      updateData = { isReturned: false, returnDate: null };
    }

    const updatedItem = await prisma.orderItem.update({
      where: { id: String(itemId) },
      data: updateData
    });

    return NextResponse.json({ success: true, item: updatedItem });
  } catch (error) {
    console.error('Error toggling rental:', error);
    return NextResponse.json({ error: 'שגיאה בעדכון הסטטוס' }, { status: 500 });
  }
}
