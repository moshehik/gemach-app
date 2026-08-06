import { NextResponse } from 'next/server';

import { checkAuth } from '../../../../lib/auth';

import prisma from '@/app/lib/prisma';

export async function GET(request) {
  if (!(await checkAuth('מנהל'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const reports = await prisma.auditReport.findMany({
      orderBy: { runAt: 'desc' },
      take: 20
    });

    return NextResponse.json(reports, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch audit reports:', error);
    return NextResponse.json({ error: 'Failed to fetch audit reports' }, { status: 500 });
  }
}
