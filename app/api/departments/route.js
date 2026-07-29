import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';

export async function GET() {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { roleId: 'asc' }
    });
    return NextResponse.json(departments);
  } catch (error) {
    console.error('Error fetching departments:', error);
    // Return fallback defaults if query fails
    return NextResponse.json([
      { roleId: 0, name: 'הנהלה ראשית' },
      { roleId: 1, name: 'הנהלה' },
      { roleId: 2, name: 'מתכנת' },
      { roleId: 3, name: 'תופרת' },
      { roleId: 4, name: 'מזכירה' },
      { roleId: 6, name: 'מסך לקוחות' }
    ]);
  }
}
