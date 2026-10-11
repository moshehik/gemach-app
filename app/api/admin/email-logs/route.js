import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { parseEmailLogsParams } from '@/lib/adminEmailLogs';
import { queryEmailLogs } from '@/lib/adminEmailLogsServer';
import { errorResponse, validatePaging, BadRequestError } from '@/lib/adminListGuards';

// יומן שליחת המיילים החדש (/admin/site-settings/email-logs): עמוד אחד (עד 100; ייצוא export:true עד 500) לפי חיפוש + סינון + מיון, שרת בלבד - לעולם לא כל הטבלה.
// שער: מתכנת בלבד (checkAuth('מתכנת')) - אותו שער כמו /api/email-logs (הדף הישן) ו-app/admin/site-settings/layout.js. אחר / אורח: 401, בלי נתונים.
// גבולות עלות (lib/adminListGuards.js): היסט מוגזם = 400; חריגת תקציב זמן / עומס = 503 "צמצמו את הסינון". הלוגיקה: lib/adminEmailLogs*.js.
// GET = פרמטרים ב-query; POST = אותו דבר ב-JSON. גוף מייל של איפוס סיסמה (סיסמה זמנית) אינו מוחזר ואינו נחפש.
export const dynamic = 'force-dynamic';

async function handle(input) {
  if (!(await checkAuth('מתכנת'))) return NextResponse.json({ error: 'נדרשת הרשאת מתכנת' }, { status: 401 });
  try {
    const params = parseEmailLogsParams(input);
    const bad = validatePaging(params);
    if (bad) throw new BadRequestError(bad);
    const { data, total } = await queryEmailLogs(params);
    return NextResponse.json({ success: true, data, total, totalPages: Math.ceil(total / params.limit) || 1 }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const known = errorResponse(error);
    if (known) return NextResponse.json(known.body, { status: known.status, headers: { 'Cache-Control': 'no-store' } });
    console.error('admin email-logs failed:', error);
    return NextResponse.json({ error: 'Failed to fetch email logs' }, { status: 500 });
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
