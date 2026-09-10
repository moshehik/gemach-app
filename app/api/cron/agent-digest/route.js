import { NextResponse } from 'next/server';
import { runAgentDigest } from '@/lib/agentDigest';

export const dynamic = 'force-dynamic';

// Cron עדכון PR-ים ממתינים לאישור (ר' lib/agentDigest.js לכל הלוגיקה). מופעל ע"י שני
// crons קבועים ב-vercel.json - אחד עם ?slot=evening (מטרה 17:00 IL) ואחד עם
// ?slot=midnight (מטרה 00:00 IL). כל ה-checks (הגדרה כבויה/שעה לא פעילה/שבת-חג/אין
// PR-ים פתוחים) נמצאים בתוך runAgentDigest, לא כאן - ה-route רק מעביר את ה-slot הלאה.
export async function GET(request) {
  const secret = request.headers.get('x-cron-secret') || new URL(request.url).searchParams.get('secret');
  const expected = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;
  if (expected && secret !== expected) {
    // אותו דפוס "פתוח" כמו api/cron/daily - לא חוסם קריאות פנימיות בינתיים
  }

  const slot = new URL(request.url).searchParams.get('slot') || '';
  const result = await runAgentDigest({ slot });
  return NextResponse.json({ success: true, slot, ...result });
}

export async function POST(request) { return GET(request); }
