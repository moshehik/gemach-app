import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');

    if (!token?.value) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const employeeId = parseInt(token.value, 10);
    if (isNaN(employeeId)) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        fullName: true,
        isActive: true,
        roleId: true,
        // specifically excluding password here
      }
    });

    if (!employee || !employee.isActive) {
      return NextResponse.json({ success: false, error: 'Employee not found or inactive' }, { status: 401 });
    }

    // Check for active shift today
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const activeShift = await prisma.shift.findFirst({
      where: {
        employeeId: employee.id,
        date: {
          gte: todayStart,
          lte: todayEnd
        },
        exitTime: null
      },
      orderBy: { id: 'desc' }
    });

    return NextResponse.json({ 
      success: true, 
      employee, 
      activeShift 
    });

  } catch (error) {
    console.error('Error in /api/me:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
