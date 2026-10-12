import { NextResponse } from 'next/server';
import { processDueCampaigns } from '@/lib/emailCampaign';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// מריץ דיוורים מתוזמנים שהגיע זמנם (ומשלים דיוורים שנעצרו באמצע, למשל בגלל מכסת Gmail יומית). אותו שער סוד כמו api/cron/daily:
// אם CRON_SECRET מוגדר - חובה; אם לא - פתוח לקריאות פנימיות (כמו שאר ה-crons). בטוח לקריאה חוזרת (התקדמות נשמרת, אין שליחה כפולה).
// נקרא אוטומטית מה-cron היומי ומ-cron סוכן הענפים (ריצות ~08:30 / ~17:30 / ~00:30 שעון ישראל). לדיוק גבוה יותר אפשר לקרוא לו
// מ-GitHub Actions כל 15 דקות (curl עם Authorization: Bearer $CRON_SECRET) - לא מוגדר כרגע.
export async function GET(request) {
  const authHeader = request.headers.get('authorization') || '';
  const bearerSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const secret = request.headers.get('x-cron-secret') || bearerSecret || new URL(request.url).searchParams.get('secret');
  const expected = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;
  if (expected && secret !== expected) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const r = await processDueCampaigns();
    return NextResponse.json({ success: true, ...r });
  } catch (e) {
    console.error('email-campaigns cron failed', e);
    return NextResponse.json({ error: 'שגיאה' }, { status: 500 });
  }
}

export async function POST(request) { return GET(request); }
