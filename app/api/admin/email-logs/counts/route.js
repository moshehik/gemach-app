import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { parseEmailLogsParams } from '@/lib/adminEmailLogs';
import { queryEmailLogsCounts } from '@/lib/adminEmailLogsServer';
import { errorResponse } from '@/lib/adminListGuards';

// ספירת האפשרויות של חלון "סינון" ביומן המיילים: לכל אפשרות - כמה מיילים יוצאים אם בוחרים בה, כשכל הקבוצות האחרות והחיפוש נשארים (אותה סמנטיקה כמו ערכת הרשימות).
// נפרד מהרשימה; הלקוח קורא לו רק כשחלון הסינון פתוח (useAdminServerList). שער: מתכנת בלבד; חריגת תקציב = 503.
export const dynamic = 'force-dynamic';

async function handle(input) {
  if (!(await checkAuth('מתכנת'))) return NextResponse.json({ error: 'נדרשת הרשאת מתכנת' }, { status: 401 });
  try {
    return NextResponse.json(await queryEmailLogsCounts(parseEmailLogsParams(input)), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const known = errorResponse(error);
    if (known) return NextResponse.json(known.body, { status: known.status, headers: { 'Cache-Control': 'no-store' } });
    console.error('admin email-logs counts failed:', error);
    return NextResponse.json({ error: 'Failed to count email logs' }, { status: 500 });
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
