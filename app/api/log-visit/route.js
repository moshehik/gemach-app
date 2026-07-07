import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    const body = await request.json();
    const { pageUrl, loadingError } = body;

    if (!pageUrl) {
      return NextResponse.json({ success: false, message: 'URL is required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const authCookie = cookieStore.get('auth_token');

    let employeeId = null;
    let employeeName = 'אורח';
    let isGuest = true;

    if (authCookie && authCookie.value) {
      employeeId = parseInt(authCookie.value, 10);
      if (!isNaN(employeeId)) {
        const emp = await prisma.employee.findUnique({
          where: { id: employeeId },
          select: { firstName: true, lastName: true }
        });
        if (emp) {
          isGuest = false;
          employeeName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || `עובד ${employeeId}`;
        } else {
          employeeId = null;
        }
      } else {
        employeeId = null;
      }
    }

    await prisma.pageVisitLog.create({
      data: {
        pageUrl,
        employeeId,
        employeeName,
        loadingError: loadingError || null,
        isGuest,
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to log page visit:', error);
    // Return 200 even on error so we don't break the client with tracking failures
    return NextResponse.json({ success: false, error: 'Failed to log visit' }, { status: 200 });
  }
}
