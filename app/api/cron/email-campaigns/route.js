import { NextResponse } from 'next/server';
import { processDueCampaigns } from '@/lib/emailCampaign';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// מריץ דיוורים מתוזמנים שהגיע זמנם (ומשלים דיוורים שנעצרו באמצע, למשל בגלל מכסת Gmail יומית). אותו שער סוד כמו api/cron/daily:
// אם CRON_SECRET מוגדר - חובה; אם לא - פתוח לקריאות פנימיות (כמו שאר ה-crons). בטוח לקריאה חוזרת (התקדמות נשמרת, אין שליחה כפולה).
// הפעלה מדויקת: מתזמן Google Apps Script (docs/gas-campaign-scheduler.gs) קורא לכאן פעם אחת בדקה שנקבעה (אותו דפוס כמו הצינתוקים המתוזמנים ב-print-center).
// רשתות ביטחון: ה-cron היומי ומ-cron סוכן הענפים (ריצות ~08:30 / ~17:30 / ~00:30 שעון ישראל) קוראים ל-processDueCampaigns ישירות.
// התשובה כוללת more: כמה דיוורים עוד נשארו ושהתקדמו - המתזמן מפעיל ריצה נוספת בעוד דקה.
export async function GET(request) {
  const authHeader = request.headers.get('authorization') || '';
  const bearerSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const secret = request.headers.get('x-cron-secret') || bearerSecret || new URL(request.url).searchParams.get('secret');
  // סודות מותרים: CRON_SECRET / VERCEL_CRON_SECRET (Vercel Cron) ו-EMAIL_SCHEDULER_SECRET (מתזמן Apps Script, docs/gas-campaign-scheduler.gs).
  // אם אף סוד לא מוגדר - פתוח לקריאות פנימיות, כמו שאר ה-crons.
  const allowed = [process.env.CRON_SECRET, process.env.VERCEL_CRON_SECRET, process.env.EMAIL_SCHEDULER_SECRET].filter(Boolean);
  if (allowed.length && !(secret && allowed.includes(secret))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const r = await processDueCampaigns();
    return NextResponse.json({ success: true, ...r, at: new Date().toISOString() });
  } catch (e) {
    console.error('email-campaigns cron failed', e);
    return NextResponse.json({ error: 'שגיאה' }, { status: 500 });
  }
}

export async function POST(request) { return GET(request); }
