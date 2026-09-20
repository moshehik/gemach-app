import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';
import { checkAuth } from '../../../lib/auth';


export async function POST(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const body = await request.json();
    // שני צורות גוף: { entries: [...] } - האצווה שה-interceptor ב-app/layout.js שולח (כל ~20 שנ'
    // או בסגירת הדף), או רשומה בודדת { pageUrl, ... } - דפי ההדפסה (app/print/*) עדיין שולחים כך.
    const rawEntries = Array.isArray(body?.entries) ? body.entries : [body];
    const now = Date.now();
    const entries = rawEntries
      .slice(0, 50)
      .filter((e) => e && typeof e.pageUrl === 'string' && e.pageUrl)
      .map((e) => ({
        pageUrl: e.pageUrl.slice(0, 2000),
        loadingError: e.loadingError ? String(e.loadingError).slice(0, 2000) : null,
        requestQuery: e.requestQuery ? String(e.requestQuery).slice(0, 4000) : null,
        responseSize: typeof e.responseSize === 'number' ? e.responseSize : null,
        executionTime: typeof e.executionTime === 'number' ? e.executionTime : null,
        // חותמת הזמן של הקליינט נשמרת (האצווה נשלחת עד ~20 שנ' אחרי הפעולה) - רק אם סבירה
        timestamp: typeof e.ts === 'number' && e.ts <= now + 60000 && e.ts >= now - 15 * 60000 ? new Date(e.ts) : undefined,
      }));

    if (entries.length === 0) {
      return NextResponse.json({ success: false, message: 'URL is required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const authCookie = cookieStore.get('auth_token');

    let employeeId = null;
    let employeeName = 'אורח';
    let isGuest = true;

    if (authCookie && authCookie.value) {
      // auth_token is the Employee's UUID `id`, not a numeric legacyId - store it as-is
      // (PageVisitLog.employeeId is a String field), don't parseInt it.
      const candidateId = authCookie.value;
      const emp = await prisma.employee.findUnique({
        where: { id: candidateId },
        select: { firstName: true, lastName: true }
      });
      if (emp) {
        employeeId = candidateId;
        isGuest = false;
        employeeName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || `עובד ${candidateId}`;
      }
    }

    await prisma.pageVisitLog.createMany({
      data: entries.map((e) => ({ ...e, employeeId, employeeName, isGuest })),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to log page visit:', error);
    // Return 200 even on error so we don't break the client with tracking failures
    return NextResponse.json({ success: false, error: 'Failed to log visit' }, { status: 200 });
  }
}
