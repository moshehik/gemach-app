import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { queryAuditCounts } from '@/lib/adminAuditListServer';
import { errorResponse } from '@/lib/adminListGuards';

// ספירת האפשרויות של חלון "סינון" בהיסטוריית הנתונים: לכל אפשרות - כמה רשומות יוצאות אם בוחרים בה, כשכל הקבוצות האחרות והחיפוש נשארים
// (אפשרות בלי תוצאות מוסתרת). נפרד מהרשימה, והלקוח קורא לו רק כשחלון הסינון נפתח (ר' useAdminServerList). כל ספירה חסומה ל-100,000 שורות ובתקציב זמן.
// אותו שער: הנהלה ראשית / מתכנת; חריגת תקציב = 503.
export const dynamic = 'force-dynamic';

async function handle(input) {
  if (!(await checkAuth('הנהלה ראשית'))) return NextResponse.json({ error: 'נדרשת הרשאת הנהלה ראשית' }, { status: 401 });
  try {
    return NextResponse.json(await queryAuditCounts(input, { isHead: true }), { headers: { 'Cache-Control': 'private, max-age=15' } });
  } catch (error) {
    const known = errorResponse(error);
    if (known) return NextResponse.json(known.body, { status: known.status, headers: { 'Cache-Control': 'no-store' } });
    console.error('admin data-history counts failed:', error);
    return NextResponse.json({ error: 'Failed to count history' }, { status: 500 });
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
