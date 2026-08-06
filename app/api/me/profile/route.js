import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// פרופיל אישי לעובד המחובר בלבד — מזוהה אך ורק לפי ה-cookie, בלי פרמטר id,
// כך שעובד לעולם לא יכול לקרוא/לעדכן רשומה של עובד אחר דרך הנתיב הזה.
// בניגוד ל-/api/employees/[id] (המנהלי), כאן לא נחשפים ולא מתקבלים שדות
// רגישים: שכר, אופן תשלום, נסיעות, roleId, showAi, isActive, הערות ומשמרות.

async function getSessionEmployee() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token');
  if (!token || !token.value) return null;

  const parsedLegacy = parseInt(token.value, 10);
  return prisma.employee.findFirst({
    where: {
      OR: [
        { id: token.value },
        ...(isNaN(parsedLegacy) ? [] : [{ legacyId: parsedLegacy }])
      ]
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      fullName: true,
      phone1: true,
      phone2: true,
      email: true,
      emailSuffix: true,
      city: true,
      street: true,
      houseNum: true,
      joinDate: true,
      themeColor: true,
      profileImage: true,
      receiveEmailAlerts: true,
      isActive: true,
      department: { select: { name: true } }
    }
  });
}

export async function GET() {
  try {
    const employee = await getSessionEmployee();
    if (!employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!employee.isActive) {
      return NextResponse.json({ error: 'Inactive employee' }, { status: 403 });
    }
    const { isActive, ...profile } = employee;
    return NextResponse.json(profile);
  } catch (error) {
    console.error('Error fetching own profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const employee = await getSessionEmployee();
    if (!employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!employee.isActive) {
      return NextResponse.json({ error: 'Inactive employee' }, { status: 403 });
    }

    const body = await request.json();

    // רשימה סגורה של שדות שעובד רשאי לעדכן על עצמו. שדה שלא הגיע בגוף הבקשה
    // נשאר undefined ו-Prisma מדלג עליו — אין דריסת ערכים קיימים בשמירה חלקית.
    const data = {};
    for (const field of ['firstName', 'lastName', 'fullName', 'phone1', 'phone2',
      'email', 'emailSuffix', 'city', 'street', 'houseNum', 'themeColor', 'profileImage']) {
      if (typeof body[field] === 'string') data[field] = body[field];
    }
    if (typeof body.receiveEmailAlerts === 'boolean') {
      data.receiveEmailAlerts = body.receiveEmailAlerts;
    }

    const updated = await prisma.employee.update({
      where: { id: employee.id },
      data,
      select: { id: true }
    });

    return NextResponse.json({ success: true, id: updated.id });
  } catch (error) {
    console.error('Error updating own profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
