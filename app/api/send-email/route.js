import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { verifyEmployeeCredentials } from '../../../lib/employeeAuth';
import { verifySecret } from '@/lib/passwordAuth';
import { renderGenericEmailHtml, renderAttachmentsGuideTable, renderAttachmentsGuideText } from '../../../lib/emailTemplates';
import { normalizeAttachments } from '@/lib/mailer';

export async function POST(request) {
  try {
    const body = await request.json();
    const { username, password, to, cc, subject, emailBody, fileName, fileContent, customerId, employeeId } = body;
    // חדש: קבצים מרובים + יעד בהתאמה (מייל / דרייב / גם וגם)
    // attachments: [{fileName,fileContent(base64),mimeType,sizeBytes,dest}]
    // sendMode: 'email' | 'drive' | 'both' - ברירת מחדל ליעד של קבצים ללא dest מפורש
    // driveFolderId: תיקיית יעד בדרייב (רשות)
    const { attachments: attachmentsRaw, sendMode: sendModeRaw, driveFolderId: driveFolderIdRaw } = body;
    const sendMode = ['email', 'drive', 'both'].includes(sendModeRaw) ? sendModeRaw : 'email';

    // 1. Verify admin credentials
    // username (employeeId) may legitimately be blank - see the fallback scan below
    if (!password) {
      return NextResponse.json({ success: false, message: 'נדרש שם משתמש וסיסמה لاישור השליחה' }, { status: 401 });
    }

    // The admin select in SendEmailModal sends the employee UUID as username, but free-text
    // name/legacyId login is also supported - see lib/employeeAuth.js for the identifier
    // matching. Passwords are hashed, so the match happens via bcrypt compare in JS instead
    // of a plaintext `password: password` clause in the Prisma query.
    let validEmployee = await verifyEmployeeCredentials(username, password);

    // ModernSendEmailModal מזין כאן את ה-employeeId שהוחזר מ-customAuthPrompt (PopupProvider),
    // שיכול להישאר ריק אם המשתמש לא הספיק לבחור עצמו מרשימת "בחר מנהל" (למשל טופס נטען
    // מהר יותר מרשימת העובדים) - זה בדיוק המצב שבו /api/auth/verify-pin כבר מאשר בהצלחה
    // באמצעות סריקת כל העובדים הפעילים, אז מיישמים כאן את אותו fallback במקום לדחות בקשה
    // שכבר אושרה פעם אחת קודם לכן.
    if (!validEmployee && !username) {
      const candidates = await prisma.employee.findMany({ where: { isActive: true } });
      for (const candidate of candidates) {
        if (await verifySecret(password, candidate.password)) {
          validEmployee = candidate;
          break;
        }
      }
    }

    if (!validEmployee) {
      return NextResponse.json({ success: false, message: 'שם משתמש או סיסמה שגויים' }, { status: 401 });
    }

    if (validEmployee.roleId !== 1 && validEmployee.roleId !== 2) {
      return NextResponse.json({ success: false, message: 'אין הרשאת ניהול (מנהל/מתכנת) לביצוע פעולה זו' }, { status: 403 });
    }

    // 2. Prepare payload for Google Script
    // תאימות לאחור: קובץ בודד fileName/fileContent + פורמט חדש attachments[].
    // dest לכל קובץ: 'email' (מצורף למייל) / 'drive' (עולה לדרייב+שיתוף) / 'both' (גם וגם).
    let normalized = normalizeAttachments({ fileName, fileContent, attachments: attachmentsRaw, sendMode });
    if (normalized.length === 0) {
      normalized = normalizeAttachments({
        fileName: 'הודעה.txt',
        fileContent: Buffer.from('נשלח ממערכת הגמ"ח').toString('base64'),
        sendMode
      });
    }
    const finalFileName = normalized[0]?.fileName || 'הודעה.txt';
    const finalFileContent = normalized[0]?.fileContent || Buffer.from('נשלח ממערכת הגמ"ח').toString('base64');

    // 3. Call Google Apps Script - Get URL from settings
    const settings = (await getAllCachedSettings()).filter(s => ['email_link_a', 'email_link_b', 'email_routing_strategy', 'gmach_name', 'email_drive_folder_id'].includes(s.key));
    const linkA = settings.find(s => s.key === 'email_link_a')?.value;
    const linkB = settings.find(s => s.key === 'email_link_b')?.value;
    const strategy = settings.find(s => s.key === 'email_routing_strategy')?.value || 'all_a';
    const gmachName = settings.find(s => s.key === 'gmach_name')?.value || 'גמ"ח שמלות';
    const defaultDriveFolder = settings.find(s => s.key === 'email_drive_folder_id')?.value || '';
    const driveFolderId = (driveFolderIdRaw || defaultDriveFolder || '').trim();

    // טבלת הוראות מסודרת - נשלחת כחלק מגוף המייל (HTML + טקסט) דרך ה-GAS,
    // כדי שהנמען יראה לכל קובץ לאן נשלח ואיך מורידים אותו.
    const guideTableHtml = renderAttachmentsGuideTable(normalized);
    const guideText = renderAttachmentsGuideText(normalized);
    const baseHtml = renderGenericEmailHtml({ title: subject, bodyText: emailBody, gmachName });
    const htmlWithGuide = guideTableHtml
      ? baseHtml.replace('</div>\n      </div>\n    </body>', `${guideTableHtml}</div>\n      </div>\n    </body>`)
      : baseHtml;

    const googlePayload = {
      to,
      cc: cc || '',
      subject: subject || 'הודעה חדשה',
      body: `${emailBody || ''}${guideText}`,
      htmlBody: htmlWithGuide,
      fileName: finalFileName,
      fileContent: finalFileContent,
      // פורמט מורחב ל-GAS החדש - פריסות ישנות מתעלמות מהשדות האלה
      attachments: normalized.map(a => ({
        fileName: a.fileName,
        fileContent: a.fileContent,
        mimeType: a.mimeType || 'application/octet-stream',
        sizeBytes: a.sizeBytes ?? null,
        dest: a.dest || (sendMode === 'drive' ? 'drive' : sendMode === 'both' ? 'both' : 'email')
      })),
      sendMode,
      driveFolderId,
      driveShareEmail: to || '',
      driveAllowDownload: true,
      grantFullDownload: true
    };

    let scriptUrl = 'https://script.google.com/macros/s/AKfycbyBDsY2mF7h9PyGCw-ZpuaVK4XbtybOcd5t1Ka9TAU-cNFmKPsZYwxeNTxL3juZC-GvQA/exec';
    
    // For standard emails, only use B if strategy is 'all_b'. Otherwise use A.
    if (strategy === 'all_b' && linkB) {
      scriptUrl = linkB;
    } else if (linkA) {
      scriptUrl = linkA;
    }
    
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
    const driveLinks = Array.isArray(result.driveLinks) ? result.driveLinks : (Array.isArray(result.driveFiles) ? result.driveFiles : []);

    // 4. Save to EmailLog
    await prisma.emailLog.create({
      data: {
        to,
        cc: cc || null,
        subject: subject || null,
        body: `${emailBody || ''}${guideText}`,
        fileName: normalized.map(a => a.fileName).join(', ') || null,
        status: isSuccess ? 'success' : 'error',
        errorMessage: isSuccess
          ? (driveLinks.length > 0 ? `Drive: ${driveLinks.map(d => d.url || d.fileName).join(', ')}` : null)
          : (result.message || 'Unknown error'),
        customerId: customerId || null,
        employeeId: employeeId || null,
        sentAt: new Date()
      }
    });

    // 5. Save to AuditLog so it shows up in history
    if (isSuccess) {
      const entityId = customerId || employeeId;
      const entityType = customerId ? 'Customer' : (employeeId ? 'Employee' : 'System');
      
      if (entityId) {
        // eslint-disable-next-line no-restricted-syntax -- הכתיבה שקדמה היא ל-EmailLog; זו שורת ההיסטוריה של הלקוח/העובד
        await prisma.auditLog.create({
          data: {
            entityType,
            entityId: entityId,
            action: 'EMAIL_SENT',
            changesJson: JSON.stringify({
              subject: subject,
              to: to,
              cc: cc,
              body: emailBody,
              sendMode,
              files: normalized.map(a => ({ fileName: a.fileName, sizeBytes: a.sizeBytes ?? null, dest: a.dest })),
              driveLinks
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

    return NextResponse.json({ success: true, message: 'המייל נשלח בהצלחה', driveLinks, sendMode });
  } catch (error) {
    console.error('Failed to send email:', error);
    return NextResponse.json({ success: false, message: 'שגיאת שרת בשליחת המייל' }, { status: 500 });
  }
}