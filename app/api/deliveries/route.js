import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { getDeliveriesForDate } from '@/lib/deliveries';

export const dynamic = 'force-dynamic';

// 'YYYY-MM-DD' -> local midnight Date (avoids the UTC-parse day-shift you'd get
// from `new Date('YYYY-MM-DD')` in negative-offset timezones); falls back to
// today (server-local) when missing/malformed, per the route's contract.
function parseDateParam(dateParam) {
  if (dateParam) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateParam);
    if (match) {
      const [, y, m, d] = match;
      const parsed = new Date(Number(y), Number(m) - 1, Number(d));
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

// GET /api/deliveries?date=YYYY-MM-DD — orders whose event date puts them in the
// outbound ("משלוח הלוך") or return ("משלוח חזור") delivery window for the given
// day. Real-world direction: the dress must go OUT before the event and gets
// picked back up AFTER it, so:
//   outbound due date = Order.eventDate - delivery_days_before
//   return due date   = Order.eventDate + delivery_days_after
// i.e. an order is "due for outbound delivery" on `date` when
// eventDate = date + delivery_days_before, and "due for return" when
// eventDate = date - delivery_days_after.
// Query logic itself lives in lib/deliveries.js (getDeliveriesForDate) - shared with
// the courier email endpoint (app/api/deliveries/courier-email/route.js), see
// docs/deliveries-feature-plan-2026-09-16.md §C/§D.
export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { searchParams } = new URL(request.url);
    const requestedDate = parseDateParam(searchParams.get('date'));

    const { daysBefore, daysAfter, data } = await getDeliveriesForDate(requestedDate);

    return NextResponse.json({
      date: `${requestedDate.getFullYear()}-${String(requestedDate.getMonth() + 1).padStart(2, '0')}-${String(requestedDate.getDate()).padStart(2, '0')}`,
      deliveryDaysBefore: daysBefore,
      deliveryDaysAfter: daysAfter,
      data
    });
  } catch (error) {
    console.error('GET /api/deliveries error:', error);
    return NextResponse.json({ error: 'שגיאה בטעינת נתוני משלוחים' }, { status: 500 });
  }
}
