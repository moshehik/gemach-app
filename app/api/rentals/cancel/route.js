import { NextResponse } from 'next/server';
import prisma, { auditAs } from '../../../lib/prisma';
import { checkAuth } from '@/lib/auth';

export async function PUT(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { orderItemId } = await request.json();

    if (!orderItemId) {
      return NextResponse.json({ error: 'חסר קוד פריט' }, { status: 400 });
    }

    const item = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: true }
    });

    if (!item) {
      return NextResponse.json({ error: 'פריט לא נמצא' }, { status: 404 });
    }

    // רישום היחיד של הביטול נעשה דרך auditAs: שורה אחת בשם 'ביטול השכרה',
    // עם מזהה העובד המבצע (הרישום הידני שהיה כאן קודם נשמר תמיד עם employeeId ריק,
    // ובנוסף נוצרה לצידו שורת "עדכון" גנרית כפולה על אותה פעולה).
    await prisma.orderItem.update(auditAs(
      'CANCEL_RENTAL',
      {
        where: { id: orderItemId },
        data: {
          isTaken: false,
          takenDate: null,
          barcode: null
        }
      },
      {
        isTaken: { from: item.isTaken, to: false },
        takenDate: { from: item.takenDate, to: null },
        barcode: { from: item.barcode, to: null }
      }
    ));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling rental:', error);
    return NextResponse.json({ error: 'שגיאה בביטול לקיחה' }, { status: 500 });
  }
}
