import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { parseCustomersListParams } from '@/lib/adminCustomersList';
import { queryCustomersCounts } from '@/lib/adminCustomersListServer';
import { errorResponse } from '@/lib/adminListGuards';

// ספירת האפשרויות של חלון "סינון" ברשימת הלקוחות לניהול: לכל אפשרות - כמה לקוחות יוצאות אם בוחרים בה, כשכל הקבוצות האחרות והחיפוש נשארים
// (אותה סמנטיקה כמו ערכת הרשימות: אפשרות בלי תוצאות מוסתרת). נפרד מהרשימה, והלקוח קורא לו רק כשחלון הסינון נפתח (ר' useAdminServerList).
// החישוב בזיכרון מתמונת הלקוחות המשותפת (מטמון 30 שנ') - אין שאילתת count לכל אפשרות. אותו שער: הנהלה ראשית / מתכנת; חריגת תקציב = 503.
export const dynamic = 'force-dynamic';

async function handle(input) {
  if (!(await checkAuth('הנהלה ראשית'))) return NextResponse.json({ error: 'נדרשת הרשאת הנהלה ראשית' }, { status: 401 });
  try {
    return NextResponse.json(await queryCustomersCounts(parseCustomersListParams(input)), { headers: { 'Cache-Control': 'private, max-age=15' } });
  } catch (error) {
    const known = errorResponse(error);
    if (known) return NextResponse.json(known.body, { status: known.status, headers: { 'Cache-Control': 'no-store' } });
    console.error('admin customers-list counts failed:', error);
    return NextResponse.json({ error: 'Failed to count customers' }, { status: 500 });
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
