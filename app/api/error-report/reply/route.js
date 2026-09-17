import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { cookies } from 'next/headers';
import { uploadAttachmentDataUrls } from '../../../../lib/attachmentUpload';

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    
    if (!token?.value) {
      return NextResponse.json({ success: false, error: 'לא מורשה' }, { status: 401 });
    }

    const employee = await prisma.employee.findUnique({ where: { id: token.value } });
    if (!employee) {
      return NextResponse.json({ success: false, error: 'משתמש לא נמצא' }, { status: 404 });
    }

    const isProgrammer = employee.roleId === 2;
    const isManager = [0, 1, 2].includes(employee.roleId);

    const body = await request.json();
    const { reportId, text, isQuestion, attachments } = body;

    if (!reportId || !text) {
      return NextResponse.json({ success: false, error: 'חסרים נתונים לשמירה' }, { status: 400 });
    }

    const attachmentUrls = await uploadAttachmentDataUrls(attachments, 'error-report-reply');

    // Verify report exists and user has access
    const report = await prisma.errorReport.findUnique({ where: { id: reportId } });
    if (!report) {
      return NextResponse.json({ success: false, error: 'דיווח השגיאה לא נמצא' }, { status: 404 });
    }

    const ownsReport = report.employeeId === employee.id || (isManager && report.employeeId === null);
    if (!isProgrammer && !ownsReport) {
      return NextResponse.json({ success: false, error: 'אין לך הרשאה לדיווח זה' }, { status: 403 });
    }

    const reply = await prisma.errorReportReply.create({
      data: {
        errorReportId: reportId,
        employeeId: employee.id,
        isProgrammer,
        text,
        isQuestion: !!isQuestion,
        attachmentUrls: attachmentUrls.length > 0 ? JSON.stringify(attachmentUrls) : null
      },
      include: {
        employee: { select: { firstName: true, lastName: true } }
      }
    });

    // Update read status for the other party. תגובה אמיתית של מתכנת מחוברת (isProgrammer,
    // employeeId מוגדר - לא הסוכן האוטומטי, ר' scripts/error-report-reply.js שלא מגדיר
    // employeeId בכלל) מסירה את דגל "צריך מענה אנושי" - זו בדיוק התגובה שהמדווח/ת ביקש/ה.
    await prisma.errorReport.update({
      where: { id: reportId },
      data: {
        isReadByUser: !isProgrammer,
        isReadByProgrammer: isProgrammer,
        updatedAt: new Date(),
        ...(isProgrammer ? { needsHuman: false } : {})
      }
    });

    return NextResponse.json({ success: true, reply });
  } catch (error) {
    console.error('Error replying to error report:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
