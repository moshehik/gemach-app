import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import {
  isDeliveryJoinAvailable, listJoinCandidates, getJoinInfo, getJoinGroup, saveDeliveryJoin,
} from '@/lib/deliveryJoin';

export const dynamic = 'force-dynamic';

// "הצטרפות למשלוח קיים" (enable_delivery_join) - ר' lib/deliveryJoin.js.
//   GET  ?mode=candidates&eventDate=YYYY-MM-DD&direction=הלוך|חזור|הלוך-חזור&oneDayBefore=true|false&exclude=<orderId>
//        -> משלוחים שאפשר להצטרף אליהם (אותו יום אירוע ואותו כיוון)
//   GET  ?mode=info&orderId=<id>   -> מצב ההצטרפות/ראשי של הזמנה + הקבוצה שלה
//   GET  ?mode=group&root=<id>     -> חברי הקבוצה של משלוח (שורש + מצטרפים)
//   POST { orderId, deliveryJoin: { joinedToOrderId, primaryOrderId } } -> שמירה עצמאית (בד"כ השמירה
//        נעשית כחלק מ-POST/PUT של ההזמנה עצמה; המסלול הזה לשימוש מסכים אחרים/עדכון "ראשי" בלבד)
// כבוי (ברירת מחדל) = תשובות ריקות / 403 בשמירה - התנהגות הזמנות ומשלוחים לא משתנה.
// "כבוי" = ההגדרה כבויה, או שהטבלה DeliveryJoin טרם נוצרה (DDL-1, prisma/migrations-pending/2026-10-04-delivery-join.sql):
// isDeliveryJoinAvailable תופס P2021 / 42P01, זוכר את זה כמה דקות, ושום מסלול לא מחזיר 500 בגלל טבלה חסרה.
export async function GET(request) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    if (!(await isDeliveryJoinAvailable())) {
      return NextResponse.json({ enabled: false, candidates: [], group: [], info: null });
    }
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode');

    if (mode === 'candidates') {
      const eventDate = searchParams.get('eventDate') || '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
        return NextResponse.json({ error: 'תאריך אירוע לא תקין' }, { status: 400 });
      }
      const direction = ['הלוך', 'חזור', 'הלוך-חזור'].includes(searchParams.get('direction')) ? searchParams.get('direction') : 'הלוך-חזור';
      const candidates = await listJoinCandidates({
        eventDateIso: eventDate,
        direction,
        oneDayBefore: searchParams.get('oneDayBefore') === 'true',
        excludeOrderId: parseInt(searchParams.get('exclude'), 10) || null,
      });
      return NextResponse.json({ enabled: true, candidates });
    }

    if (mode === 'info') {
      const orderId = parseInt(searchParams.get('orderId'), 10);
      if (!orderId) return NextResponse.json({ error: 'orderId חסר' }, { status: 400 });
      return NextResponse.json({ enabled: true, info: await getJoinInfo(orderId) });
    }

    if (mode === 'group') {
      const root = parseInt(searchParams.get('root'), 10);
      if (!root) return NextResponse.json({ error: 'root חסר' }, { status: 400 });
      return NextResponse.json({ enabled: true, group: await getJoinGroup(root) });
    }

    return NextResponse.json({ error: 'mode לא מוכר' }, { status: 400 });
  } catch (error) {
    console.error('GET /api/deliveries/join error:', error);
    return NextResponse.json({ error: 'שגיאה בטעינת נתוני הצטרפות למשלוח' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    if (!(await isDeliveryJoinAvailable())) {
      return NextResponse.json({ error: 'הצטרפות למשלוח קיים כבויה בהגדרות' }, { status: 403 });
    }
    const body = await request.json();
    const orderId = parseInt(body?.orderId, 10);
    if (!orderId) return NextResponse.json({ error: 'orderId חסר' }, { status: 400 });
    const result = await saveDeliveryJoin(orderId, body?.deliveryJoin || {});
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.unavailable ? 403 : 400 });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('POST /api/deliveries/join error:', error);
    return NextResponse.json({ error: 'שגיאה בשמירת ההצטרפות למשלוח' }, { status: 500 });
  }
}
