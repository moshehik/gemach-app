import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { canOpenAnyPage } from '@/lib/permissions';
import { getDeliveriesForDate } from '@/lib/deliveries';
import { getIsraelTodayDate } from '@/lib/hebrewDate';

export const dynamic = 'force-dynamic';

// 'YYYY-MM-DD' -> local midnight Date (avoids the UTC-parse day-shift you'd get
// from `new Date('YYYY-MM-DD')` in negative-offset timezones); falls back to
// today in Israel (not server-local: Vercel runs in UTC, so setHours(0,0,0,0) on
// new Date() gave "yesterday" between 00:00 and 03:00 Israel time) when missing/malformed.
function parseDateParam(dateParam) {
  if (dateParam) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateParam);
    if (match) {
      const [, y, m, d] = match;
      const parsed = new Date(Number(y), Number(m) - 1, Number(d));
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }
  return getIsraelTodayDate();
}

// GET /api/deliveries?date=YYYY-MM-DD — orders whose event date puts them in the
// outbound ("משלוח הלוך") or return ("משלוח חזור") delivery window for the given
// day. Real-world direction: the dress must go OUT before the event and gets
// picked back up AFTER it, so:
//   outbound due date = Order.eventDate - delivery_days_before
//   return due date   = Order.eventDate + delivery_days_after
//                       (0 = the event day itself, but a closed event day rolls to the next
//                        working day - owner decision 4.10.2026, SCH-DELIV-0; lib/deliveries.js)
// i.e. an order is "due for outbound delivery" on `date` when
// eventDate = date + delivery_days_before, and "due for return" when
// eventDate = date - delivery_days_after.
// כשההגדרה deliveries_select_by_event_date דולקת, `date` הוא תאריך האירוע עצמו (לא יום
// הוצאה/חזרה) וכל שורה נושאת dispatchDates עם יום היציאה/האיסוף המחושבים - ר' lib/deliveries.js.
// Query logic itself lives in lib/deliveries.js (getDeliveriesForDate) - shared with
// the courier email endpoint (app/api/deliveries/courier-email/route.js), see
// docs/deliveries-feature-plan-2026-09-16.md §C/§D.
export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  // H5 hardening: customer names / addresses - the deliveries screen (page:deliveries) or the orders screens (page:orders) only, like /api/deliveries/join
  if (!(await canOpenAnyPage(['page:deliveries', 'page:orders']))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { searchParams } = new URL(request.url);
    const requestedDate = parseDateParam(searchParams.get('date'));

    const { daysBefore, daysAfter, selectByEventDate, data } = await getDeliveriesForDate(requestedDate);

    return NextResponse.json({
      date: `${requestedDate.getFullYear()}-${String(requestedDate.getMonth() + 1).padStart(2, '0')}-${String(requestedDate.getDate()).padStart(2, '0')}`,
      deliveryDaysBefore: daysBefore,
      deliveryDaysAfter: daysAfter,
      selectByEventDate,
      data
    });
  } catch (error) {
    console.error('GET /api/deliveries error:', error);
    return NextResponse.json({ error: 'שגיאה בטעינת נתוני משלוחים' }, { status: 500 });
  }
}
