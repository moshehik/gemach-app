import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';

export async function GET(request, { params }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'חסר קוד פריט' }, { status: 400 });
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: 'OrderItem',
        entityId: id
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'שגיאה בשליפת היסטוריה' }, { status: 500 });
  }
}
