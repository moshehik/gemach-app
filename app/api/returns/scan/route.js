import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';

export async function POST(request) {
  try {
    const { barcode, orderId } = await request.json();

    if (!barcode) {
      return NextResponse.json({ error: 'חסר ברקוד' }, { status: 400 });
    }

    let itemToReturn = null;

    if (orderId) {
      // Local return (within an order)
      itemToReturn = await prisma.orderItem.findFirst({
        where: {
          orderId: parseInt(orderId),
          barcode: barcode,
          isTaken: true,
          isReturned: false,
          isDeleted: false
        }
      });

      if (!itemToReturn) {
        return NextResponse.json({ error: 'בר קוד לא קיים בהזמנה או שכבר הוחזר' }, { status: 404 });
      }
    } else {
      // Global return
      itemToReturn = await prisma.orderItem.findFirst({
        where: {
          barcode: barcode,
          isTaken: true,
          isReturned: false,
          isDeleted: false
        }
      });

      if (!itemToReturn) {
        return NextResponse.json({ error: 'לא הצלחנו למצוא את ההזמנה' }, { status: 404 });
      }
    }

    // Mark as returned
    const updatedItem = await prisma.orderItem.update({
      where: { id: itemToReturn.id },
      data: {
        isReturned: true,
        returnedOk: true,
        returnDate: new Date()
      }
    });

    // Update dress item location
    if (updatedItem.dressItemId) {
      await prisma.dressItem.update({
        where: { id: updatedItem.dressItemId },
        data: { location: 'חנות' }
      });
    }

    await prisma.auditLog.create({
      data: {
        entityType: 'OrderItem',
        entityId: updatedItem.id,
        action: 'RETURN_RENTAL',
        changesJson: JSON.stringify({ isReturned: { from: false, to: true }, returnDate: { from: null, to: updatedItem.returnDate } })
      }
    });

    return NextResponse.json({ 
      success: true, 
      orderId: updatedItem.orderId,
      item: updatedItem 
    });
  } catch (error) {
    console.error('Error scanning return barcode:', error);
    return NextResponse.json({ error: 'שגיאה בהחזרת פריט' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { orderItemId } = await request.json();

    if (!orderItemId) {
      return NextResponse.json({ error: 'חסר קוד פריט' }, { status: 400 });
    }

    const item = await prisma.orderItem.update({
      where: { id: parseInt(orderItemId) },
      data: {
        isReturned: false,
        returnedOk: false,
        returnDate: null
      }
    });

    if (item.dressItemId) {
      await prisma.dressItem.update({
        where: { id: item.dressItemId },
        data: { location: 'מושכר' }
      });
    }

    // Log the cancellation
    await prisma.auditLog.create({
      data: {
        entityType: 'OrderItem',
        entityId: item.id,
        action: 'CANCEL_RETURN',
        changesJson: JSON.stringify({ isReturned: { from: true, to: false } }),
        employeeId: null
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error undoing return:', error);
    return NextResponse.json({ error: 'שגיאה בביטול החזרה' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({ error: 'חסר מספר הזמנה' }, { status: 400 });
    }

    const returnedItems = await prisma.orderItem.findMany({
      where: {
        orderId: parseInt(orderId),
        isReturned: true
      }
    });

    if (returnedItems.length === 0) {
      return NextResponse.json({ success: true });
    }

    // Undo returns
    await prisma.orderItem.updateMany({
      where: {
        orderId: parseInt(orderId),
        isReturned: true
      },
      data: {
        isReturned: false,
        returnedOk: false,
        returnDate: null
      }
    });

    // Update locations
    const dressItemIds = returnedItems.map(i => i.dressItemId).filter(id => id !== null);
    await prisma.dressItem.updateMany({
      where: { id: { in: dressItemIds } },
      data: { location: 'מושכר' }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling all returns:', error);
    return NextResponse.json({ error: 'שגיאה בביטול החזרות' }, { status: 500 });
  }
}
