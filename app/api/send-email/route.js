import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';

export async function POST(request) {
  try {
    const body = await request.json();
    const { username, password, to, cc, subject, emailBody, fileName, fileContent, customerId, employeeId } = body;

    // 1. Verify admin credentials
    if (!username || !password) {
      return NextResponse.json({ success: false, message: 'נדרש שם משתמש וסיסמה لاישור השליחה' }, { status: 401 });
    }

    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          { firstName: username },
          { lastName: username },
          { fullName: username }
        ],
        password: password,
        isActive: true
      }
    });

    let validEmployee = employee;
    if (!validEmployee && !isNaN(parseInt(username, 10))) {
      validEmployee = await prisma.employee.findFirst({
        where: {
          id: parseInt(username, 10),
          password: password,
          isActive: true
        }
      });
    }

    if (!validEmployee) {
      return NextResponse.json({ success: false, message: 'שם משתמש או סיסמה שגויים' }, { status: 401 });
    }

    if (validEmployee.roleId !== 1 && validEmployee.roleId !== 2) {
      return NextResponse.json({ success: false, message: 'אין הרשאת ניהול (מנהל/מתכנת) לביצוע פעולה זו' }, { status: 403 });
    }

    // 2. Prepare payload for Google Script
    // If no file was provided, send a tiny dummy text file because the script requires base64
    const finalFileName = fileName || 'message.txt';
    const finalFileContent = fileContent || Buffer.from('נשלח ממערכת הגמ"ח').toString('base64');

    const googlePayload = {
      to,
      cc: cc || '',
      subject: subject || 'הודעה חדשה',
      body: emailBody || '',
      fileName: finalFileName,
      fileContent: finalFileContent
    };

    // 3. Call Google Apps Script
    const scriptUrl = 'https://script.google.com/macros/s/AKfycbyBDsY2mF7h9PyGCw-ZpuaVK4XbtybOcd5t1Ka9TAU-cNFmKPsZYwxeNTxL3juZC-GvQA/exec';
    
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(googlePayload)
    });

    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      // Sometimes google scripts return HTML if there's an error
      result = { status: 'error', message: responseText };
    }

    const isSuccess = result.status === 'success';

    // 4. Save to EmailLog
    await prisma.emailLog.create({
      data: {
        to,
        cc: cc || null,
        subject: subject || null,
        body: emailBody || null,
        fileName: fileName ? fileName : null,
        status: isSuccess ? 'success' : 'error',
        errorMessage: isSuccess ? null : (result.message || 'Unknown error'),
        customerId: customerId ? parseInt(customerId, 10) : null,
        employeeId: employeeId ? parseInt(employeeId, 10) : null,
        sentAt: new Date()
      }
    });

    // 5. Save to AuditLog so it shows up in history
    if (isSuccess) {
      const entityId = customerId || employeeId;
      const entityType = customerId ? 'Customer' : (employeeId ? 'Employee' : 'System');
      
      if (entityId) {
        await prisma.auditLog.create({
          data: {
            entityType,
            entityId: entityId,
            action: 'EMAIL_SENT',
            changesJson: JSON.stringify({
              subject: subject,
              to: to,
              cc: cc,
              body: emailBody
            }),
            employeeId: validEmployee.id,
            createdAt: new Date()
          }
        });
      }
    }

    if (!isSuccess) {
      return NextResponse.json({ success: false, message: 'השליחה נכשלה: ' + (result.message || 'Unknown error') }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'המייל נשלח בהצלחה' });
  } catch (error) {
    console.error('Failed to send email:', error);
    return NextResponse.json({ success: false, message: 'שגיאת שרת בשליחת המייל' }, { status: 500 });
  }
}
