import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { checkAuth } from '../../../lib/auth';

export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search') || '';

    const where = {};
    if (search) {
      where.OR = [
        { to: { contains: search } },
        { subject: { contains: search } },
        { body: { contains: search } }
      ];
    }

    const total = await prisma.emailLog.count({ where });
    const totalPages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;

    const data = await prisma.emailLog.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      skip,
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data,
      total,
      totalPages
    });
  } catch (error) {
    console.error('Failed to fetch email logs:', error);
    return NextResponse.json({ success: false, message: 'שגיאת שרת' }, { status: 500 });
  }
}
