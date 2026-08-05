import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { hashSecret, last4Of } from '@/lib/passwordAuth';



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

    // Hashes never leave the server - there's nothing a legitimate client does with them.
    const { password, pinHash, ...safeEmployee } = employee;
    return NextResponse.json(safeEmployee);
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

    // body.password only arrives here as plaintext when a caller genuinely means to set a
    // brand-new password (e.g. an admin resetting one directly on the edit form). The normal
    // "save my other details" round trip never includes it, since GET above no longer sends
    // a password/hash to the client to send back. When it IS present, hash it (and derive the
    // trusted-device PIN hash from its last 4 characters) before it touches the database;
    // when absent, leave both fields untouched by passing `undefined` (Prisma skips
    // undefined fields on update rather than nulling them out).
    const plainPassword = body.password || undefined;
    const hashedPassword = plainPassword ? await hashSecret(plainPassword) : undefined;
    const pinHash = plainPassword ? await hashSecret(last4Of(plainPassword)) : undefined;

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
        password: hashedPassword,
        pinHash: pinHash,
        // A manager directly setting a new password on the edit form counts as a resolved
        // reset - no reason to force the employee through the change-password prompt too.
        mustResetPassword: plainPassword ? false : undefined,
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

    const { password, pinHash: _pinHash, ...safeEmployee } = updatedEmployee;
    return NextResponse.json(safeEmployee);
  } catch (error) {
    console.error('Error updating employee:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
