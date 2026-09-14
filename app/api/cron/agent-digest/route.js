import { NextResponse } from 'next/server';
import { runAgentDigest } from '@/lib/agentDigest';

export const dynamic = 'force-dynamic';

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
  return NextResponse.json({ success: true, slot, ...result });
}

export async function POST(request) { return GET(request); }
