import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    const { employeeId, password } = await request.json();

    if (!employeeId) {
      return NextResponse.json({ success: false, message: 'נא להזין קוד עובד / לבחור עובד' }, { status: 400 });
    }

    if (password !== '000') {
      return NextResponse.json({ success: false, message: 'סיסמא שגויה. (השתמש ב-000)' }, { status: 401 });
    }

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set({
      name: 'auth_token',
      value: employeeId.toString(),
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, message: 'שגיאת שרת' }, { status: 500 });
  }
}
