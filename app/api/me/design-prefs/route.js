import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { mergeDesignPrefs, parseStoredDesignPrefs } from '@/lib/designPrefsSchema';

// העדפות עיצוב פר-עובד — מקור האמת. מאוחסנות כ-JSON בעמודת
// Employee.themeColor (עמודה שהייתה "פלטת גוונים" מתה — אף רכיב לא קרא
// אותה — והוסבה לכאן בלי שינוי סכמה). מזוהה אך ורק לפי cookie
// (auth_token), בלי פרמטר id — עובד לא יכול לקרוא/לעדכן העדפות של אחר.
// אין כתיבת AuditLog ידנית — ההרחבה של Prisma מתעדת את העדכון אוטומטית.

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
    select: { id: true, themeColor: true, isActive: true }
  });
}

export async function GET() {
  try {
    const employee = await getSessionEmployee();
    if (!employee) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!employee.isActive) {
      return NextResponse.json({ success: false, error: 'Inactive employee' }, { status: 403 });
    }
    // prefs === null ⇒ לעובד עדיין אין העדפות ב-DB (ערך legacy/ריק) —
    // הלקוח (DesignPrefsSync) מבצע אז הגירה חד-פעמית מההעדפות המקומיות.
    return NextResponse.json({
      success: true,
      employeeId: employee.id,
      prefs: parseStoredDesignPrefs(employee.themeColor),
    });
  } catch (error) {
    console.error('Error fetching design prefs:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const employee = await getSessionEmployee();
    if (!employee) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!employee.isActive) {
      return NextResponse.json({ success: false, error: 'Inactive employee' }, { status: 403 });
    }

    let body = null;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    // מיזוג רדוד של העדכון על ההעדפות הקיימות — שדות לא-מוכרים/לא-תקינים
    // נזרקים בשקט (sanitize), כך שהעמודה לעולם לא מכילה JSON שרירותי.
    const existing = parseStoredDesignPrefs(employee.themeColor);
    const next = mergeDesignPrefs(existing || {}, body);
    const serialized = JSON.stringify(next);
    if (serialized.length > 8192) {
      return NextResponse.json({ success: false, error: 'Prefs too large' }, { status: 413 });
    }

    await prisma.employee.update({
      where: { id: employee.id },
      data: { themeColor: serialized },
      select: { id: true }
    });

    return NextResponse.json({ success: true, prefs: next });
  } catch (error) {
    console.error('Error updating design prefs:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
