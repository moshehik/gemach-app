import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { cookies } from 'next/headers';
import { renderErrorReportEmailHtml, renderGenericEmailHtml } from '../../../lib/emailTemplates';

// שולח מייל לכל המתכנתים הפעילים (roleId=2) דרך אותו Google Apps Script mailer
// ששאר המערכת משתמשת בו - ר' POST למטה (דיווח חדש) ו-lib/emailTemplates.js.
async function sendProgrammerEmail({ subject, textBody, htmlBody, fileName }) {
  const programmers = await prisma.employee.findMany({
    where: { roleId: 2, isActive: true, email: { not: null } }
  });
  if (programmers.length === 0) return;

  const settings = (await getAllCachedSettings()).filter(s => ['email_link_a', 'email_link_b', 'email_routing_strategy'].includes(s.key));
  const linkA = settings.find(s => s.key === 'email_link_a')?.value;
  const linkB = settings.find(s => s.key === 'email_link_b')?.value;
  const strategy = settings.find(s => s.key === 'email_routing_strategy')?.value || 'all_a';

  let scriptUrl = 'https://script.google.com/macros/s/AKfycbyBDsY2mF7h9PyGCw-ZpuaVK4XbtybOcd5t1Ka9TAU-cNFmKPsZYwxeNTxL3juZC-GvQA/exec';
  if ((strategy === 'all_b' || strategy === 'bugs_b_rest_a') && linkB) {
    scriptUrl = linkB;
  } else if (linkA) {
    scriptUrl = linkA;
  }

  for (const prog of programmers) {
    try {
      await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: prog.email,
          cc: '',
          subject,
          body: textBody,
          htmlBody,
          fileName: fileName || 'הודעה.txt',
          fileContent: Buffer.from('הודעה').toString('base64')
        })
      });
    } catch (e) {
      console.error('Failed to send email to', prog.email, e);
    }
  }
}

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
    // isManager = מותר להגיש דיווח חדש: תפקיד מנהל/הנהלה/מתכנת, או אישור פרטני בכרטיס העובד
    const isManager = [0, 1, 2].includes(employee.roleId) || !!employee.canReportErrors;

    // Fetch reports: programmers see all, regular users see their own
    const whereClause = isProgrammer ? {} : { employeeId: employee.id };

    // ?light=1 - הבדיקה התקופתית כל 30 שנ' (ErrorReportButton.js, פועלת ברקע כל עוד
    // הפאנל סגור) צריכה רק את השדות שמחשבים את מונה "לא נקראו"/הנקודה האדומה על
    // הכפתור - לא את הרשימה המלאה עם כל התגובות המקוננות. לפני התיקון הזה כל טיק
    // כזה הריץ בדיוק את אותה שאילתה הכבדה שהפאנל הפתוח משתמש בה: אצל כל מתכנת (רואה
    // את *כל* הדיווחים בכל הארגון + כל התגובות) עם טאב פתוח ברקע 24/7 זה יצא
    // ~720KB בכל 30 שניות - על נווה יעקב לבד כ-2000 קריאות/יום, ~250MB ליום, שהיה
    // הגורם הדומיננטי (רוב מתוך כ-3.85GB) לחריגת מכסת התעבורה החודשית של נאון
    // (5GB/פרויקט ב-Free) ב-2026-09-17. ר' תיעוד: docs/neon-quota-error-report-poll-2026-09-17.md
    const isLight = new URL(request.url).searchParams.get('light') === '1';

    const reports = await prisma.errorReport.findMany({
      where: whereClause,
      orderBy: { updatedAt: 'desc' },
      ...(isLight
        ? { select: { id: true, status: true, isReadByProgrammer: true, isReadByUser: true } }
        : {
            include: {
              employee: { select: { firstName: true, lastName: true } },
              replies: {
                orderBy: { createdAt: 'asc' },
                include: {
                  employee: { select: { firstName: true, lastName: true } }
                }
              }
            }
          })
    });

    return NextResponse.json({ success: true, reports, isProgrammer, isManager });
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

    const { reportId, status, isHandled, isReadByUser, isReadByProgrammer, needsHuman } = await request.json();
    const statusProvided = status !== undefined;
    const isHandledProvided = isHandled !== undefined;
    const isReadByUserProvided = isReadByUser !== undefined;
    const isReadByProgrammerProvided = isReadByProgrammer !== undefined;
    const needsHumanProvided = needsHuman !== undefined;
    if (
      !reportId ||
      (!statusProvided && !isHandledProvided && !isReadByUserProvided && !isReadByProgrammerProvided && !needsHumanProvided) ||
      (statusProvided && !['OPEN', 'ARCHIVED'].includes(status)) ||
      (isHandledProvided && typeof isHandled !== 'boolean') ||
      (isReadByUserProvided && typeof isReadByUser !== 'boolean') ||
      (isReadByProgrammerProvided && typeof isReadByProgrammer !== 'boolean') ||
      (needsHumanProvided && typeof needsHuman !== 'boolean')
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
    if (isReadByUserProvided) data.isReadByUser = isReadByUser;
    if (isReadByProgrammerProvided) data.isReadByProgrammer = isReadByProgrammer;
    if (needsHumanProvided) data.needsHuman = needsHuman;

    const updated = await prisma.errorReport.update({
      where: { id: reportId },
      data,
    });

    // "אוף! אני צריך מענה אנושי!" - המדווח/ת ביקש/ה לדלג על הסוכן האוטומטי ולקבל
    // מענה ישיר מתמיכה. שולחים מייל רק כשמדליקים את הדגל (לא כשמכבים אותו), ורק
    // מי שאינו מתכנת יכול להדליק אותו (אכיפה למעלה: !isProgrammer && employeeId===own).
    if (needsHumanProvided && needsHuman && !existing.needsHuman) {
      const reporterName = employee.firstName ? `${employee.firstName} ${employee.lastName || ''}`.trim() : 'משתמש';
      const textBody = `
${reporterName} ביקש/ה מענה אנושי ישיר בדיווח תקלה, במקום המענה האוטומטי.

חלון/דף: ${existing.title || 'לא צוין'}
תיאור התקלה:
${existing.userText}

הסוכן האוטומטי ידלג על הדיווח הזה מעתה - יש לענות בעצמכם בשרשור.
      `.trim();
      const htmlBody = renderGenericEmailHtml({
        title: 'התבקש מענה אנושי בדיווח תקלה',
        bodyText: textBody
      });
      sendProgrammerEmail({
        subject: `${reporterName} מבקש/ת מענה אנושי - דיווח תקלה`,
        textBody,
        htmlBody,
        fileName: 'בקשה למענה אנושי.txt'
      }).catch((e) => console.error('Failed to send needsHuman email', e));
    }

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
    let requester = null;
    
    if (token?.value) {
      const emp = await prisma.employee.findUnique({ where: { id: token.value } });
      if (emp) {
        employeeId = emp.id;
        employeeName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
        requester = emp;
      }
    }
    // הגבלת יצירת דיווח חדש למנהלים/הנהלה ראשית/מתכנת, או לעובד שקיבל אישור פרטני בכרטיס שלו (בקשה 4191ef31)
    if (!requester || (![0, 1, 2].includes(requester.roleId) && !requester.canReportErrors)) {
      return NextResponse.json({ success: false, error: 'יצירת דיווח חדש מותרת למנהלים בלבד' }, { status: 403 });
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

    // הפעלה מיידית של סוכן /fix-reports (GitHub Actions) במקום לחכות ל-cron הבא
    // (עד 5 דק') - ר' .github/workflows/claude-fix-reports.yml, טריגר repository_dispatch.
    // דורש GH_DISPATCH_TOKEN + GH_DISPATCH_REPO כ-env ב-Vercel (שני הפרויקטים/הגמחים,
    // אותו ריפו משותף) - בלי זה פשוט לא שולח כלום, ה-cron הרגיל עדיין מכסה.
    try {
      const ghToken = process.env.GH_DISPATCH_TOKEN;
      const ghRepo = process.env.GH_DISPATCH_REPO;
      if (ghToken && ghRepo) {
        fetch(`https://api.github.com/repos/${ghRepo}/dispatches`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ghToken}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ event_type: 'new-error-report', client_payload: { reportId: newReport.id } }),
        }).catch(() => {});
      }
    } catch (e) {
      console.error('Failed to trigger instant fix-reports run', e);
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