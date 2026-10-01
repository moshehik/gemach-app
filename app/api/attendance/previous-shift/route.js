import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/app/lib/prisma';
import { getVerifiedAuthCookie } from '@/lib/authTokens';
import { findOpenShift, punchIn, punchOut } from '@/lib/shiftPunch';
import { getAutoClockIn } from '@/lib/autoClockPref';
import { classifyOpenShift, resolvePreviousShiftExit, formatIsraelHHMM, PREVIOUS_SHIFT_MESSAGES } from '@/lib/loginFlow';

// דף הכניסה החדש, חלונית "לא נרשמה יציאה אתמול" (L15, Q03, LQ-02): העובדת המחוברת סוגרת את המשמרת
// שנשארה פתוחה מיום קודם בשעה שהקלידה, או משאירה אותה פתוחה. אחרי סגירה, אם ההעדפה "רישום אוטומטי"
// דלוקה - נרשמת גם התחלת העבודה של היום. LQ-03: השעה נשמרת כמו כל שעה אחרת, בלי סימון "הוזנה ידנית".
// מזוהה אך ורק לפי עוגיית ההתחברות - עובדת יכולה לסגור רק משמרת של עצמה.
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const token = getVerifiedAuthCookie(cookieStore);
    if (!token?.value) {
      return NextResponse.json({ success: false, message: 'יש להתחבר למערכת' }, { status: 401 });
    }
    const employee = await prisma.employee.findUnique({ where: { id: token.value } });
    if (!employee || !employee.isActive) {
      return NextResponse.json({ success: false, message: 'עובד לא נמצא' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const now = new Date();
    const openShift = await findOpenShift(employee.id);
    if (!openShift || (body.shiftId && body.shiftId !== openShift.id)) {
      return NextResponse.json({ success: false, message: 'לא נמצאה משמרת פתוחה לסגירה' }, { status: 404 });
    }
    if (!openShift.entryTime) {
      // משמרת legacy בלי שעת כניסה: אין ממה לחשב יציאה - לא נוגעים בה (ולא כותבים 1970).
      return NextResponse.json({ success: false, message: 'למשמרת הפתוחה אין שעת כניסה - יש לפנות למנהל לסגירה ידנית' }, { status: 400 });
    }
    if (classifyOpenShift(openShift, now) !== 'previous-day') {
      return NextResponse.json({ success: false, message: 'המשמרת הפתוחה היא של היום - אפשר לסגור אותה בשעון הנוכחות' }, { status: 400 });
    }

    const autoClockIn = getAutoClockIn(employee);

    if (body.leaveOpen === true) {
      return NextResponse.json({
        success: true,
        closed: false,
        punchedIn: false,
        note: autoClockIn ? PREVIOUS_SHIFT_MESSAGES.leftOpenNoPunch : PREVIOUS_SHIFT_MESSAGES.leftOpen,
      });
    }

    const resolved = resolvePreviousShiftExit({ entryTime: openShift.entryTime, hhmm: body.exitTime, now });
    if (!resolved.ok) {
      return NextResponse.json({ success: false, message: resolved.error }, { status: 400 });
    }

    const closedShift = await punchOut(employee, openShift, resolved.exitAt);
    let punchedInAt = null;
    if (autoClockIn) {
      const stillOpen = await findOpenShift(employee.id);
      if (!stillOpen) {
        const created = await punchIn(employee, now);
        punchedInAt = created.entryTime;
      }
    }

    return NextResponse.json({
      success: true,
      closed: true,
      closedAt: formatIsraelHHMM(closedShift.exitTime),
      punchedIn: !!punchedInAt,
      punchedInAt,
    });
  } catch (error) {
    console.error('Error closing previous shift:', error);
    return NextResponse.json({ success: false, message: 'שגיאת שרת' }, { status: 500 });
  }
}
