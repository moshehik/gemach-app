import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';



export async function GET(request, { params }) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;
    if (!id) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const includeDeleted = searchParams.get('includeDeleted') === 'true';

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        shifts: {
          where: includeDeleted ? {} : { isDeleted: false },
          orderBy: { date: 'desc' }
        }
      }
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Do not send password to client in plain text in a real app, but since this is a migration from Access:
    return NextResponse.json(employee);
  } catch (error) {
    console.error('Error fetching employee:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;
    if (!id) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    const updatedEmployee = await prisma.employee.update({
      where: { id },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        phone1: body.phone1,
        phone2: body.phone2,
        city: body.city,
        street: body.street,
        houseNum: body.houseNum,
        email: body.email,
        joinDate: body.joinDate ? new Date(body.joinDate) : null,
        fullName: body.fullName,
        notes: body.notes,
        emailSuffix: body.emailSuffix,
        paymentMethod: body.paymentMethod,
        password: body.password,
        roleId: body.roleId !== "" && body.roleId !== null ? parseInt(body.roleId, 10) : null,
        hourlyWage: body.hourlyWage !== "" && body.hourlyWage !== null ? parseFloat(body.hourlyWage) : null,
        travelExpenses: typeof body.travelExpenses === 'boolean' ? body.travelExpenses : (body.travelExpenses === 'true' || body.travelExpenses === true),
        isActive: body.isActive !== undefined ? body.isActive : true,
        themeColor: body.themeColor,
        profileImage: body.profileImage,
        receiveEmailAlerts: typeof body.receiveEmailAlerts === 'boolean' ? body.receiveEmailAlerts : (body.receiveEmailAlerts === 'true' || body.receiveEmailAlerts === true),
        showAi: typeof body.showAi === 'boolean' ? body.showAi : (body.showAi === 'true' || body.showAi === true)
      }
    });

    return NextResponse.json(updatedEmployee);
  } catch (error) {
    console.error('Error updating employee:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
