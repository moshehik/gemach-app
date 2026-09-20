import { NextResponse } from 'next/server';


import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { SAFE_EMPLOYEE_SELECT } from '@/lib/safeSelect';

export async function GET(request, { params }) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const resolvedParams = await params;
    const idParam = resolvedParams.id;
    
    let order;

    if (idParam.includes('-')) {
      // UUID
      order = await prisma.order.findUnique({
        where: { id: idParam },
        include: { employee: { select: SAFE_EMPLOYEE_SELECT } }
      });
    } else {
      // Legacy Int ID
      const id = parseInt(idParam);
      if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
      }
      order = await prisma.order.findUnique({
        where: { orderId: id },
        include: { employee: { select: SAFE_EMPLOYEE_SELECT } }
      });
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Base the time context on orderDate (or fallback to new Date())
    const targetDate = order.orderDate || new Date();
    
    // Find all shifts on that day
    // We normalize targetDate to start and end of day in local time or UTC.
    // For simplicity, we can look for shifts where date matches targetDate's date
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const shiftsOnDay = await prisma.shift.findMany({
      where: {
        isDeleted: false,
        OR: [
          {
            date: {
              gte: startOfDay,
              lte: endOfDay
            }
          },
          {
            entryTime: {
              gte: startOfDay,
              lte: endOfDay
            }
          }
        ]
      },
      include: {
        employee: { select: SAFE_EMPLOYEE_SELECT }
      }
    });

    // Extract unique active employees
    const activeEmployeesMap = new Map();
    shiftsOnDay.forEach(shift => {
      if (shift.employee) {
        // Skip adding the executing employee to the "other employees" list if they are the one
        if (order.employeeId !== shift.employee.id) {
          activeEmployeesMap.set(shift.employee.id, shift.employee);
        }
      }
    });

    const activeEmployees = Array.from(activeEmployeesMap.values());

    return NextResponse.json({
      executingEmployee: order.employee || null,
      activeEmployees: activeEmployees,
      orderDate: targetDate
    });
  } catch (error) {
    console.error('Error fetching order employees:', error);
    return NextResponse.json({ error: 'Failed to fetch order employees', details: error.message }, { status: 500 });
  }
}
