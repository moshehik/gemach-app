import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { cookies } from 'next/headers';
import { renderErrorReportEmailHtml } from '../../../lib/emailTemplates';

export async function GET(request) {
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
    
    // Fetch reports: programmers see all, regular users see their own
    const whereClause = isProgrammer ? {} : { employeeId: employee.id };
    
    const reports = await prisma.errorReport.findMany({
      where: whereClause,
      orderBy: { updatedAt: 'desc' },
      include: {
        employee: { select: { firstName: true, lastName: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            employee: { select: { firstName: true, lastName: true } }
          }
        }
      }
    });

    return NextResponse.json({ success: true, reports, isProgrammer });
  } catch (error) {
    console.error('Error fetching error reports:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request) {
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

    const { reportId, status, isHandled } = await request.json();
    const statusProvided = status !== undefined;
    const isHandledProvided = isHandled !== undefined;
    if (
      !reportId ||
      (!statusProvided && !isHandledProvided) ||
      (statusProvided && !['OPEN', 'ARCHIVED'].includes(status)) ||
      (isHandledProvided && typeof isHandled !== 'boolean')
    ) {
      return NextResponse.json({ success: false, error: 'נתונים חסרים או לא תקינים' }, { status: 400 });
    }

    const isProgrammer = employee.roleId === 2;
    const existing = await prisma.errorReport.findUnique({ where: { id: reportId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'הדיווח לא נמצא' }, { status: 404 });
    }
    if (!isProgrammer && existing.employeeId !== employee.id) {
      return NextResponse.json({ success: false, error: 'אין לך הרשאה לדיווח זה' }, { status: 403 });
    }

    const data = {};
    if (statusProvided) data.status = status;
    if (isHandledProvided) data.isHandled = isHandled;

    const updated = await prisma.errorReport.update({
      where: { id: reportId },
      data,
    });

    return NextResponse.json({ success: true, report: updated });
  } catch (error) {
    console.error('Error updating error report status:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');

    let employeeId = null;
    let employeeName = 'לא ידוע / אורח';
    
    if (token?.value) {
      const emp = await prisma.employee.findUnique({ where: { id: token.value } });
      if (emp) {
        employeeId = emp.id;
        employeeName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
      }
    }

    const body = await request.json();
    const { userText, url, title, time, queryParams, lastButtons } = body;

    if (!userText) {
      return NextResponse.json({ success: false, error: 'יש להזין תיאור שגיאה' }, { status: 400 });
    }

    // Save to Database
    const newReport = await prisma.errorReport.create({
      data: {
        employeeId,
        time,
        url,
        title,
        queryParams,
        lastButtons: lastButtons ? JSON.stringify(lastButtons) : null,
        userText,
        isReadByUser: true,
        isReadByProgrammer: false
      }
    });

    // Find programmers to email (optional - keep as backup)
    const programmers = await prisma.employee.findMany({
      where: { roleId: 2, isActive: true, email: { not: null } }
    });

    if (programmers.length > 0) {
      // Determine Script URL from settings
      const settings = (await getAllCachedSettings()).filter(s => ['email_link_a', 'email_link_b', 'email_routing_strategy', 'gmach_name'].includes(s.key));
      const linkA = settings.find(s => s.key === 'email_link_a')?.value;
      const linkB = settings.find(s => s.key === 'email_link_b')?.value;
      const strategy = settings.find(s => s.key === 'email_routing_strategy')?.value || 'all_a';
      const gmachName = settings.find(s => s.key === 'gmach_name')?.value || 'גמ"ח שמלות';

      let scriptUrl = 'https://script.google.com/macros/s/AKfycbyBDsY2mF7h9PyGCw-ZpuaVK4XbtybOcd5t1Ka9TAU-cNFmKPsZYwxeNTxL3juZC-GvQA/exec';
      
      // For bugs, use B if strategy is 'all_b' OR 'bugs_b_rest_a'
      if ((strategy === 'all_b' || strategy === 'bugs_b_rest_a') && linkB) {
        scriptUrl = linkB;
      } else if (linkA) {
        scriptUrl = linkA;
      }
      
      const hiddenData = JSON.stringify({
        employeeName, time, title, url, queryParams, lastButtons, userText, status: 'OPEN', reportId: newReport.id
      });

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

---AI_DATA_START---
${hiddenData}
---AI_DATA_END---
      `.trim();

      const htmlBody = renderErrorReportEmailHtml({
        employeeName, time, title, url, userText, lastButtons, gmachName
      });

      for (const prog of programmers) {
        try {
          await fetch(scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: prog.email,
              cc: '',
              subject: 'דיווח תקלה ממערכת הגמח - לטיפול AI',
              body: emailContent,
              htmlBody,
              fileName: 'דוח שגיאה.txt',
              fileContent: Buffer.from('Error Report').toString('base64')
            })
          });
        } catch (e) {
          console.error('Failed to send error report to', prog.email, e);
        }
      }
    }

    // Save locally for Antigravity AI to read instantly
    try {
        const fs = require('fs');
        const csvPath = 'C:\\Users\\moshe\\Desktop\\מערכת AI\\AI_Errors.csv';
        const id = new Date().getTime().toString();
        const csvLine = `"${id}","${time}","OPEN","${(employeeName||'').replace(/"/g, '""')}","${(title||'').replace(/"/g, '""')}","${(url||'').replace(/"/g, '""')}","${(userText||'').replace(/"/g, '""')}"\n`;

        if (!fs.existsSync(csvPath)) {
            const header = `"ID","Time","Status","Reporter","Title","URL","Description"\n`;
            fs.writeFileSync(csvPath, header, 'utf8');
        }
        fs.appendFileSync(csvPath, csvLine, 'utf8');
    } catch(err) {
        console.error('Failed to append to local CSV', err);
    }

    return NextResponse.json({ success: true, report: newReport });
  } catch (error) {
    console.error('Error sending error report:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}