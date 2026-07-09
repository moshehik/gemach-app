import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all') === 'true';
    
    const employees = await prisma.employee.findMany({
      where: all ? {} : { isActive: true },
      orderBy: { id: 'asc' }
    });
    
    // Remove passwords from the response
    const safeEmployees = employees.map(({ password, ...emp }) => emp);
    
    return NextResponse.json(safeEmployees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const newEmployee = await prisma.employee.create({
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
        isActive: body.isActive !== undefined ? body.isActive : true
      }
    });
    return NextResponse.json(newEmployee);
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
  }
}
