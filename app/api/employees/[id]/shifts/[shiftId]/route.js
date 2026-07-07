import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';



export async function PUT(request, { params }) {
  try {
    const resolvedParams = await params;
    const employeeId = parseInt(resolvedParams.id, 10);
    const shiftId = parseInt(resolvedParams.shiftId, 10);
    
    if (isNaN(employeeId) || isNaN(shiftId)) {
      return NextResponse.json({ error: 'Invalid ID parameters' }, { status: 400 });
    }

    const body = await request.json();

    const updatedShift = await prisma.shift.update({
      where: { id: shiftId },
      data: {
        date: body.date ? new Date(body.date) : undefined,
        hebrewDate: body.hebrewDate !== undefined ? body.hebrewDate : undefined,
        entryTime: body.entryTime !== undefined ? (body.entryTime ? new Date(body.entryTime) : null) : undefined,
        exitTime: body.exitTime !== undefined ? (body.exitTime ? new Date(body.exitTime) : null) : undefined,
        totalMinutes: body.totalMinutes !== undefined ? body.totalMinutes : undefined,
        totalCalculated: body.totalCalculated !== undefined ? body.totalCalculated : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
      }
    });

    return NextResponse.json(updatedShift);
  } catch (error) {
    console.error('Error updating shift:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const resolvedParams = await params;
    const employeeId = parseInt(resolvedParams.id, 10);
    const shiftId = parseInt(resolvedParams.shiftId, 10);

    if (isNaN(employeeId) || isNaN(shiftId)) {
      return NextResponse.json({ error: 'Invalid ID parameters' }, { status: 400 });
    }

    // Soft delete
    const deletedShift = await prisma.shift.update({
      where: { id: shiftId },
      data: { isDeleted: true }
    });

    return NextResponse.json({ success: true, id: deletedShift.id });
  } catch (error) {
    console.error('Error deleting shift:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
