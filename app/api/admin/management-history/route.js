import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { pagingError } from '@/lib/adminLogList';
import { parseVisitListParams } from '@/lib/adminVisitList';
import { queryVisitList } from '@/lib/adminVisitListServer';
import { errorResponse, BadRequestError } from '@/lib/adminListGuards';

// היסטוריית שאילתות ו-API לניהול (/management/history): עמוד אחד (עד 100; ייצוא export:true עד 500) מיומן הגלישה והשאילתות (PageVisitLog) לפי חיפוש + סינון + מיון, שרת בלבד.
// שער: הנהלה ראשית / מתכנת (checkAuth('הנהלה ראשית')) - אותו שער כמו הדף (app/management/layout.js); הנתיב הישן GET /api/history הוקשח לאותו שער (R8, ביקורת 11.10.2026); הדף החדש משתמש רק בנתיב הזה (חיפוש / עימוד / הסתרת סודות בשרת).
// גופי בקשה ונתיבים עוברים הסתרת סודות בשרת (lib/redactSensitive.js) לפני שהם יוצאים. גבולות עלות כמו ביומן הנתונים; פירוט: management-history-notes.md.
export const dynamic = 'force-dynamic';

async function handle(input) {
  if (!(await checkAuth('הנהלה ראשית'))) return NextResponse.json({ error: 'נדרשת הרשאת הנהלה ראשית' }, { status: 401 });
  try {
    const bad = pagingError(parseVisitListParams(input));
    if (bad) throw new BadRequestError(bad);
    return NextResponse.json(await queryVisitList(input), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const known = errorResponse(error);
    if (known) return NextResponse.json(known.body, { status: known.status, headers: { 'Cache-Control': 'no-store' } });
    console.error('admin management-history failed:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}

export async function GET(request) {
  return handle(Object.fromEntries(new URL(request.url).searchParams.entries()));
}

export async function POST(request) {
  let body = null;
  try { body = await request.json(); } catch { body = null; }
  return handle(body && typeof body === 'object' && !Array.isArray(body) ? body : {});
}
