import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { canApproveDebt } from '@/lib/permissions';
import { resolveDebtApprover, releaseApprovalClaims } from '@/lib/approvalGate';

export const dynamic = 'force-dynamic';

// אישור/ביטול אישור יתרת חוב עבור הזמנה, בלי לעבור דרך PUT /api/orders/[id] המלא.
// שומר בדיוק על אותה מוסכמה שכבר קיימת שם ("6. Record debt approval if provided") -
// AuditLog נכתב ידנית כי אין כתיבה מקבילה למודל שתייצר שורה אוטומטית (ר' auditAs
// ב-app/lib/prisma.js). מסך זיכויים/חובות קורא לנתיב הקטן הזה כדי לאשר/לבטל אישור
// שורת חוב בודדת בלי לשלוח את כל מטען ההזמנה (items/payments/obligations/updatedAt)
// שממילא לא משתנה כאן.
//
// הקשחה (docs/server-approval-hardening.md): המאשר נלקח מ-`approvalToken` החתום ש-POST /api/auth/verify-pin החזיר אחרי שהקוד
// הוקלד באמת (מקושר להזמנה, לעובד המחובר ולסוג "אישור חוב", תקף 5 דקות, חד-פעמי) - לא מ-`employeeId` שבגוף הבקשה. כשההגדרה
// approval_tokens_required כבויה (ברירת מחדל) `employeeId` הישן עדיין מתקבל כמו קודם (עם שורת deprecation בלי סודות);
// כשדלוקה - נדרש טוקן.

// מפענח את המאשר של הבקשה; { approverId } או { response } (תשובת שגיאה מוכנה). claims = טוקנים שנתפסו (מוחזרים אם הבקשה נכשלת).
async function resolveApprover(request, orderId, claims) {
  const body = await request.json().catch(() => ({}));
  const r = await resolveDebtApprover({ orderId, token: body.approvalToken, bareId: body.employeeId, claims });
  if (!r.ok) return { response: NextResponse.json({ error: r.error, code: r.code }, { status: r.status }) };
  if (!r.approverId) return { response: NextResponse.json({ error: 'נדרש מזהה עובד מאשר' }, { status: 400 }) };
  if (!(await canApproveDebt(r.approverId))) return { response: NextResponse.json({ error: 'העובד שצוין כמאשר אינו מורשה לאשר הזמנה ללא תשלום מלא' }, { status: 403 }) };
  return { approverId: r.approverId };
}

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
  const claims = [];
  let done = false;
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) return NextResponse.json({ error: 'מספר הזמנה לא תקין' }, { status: 400 });

    const approver = await resolveApprover(request, orderId, claims);
    if (approver.response) return approver.response;
    const employeeId = approver.approverId;

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

    done = true;
    return NextResponse.json({ success: true, log, remaining: balance.remaining });
  } catch (error) {
    console.error('Error approving debt:', error);
    return NextResponse.json({ error: 'שגיאה באישור החוב' }, { status: 500 });
  } finally {
    if (!done) releaseApprovalClaims(claims);
  }
}

export async function DELETE(request, { params }) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const claims = [];
  let done = false;
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) return NextResponse.json({ error: 'מספר הזמנה לא תקין' }, { status: 400 });

    const approver = await resolveApprover(request, orderId, claims);
    if (approver.response) return approver.response;
    const employeeId = approver.approverId;

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

    done = true;
    return NextResponse.json({ success: true, log });
  } catch (error) {
    console.error('Error cancelling debt approval:', error);
    return NextResponse.json({ error: 'שגיאה בביטול אישור החוב' }, { status: 500 });
  } finally {
    if (!done) releaseApprovalClaims(claims);
  }
}
