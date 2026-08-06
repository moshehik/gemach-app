import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { attachEmployeeNames } from '@/app/lib/auditLog';

export async function GET(request, { params }) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const resolvedParams = await params;
    const employeeId = resolvedParams.id;

    if (!employeeId) {
      return NextResponse.json({ error: 'Invalid Employee ID' }, { status: 400 });
    }

    // `employeeId` on AuditLog is the ACTOR who made a change, not the entity being changed.
    // The history tab wants changes made TO this employee's own record (entityType:
    // 'Employee', entityId: <this employee's id>) AND changes made to this employee's
    // shifts (entityType: 'Shift', entityId: <shift id>, written by hand from the shifts
    // routes since Shift is excluded from the automatic audit extension - see
    // app/lib/prisma.js). Previously this route only queried the 'Employee' rows, so a
    // shift's own AuditLog entries (e.g. "הוספת משמרת") never appeared in this tab even
    // though they were recorded correctly in the database.
    const shifts = await prisma.shift.findMany({
      where: { employeeId },
      select: { id: true }
    });
    const shiftIds = shifts.map(s => s.id);

    const history = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: 'Employee', entityId: employeeId },
          ...(shiftIds.length > 0 ? [{ entityType: 'Shift', entityId: { in: shiftIds } }] : [])
        ]
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 100 // Limit to recent 100 logs
    });

    const historyWithNames = await attachEmployeeNames(history);

    return NextResponse.json(historyWithNames);
  } catch (error) {
    console.error('Error fetching employee history:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
