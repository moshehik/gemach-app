import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { getSharedDeliveryInfo, setSharedDeliveryPrimary } from '@/lib/sharedDelivery';

export const dynamic = 'force-dynamic';

// "משלוח משותף" (shared_delivery_enabled) - מצב הקבוצה של הזמנה והחלפת "משלוח ראשי". ר' docs/shared-delivery-discount.md.
//  GET  -> { enabled:false } כשהפיצ'ר כבוי (הכרטיס לא מציג כלום), אחרת המצב: האם יש קבוצה, מי הראשי, ההזמנות בקבוצה וחיוב המשלוח של כל אחת.
//  POST { primaryOrderId } -> קובע את ההזמנה הנבחרת כ"משלוח ראשי" ומחשב מחדש את חיוב המשלוח של כל ההזמנות בקבוצה. הזיכוי / החיוב נרשמים
//        אוטומטית דרך המנגנון הקיים (בקשת זיכוי אוטומטית על יתרת זכות). התשובה נושאת notices להצגה לעובד (הזמנות שהושפעו, עם מספרן).

function parseId(params) {
  const n = parseInt(params?.id, 10);
  return Number.isInteger(n) ? n : null;
}

export async function GET(request, { params }) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const id = parseId(await params);
    if (id === null) return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    return NextResponse.json(await getSharedDeliveryInfo(id));
  } catch (error) {
    console.error('shared-delivery GET failed', error);
    return NextResponse.json({ error: 'טעינת מצב המשלוח המשותף נכשלה' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const id = parseId(await params);
    if (id === null) return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    let body = {};
    try { body = await request.json(); } catch { body = {}; }
    const primaryOrderId = parseInt(body?.primaryOrderId, 10);
    if (!Number.isInteger(primaryOrderId)) return NextResponse.json({ error: 'לא נבחרה הזמנה כ"משלוח ראשי"' }, { status: 400 });
    const result = await setSharedDeliveryPrimary(id, primaryOrderId);
    if (!result.ok) return NextResponse.json({ error: result.error || 'החלפת "משלוח ראשי" נכשלה', unavailable: !!result.unavailable }, { status: result.unavailable ? 503 : 400 });
    return NextResponse.json({ ok: true, changed: result.changed, notices: result.notices || [], info: result.info });
  } catch (error) {
    console.error('shared-delivery POST failed', error);
    return NextResponse.json({ error: 'החלפת "משלוח ראשי" נכשלה' }, { status: 500 });
  }
}
