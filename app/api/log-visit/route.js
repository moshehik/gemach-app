import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';
import { checkAuth } from '../../../lib/auth';


export async function POST(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const body = await request.json();
    const { pageUrl, loadingError, requestQuery, responseSize, executionTime } = body;

    if (!pageUrl) {
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

    await prisma.pageVisitLog.create({
      data: {
        pageUrl,
        employeeId,
        employeeName,
        loadingError: loadingError || null,
        isGuest,
        requestQuery: requestQuery || null,
        responseSize: typeof responseSize === 'number' ? responseSize : null,
        executionTime: typeof executionTime === 'number' ? executionTime : null,
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to log page visit:', error);
    // Return 200 even on error so we don't break the client with tracking failures
    return NextResponse.json({ success: false, error: 'Failed to log visit' }, { status: 200 });
  }
}
