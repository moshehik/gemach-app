import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    
    let startDate, endDate;
    if (month && year) {
      startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
    } else {
      // Default to current month
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const employees = await prisma.employee.findMany({
      where: {
        // We could filter by isActive, but let's get everyone who might have shifts this month
      },
      include: {
        shifts: {
          where: {
            isDeleted: false,
            date: {
              gte: startDate,
              lte: endDate
            }
          },
          orderBy: {
            date: 'asc'
          }
        },
        department: true
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' }
      ]
    });

    // Filter out inactive employees that have no shifts in this period
    const activeOrWithShifts = employees.filter(e => e.isActive || e.shifts.length > 0);

    return NextResponse.json({
      success: true,
      data: activeOrWithShifts,
      period: {
        startDate,
        endDate
      }
    });
  } catch (error) {
    console.error('Error fetching attendance report:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch attendance data' }, { status: 500 });
  }
}
