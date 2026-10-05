import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { recalculateOrderObligations } from '@/lib/pricingEngine';
import { syncPendingCreditRefund } from '@/lib/creditRefundSync';
import { paymentsGrantPermanentHold } from '@/lib/inventoryHold';
import { checkAuth, getSessionEmployee } from '@/lib/auth';
import { getApprovalMode, requireApprovalPermission, releaseApprovalClaims, commitApprovalClaims, KINDS } from '@/lib/approvalGate';

// A manual payment (cash / transfer / check - anything that is not a credit-card row, which the Nedarim flow saves right after
// the charge) is the "manual payment" of feature:manual_payment_credit_add. Enforced here only when approval_permissions_enforced
// is ON: the logged-in employee holds the permission, or `approvalToken` (verify-pin, kind manual_payment_credit, this order) comes along.
// docs/server-approval-hardening.md
const isManualPaymentMethod = (method) => !String(method || 'מזומן').includes('אשראי');

export async function POST(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  const claims = [];
  let done = false;
  try {
    const data = await request.json();
    
    if (!data.orderId || data.amount === undefined || data.amount === null) {
      return NextResponse.json({ error: 'חסרים נתונים חובה: מסנהזמנה וסכום' }, { status: 400 });
    }

    const parsedOrderId = parseInt(data.orderId);
    if (isNaN(parsedOrderId)) {
      return NextResponse.json({ error: 'מספר הזמנה לא חוקי' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { orderId: parsedOrderId }
    });

    if (!order) {
      return NextResponse.json({ error: 'הזמנה לא נמצאה' }, { status: 404 });
    }

    const approvalMode = await getApprovalMode();
    if (approvalMode.permissionsEnforced && isManualPaymentMethod(data.paymentMethod)) {
      const gate = await requireApprovalPermission({
        kind: KINDS.MANUAL_PAYMENT_CREDIT, orderId: parsedOrderId, token: data.approvalToken, claims, mode: approvalMode,
        sessionEmployee: await getSessionEmployee(),
      });
      if (!gate.ok) {
        return NextResponse.json({ error: 'רישום תשלום ידני מותר רק למי שהוגדר כמאשר תשלום/זיכוי ידני (או באישור שלו בקוד).', code: gate.code }, { status: gate.status });
      }
    }

    // Create new payment
    const payment = await prisma.payment.create({
      data: {
        orderId: parsedOrderId,
        customerId: data.customerId ? parseInt(data.customerId) : order.customerId,
        amount: parseFloat(data.amount),
        paymentMethod: data.paymentMethod || 'מזומן',
        notes: data.notes || '',
        paymentDate: new Date()
      }
    });

    commitApprovalClaims(claims); // the payment is stored - a later failure (stock hold, credit sync) must not hand the token back
    done = true;

    // Money changed hands (or a manager approved leaving with the payment tracked
    // afterwards), so the order stops being a cart and its items hold their units for good.
    // A zero-amount row that is neither of those - a note, a correction - is not a payment
    // and must not silently turn an expiring cart into a permanent booking.
    if (paymentsGrantPermanentHold([payment])) {
      await prisma.orderItem.updateMany({
        where: { orderId: parsedOrderId, isDeleted: false, cartStatus: 'pending' },
        data: { cartStatus: 'confirmed', cartStatusDate: new Date() }
      });
    }

    // We can also trigger recalculation or update if needed
    // await recalculateOrderObligations(parsedOrderId);

    // תשלום ישיר לא עובר דרך recalculateOrderObligations (שם רץ הסנכרון הרגיל של בקשת
    // זיכוי אוטומטית) - אם התשלום הזה יצר/הגדיל יתרת זכות, מוודאים שהיא ידועה כאן.
    await syncPendingCreditRefund(parsedOrderId);

    return NextResponse.json(payment);
  } catch (error) {
    console.error('Error adding payment:', error);
    return NextResponse.json({ error: 'שגיאה בשמירת התשלום' }, { status: 500 });
  } finally {
    if (!done) releaseApprovalClaims(claims);
  }
}
