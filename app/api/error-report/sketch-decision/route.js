import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { cookies } from 'next/headers';
import { getVerifiedAuthCookie } from '@/lib/authTokens';

// אישור/דחייה של סקיצה שהסוכן הציע (ErrorReportReply.sketchStatus). מעדכן את התגובה
// ומוסיף תגובה אוטומטית בשרשור (טקסט קבוע ומוכר) כדי שהסוכן, שרץ מחדש בכל סבב, יראה
// החלטה דטרמיניסטית - לא ניחוש לפי ניסוח חופשי. רק סקיצה במצב PENDING ניתנת להחלטה.
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const token = getVerifiedAuthCookie(cookieStore);
    if (!token?.value) return NextResponse.json({ success: false, error: 'לא מורשה' }, { status: 401 });

    const employee = await prisma.employee.findUnique({ where: { id: token.value } });
    if (!employee) return NextResponse.json({ success: false, error: 'משתמש לא נמצא' }, { status: 404 });

    const { replyId, decision, note } = await request.json();
    if (!replyId || !['APPROVED', 'REJECTED'].includes(decision)) {
      return NextResponse.json({ success: false, error: 'נתונים לא תקינים' }, { status: 400 });
    }

    const reply = await prisma.errorReportReply.findUnique({
      where: { id: replyId },
      select: { id: true, sketchStatus: true, errorReportId: true, errorReport: { select: { employeeId: true } } },
    });
    if (!reply || !reply.sketchStatus) {
      return NextResponse.json({ success: false, error: 'לא נמצאה סקיצה' }, { status: 404 });
    }
    if (reply.sketchStatus !== 'PENDING') {
      return NextResponse.json({ success: false, error: 'כבר התקבלה החלטה על הסקיצה הזו' }, { status: 409 });
    }

    const isProgrammer = employee.roleId === 2;
    const isManager = [0, 1, 2].includes(employee.roleId);
    const owns = reply.errorReport.employeeId === employee.id || (isManager && reply.errorReport.employeeId === null);
    if (!isProgrammer && !owns) {
      return NextResponse.json({ success: false, error: 'אין לך הרשאה לדיווח זה' }, { status: 403 });
    }

    const cleanNote = typeof note === 'string' ? note.trim().slice(0, 1000) : '';
    const text = decision === 'APPROVED'
      ? '✅ הסקיצה אושרה - אפשר להתקדם עם התיקון.'
      : `❌ הסקיצה נדחתה.${cleanNote ? `\n${cleanNote}` : ''}`;

    // updateMany עם תנאי PENDING - מונע החלטה כפולה במירוץ בין שני לחיצות
    const updated = await prisma.errorReportReply.updateMany({
      where: { id: replyId, sketchStatus: 'PENDING' },
      data: { sketchStatus: decision },
    });
    if (updated.count === 0) {
      return NextResponse.json({ success: false, error: 'כבר התקבלה החלטה על הסקיצה הזו' }, { status: 409 });
    }

    const decisionReply = await prisma.errorReportReply.create({
      data: { errorReportId: reply.errorReportId, employeeId: employee.id, isProgrammer, text, isQuestion: false },
      include: { employee: { select: { firstName: true, lastName: true } } },
    });
    await prisma.errorReport.update({
      where: { id: reply.errorReportId },
      data: { isReadByUser: !isProgrammer, isReadByProgrammer: isProgrammer, updatedAt: new Date() },
    });

    return NextResponse.json({ success: true, sketchStatus: decision, reply: decisionReply });
  } catch (error) {
    console.error('Error deciding on sketch:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
