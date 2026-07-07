import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';



export async function PUT(request, { params }) {
  try {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    
    // Calculate totalMinutes and totalCalculated if entry and exit are provided
    let totalMinutes = null;
    let totalCalculated = null;

    if (body.entryTime && body.exitTime) {
      const entry = new Date(body.entryTime);
      const exit = new Date(body.exitTime);
      const diffMs = exit - entry;
      totalMinutes = Math.floor(diffMs / 60000);

      // We need hourly wage, if it's passed or fetch from DB
      let hourlyWage = body.hourlyWageSnapshot || 0;
      let travel = body.travelExpensesSnapshot || 0;

      if (!hourlyWage || !travel) {
         const shift = await prisma.shift.findUnique({ where: { id } });
         if (shift) {
            hourlyWage = hourlyWage || shift.hourlyWageSnapshot || 0;
            travel = travel || shift.travelExpensesSnapshot || 0;
         }
      }

      totalCalculated = (totalMinutes / 60) * hourlyWage + travel;
      totalCalculated = parseFloat(totalCalculated.toFixed(2));
    }

    const dataToUpdate = {
      entryTime: body.entryTime ? new Date(body.entryTime) : null,
      exitTime: body.exitTime ? new Date(body.exitTime) : null,
      date: body.date ? new Date(body.date) : undefined,
      notes: body.notes,
      hourlyWageSnapshot: body.hourlyWageSnapshot,
      travelExpensesSnapshot: body.travelExpensesSnapshot
    };

    if (totalMinutes !== null) dataToUpdate.totalMinutes = totalMinutes;
    if (totalCalculated !== null) dataToUpdate.totalCalculated = totalCalculated;

    const updatedShift = await prisma.shift.update({
      where: { id },
      data: dataToUpdate
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
    const id = parseInt(resolvedParams.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    await prisma.shift.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting shift:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
