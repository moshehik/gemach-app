import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    const resolvedParams = await params;
    const employeeId = resolvedParams.id;
    
    if (!employeeId) {
      return NextResponse.json({ error: 'Invalid Employee ID' }, { status: 400 });
    }

    const history = await prisma.auditLog.findMany({
      where: {
        employeeId: employeeId,
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 100 // Limit to recent 100 logs
    });

    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching employee history:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
