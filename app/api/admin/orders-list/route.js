import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { parseOrdersListParams } from '@/lib/adminOrdersList';
import { queryOrdersList } from '@/lib/adminOrdersListServer';
import { errorResponse, validatePaging, BadRequestError } from '@/lib/adminListGuards';

// רשימת ההזמנות לניהול (/admin/orders-list): עמוד אחד (עד 100; ייצוא export:true עד 500) לפי חיפוש + סינון + מיון, שרת בלבד - לעולם לא כל ההזמנות.
// שער: הנהלה ראשית / מתכנת (checkAuth('הנהלה ראשית')) - אותו שער כמו שאר ה-API של /admin. אורח / עובד אחר: 401, בלי נתונים.
// גבולות עלות (lib/adminListGuards.js): היסט מוגזם = 400; חריגת תקציב זמן / עומס = 503 "צמצמו את הסינון" (לא תלייה); ר' orders-list-notes.md.
// GET = פרמטרים ב-query; POST = אותו דבר ב-JSON (מזהי ה"חיפוש החכם" ארוכים מדי ל-URL). הלוגיקה: lib/adminOrdersList*.js.
export const dynamic = 'force-dynamic';

async function handle(input) {
  if (!(await checkAuth('הנהלה ראשית'))) return NextResponse.json({ error: 'נדרשת הרשאת הנהלה ראשית' }, { status: 401 });
  try {
    const params = parseOrdersListParams(input);
    const bad = validatePaging(params);
    if (bad) throw new BadRequestError(bad);
    return NextResponse.json(await queryOrdersList(params), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const known = errorResponse(error);
    if (known) return NextResponse.json(known.body, { status: known.status, headers: { 'Cache-Control': 'no-store' } });
    console.error('admin orders-list failed:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
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
