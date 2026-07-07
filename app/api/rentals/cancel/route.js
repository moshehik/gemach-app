import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';

export async function PUT(request) {
  try {
    const { orderItemId } = await request.json();

    if (!orderItemId) {
      return NextResponse.json({ error: 'חסר קוד פריט' }, { status: 400 });
    }

    const item = await prisma.orderItem.findUnique({
      where: { id: parseInt(orderItemId) },
      include: { order: true }
    });

    if (!item) {
      return NextResponse.json({ error: 'פריט לא נמצא' }, { status: 404 });
    }

    const updatedItem = await prisma.orderItem.update({
      where: { id: parseInt(orderItemId) },
      data: {
        isTaken: false,
        takenDate: null,
        barcode: null
      }
    });

    // Log the cancellation
    await prisma.auditLog.create({
      data: {
        entityType: 'OrderItem',
        entityId: item.id,
        action: 'CANCEL_RENTAL',
        changesJson: JSON.stringify({ isTaken: { from: true, to: false }, barcode: { from: item.barcode, to: null } }),
        employeeId: null
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling rental:', error);
    return NextResponse.json({ error: 'שגיאה בביטול לקיחה' }, { status: 500 });
  }
}
