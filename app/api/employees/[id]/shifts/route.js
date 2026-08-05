import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';

export async function POST(request, { params }) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const resolvedParams = await params;
    const employeeId = resolvedParams.id;

    if (!employeeId) {
      return NextResponse.json({ error: 'Invalid Employee ID' }, { status: 400 });
    }

    const body = await request.json();

    const entryTime = body.entryTime ? new Date(body.entryTime) : null;
    const exitTime = body.exitTime ? new Date(body.exitTime) : null;
    const shiftDate = body.date ? new Date(body.date) : new Date();

    // Validation for overlapping shifts
    if (entryTime && exitTime) {
      const overlappingShifts = await prisma.shift.findMany({
        where: {
          employeeId: employeeId,
          isDeleted: false,
          OR: [
            {
              entryTime: { lt: exitTime },
              exitTime: { gt: entryTime }
            }
          ]
        }
      });
      if (overlappingShifts.length > 0) {
        return NextResponse.json({ error: 'שגיאה: העובד כבר רשום למשמרת בשעות אלו' }, { status: 400 });
      }
    }

    // Calculate totals the same way the punch-clock (POST /api/attendance) does. The UI
    // shows these fields as "מחושב אוטומטית" but this route used to just store whatever
    // (empty) totalMinutes/totalCalculated the client sent, so manual shifts never got paid.
    let totalMinutes = body.totalMinutes || null;
    let totalCalculated = body.totalCalculated || null;
    let hourlyWageSnapshot = null;
    let travelExpensesSnapshot = null;

    if (entryTime && exitTime) {
      const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
      const diffMs = exitTime - entryTime;
      totalMinutes = Math.floor(diffMs / 60000);

      hourlyWageSnapshot = employee?.hourlyWage || 0;
      const travelEligible = employee?.travelExpenses || 0;

      // Same daily (not per-punch) travel rule as the punch-clock: only pay it if no other
      // shift for this employee on the same day already carries it.
      let travelForThisShift = 0;
      if (travelEligible) {
        const otherShiftWithTravelToday = await prisma.shift.findFirst({
          where: {
            employeeId,
            date: shiftDate,
            isDeleted: false,
            travelExpensesSnapshot: { gt: 0 }
          }
        });
        if (!otherShiftWithTravelToday) {
          travelForThisShift = travelEligible;
        }
      }
      travelExpensesSnapshot = travelForThisShift;

      totalCalculated = parseFloat((((totalMinutes / 60) * hourlyWageSnapshot) + travelForThisShift).toFixed(2));
    }

    const newShift = await prisma.shift.create({
      data: {
        employeeId,
        date: shiftDate,
        hebrewDate: body.hebrewDate || null,
        entryTime: entryTime,
        exitTime: exitTime,
        totalMinutes: totalMinutes,
        totalCalculated: totalCalculated,
        hourlyWageSnapshot: hourlyWageSnapshot,
        travelExpensesSnapshot: travelExpensesSnapshot,
        notes: body.notes || null,
        isDeleted: false
      }
    });

    // Create Audit Log
    // eslint-disable-next-line no-restricted-syntax -- Shift מוחרג מתוסף היומן, ולכן אין שורה אוטומטית
    await prisma.auditLog.create({
      data: {
        entityType: 'Shift',
        entityId: newShift.id,
        action: 'CREATE',
        changesJson: JSON.stringify({ to: newShift }),
        employeeId: employeeId
      }
    });

    return NextResponse.json(newShift);
  } catch (error) {
    console.error('Error creating shift:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
