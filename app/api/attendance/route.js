import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { checkAuth } from '../../../lib/auth';
import { verifySecret } from '../../../lib/passwordAuth';
import { getTrustedDeviceFromCookieStore, markDeviceUsed } from '../../../lib/trustedDevice';




// Get attendance records, optionally filter by month and year
export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
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
export async function POST(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const body = await request.json();
    const { employeeId, password, action } = body; // action is 'IN' or 'OUT'

    if (!employeeId || !['IN', 'OUT'].includes(action)) {
      return NextResponse.json({ error: 'Missing required fields or invalid action' }, { status: 400 });
    }

    const parsedLegacyId = parseInt(employeeId, 10);
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
      const token = cookieStore.get('auth_token');
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
    // Normalize date to start of day for the 'date' field
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // עובד שנכנס לפני חצות ועדיין לא יצא נשאר עם משמרת פתוחה מתוארכת ל"אתמול" -
    // בדיקת "כבר נכנס" חייבת לחפש משמרת פתוחה בכל תאריך (לא רק היום), אחרת
    // אחרי חצות הבדיקה לא מוצאת כלום והעובד יכול "להיכנס" שוב ולפתוח משמרת
    // כפולה/חופפת בזמן שהראשונה נשארת פתוחה לצמיתות.
    let currentShift = await prisma.shift.findFirst({
      where: {
        employeeId: employee.id,
        exitTime: null
      },
      orderBy: { id: 'desc' }
    });

    if (action === 'IN') {
      if (currentShift) {
        return NextResponse.json({ error: 'כבר נרשמה כניסה - יש לרשום יציאה קודם' }, { status: 400 });
      }

      // Create new shift
      const newShift = await prisma.shift.create({
        data: {
          employeeId: employee.id,
          date: todayStart,
          entryTime: now,
          hourlyWageSnapshot: employee.hourlyWage || 0,
          travelExpensesSnapshot: typeof employee.travelExpenses === 'number' ? employee.travelExpenses : 0
        }
      });
      return NextResponse.json({ message: 'Punched IN successfully', shift: newShift });

    } else if (action === 'OUT') {
      if (!currentShift) {
        return NextResponse.json({ error: 'לא נמצאה משמרת פתוחה לרישום יציאה' }, { status: 400 });
      }

      const entryTime = new Date(currentShift.entryTime);
      const diffMs = now - entryTime;
      const totalMinutes = Math.floor(diffMs / 60000);

      // Calculate total pay: (minutes / 60) * hourly wage
      const hourlyWage = currentShift.hourlyWageSnapshot || employee.hourlyWage || 0;
      const travelEligible = currentShift.travelExpensesSnapshot || (typeof employee.travelExpenses === 'number' ? employee.travelExpenses : 0);
      let totalCalculated = (totalMinutes / 60) * hourlyWage;

      // Travel expense is a daily allowance, not a per-punch one: only credit it on the
      // employee's earliest shift of the calendar day, so splitting a day into several
      // punches (e.g. a lunch break) doesn't pay travel more than once.
      let travelForThisShift = 0;
      if (travelEligible) {
        const earlierShiftToday = await prisma.shift.findFirst({
          where: {
            employeeId: employee.id,
            date: currentShift.date,
            isDeleted: false,
            id: { not: currentShift.id },
            entryTime: { lt: currentShift.entryTime }
          }
        });
        if (!earlierShiftToday) {
          travelForThisShift = travelEligible;
        }
      }
      totalCalculated += travelForThisShift;

      const updatedShift = await prisma.shift.update({
        where: { id: currentShift.id },
        data: {
          exitTime: now,
          totalMinutes,
          totalCalculated: parseFloat(totalCalculated.toFixed(2))
        }
      });
      return NextResponse.json({ message: 'Punched OUT successfully', shift: updatedShift });
    }

  } catch (error) {
    console.error('Error with punch clock:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
