import { NextResponse } from 'next/server';

import { checkAuth } from '../../../../lib/auth';

import prisma from '@/app/lib/prisma';

export async function GET(request) {
  if (!(await checkAuth('מנהל'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const logs = await prisma.queryLog.findMany({
      orderBy: { executedAt: 'desc' },
      take: 50
    });

    return NextResponse.json(logs, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch query logs:', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}
