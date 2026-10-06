import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth, getSessionEmployee } from '@/lib/auth';
import { getCachedSetting } from '@/lib/settingsCache';
import { syncPendingCreditRefund } from '@/lib/creditRefundSync';
import { paymentsGrantPermanentHold } from '@/lib/inventoryHold';
import { getApprovalMode, requireApprovalPermission, commitApprovalClaims, releaseApprovalClaims, KINDS } from '@/lib/approvalGate';
import { CREDIT_OFFSET_SETTING, offsetQuestion } from '@/lib/creditOffset';
import { previewCreditOffset, applyCreditOffset } from '@/lib/creditOffsetServer';

export const dynamic = 'force-dynamic';

// קיזוז זיכוי פתוח של הלקוחה מחוב בהזמנה הזו (דיווח 679a860b, נווה יעקב). הכללים והמבנה: lib/creditOffset.js + lib/creditOffsetServer.js.
// הנתיב הוא נקודת החיבור של כל כרטיסי ההזמנה (הישן קורא לו מהשמירה; הכרטיס החדש יוכל לקרוא לו בלי לשנות את השרת).
//
// מאחורי customer_credit_offset_prompt (ברירת מחדל כבוי = אין קיזוז; GET מחזיר enabled:false, POST מחזיר 404).
// GET  -> { enabled, debt, available, offsetAmount, sources:[{orderId, amount}], question }   (קריאה בלבד: מה היה מקוזז ומה לשאול)
// POST { maxAmount?, requestKey?, approvalToken? } -> רושם זוג תשלומים (אמצעי "קיזוז זיכוי") ומסנכרן את בקשות הזיכוי.
//   מאשר: כמו כל תשלום ידני בנווה - feature:manual_payment_credit_add, נאכף תמיד בשרת (המחובר מחזיק את ההרשאה, או approvalToken מסוג
//   manual_payment_credit להזמנה הזו). restrict_refunds_to_head_management כבר לא נקרא בשום קוד (ר' lib/settingsMetadata.js).

async function featureEnabled() {
  try {
    const row = await getCachedSetting(CREDIT_OFFSET_SETTING);
    return !!row && String(row.value).trim().toLowerCase() === 'true';
  } catch (e) {
    console.error('credit offset: could not read setting');
    return false; // כמו שורה חסרה = כבוי
  }
}

const parseOrderId = async (params) => {
  const { id } = await params;
  const orderId = parseInt(id, 10);
  return Number.isNaN(orderId) ? null : orderId;
};

export async function GET(request, { params }) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const orderId = await parseOrderId(params);
    if (orderId === null) return NextResponse.json({ error: 'מספר הזמנה לא תקין' }, { status: 400 });
    if (!(await featureEnabled())) return NextResponse.json({ enabled: false, offsetAmount: 0, sources: [] });
    const r = await previewCreditOffset(prisma, orderId);
    if (!r.found) return NextResponse.json({ error: 'הזמנה לא נמצאה' }, { status: 404 });
    const { plan } = r;
    return NextResponse.json({
      enabled: true,
      debt: plan.debt,
      available: plan.available,
      offsetAmount: plan.offsetAmount,
      sources: plan.sources.map((s) => ({ orderId: s.orderId, amount: s.amount })),
      question: offsetQuestion(plan),
    });
  } catch (error) {
    console.error('Error previewing credit offset:', error);
    return NextResponse.json({ error: 'שגיאה בבדיקת זיכוי פתוח' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const claims = [];
  let done = false;
  try {
    const orderId = await parseOrderId(params);
    if (orderId === null) return NextResponse.json({ error: 'מספר הזמנה לא תקין' }, { status: 400 });
    if (!(await featureEnabled())) return NextResponse.json({ error: 'קיזוז זיכוי אינו מופעל' }, { status: 404 });
    const body = await request.json().catch(() => ({}));

    const mode = await getApprovalMode();
    const gate = await requireApprovalPermission({
      kind: KINDS.MANUAL_PAYMENT_CREDIT, orderId, token: body.approvalToken, claims,
      mode: { ...mode, permissionsEnforced: true }, // כסף: תמיד נאכף, גם כש-approval_permissions_enforced כבוי
      sessionEmployee: await getSessionEmployee(),
    });
    if (!gate.ok) {
      return NextResponse.json({
        error: 'קיזוז זיכוי מותר רק למי שהוגדר כמאשר תשלום/זיכוי ידני (או באישור שלו בקוד).', code: gate.code, approvalKind: gate.kind,
      }, { status: gate.status });
    }

    const maxAmount = body.maxAmount === undefined || body.maxAmount === null ? undefined : Number(body.maxAmount);
    if (maxAmount !== undefined && !Number.isFinite(maxAmount)) return NextResponse.json({ error: 'סכום לא תקין' }, { status: 400 });

    const result = await applyCreditOffset({
      prisma, orderId, maxAmount, requestKey: body.requestKey, syncPendingCreditRefund,
      grantsHold: async (id, amount) => {
        if (!paymentsGrantPermanentHold([{ amount }])) return;
        await prisma.orderItem.updateMany({ where: { orderId: id, isDeleted: false, cartStatus: 'pending' }, data: { cartStatus: 'confirmed', cartStatusDate: new Date() } });
      },
    });

    if (result.status === 'not_found') return NextResponse.json({ error: 'הזמנה לא נמצאה' }, { status: 404 });
    if (result.status === 'stale') return NextResponse.json({ error: 'התשלומים בהזמנה השתנו ברגע זה - נסו שוב.', status: 'stale' }, { status: 409 });
    if (result.status === 'applied') { commitApprovalClaims(claims); done = true; }
    return NextResponse.json({
      ok: result.status === 'applied' || result.status === 'duplicate',
      status: result.status,
      amount: result.amount || 0,
      sources: (result.sources || []).map((s) => ({ orderId: s.orderId, amount: s.amount })),
    });
  } catch (error) {
    console.error('Error applying credit offset:', error);
    return NextResponse.json({ error: 'שגיאה ברישום הקיזוז' }, { status: 500 });
  } finally {
    if (!done) releaseApprovalClaims(claims);
  }
}
