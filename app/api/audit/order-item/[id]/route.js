import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { checkAuth } from '@/lib/auth';

export async function GET(request, { params }) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { id } = await params;

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
