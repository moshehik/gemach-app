import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { checkAuth } from '../../../lib/auth';
import { verifySecret } from '../../../lib/passwordAuth';
import { getTrustedDeviceFromCookieStore, markDeviceUsed } from '../../../lib/trustedDevice';
import { getVerifiedAuthCookie } from '@/lib/authTokens';
import { findOpenShift, punchIn, punchOut } from '@/lib/shiftPunch';
import { resolveAttendanceManager } from '@/lib/attendance/server';

// Get attendance records, optionally filter by month and year
// הנהלה בלבד (סקירה 4.10.2026): עד עכשיו כל מחובר קיבל כאן שורות משמרת מלאות עם שכר של כל עובד. אין לזה קורא בממשק
// (שעון הנוכחות משתמש רק ב-POST); העובד רואה את שלו דרך /api/attendance-sheet. אותו שער נכשל-סגור כמו סיכום הנוכחות.
export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  const { isManager } = await resolveAttendanceManager();
  if (!isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const employeeId = searchParams.get('employeeId');

    let whereClause = {};

    if (employeeId) {
      whereClause.employeeId = employeeId;
    }

    if (month && year) {
      const startDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      const endDate = new Date(parseInt(year, 10), parseInt(month, 10), 0, 23, 59, 59); // Last day of month
      
      whereClause.date = {
        gte: startDate,
        lte: endDate
      };
    }

    const shifts = await prisma.shift.findMany({
      where: whereClause,
      include: {
        employee: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: { date: 'desc' }
    });

    return NextResponse.json(shifts);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Punch In / Punch Out
// הערה: אין checkAuth() גורף בתחילת הראוט הזה בכוונה - /punch-clock חייב להיות נגיש
// גם בלי session קיים בכלל (למשל require_login מופעל ואף אחד עוד לא מחובר במחשב
// הזה, ר' isPunchClock ב-app/layout.js), אחרת אף אחד לא יכול לרשום כניסה ראשונה
// ביום. כשמסופקת סיסמה, אימות הסיסמה/PIN למטה הוא בעצמו הוכחת זהות מספקת; רק
// המסלול "בלי סיסמה" (סומך על session קיים) דורש checkAuth בפועל, ר' למטה.
export async function POST(request) {
  try {
    const body = await request.json();
    const { employeeId, password, action } = body; // action is 'IN' or 'OUT'

    if (!employeeId || !['IN', 'OUT'].includes(action)) {
      return NextResponse.json({ error: 'Missing required fields or invalid action' }, { status: 400 });
    }

    const parsedLegacyId = /^\d+$/.test(String(employeeId)) ? parseInt(employeeId, 10) : NaN; // digits only: a UUID that merely STARTS with digits must not match some other employee's legacyId
    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          ...(isNaN(parsedLegacyId) ? [] : [{ legacyId: parsedLegacyId }]),
          { id: String(employeeId) }
        ]
      }
    });

    if (!employee) {
      return NextResponse.json({ error: 'עובד לא נמצא' }, { status: 404 });
    }

    // Verify password OR check if the logged in user is the same employee
    if (password) {
      const fullPasswordOk = await verifySecret(password, employee.password);
      if (!fullPasswordOk) {
        // Same trust model as the login screen (app/api/login/route.js): a short code is
        // only ever honored on a computer a manager marked trusted - on any other machine
        // the full password is required, no matter what the client typed.
        const cookieStore = await cookies();
        const trustedDevice = await getTrustedDeviceFromCookieStore(cookieStore);
        const shortCodeOk = trustedDevice && employee.pinHash && (await verifySecret(password, employee.pinHash));
        if (!shortCodeOk) {
          if (!trustedDevice && String(password).length <= 4) {
            return NextResponse.json({ error: 'קוד מקוצר אפשרי רק ממחשב מערכת מהימן - יש להזין את הסיסמה המלאה' }, { status: 401 });
          }
          return NextResponse.json({ error: 'סיסמה שגויה' }, { status: 401 });
        }
        markDeviceUsed(trustedDevice.id);
      }
    } else {
      // If no password provided, ensure the current session belongs to this employee
      const cookieStore = await cookies();
      const token = getVerifiedAuthCookie(cookieStore);
      // auth_token holds the employee UUID; the client may have sent either the UUID or
      // the numeric legacyId, so compare against the resolved employee's UUID.
      if (!token || token.value !== employee.id) {
        return NextResponse.json({ error: 'רישום נוכחות ללא סיסמה אפשרי רק לעובד המחובר' }, { status: 401 });
      }
    }

    if (!employee.isActive) {
       return NextResponse.json({ error: 'חשבון העובד אינו פעיל' }, { status: 403 });
    }

    const now = new Date();

    // עובד שנכנס לפני חצות ועדיין לא יצא נשאר עם משמרת פתוחה מתוארכת ל"אתמול" -
    // בדיקת "כבר נכנס" חייבת לחפש משמרת פתוחה בכל תאריך (לא רק היום), אחרת
    // אחרי חצות הבדיקה לא מוצאת כלום והעובד יכול "להיכנס" שוב ולפתוח משמרת
    // כפולה/חופפת בזמן שהראשונה נשארת פתוחה לצמיתות.
    // החישובים עצמם (שדה date לפי היום הישראלי, סגירה עם דקות/שכר/נסיעות) עברו ל-lib/shiftPunch.js -
    // משותפים לדף הכניסה החדש (רישום התחלת עבודה אוטומטי בכניסה) ולסגירת משמרת פתוחה מאתמול
    // (POST /api/attendance/previous-shift), בלי שינוי בהתנהגות כאן.
    let currentShift = await findOpenShift(employee.id);

    if (action === 'IN') {
      if (currentShift) {
        return NextResponse.json({ error: 'כבר נרשמה כניסה - יש לרשום יציאה קודם' }, { status: 400 });
      }

      const newShift = await punchIn(employee, now);
      return NextResponse.json({ message: 'Punched IN successfully', shift: newShift });

    } else if (action === 'OUT') {
      if (!currentShift) {
        return NextResponse.json({ error: 'לא נמצאה משמרת פתוחה לרישום יציאה' }, { status: 400 });
      }

      const updatedShift = await punchOut(employee, currentShift, now);
      return NextResponse.json({ message: 'Punched OUT successfully', shift: updatedShift });
    }

  } catch (error) {
    console.error('Error with punch clock:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
