import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const sort = searchParams.get('sort') || 'id';
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

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { [sort]: order },
      skip,
      take: limit
    });
    
    const totalCount = await prisma.customer.count({ where });

    return NextResponse.json({
      data: customers,
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
  try {
    const body = await request.json();
    const newCustomer = await prisma.customer.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        phone1: body.phone1,
        phone2: body.phone2,
        email: body.email,
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
