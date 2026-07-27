import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');

    let employeeName = 'לא ידוע / אורח';
    if (token?.value) {
      const emp = await prisma.employee.findUnique({ where: { id: token.value } });
      if (emp) {
        employeeName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
      }
    }

    const body = await request.json();
    const { userText, url, title, time, queryParams, lastButtons } = body;

    if (!userText) {
      return NextResponse.json({ success: false, error: 'יש להזין תיאור שגיאה' }, { status: 400 });
    }

    // Find programmers
    const programmers = await prisma.employee.findMany({
      where: { roleId: 2, isActive: true, email: { not: null } }
    });

    if (programmers.length === 0) {
      return NextResponse.json({ success: false, error: 'לא נמצא מתכנת במערכת עם כתובת מייל פעילה' }, { status: 404 });
    }

    const scriptUrl = 'https://script.google.com/macros/s/AKfycbyBDsY2mF7h9PyGCw-ZpuaVK4XbtybOcd5t1Ka9TAU-cNFmKPsZYwxeNTxL3juZC-GvQA/exec';
    
    const emailContent = `
דיווח שגיאה מאת: ${employeeName}
זמן: ${time}
חלון/דף: ${title}
כתובת URL: ${url}
שאילתות/פרמטרים: ${queryParams}

5 הלחצנים האחרונים שנלחצו:
${lastButtons && lastButtons.length > 0 ? lastButtons.map((b, i) => `${i + 1}. ${b}`).join('\n') : 'אין פעולות מתועדות'}

תיאור השגיאה מהמשתמש:
${userText}
    `.trim();

    for (const prog of programmers) {
      try {
        await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: prog.email,
            cc: '',
            subject: 'דיווח תקלה ממערכת הגמח',
            body: emailContent,
            fileName: 'error_report.txt',
            fileContent: Buffer.from('Error Report').toString('base64')
          })
        });
      } catch (e) {
        console.error('Failed to send error report to', prog.email, e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending error report:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
