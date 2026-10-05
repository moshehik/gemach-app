import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { getBootInfo } from '@/lib/bootInfo';
import { withCpuTiming } from '@/lib/cpuTiming';

// מידע על ההפעלה (boot) של האינסטנס שענה: bootId/bootAt/uptime. מחובר בלבד (checkAuth).
// בקשה חוזרת שמחזירה bootId אחר = אינסטנס אחר/קר. ר' docs/cpu-measurement-2026-10-06.md.
// (/api/health עצמו נשאר ציבורי ובלי מידע - הוא משמש בדיקות חוץ.)
export const dynamic = 'force-dynamic';

async function GET() {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  return NextResponse.json(getBootInfo(), { headers: { 'Cache-Control': 'no-store' } });
}

const GET_timed = withCpuTiming(GET);
export { GET_timed as GET };
