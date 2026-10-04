import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { getIsraelDayRange, getIsraelTodayDate } from '@/lib/hebrewDate';
import { computeDressLocationAlerts, isDressLocationAlertEnabled } from '@/lib/dressLocationAlerts';

export const dynamic = 'force-dynamic';

// התראת "שמלות שעדיין באירועים / בסניף אחר" (enable_dress_location_alert) - קריאה בלבד.
//   ?orderId=123  -> ההזמנה הבודדת (כרטיס הזמנה)
//   ?days=7       -> כל ההזמנות שאירועיהן בטווח [היום, היום+days] (סיכום בלוח), רק אלה שיש בהן התראה
// כשההגדרה כבויה: { enabled:false, orders:[] } בלי שום שאילתה נוספת.
export async function GET(request) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    if (!(await isDressLocationAlertEnabled())) return NextResponse.json({ enabled: false, orders: [] });

    const { searchParams } = new URL(request.url);
    const orderIdParam = searchParams.get('orderId');

    if (orderIdParam) {
      const id = parseInt(orderIdParam, 10);
      if (!Number.isFinite(id)) return NextResponse.json({ error: 'orderId לא תקין' }, { status: 400 });
      const orders = await computeDressLocationAlerts([id]);
      return NextResponse.json({ enabled: true, orders });
    }

    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '7', 10) || 7, 1), 30);
    const today = getIsraelTodayDate();
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const last = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
    const from = getIsraelDayRange(iso(today)).start;
    const to = getIsraelDayRange(iso(last)).end;

    const upcoming = await prisma.order.findMany({
      where: { isDeleted: false, eventDate: { gte: from, lte: to } },
      select: { orderId: true },
      orderBy: { eventDate: 'asc' },
      take: 300,
    });
    const computed = await computeDressLocationAlerts(upcoming.map(o => o.orderId));
    return NextResponse.json({ enabled: true, orders: computed.filter(o => o.alerts.length > 0) });
  } catch (error) {
    console.error('Error computing dress location alerts:', error);
    return NextResponse.json({ error: 'שגיאה בחישוב התראות מיקום שמלות' }, { status: 500 });
  }
}
