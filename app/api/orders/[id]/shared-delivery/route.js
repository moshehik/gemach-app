import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { canOpenPage } from '@/lib/permissions';
import { getSharedDeliveryInfo, setSharedDeliveryPrimary } from '@/lib/sharedDelivery';

export const dynamic = 'force-dynamic';

// "משלוח משותף" (shared_delivery_enabled) - מצב הקבוצה של הזמנה והחלפת "משלוח ראשי". ר' docs/shared-delivery-discount.md.
//  GET  -> { enabled:false } כשהפיצ'ר כבוי (הכרטיס לא מציג כלום), אחרת המצב: האם יש קבוצה, מי הראשי, ההזמנות בקבוצה וחיוב המשלוח של כל אחת.
//  החלפת ראשי מותרת רק למי שרשאית לערוך הזמנות קיימות: הרשאת "רשימת הזמנות" (page:orders - "חיפוש ועריכת הזמנות קיימות", נאכפת בשרת) - לא כל עובדת מחוברת.
//  POST { primaryOrderId } -> קובע את ההזמנה הנבחרת כ"משלוח ראשי" ומחשב מחדש את חיוב המשלוח של כל ההזמנות בקבוצה. הזיכוי / החיוב נרשמים
//        אוטומטית דרך המנגנון הקיים (בקשת זיכוי אוטומטית על יתרת זכות). התשובה נושאת notices להצגה לעובד (הזמנות שהושפעו, עם מספרן).
//        409 כשההזמנה (או היעד, או הקבוצה) כוללת הזמנה "קפואה" - קיימת מלפני הפעלת המשלוח המשותף (shared_delivery_first_order_id) ואינה משתתפת בהנחה.

function parseId(params) {
  const n = parseInt(params?.id, 10);
  return Number.isInteger(n) ? n : null;
}

export async function GET(request, { params }) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const id = parseId(await params);
    if (id === null) return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    const info = await getSharedDeliveryInfo(id);
    // הממשק מנטרל את הכפתורים למי שאינה רשאית להחליף (השרת אוכף שוב ב-POST)
    if (info && info.enabled && info.applicable) info.canChangePrimary = !!info.canChangePrimary && await canOpenPage('page:orders');
    return NextResponse.json(info);
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
    if (!(await canOpenPage('page:orders'))) return NextResponse.json({ error: 'אין הרשאה להחליף משלוח ראשי (נדרשת הרשאת עריכת הזמנות)' }, { status: 403 });
    let body = {};
    try { body = await request.json(); } catch { body = {}; }
    const primaryOrderId = parseInt(body?.primaryOrderId, 10);
    if (!Number.isInteger(primaryOrderId)) return NextResponse.json({ error: 'לא נבחרה הזמנה כ"משלוח ראשי"' }, { status: 400 });
    const result = await setSharedDeliveryPrimary(id, primaryOrderId);
    if (!result.ok) return NextResponse.json({ error: result.error || 'החלפת "משלוח ראשי" נכשלה', unavailable: !!result.unavailable, ...(result.frozen ? { frozen: true } : {}) }, { status: result.frozen ? 409 : (result.unavailable ? 503 : 400) });
    return NextResponse.json({ ok: true, changed: result.changed, notices: result.notices || [], info: result.info });
  } catch (error) {
    console.error('shared-delivery POST failed', error);
    return NextResponse.json({ error: 'החלפת "משלוח ראשי" נכשלה' }, { status: 500 });
  }
}
