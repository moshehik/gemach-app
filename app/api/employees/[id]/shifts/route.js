import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';



export async function POST(request, { params }) {
  try {
    const resolvedParams = await params;
    const employeeId = parseInt(resolvedParams.id, 10);
    if (isNaN(employeeId)) {
      return NextResponse.json({ error: 'Invalid Employee ID' }, { status: 400 });
    }

    const body = await request.json();

    const newShift = await prisma.shift.create({
      data: {
        employeeId,
        date: body.date ? new Date(body.date) : new Date(),
        hebrewDate: body.hebrewDate || null,
        entryTime: body.entryTime ? new Date(body.entryTime) : null,
        exitTime: body.exitTime ? new Date(body.exitTime) : null,
        totalMinutes: body.totalMinutes || null,
        totalCalculated: body.totalCalculated || null,
        notes: body.notes || null,
        isDeleted: false
      }
    });

    return NextResponse.json(newShift);
  } catch (error) {
    console.error('Error creating shift:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
