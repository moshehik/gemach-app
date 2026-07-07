import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';

export async function POST(request) {
  try {
    const { orderId, barcode, itemIdToForce } = await request.json();

    if (!orderId || !barcode) {
      return NextResponse.json({ error: 'חסרים נתונים (מספר הזמנה או ברקוד)' }, { status: 400 });
    }

    // 1. Validate order
    const order = await prisma.order.findUnique({
      where: { orderId: parseInt(orderId) },
      include: { items: true }
    });

    if (!order) {
      return NextResponse.json({ error: 'ההזמנה לא נמצאה' }, { status: 404 });
    }
    
    if (order.isDeleted) {
      return NextResponse.json({ error: 'ההזמנה בוטלה, לא ניתן לבצע השכרות' }, { status: 400 });
    }

    // 2. Find the DressItem by barcode
    const dressItem = await prisma.dressItem.findFirst({
      where: { dressBarcode: barcode },
      include: { dress: true }
    });

    if (!dressItem) {
      return NextResponse.json({ error: 'ברקוד לא קיים במאגר השמלות' }, { status: 404 });
    }

    // Extract size and prefix from barcode as per Access logic
    // barcode = prefix + size(2 digits) + serial(1 or more digits) -> wait, Access logic:
    // Mid(Me.בר_קוד, 1, Len(Me.בר_קוד) - 4) = Prefix
    // Mid(Me.בר_קוד, Len(Me.בר_קוד) - 3, 2) = Size
    // In JS:
    const prefixStr = barcode.substring(0, barcode.length - 4);
    const sizeStr = barcode.substring(barcode.length - 4, barcode.length - 2);
    
    const barcodePrefix = parseInt(prefixStr);
    
    // 3. Check if already in THIS order
    const existingInOrder = await prisma.orderItem.findFirst({
      where: {
        orderId: parseInt(orderId),
        barcode: barcode,
        isDeleted: false
      }
    });

    if (existingInOrder) {
      return NextResponse.json({ error: 'הברקוד כבר קיים בהזמנה זו' }, { status: 400 });
    }

    // 4. Check if currently rented and not returned
    const unreturnedItem = await prisma.orderItem.findFirst({
      where: {
        barcode: barcode,
        isTaken: true,
        isReturned: false,
        isDeleted: false
      },
      include: { order: true }
    });

    if (unreturnedItem) {
      return NextResponse.json({ 
        warning: 'השמלה שבחרת עוד לא הוחזרה מהשכרה קודמת', 
        unreturned: true, 
        unreturnedItemId: unreturnedItem.id,
        unreturnedOrderId: unreturnedItem.orderId 
      }, { status: 400 });
    }

    // 5. Find matching OrderItem(s) in this order
    // In Access: orderId, barcodePrefix=prefix, size=size, barcode IS NULL, מחוק=0
    // Wait, size in OrderItem is currently sizeText. But we need to match by size numeric or sizeText.
    // Let's match by dressItemId prefix, or by item size if we have it.
    // Actually, order items have dressItem attached. We can filter by dressItem.barcodePrefix and dressItem.sizeText.
    // Let's find order items in this order that match prefix and size.
    // sizeText in DressItem might be "38", "40", etc. which matches sizeStr.
    
    // Convert sizeStr to number to drop leading zero if any, then to string
    const sizeVal = parseInt(sizeStr).toString(); 

    const matchingItems = await prisma.orderItem.findMany({
      where: {
        orderId: parseInt(orderId),
        isDeleted: false,
        barcode: null,
        // Match prefix and size
        dressItem: {
          barcodePrefix: barcodePrefix,
          sizeText: {
            startsWith: sizeVal // e.g., "38" matches "38" or "38 ארוך" (simplification, but typically exact)
          }
        }
      },
      include: {
        dressItem: {
          include: { dress: true }
        }
      }
    });

    // 6. No matching items
    if (matchingItems.length === 0) {
      return NextResponse.json({ error: 'הפריט לא קיים בהזמנה' }, { status: 404 });
    }

    // 7. Handle multiple matches
    if (matchingItems.length > 1 && !itemIdToForce) {
      // Check if they have different alterations
      const isDuplicate = matchingItems.some(item => 
        item.neckAlteration !== matchingItems[0].neckAlteration ||
        item.lengthAlteration !== matchingItems[0].lengthAlteration ||
        item.sleeveAlteration !== matchingItems[0].sleeveAlteration
      );

      if (isDuplicate) {
        return NextResponse.json({
          duplicateAlterations: true,
          options: matchingItems
        });
      }
    }

    // 8. Single match (or multiple identical ones, just take the first, or the forced one)
    let itemToUpdate = matchingItems[0];
    if (itemIdToForce) {
      const forcedItem = matchingItems.find(i => i.id === itemIdToForce);
      if (forcedItem) itemToUpdate = forcedItem;
    }

    const updatedItem = await prisma.orderItem.update({
      where: { id: itemToUpdate.id },
      data: {
        barcode: barcode,
        isTaken: false // Will be set to true on confirm
      },
      include: {
        dressItem: {
          include: { dress: true }
        }
      }
    });

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error('Error scanning rental barcode:', error);
    return NextResponse.json({ error: 'שגיאה בסריקת ברקוד' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { unreturnedItemId } = await request.json();

    if (!unreturnedItemId) {
      return NextResponse.json({ error: 'חסר קוד פריט' }, { status: 400 });
    }

    const item = await prisma.orderItem.update({
      where: { id: parseInt(unreturnedItemId) },
      data: {
        isReturned: true,
        returnedOk: true,
        returnDate: new Date()
      }
    });

    // We should also update DressItem location to 'חנות'
    if (item.dressItemId) {
        await prisma.dressItem.update({
            where: { id: item.dressItemId },
            data: { location: 'חנות' }
        });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error forcing return:', error);
    return NextResponse.json({ error: 'שגיאה בעדכון החזרה' }, { status: 500 });
  }
}
