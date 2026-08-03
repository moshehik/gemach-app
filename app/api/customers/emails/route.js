import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { normalizeEmail } from '@/lib/emailUtils';

export async function GET(request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const customers = await prisma.customer.findMany({
      where: {
        isDeleted: false,
        email: { not: null, not: '' }
      },
      orderBy: { legacyId: 'desc' },
      select: {
        id: true,
        legacyId: true,
        firstName: true,
        lastName: true,
        phone1: true,
        city: true,
        email: true,
        emailSuffix: true
      }
    });

    const formatted = customers.map(c => ({
      id: c.id,
      legacyId: c.legacyId,
      name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'ללא שם',
      phone: c.phone1 || '',
      city: c.city || '',
      email: normalizeEmail(c.email, c.emailSuffix)
    })).filter(c => c.email && c.email.includes('@'));

    return NextResponse.json({
      success: true,
      count: formatted.length,
      data: formatted
    });
  } catch (error) {
    console.error('Error fetching email list:', error);
    return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 });
  }
}
