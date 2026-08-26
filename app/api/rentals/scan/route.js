import { NextResponse } from 'next/server';
import { getAllCachedSettings, getCachedSetting } from '@/lib/settingsCache';
import prisma from '../../../lib/prisma';
import { checkAuth } from '@/lib/auth';
import { verifySecret } from '@/lib/passwordAuth';

export async function POST(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { orderId, barcode, itemIdToForce, overridePin, overrideEmployeeId } = await request.json();

    if (!orderId || !barcode) {
      return NextResponse.json({ error: 'חסרים נתונים (מספר הזמנה או ברקוד)' }, { status: 400 });
    }

    // 1+2. Validate order and find the DressItem by barcode — three independent lookups,
    // fetched in parallel (this is the hot path of every barcode scan). The validation
    // checks below run in the exact same order as before, so error precedence is unchanged.
    const [order, dressItem, warehouseSetting] = await Promise.all([
      prisma.order.findUnique({
        where: { orderId: parseInt(orderId) },
        include: { items: true }
      }),
      prisma.dressItem.findFirst({
        where: { dressBarcode: barcode },
        include: { dress: true }
      }),
      getCachedSetting('inventory_include_warehouse')
    ]);

    if (!order) {
      return NextResponse.json({ error: 'ההזמנה לא נמצאה' }, { status: 404 });
    }

    if (order.isDeleted) {
      return NextResponse.json({ error: 'ההזמנה בוטלה, לא ניתן לבצע השכרות' }, { status: 400 });
    }

    if (!dressItem) {
      return NextResponse.json({ error: 'ברקוד לא קיים במאגר השמלות' }, { status: 404 });
    }

    if (dressItem.isDeleted || dressItem.notInUse) {
      return NextResponse.json({ error: `הפריט עם ברקוד ${barcode} אינו בשימוש או שבוטל במאגר` }, { status: 400 });
    }

    if (dressItem.inRepair) {
      return NextResponse.json({ error: `הפריט עם ברקוד ${barcode} נמצא בתיקון ולא ניתן להשכרה` }, { status: 400 });
    }

    const includeWarehouse = warehouseSetting && warehouseSetting.value === 'true';

    // חסימת רזרבה/מחסן ניתנת לעקיפה באישור מנהל - יש מצבים בפועל שבהם שמלה
    // שמסומנת רזרבה/מחסן כן ניתנת להוצאה, וזו החלטה תפעולית של מנהל. האימות
    // נעשה כאן בשרת (לא סומך על דגל overrideReserved מהלקוח) - הלקוח שולח את
    // הסיסמה שהמנהל הקליד (overridePin/overrideEmployeeId) ואנו מוודאים אותה
    // מול ה-DB בדיוק כמו /api/auth/verify-pin, כדי שעובד רגיל לא יוכל לשלוח
    // בקשה ישירה עם overrideReserved=true ולעקוף את החסימה בלי אישור מנהל אמיתי.
    if (!includeWarehouse && dressItem.location) {
      const locLower = dressItem.location.toLowerCase();
      const isReserved = (
        locLower.includes('מחסן') ||
        locLower.includes('רזרבה') ||
        locLower.includes('warehouse') ||
        locLower.includes('reserve')
      );
      if (isReserved) {
        let overrideVerified = false;
        if (overridePin) {
          const candidates = await prisma.employee.findMany({
            where: { isActive: true, ...(overrideEmployeeId ? { id: overrideEmployeeId } : {}) }
          });
          for (const candidate of candidates) {
            if ((candidate.roleId === 1 || candidate.roleId === 2) && await verifySecret(overridePin, candidate.password)) {
              overrideVerified = true;
              break;
            }
          }
        }
        if (!overrideVerified) {
          return NextResponse.json({
            error: `הפריט עם ברקוד ${barcode} נמצא ב"${dressItem.location}" (רזרבה/מחסן) ולא ניתן להשכרה`,
            reservedLocation: true
          }, { status: 400 });
        }
      }
    }

    // Extract size and prefix from barcode as per Access logic
    const prefixStr = barcode.substring(0, barcode.length - 4);
    const sizeStr = barcode.substring(barcode.length - 4, barcode.length - 2);
    
    const barcodePrefix = parseInt(prefixStr);
    
    // 3+4+5. Three more independent read-only lookups (same-order check, unreturned-rental
    // check, and the candidate items of this order) — fetched in parallel; the checks below
    // still run in the original order so the returned error stays the same one as before.
    const [existingInOrder, unreturnedItem, potentialItems] = await Promise.all([
      // 3. Check if already in THIS order
      prisma.orderItem.findFirst({
        where: {
          orderId: parseInt(orderId),
          barcode: barcode,
          isDeleted: false
        }
      }),
      // 4. Check if currently rented and not returned
      prisma.orderItem.findFirst({
        where: {
          barcode: barcode,
          isTaken: true,
          isReturned: false,
          isDeleted: false
        },
        include: { order: true }
      }),
      // 5. Candidate OrderItems in this order (unassigned barcode slots)
      prisma.orderItem.findMany({
        where: {
          orderId: parseInt(orderId),
          isDeleted: false,
          barcode: null
        },
        include: {
          dressItem: {
            include: { dress: true }
          }
        }
      })
    ]);

    if (existingInOrder) {
      return NextResponse.json({ error: 'הברקוד כבר קיים בהזמנה זו' }, { status: 400 });
    }

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
    
    const sizeVal = parseInt(sizeStr);

    const matchingItems = potentialItems.filter(item => {
      const pfx = item.dressItem?.dress?.barcodePrefix || item.dressItem?.barcodePrefix || item.barcodePrefix;
      const sz = item.dressItem?.sizeText || item.sizeText || '';
      return pfx === barcodePrefix && parseInt(sz) === sizeVal;
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
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { unreturnedItemId } = await request.json();

    if (!unreturnedItemId) {
      return NextResponse.json({ error: 'חסר קוד פריט' }, { status: 400 });
    }

    const idStr = String(unreturnedItemId);
    const item = await prisma.orderItem.update({
      where: { id: idStr },
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