import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { cookies } from 'next/headers';
import { getVerifiedAuthCookie } from '@/lib/authTokens';

// מגיש את סקיצת ה-HTML שהסוכן האוטומטי צירף לתגובה (ErrorReportReply.sketchHtml).
// זה קוד שהסוכן כתב ורץ בדפדפן של משתמש - לכן CSP עם `sandbox` (בלי allow-scripts /
// allow-same-origin): אין JS, ואין גישה ל-cookie של auth_token גם אם מישהו פותח את
// הכתובת ישירות. הגישה מוגבלת בדיוק כמו התגובה עצמה: מתכנת, או בעל הדיווח.
export async function GET(_request, { params }) {
  const { replyId } = await params;
  const cookieStore = await cookies();
  const token = getVerifiedAuthCookie(cookieStore);
  if (!token?.value) return NextResponse.json({ error: 'לא מורשה' }, { status: 401 });

  const employee = await prisma.employee.findUnique({ where: { id: token.value } });
  if (!employee) return NextResponse.json({ error: 'משתמש לא נמצא' }, { status: 404 });

  const reply = await prisma.errorReportReply.findUnique({
    where: { id: replyId },
    select: { sketchHtml: true, errorReport: { select: { employeeId: true } } },
  });
  if (!reply?.sketchHtml) return NextResponse.json({ error: 'לא נמצאה סקיצה' }, { status: 404 });

  const isProgrammer = employee.roleId === 2;
  const isManager = [0, 1, 2].includes(employee.roleId);
  const owns = reply.errorReport.employeeId === employee.id || (isManager && reply.errorReport.employeeId === null);
  if (!isProgrammer && !owns) return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });

  return new NextResponse(reply.sketchHtml, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:",
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
}
