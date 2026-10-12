// GET /api/admin/station-analytics/registrations?day=YYYY-MM-DD[&channel=all][&windowDays=14]
// הרישומים של יום מסוים בעמדה (שם פרטי + אות ראשונה של שם המשפחה, סטטוס אימות, האם סגרה הזמנה). זה הנתון היחיד במסך שהוא PII,
// ולכן בנוסף להרשאת המסך (page:station_analytics) נדרשת הרשאת הדף "לקוחות" (page:customers; הנהלה ראשית / מתכנת תמיד עוברות). לא במטמון.
import { NextResponse } from 'next/server';
import { canOpenPage } from '@/lib/permissions';
import { getIsraelDateKey } from '@/lib/hebrewDate';
import { DEFAULT_WINDOW_DAYS, MAX_WINDOW_DAYS, MIN_WINDOW_DAYS, VIEW_CHANNELS } from '@/lib/stationAnalytics/constants';
import { getDayRegistrations } from '@/lib/stationAnalytics/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!(await canOpenPage('page:station_analytics'))) return NextResponse.json({ error: 'אין הרשאה לצפות במדדי העמדה הציבורית' }, { status: 403 });
  if (!(await canOpenPage('page:customers'))) return NextResponse.json({ error: 'אין הרשאה לצפות בפרטי לקוחות' }, { status: 403 });
  try {
    const sp = new URL(request.url).searchParams;
    const day = sp.get('day') || getIsraelDateKey();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return NextResponse.json({ error: 'תאריך לא תקין' }, { status: 400 });
    const channel = sp.get('channel') || 'all';
    if (!VIEW_CHANNELS.includes(channel)) return NextResponse.json({ error: 'ערוץ לא תקין' }, { status: 400 });
    const w = sp.get('windowDays') ? parseInt(sp.get('windowDays'), 10) : DEFAULT_WINDOW_DAYS;
    if (!Number.isFinite(w) || w < MIN_WINDOW_DAYS || w > MAX_WINDOW_DAYS) return NextResponse.json({ error: 'חלון ההמרה לא תקין' }, { status: 400 });
    const data = await getDayRegistrations({ day, channel, windowDays: w });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('admin station-analytics registrations failed:', error);
    return NextResponse.json({ error: 'שגיאה בטעינת הרישומים' }, { status: 500 });
  }
}
