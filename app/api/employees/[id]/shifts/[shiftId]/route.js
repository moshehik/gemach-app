import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';

export async function PUT(request, { params }) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const resolvedParams = await params;
    const employeeId = resolvedParams.id;
    const shiftId = resolvedParams.shiftId;
    
    if (!employeeId || !shiftId) {
      return NextResponse.json({ error: 'Invalid ID parameters' }, { status: 400 });
    }

    const body = await request.json();

    const entryTime = body.entryTime !== undefined ? (body.entryTime ? new Date(body.entryTime) : null) : undefined;
    const exitTime = body.exitTime !== undefined ? (body.exitTime ? new Date(body.exitTime) : null) : undefined;

    // Check for overlap if entryTime or exitTime is being updated
    if (entryTime !== undefined || exitTime !== undefined) {
      const existingShift = await prisma.shift.findUnique({ where: { id: shiftId } });
      const checkEntry = entryTime !== undefined ? entryTime : existingShift.entryTime;
      const checkExit = exitTime !== undefined ? exitTime : existingShift.exitTime;

      if (checkEntry && checkExit) {
        const overlappingShifts = await prisma.shift.findMany({
          where: {
            employeeId: employeeId,
            id: { not: shiftId },
            isDeleted: false,
            OR: [
              {
                entryTime: { lt: checkExit },
                exitTime: { gt: checkEntry }
              }
            ]
          }
        });
        if (overlappingShifts.length > 0) {
          return NextResponse.json({ error: 'שגיאה: קיימת משמרת חופפת בזמנים אלו' }, { status: 400 });
        }
      }
    }

    const oldShift = await prisma.shift.findUnique({ where: { id: shiftId } });

    const updatedShift = await prisma.shift.update({
      where: { id: shiftId },
      data: {
        date: body.date ? new Date(body.date) : undefined,
        hebrewDate: body.hebrewDate !== undefined ? body.hebrewDate : undefined,
        entryTime: entryTime,
        exitTime: exitTime,
        totalMinutes: body.totalMinutes !== undefined
          ? (body.totalMinutes !== "" && body.totalMinutes !== null ? parseInt(body.totalMinutes, 10) : null)
          : undefined,
        totalCalculated: body.totalCalculated !== undefined
          ? (body.totalCalculated !== "" && body.totalCalculated !== null ? parseFloat(body.totalCalculated) : null)
          : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
        isDeleted: body.isDeleted !== undefined ? body.isDeleted : undefined
      }
    });

    // eslint-disable-next-line no-restricted-syntax -- Shift מוחרג מתוסף היומן, ולכן אין שורה אוטומטית
    await prisma.auditLog.create({
      data: {
        entityType: 'Shift',
        entityId: shiftId,
        action: 'UPDATE',
        changesJson: JSON.stringify({ from: oldShift, to: updatedShift }),
        employeeId: employeeId
      }
    });

    return NextResponse.json(updatedShift);
  } catch (error) {
    console.error('Error updating shift:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const resolvedParams = await params;
    const employeeId = resolvedParams.id;
    const shiftId = resolvedParams.shiftId;

    if (!employeeId || !shiftId) {
      return NextResponse.json({ error: 'Invalid ID parameters' }, { status: 400 });
    }

    const oldShift = await prisma.shift.findUnique({ where: { id: shiftId } });

    // Soft delete
    const deletedShift = await prisma.shift.update({
      where: { id: shiftId },
      data: { isDeleted: true }
    });

    // eslint-disable-next-line no-restricted-syntax -- Shift מוחרג מתוסף היומן, ולכן אין שורה אוטומטית
    await prisma.auditLog.create({
      data: {
        entityType: 'Shift',
        entityId: shiftId,
        action: 'DELETE',
        changesJson: JSON.stringify({ from: oldShift, to: deletedShift }),
        employeeId: employeeId
      }
    });

    return NextResponse.json({ success: true, id: deletedShift.id });
  } catch (error) {
    console.error('Error deleting shift:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
