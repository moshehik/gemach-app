import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth, getSessionEmployee } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { getIsraelDayRange, getIsraelDateKey } from '@/lib/hebrewDate';
import { NON_WORKING_DAYS_PERMISSION_KEY } from '@/lib/businessDays';
import { DRAFT_ORDER_STATUS } from '@/lib/orderReservation';
import { countActivity, parseActivityRange } from '@/lib/nonWorkingDaysPage';

// GET /api/non-working-days/activity?from=YYYY-MM-DD&to=YYYY-MM-DD - "פעילות רשומה" בימים שמסמנים (החלטת הבעלים
// NWD-Q06: אזהרה בלבד - ההזמנות, האירועים והמשלוחים לא משתנים בשום דרך). קריאה בלבד: לכל יום ישראלי בטווח, כמה הזמנות
// שהאירוע שלהן באותו יום ומתוכן כמה משלוחים. רק למי שרשאי לסמן (אותה הרשאה כמו השמירה) - הדף לא שואל אחרים.
// טיוטות (עגלה שנשמרה אוטומטית) ומחוקות לא נספרות, כמו בלו״ז (lib/schedule/loaders.js NOT_DRAFT, בטוח ל-NULL).
// טווח מרבי ACTIVITY_MAX_DAYS (120) ימים.
export const dynamic = 'force-dynamic';

const NOT_DRAFT = { OR: [{ status: null }, { status: { not: DRAFT_ORDER_STATUS } }] };

export async function GET(request) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const employee = await getSessionEmployee();
  if (!employee || !(await hasPermission(employee, NON_WORKING_DAYS_PERMISSION_KEY))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const sp = new URL(request.url).searchParams;
  const range = parseActivityRange(sp.get('from'), sp.get('to'));
  if (!range) return NextResponse.json({ error: 'טווח תאריכים לא תקין' }, { status: 400 });
  try {
    const start = getIsraelDayRange(range.from).start;
    const end = getIsraelDayRange(range.to).end;
    const orders = await prisma.order.findMany({
      where: { isDeleted: false, eventDate: { gte: start, lte: end }, AND: [NOT_DRAFT] },
      select: { eventDate: true, isDelivery: true },
      take: 5000,
    });
    return NextResponse.json({ from: range.from, to: range.to, days: countActivity(orders, range.from, range.to, getIsraelDateKey) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('GET /api/non-working-days/activity error:', error);
    return NextResponse.json({ error: 'שגיאה בטעינת הפעילות' }, { status: 500 });
  }
}
