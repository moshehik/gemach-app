import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';



export async function GET(request, { params }) {
  try {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: { id: 'desc' },
          include: {
            items: {
              include: {
                dressItem: true
              }
            }
          }
        },
        payments: {
          orderBy: { paymentDate: 'desc' }
        }
      }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    
    // 1. Fetch old data to compare
    const oldCustomer = await prisma.customer.findUnique({ where: { id } });
    if (!oldCustomer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // 2. Perform the update
    const updatedCustomer = await prisma.customer.update({
      where: { id },
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

    // 3. Compute changes
    const changes = {};
    const keysToCheck = ['firstName', 'lastName', 'phone1', 'phone2', 'email', 'city', 'street', 'houseNum', 'notes'];
    keysToCheck.forEach(key => {
      if (oldCustomer[key] !== updatedCustomer[key]) {
        changes[key] = { from: oldCustomer[key], to: updatedCustomer[key] };
      }
    });

    // 4. Save AuditLog if there are changes
    if (Object.keys(changes).length > 0) {
      await prisma.auditLog.create({
        data: {
          entityType: 'Customer',
          entityId: id,
          action: 'UPDATE',
          changesJson: JSON.stringify(changes),
          employeeId: body.employeeId || null
        }
      });
    }

    return NextResponse.json(updatedCustomer);
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
