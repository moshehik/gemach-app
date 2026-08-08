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

    const employeeId = token.value;
    if (!employeeId) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const parsedLegacyId = parseInt(employeeId, 10);
    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          { id: employeeId },
          ...(isNaN(parsedLegacyId) ? [] : [{ legacyId: parsedLegacyId }])
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        fullName: true,
        isActive: true,
        roleId: true,
        receiveEmailAlerts: true,
        email: true,
        showAi: true,
        department: { select: { name: true } }
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

export async function PATCH(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');

    if (!token?.value) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const employeeId = token.value;
    if (!employeeId) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const updateData = {};

    if (typeof body.receiveEmailAlerts !== 'undefined') {
      updateData.receiveEmailAlerts = Boolean(body.receiveEmailAlerts);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: 'No data to update' }, { status: 400 });
    }

    const updatedEmployee = await prisma.employee.update({
      where: { id: employeeId },
      data: updateData,
      select: {
        id: true,
        receiveEmailAlerts: true
      }
    });

    return NextResponse.json({ success: true, employee: updatedEmployee });

  } catch (error) {
    console.error('Error in /api/me PATCH:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
