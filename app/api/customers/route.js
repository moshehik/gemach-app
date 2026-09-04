import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { checkAuth } from '../../../lib/auth';
import { normalizeEmail } from '@/lib/emailUtils';

export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const sort = searchParams.get('sort') || 'legacyId';
    const order = searchParams.get('order') || 'desc';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const skip = (page - 1) * limit;

    const advFirstName = searchParams.get('firstName') || '';
    const advLastName = searchParams.get('lastName') || '';
    const advPhone = searchParams.get('phone') || '';
    const advCity = searchParams.get('city') || '';
    const advEmail = searchParams.get('email') || '';

    const where = {
      isDeleted: false,
      ...(search ? {
        OR: [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { phone1: { contains: search } },
          { email: { contains: search } },
          { city: { contains: search } }
        ]
      } : {}),
      ...(advFirstName ? { firstName: { contains: advFirstName } } : {}),
      ...(advLastName ? { lastName: { contains: advLastName } } : {}),
      ...(advPhone ? {
        OR: [
          { phone1: { contains: advPhone } },
          { phone2: { contains: advPhone } }
        ]
      } : {}),
      ...(advCity ? { city: { contains: advCity } } : {}),
      ...(advEmail ? { email: { contains: advEmail } } : {})
    };

    const [customers, totalCount] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { [sort]: order },
        skip,
        take: limit,
        select: {
          id: true,
          legacyId: true,
          firstName: true,
          lastName: true,
          phone1: true,
          phone2: true,
          city: true,
          // The new-order screen charges the card straight off the customer picked here, and
          // Nedarim Plus is sent the full address - without these it only ever got the city.
          street: true,
          houseNum: true,
          email: true,
          emailSuffix: true,
          isBlocked: true,
          blockedReason: true
        }
      }),
      prisma.customer.count({ where })
    ]);

    const formattedCustomers = customers.map(c => ({
      ...c,
      email: normalizeEmail(c.email, c.emailSuffix)
    }));

    return NextResponse.json({
      data: formattedCustomers,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const body = await request.json();
    
    // Auto-generate a short legacyId for new customers so it displays nicely
    const maxCustomer = await prisma.customer.findFirst({
      where: { legacyId: { not: null } },
      orderBy: { legacyId: 'desc' }
    });
    const nextLegacyId = (maxCustomer?.legacyId || 0) + 1;

    const normalizedEmail = normalizeEmail(body.email, body.emailSuffix);

    const newCustomer = await prisma.customer.create({
      data: {
        legacyId: nextLegacyId,
        firstName: body.firstName,
        lastName: body.lastName,
        phone1: body.phone1,
        phone2: body.phone2,
        email: normalizedEmail,
        city: body.city,
        street: body.street,
        houseNum: body.houseNum !== "" && body.houseNum !== null ? parseInt(body.houseNum, 10) : null,
        notes: body.notes
      }
    });
    return NextResponse.json(newCustomer);
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}
