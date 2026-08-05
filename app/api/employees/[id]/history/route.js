import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';

export async function GET(request, { params }) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const resolvedParams = await params;
    const employeeId = resolvedParams.id;

    if (!employeeId) {
      return NextResponse.json({ error: 'Invalid Employee ID' }, { status: 400 });
    }

    // `employeeId` on AuditLog is the ACTOR who made a change, not the entity being changed.
    // The history tab wants changes made TO this employee's own record, which are logged
    // under entityType: 'Employee', entityId: <this employee's id> (see the audit
    // extension in app/lib/prisma.js, and 'Shift' entries this employee's shifts routes
    // write by hand with the same entityType/entityId convention).
    const history = await prisma.auditLog.findMany({
      where: {
        entityType: 'Employee',
        entityId: employeeId,
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
