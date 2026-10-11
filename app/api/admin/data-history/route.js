import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { pagingError } from '@/lib/adminLogList';
import { parseAuditListParams } from '@/lib/adminAuditList';
import { queryAuditList } from '@/lib/adminAuditListServer';
import { errorResponse, BadRequestError } from '@/lib/adminListGuards';

// היסטוריית נתונים לניהול (/admin/data-history): עמוד אחד (עד 100; ייצוא export:true עד 500) מיומן השינויים (AuditLog) לפי חיפוש + סינון + מיון, שרת בלבד.
// שער: הנהלה ראשית / מתכנת (checkAuth('הנהלה ראשית')) - אותו שער כמו הדף (app/admin/layout.js). אחר / אורח: 401, בלי נתונים. שורות של עובדים / משמרות /
// הרשאות / מכשירים / מפתחות נשארות להנהלה ראשית בלבד גם בפונקציה עצמה (lib/adminAuditList.js), וסודות / מזהי UUID לא יוצאים בתשובה.
// גבולות עלות (lib/adminListGuards.js + lib/adminLogList.js): עמוד רחוק = 400; חריגת זמן / עומס = 503 "צמצמו את הסינון"; סך חסום ל-100,000. פירוט: data-history-notes.md.
export const dynamic = 'force-dynamic';

async function handle(input) {
  if (!(await checkAuth('הנהלה ראשית'))) return NextResponse.json({ error: 'נדרשת הרשאת הנהלה ראשית' }, { status: 401 });
  try {
    const bad = pagingError(parseAuditListParams(input));
    if (bad) throw new BadRequestError(bad);
    return NextResponse.json(await queryAuditList(input, { isHead: true }), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const known = errorResponse(error);
    if (known) return NextResponse.json(known.body, { status: known.status, headers: { 'Cache-Control': 'no-store' } });
    console.error('admin data-history failed:', error);
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
