import { NextResponse } from 'next/server';
import prisma, { getActingEmployeeId } from '../../../lib/prisma';
import { checkAuth } from '@/lib/auth';
import { autoMarkPrepForOrder } from '@/lib/schedule/autoPrepMark';
import { autoMarkAlterationsForItems } from '@/lib/schedule/autoAlterationDone';
import { runAfterResponse } from '@/lib/schedule/afterResponse';

export async function POST(request) {
  // העובד נקרא לפני כל await (ר' rentals/toggle ו-lib/schedule/afterResponse.js)
  const actorPromise = getActingEmployeeId();
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: 'חסר מספר הזמנה' }, { status: 400 });
    }

    // 1. Find all pending items (barcode set but not yet taken)
    const pendingItems = await prisma.orderItem.findMany({
      where: {
        orderId: parseInt(orderId),
        barcode: { not: null },
        isTaken: false,
        isDeleted: false
      }
    });

    if (pendingItems.length === 0) {
      return NextResponse.json({ message: 'אין פריטים חדשים לאישור' }, { status: 200 });
    }

    // 2 & 3. Update them all in a transaction
    const updateItems = prisma.orderItem.updateMany({
      where: {
        orderId: parseInt(orderId),
        barcode: { not: null },
        isTaken: false,
        isDeleted: false
      },
      data: {
        isTaken: true,
        takenDate: new Date()
      }
    });

    // Update dress item locations
    const dressItemIds = pendingItems.map(item => item.dressItemId).filter(id => id !== null);
    const updateLocations = prisma.dressItem.updateMany({
      where: { id: { in: dressItemIds } },
      data: { location: 'מושכר' }
    });

    const confirmedBy = await actorPromise;
    const auditLogs = pendingItems.map(item => ({
      entityType: 'OrderItem',
      entityId: item.id,
      action: 'CONFIRM_RENTAL',
      changesJson: JSON.stringify({ isTaken: { from: false, to: true }, takenDate: { from: null, to: new Date() } }),
      employeeId: confirmedBy
    }));
    
    // הפריטים מאושרים ב-updateMany שאינו עובר דרך תוסף היומן,
    // ולכן זהו הרישום היחיד של אישור ההשכרה ולא שורה כפולה.
    // eslint-disable-next-line no-restricted-syntax -- updateMany אינו מייצר שורות יומן
    const createLogs = prisma.auditLog.createMany({ data: auditLogs });

    await prisma.$transaction([updateItems, updateLocations, createLogs]);

    // אחרי הטרנזקציה, במקביל ובלי להאט את התשובה (after(); נכשל בשקט): הכנה אוטומטית + תיקונים של הפריטים שאושרו עכשיו בלבד (לא כל פריטי ההזמנה): בוצע (משוער)
    const confirmedItemIds = pendingItems.map((item) => item.id);
    await runAfterResponse([
      () => autoMarkPrepForOrder(parseInt(orderId), { userId: confirmedBy }),
      () => autoMarkAlterationsForItems(confirmedItemIds),
    ], { actorId: confirmedBy });

    return NextResponse.json({ success: true, count: pendingItems.length });
  } catch (error) {
    console.error('Error confirming rentals:', error);
    return NextResponse.json({ error: 'שגיאה באישור השכרות' }, { status: 500 });
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

    // Clear barcodes from items that were scanned but not yet confirmed
    const scannedItems = await prisma.orderItem.findMany({
      where: {
        orderId: parseInt(orderId),
        barcode: { not: null },
        isTaken: false,
        isDeleted: false
      },
      select: { id: true, barcode: true }
    });

    if (scannedItems.length === 0) {
      return NextResponse.json({ success: true });
    }

    await prisma.orderItem.updateMany({
      where: { id: { in: scannedItems.map(i => i.id) } },
      data: { barcode: null }
    });

    // updateMany עוקף את תוסף היומן — לכן ביטול הסריקות נרשם כאן במפורש, פריט אחר פריט.
    const cancelledBy = await getActingEmployeeId();
    // eslint-disable-next-line no-restricted-syntax -- ראה ההסבר למעלה: אין שורה אוטומטית ל-updateMany
    await prisma.auditLog.createMany({
      data: scannedItems.map(item => ({
        entityType: 'OrderItem',
        entityId: item.id,
        action: 'CANCEL_SCAN',
        changesJson: JSON.stringify({
          barcode: { from: item.barcode, to: null },
          note: 'ביטול סריקות שטרם אושרו'
        }),
        employeeId: cancelledBy
      }))
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling rentals:', error);
    return NextResponse.json({ error: 'שגיאה בביטול השכרות' }, { status: 500 });
  }
}
