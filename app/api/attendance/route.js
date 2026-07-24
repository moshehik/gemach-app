import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { checkAuth } from '../../../lib/auth';




// Get attendance records, optionally filter by month and year
export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const employeeId = searchParams.get('employeeId');

    let whereClause = {};

      whereClause.employeeId = employeeId;
    }

    if (month && year) {
      const startDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      const endDate = new Date(parseInt(year, 10), parseInt(month, 10), 0, 23, 59, 59); // Last day of month
      
      whereClause.date = {
        gte: startDate,
        lte: endDate
      };
    }

    const shifts = await prisma.shift.findMany({
      where: whereClause,
      include: {
        employee: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: { date: 'desc' }
    });

    return NextResponse.json(shifts);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Punch In / Punch Out
export async function POST(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const body = await request.json();
    const { employeeId, password, action } = body; // action is 'IN' or 'OUT'

    if (!employeeId || !['IN', 'OUT'].includes(action)) {
      return NextResponse.json({ error: 'Missing required fields or invalid action' }, { status: 400 });
    }

    const parsedLegacyId = parseInt(employeeId, 10);
    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          ...(isNaN(parsedLegacyId) ? [] : [{ legacyId: parsedLegacyId }]),
          { id: String(employeeId) }
        ]
      }
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Verify password OR check if the logged in user is the same employee
    if (password) {
      if (employee.password !== password) {
        return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
      }
    } else {
      // If no password provided, ensure the current session belongs to this employee
      const { cookies } = require('next/headers');
      const cookieStore = await cookies();
      const token = cookieStore.get('auth_token');
      if (!token || token.value !== String(employeeId)) {
        return NextResponse.json({ error: 'Unauthorized to punch clock without password' }, { status: 401 });
      }
    }

    if (!employee.isActive) {
       return NextResponse.json({ error: 'Employee account is inactive' }, { status: 403 });
    }

    const now = new Date();
    // Normalize date to start of day for the 'date' field
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // Find if there is an active shift for today (entry but no exit)
    let currentShift = await prisma.shift.findFirst({
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

    if (action === 'IN') {
      if (currentShift) {
        return NextResponse.json({ error: 'Already punched in' }, { status: 400 });
      }

      // Create new shift
      const newShift = await prisma.shift.create({
        data: {
          employeeId: employee.id,
          date: todayStart,
          entryTime: now,
          hourlyWageSnapshot: employee.hourlyWage || 0,
          travelExpensesSnapshot: employee.travelExpenses || 0
        }
      });
      return NextResponse.json({ message: 'Punched IN successfully', shift: newShift });

    } else if (action === 'OUT') {
      if (!currentShift) {
        // Look for the most recent shift without an exit time, even if from a previous day
        currentShift = await prisma.shift.findFirst({
           where: {
             employeeId: employee.id,
             exitTime: null
           },
           orderBy: { id: 'desc' }
        });

        if (!currentShift) {
           return NextResponse.json({ error: 'No active shift found to punch out from' }, { status: 400 });
        }
      }

      const entryTime = new Date(currentShift.entryTime);
      const diffMs = now - entryTime;
      const totalMinutes = Math.floor(diffMs / 60000);

      // Calculate total pay: (minutes / 60) * hourly wage
      const hourlyWage = currentShift.hourlyWageSnapshot || employee.hourlyWage || 0;
      const travel = currentShift.travelExpensesSnapshot || employee.travelExpenses || 0;
      let totalCalculated = (totalMinutes / 60) * hourlyWage;
      
      // Add travel expenses if it's the first shift of the day? Or just add it per shift.
      // Usually it's per day, but for simplicity we add it to the shift.
      totalCalculated += travel;

      const updatedShift = await prisma.shift.update({
        where: { id: currentShift.id },
        data: {
          exitTime: now,
          totalMinutes,
          totalCalculated: parseFloat(totalCalculated.toFixed(2))
        }
      });
      return NextResponse.json({ message: 'Punched OUT successfully', shift: updatedShift });
    }

  } catch (error) {
    console.error('Error with punch clock:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
