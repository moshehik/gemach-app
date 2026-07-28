import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(request, { params }) {
  try {
    const resolvedParams = await params;
    const employeeId = resolvedParams.id;
    
    if (!employeeId) {
      return NextResponse.json({ error: 'Invalid Employee ID' }, { status: 400 });
    }

    const body = await request.json();

    const entryTime = body.entryTime ? new Date(body.entryTime) : null;
    const exitTime = body.exitTime ? new Date(body.exitTime) : null;

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

    const newShift = await prisma.shift.create({
      data: {
        employeeId,
        date: body.date ? new Date(body.date) : new Date(),
        hebrewDate: body.hebrewDate || null,
        entryTime: entryTime,
        exitTime: exitTime,
        totalMinutes: body.totalMinutes || null,
        totalCalculated: body.totalCalculated || null,
        notes: body.notes || null,
        isDeleted: false
      }
    });

    // Create Audit Log
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
