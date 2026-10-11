import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { parseOrdersListParams } from '@/lib/adminOrdersList';
import { queryOrdersCounts } from '@/lib/adminOrdersListServer';
import { errorResponse } from '@/lib/adminListGuards';

// ספירת האפשרויות של חלון "סינון" ברשימת ההזמנות לניהול: לכל אפשרות - כמה הזמנות יוצאות אם בוחרים בה, כשכל הקבוצות האחרות והחיפוש נשארים
// (אותה סמנטיקה כמו ערכת הרשימות: אפשרות בלי תוצאות מוסתרת). נפרד מהרשימה, והלקוח קורא לו רק כשחלון הסינון נפתח (ר' useAdminServerList).
// החישוב בזיכרון מתמונת ההזמנות המשותפת (מטמון 30 שנ') - אין שאילתת count לכל אפשרות. אותו שער: הנהלה ראשית / מתכנת; חריגת תקציב = 503.
export const dynamic = 'force-dynamic';

async function handle(input) {
  if (!(await checkAuth('הנהלה ראשית'))) return NextResponse.json({ error: 'נדרשת הרשאת הנהלה ראשית' }, { status: 401 });
  try {
    return NextResponse.json(await queryOrdersCounts(parseOrdersListParams(input)), { headers: { 'Cache-Control': 'private, max-age=15' } });
  } catch (error) {
    const known = errorResponse(error);
    if (known) return NextResponse.json(known.body, { status: known.status, headers: { 'Cache-Control': 'no-store' } });
    console.error('admin orders-list counts failed:', error);
    return NextResponse.json({ error: 'Failed to count orders' }, { status: 500 });
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
