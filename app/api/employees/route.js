import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { checkAuth } from '../../../lib/auth';
import { hashSecret, last4Of } from '../../../lib/passwordAuth';

export async function GET(request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all') === 'true';

    const employees = await prisma.employee.findMany({
      where: all ? {} : { isActive: true },
      include: { department: true },
      orderBy: [
        { lastName: { sort: 'asc', nulls: 'last' } },
        { firstName: { sort: 'asc', nulls: 'last' } }
      ]
    });

    // Never send hashes (password/pinHash) to the client - there's no legitimate reason
    // for the browser to hold them, hashed or not.
    const safeEmployees = employees.map(({ password, pinHash, ...emp }) => emp);

    return NextResponse.json(safeEmployees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    // An initial password is set in plaintext here (the "new employee" form field) and
    // hashed before it ever reaches the database - same treatment as a real login password.
    // The last-4-digit PIN hash is derived right now, while the plaintext is still in hand,
    // so the trusted-device fast path works for this employee from day one.
    const plainPassword = body.password || null;
    const hashedPassword = plainPassword ? await hashSecret(plainPassword) : null;
    const pinHash = plainPassword ? await hashSecret(last4Of(plainPassword)) : null;

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
        password: hashedPassword,
        pinHash: pinHash,
        roleId: body.roleId !== "" && body.roleId !== null ? parseInt(body.roleId, 10) : null,
        hourlyWage: body.hourlyWage !== "" && body.hourlyWage !== null ? parseFloat(body.hourlyWage) : null,
        travelExpenses: typeof body.travelExpenses === 'boolean' ? body.travelExpenses : (body.travelExpenses === 'true' || body.travelExpenses === true),
        isActive: body.isActive !== undefined ? body.isActive : true,
        // themeColor לא נכתב ביצירה — העמודה משמשת העדפות-עיצוב פר-עובד (JSON)
        profileImage: body.profileImage,
        receiveEmailAlerts: typeof body.receiveEmailAlerts === 'boolean' ? body.receiveEmailAlerts : (body.receiveEmailAlerts === 'true' || body.receiveEmailAlerts === true),
        showAi: typeof body.showAi === 'boolean' ? body.showAi : (body.showAi === 'true' || body.showAi === true)
      }
    });
    const { password, pinHash: _pinHash, ...safeEmployee } = newEmployee;
    return NextResponse.json(safeEmployee);
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
  }
}
