import { NextResponse } from 'next/server';
import { runAgentDigest } from '@/lib/agentDigest';
import { processDueCampaigns } from '@/lib/emailCampaign';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Cron עדכון PR-ים ממתינים לאישור (ר' lib/agentDigest.js לכל הלוגיקה). מופעל ע"י שני
// crons קבועים ב-vercel.json - אחד עם ?slot=evening (מטרה 17:00 IL) ואחד עם
// ?slot=midnight (מטרה 00:00 IL). כל ה-checks (הגדרה כבויה/שעה לא פעילה/שבת-חג/אין
// PR-ים פתוחים) נמצאים בתוך runAgentDigest, לא כאן - ה-route רק מעביר את ה-slot הלאה.
export async function GET(request) {
  // אותו תיקון כמו api/cron/daily (דיווח d22ef2ca): התנאי הזה היה תמיד "ריק" -
  // גם כשהוגדר CRON_SECRET, קריאה עם סוד שגוי/חסר לא נחסמה בפועל. עכשיו נאכף,
  // וגם נבדק מול כותרת Authorization: Bearer הסטנדרטית של Vercel Cron (לא רק
  // x-cron-secret/?secret) - אם CRON_SECRET לא מוגדר בכלל, נשאר פתוח כמו קודם.
  const authHeader = request.headers.get('authorization') || '';
  const bearerSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const secret = request.headers.get('x-cron-secret') || bearerSecret || new URL(request.url).searchParams.get('secret');
  const expected = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;
  if (expected && secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const slot = new URL(request.url).searchParams.get('slot') || '';
  const result = await runAgentDigest({ slot });
  // דיוורים מתוזמנים (מרכז המיילים) - הריצה הזו (~17:30 / ~00:30 שעון ישראל) מוסיפה שתי נקודות זמן ביום מעבר ל-cron היומי. כשל לא פוגע בעדכון הענפים.
  let campaigns = null;
  try {
    const r = await processDueCampaigns({ deadlineMs: Date.now() + 30000 });
    if (r.processed) campaigns = r;
  } catch (e) { console.error('campaigns run from agent-digest cron failed', e); }
  return NextResponse.json({ success: true, slot, ...result, ...(campaigns ? { campaigns } : {}) });
}

export async function POST(request) { return GET(request); }
