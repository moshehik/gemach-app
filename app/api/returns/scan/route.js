import { NextResponse } from 'next/server';
import prisma, { auditAs, getActingEmployeeId } from '../../../lib/prisma';
import { checkAuth } from '@/lib/auth';
import { checkEarlyReturn } from '@/lib/earlyReturnGuard';
import { getHebrewDateString } from '@/lib/hebrewDate';

// ברקוד תקין הוא ספרות/אותיות בלבד. הקלדה/הדבקה מתוך מסך RTL יכולה להכניס תווים בלתי נראים
// (סימוני כיווניות U+200E/U+200F, רווח ברוחב אפס...) ש-s לא מסיר - והחיפוש המדויק נכשל על ברקוד
// שנראה זהה. מנקים כאן בשרת (בנוסף לניקוי בלקוח) כדי שזה לא ישתנה לפי הלקוח.
function normalizeScanBarcode(raw) {
  return String(raw ?? '').replace(/[^0-9A-Za-z]/g, '');
}

// "לא נמצא פריט מושכר בברקוד" - מסבירים למה (כבר הוחזר / טרם נלקח / ברקוד לא מוכר) ורושמים ללוג של
// השרת את הברקוד כפי שהתקבל (כולל קודי התווים), כדי שכישלון עתידי בהחזרה מהירה יהיה ניתן לאבחון
// בלי לנחש (דיווח df035847, נווה יעקב 2026-10-04).
async function barcodeNotRentedResponse(rawBarcode, barcode) {
  let reason = 'unknown';
  let error = 'לא נמצא פריט עם הברקוד הזה';
  let orderId = null;
  try {
    const returned = await prisma.orderItem.findFirst({
      where: { barcode, isTaken: true, isReturned: true, isDeleted: false },
      orderBy: [{ returnDate: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
      select: { orderId: true, returnDate: true }
    });
    if (returned) {
      reason = 'already_returned';
      orderId = returned.orderId;
      const when = returned.returnDate ? ` ב-${getHebrewDateString(returned.returnDate)}` : '';
      error = `השמלה הזו כבר סומנה כמוחזרת בהזמנה ${returned.orderId}${when}`;
    } else {
      const notTaken = await prisma.orderItem.findFirst({
        where: { barcode, isTaken: false, isDeleted: false },
        orderBy: { updatedAt: 'desc' },
        select: { orderId: true }
      });
      if (notTaken) {
        reason = 'not_taken';
        orderId = notTaken.orderId;
        error = `הברקוד הזה קיים בהזמנה ${notTaken.orderId} אבל טרם סומן כנלקח`;
      }
    }
  } catch (diagErr) {
    console.error('returns/scan diagnostic lookup failed:', diagErr);
  }
  console.error('returns/scan: no rented item for barcode', JSON.stringify({
    reason, orderId, barcode,
    rawCodePoints: [...String(rawBarcode ?? '')].map((c) => c.codePointAt(0).toString(16)).join(' ')
  }));
  return NextResponse.json({ error, reason, ...(orderId ? { orderId } : {}) }, { status: 404 });
}

// חיפוש read-only של הזמנה/פריט לפי ברקוד, בלי לבצע החזרה בפועל - משמש את בר
// ההחזרה המהיר ב-app/rentals/page.js כדי לבדוק איחור (ר' lib/lateReturn.js)
// לפני שמחליטים אם להשלים את ההחזרה המהירה או לפתוח את כרטיס ההזמנה המלא.
export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { searchParams } = new URL(request.url);
    const barcode = normalizeScanBarcode(searchParams.get('barcode'));
    if (!barcode) {
      return NextResponse.json({ error: 'חסר ברקוד' }, { status: 400 });
    }

    const item = await prisma.orderItem.findFirst({
      where: { barcode, isTaken: true, isReturned: false, isDeleted: false },
      include: {
        order: {
          select: { orderId: true, eventDate: true, toDate: true, returnDate: true }
        }
      }
    });

    if (!item || !item.order) {
      return NextResponse.json({ error: 'לא הצלחנו למצוא את ההזמנה' }, { status: 404 });
    }

    return NextResponse.json({ item, order: item.order });
  } catch (error) {
    console.error('Error looking up return barcode:', error);
    return NextResponse.json({ error: 'שגיאה בחיפוש ברקוד' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const body = await request.json();
    const { orderId, overridePin, overrideEmployeeId } = body;
    const barcode = normalizeScanBarcode(body.barcode);

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
        },
        include: { order: { select: { orderId: true, eventDate: true } } }
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
        },
        include: { order: { select: { orderId: true, eventDate: true } } }
      });

      if (!itemToReturn) {
        return barcodeNotRentedResponse(body.barcode, barcode);
      }
    }

    if (itemToReturn.order) {
      const guard = await checkEarlyReturn(itemToReturn.order, { overridePin, overrideEmployeeId });
      if (guard.response) return guard.response;
    }

    // Mark as returned
    const updatedItem = await prisma.orderItem.update(auditAs(
      'RETURN_RENTAL',
      {
        where: { id: itemToReturn.id },
        data: {
          isReturned: true,
          returnedOk: true,
          returnDate: new Date()
        }
      },
      {
        isReturned: { from: itemToReturn.isReturned, to: true },
        returnedOk: { from: itemToReturn.returnedOk, to: true },
        returnDate: { from: itemToReturn.returnDate, to: new Date() }
      }
    ));

    // Update dress item location
    if (updatedItem.dressItemId) {
      await prisma.dressItem.update({
        where: { id: updatedItem.dressItemId },
        data: { location: 'חנות' }
      });
    }

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
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { orderItemId } = await request.json();

    if (!orderItemId) {
      return NextResponse.json({ error: 'חסר קוד פריט' }, { status: 400 });
    }

    const before = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      select: { isReturned: true, returnedOk: true, returnDate: true }
    });
    if (!before) {
      return NextResponse.json({ error: 'פריט לא נמצא' }, { status: 404 });
    }

    const item = await prisma.orderItem.update(auditAs(
      'CANCEL_RETURN',
      {
        where: { id: orderItemId },
        data: {
          isReturned: false,
          returnedOk: false,
          returnDate: null
        }
      },
      {
        isReturned: { from: before.isReturned, to: false },
        returnedOk: { from: before.returnedOk, to: false },
        returnDate: { from: before.returnDate, to: null }
      }
    ));

    if (item.dressItemId) {
      await prisma.dressItem.update({
        where: { id: item.dressItemId },
        data: { location: 'מושכר' }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error undoing return:', error);
    return NextResponse.json({ error: 'שגיאה בביטול החזרה' }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
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

    // updateMany לא עובר דרך תוסף היומן (הוא מעדכן שורות רבות בשאילתה אחת ואין לו תוצאה
    // לכל שורה), ולכן ביטול גורף של החזרות לא הותיר שום עקבות בהיסטוריית הפריטים.
    // הרישום נעשה כאן במפורש — שורה לכל פריט שבוטלה עבורו ההחזרה.
    const cancelledBy = await getActingEmployeeId();
    // eslint-disable-next-line no-restricted-syntax -- ראה ההסבר למעלה: אין שורה אוטומטית ל-updateMany
    await prisma.auditLog.createMany({
      data: returnedItems.map(item => ({
        entityType: 'OrderItem',
        entityId: item.id,
        action: 'CANCEL_RETURN',
        changesJson: JSON.stringify({
          isReturned: { from: true, to: false },
          returnedOk: { from: item.returnedOk, to: false },
          returnDate: { from: item.returnDate, to: null },
          note: 'ביטול כל ההחזרות בהזמנה'
        }),
        employeeId: cancelledBy
      }))
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
