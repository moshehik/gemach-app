import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// אישור/ביטול אישור יתרת חוב עבור הזמנה, בלי לעבור דרך PUT /api/orders/[id] המלא.
// שומר בדיוק על אותה מוסכמה שכבר קיימת שם ("6. Record debt approval if provided") -
// AuditLog נכתב ידנית כי אין כתיבה מקבילה למודל שתייצר שורה אוטומטית (ר' auditAs
// ב-app/lib/prisma.js). מסך זיכויים/חובות קורא לנתיב הקטן הזה כדי לאשר/לבטל אישור
// שורת חוב בודדת בלי לשלוח את כל מטען ההזמנה (items/payments/obligations/updatedAt)
// שממילא לא משתנה כאן.

async function loadOrderBalance(orderId) {
  const order = await prisma.order.findUnique({
    where: { orderId },
    select: {
      orderId: true,
      totalAmount: true,
      payments: { select: { amount: true, isDeleted: true } },
      obligations: { select: { amount: true, isDeleted: true } }
    }
  });
  if (!order) return null;

  const totalPaid = order.payments.reduce((sum, p) => sum + (p.isDeleted ? 0 : p.amount), 0);
  const obligationsSum = order.obligations.reduce((sum, o) => sum + (o.isDeleted ? 0 : o.amount), 0);
  // תואם לחישוב totalAmount שכבר משמש בכל מקום אחר (app/api/orders/route.js) -
  // totalAmount המפורש אם קיים, אחרת סכום ההתחייבויות.
  const totalRequired = (order.totalAmount && order.totalAmount > 0) ? order.totalAmount : obligationsSum;

  return { totalPaid, totalRequired, remaining: totalRequired - totalPaid };
}

export async function POST(request, { params }) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) return NextResponse.json({ error: 'מספר הזמנה לא תקין' }, { status: 400 });

    const { employeeId } = await request.json();
    if (!employeeId) return NextResponse.json({ error: 'נדרש מזהה עובד מאשר' }, { status: 400 });

    const balance = await loadOrderBalance(orderId);
    if (!balance) return NextResponse.json({ error: 'הזמנה לא נמצאה' }, { status: 404 });

    // אישור החוב אינו כתיבה למודל כלשהו אלא רישום עצמאי של אישור העובד/מנהל - זהה
    // בדיוק לרישום שנכתב היום ב-PUT /api/orders/[id] בשמירת הזמנה עם יתרת חוב פתוחה.
    // eslint-disable-next-line no-restricted-syntax -- אין כתיבה מקבילה שתייצר שורה אוטומטית
    const log = await prisma.auditLog.create({
      data: {
        entityType: 'Order',
        entityId: orderId.toString(),
        action: 'DEBT_APPROVED',
        changesJson: JSON.stringify({ approvedDebtAmount: balance.remaining }),
        employeeId
      }
    });

    return NextResponse.json({ success: true, log, remaining: balance.remaining });
  } catch (error) {
    console.error('Error approving debt:', error);
    return NextResponse.json({ error: 'שגיאה באישור החוב' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) return NextResponse.json({ error: 'מספר הזמנה לא תקין' }, { status: 400 });

    const { employeeId } = await request.json();
    if (!employeeId) return NextResponse.json({ error: 'נדרש מזהה עובד מאשר' }, { status: 400 });

    const order = await prisma.order.findUnique({ where: { orderId }, select: { orderId: true } });
    if (!order) return NextResponse.json({ error: 'הזמנה לא נמצאה' }, { status: 404 });

    // ביטול אישור החוב - אותה מוסכמה בכיוון ההפוך (בדומה לזוגות CANCEL_*/RESTORE_*
    // הקיימים כבר ב-PUT /api/orders/[id], כמו CANCEL_PAYMENT/RESTORE_PAYMENT).
    // eslint-disable-next-line no-restricted-syntax -- אין כתיבה מקבילה שתייצר שורה אוטומטית
    const log = await prisma.auditLog.create({
      data: {
        entityType: 'Order',
        entityId: orderId.toString(),
        action: 'CANCEL_DEBT_APPROVAL',
        changesJson: JSON.stringify({ approvedDebtAmount: 0 }),
        employeeId
      }
    });

    return NextResponse.json({ success: true, log });
  } catch (error) {
    console.error('Error cancelling debt approval:', error);
    return NextResponse.json({ error: 'שגיאה בביטול אישור החוב' }, { status: 500 });
  }
}
