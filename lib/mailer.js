import prisma from '@/app/lib/prisma';
import { getAllCachedSettings, getCachedSetting } from '@/lib/settingsCache';
import { rtlPlainText, stripManagementGreeting } from '@/lib/emailTemplates';

// Thin wrapper around the app's existing email mechanism (a Google Apps Script webhook,
// URL configurable via the `email_link_a` / `email_link_b` / `email_routing_strategy`
// SystemSetting rows - see app/api/send-email/route.js and app/api/error-report/route.js,
// which this mirrors). Centralized here so the password-reset flows don't duplicate the
// script-URL lookup / payload shape a third time.
const FALLBACK_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyBDsY2mF7h9PyGCw-ZpuaVK4XbtybOcd5t1Ka9TAU-cNFmKPsZYwxeNTxL3juZC-GvQA/exec';

/**
 * כתובת ה-Apps Script לפי הגדרות email_link_a/b + email_routing_strategy.
 * bugRouting=true למיילי דיווח תקלה בלבד: אסטרטגיית 'bugs_b_rest_a' מנתבת אותם ל-B.
 * הנקודה היחידה במערכת שמכירה את כתובת ה-fallback - כל אתר שליחה משתמש בה.
 */
export async function resolveScriptUrl({ bugRouting = false } = {}) {
  const settings = (await getAllCachedSettings()).filter(s => ['email_link_a', 'email_link_b', 'email_routing_strategy'].includes(s.key));
  const linkA = settings.find(s => s.key === 'email_link_a')?.value;
  const linkB = settings.find(s => s.key === 'email_link_b')?.value;
  const strategy = settings.find(s => s.key === 'email_routing_strategy')?.value || 'all_a';

  if ((strategy === 'all_b' || (bugRouting && strategy === 'bugs_b_rest_a')) && linkB) return linkB;
  if (linkA) return linkA;
  return FALLBACK_SCRIPT_URL;
}

/**
 * ה-Apps Script החי דורש fileName+fileContent בכל בקשה רגילה (הוא מפענח base64 ללא בדיקה),
 * ולכן כשאין קובץ אמיתי לצרף עדיין נשלח "קובץ ממלא מקום". הדגל noAttachment=true אומר
 * ל-Apps Script (בגרסה המעודכנת, ר' docs/gas-mailer-live.gs) לא לצרף אותו למייל.
 * בלי הגרסה המעודכנת הדגל מתעלמים ממנו והמייל יוצא כמו קודם - אין שבירה בשום כיוון.
 */
const PLACEHOLDER_FILE_NAME = 'הודעה.txt';
const PLACEHOLDER_FILE_B64 = Buffer.from('נשלח ממערכת הגמ"ח').toString('base64');

/**
 * שולח payload ל-Apps Script ומחזיר את התוצאה המפוענחת. נקודת היציאה היחידה של כל מייל.
 * לפני השליחה (רק בבקשות רגילות, לא בפעולות כמו sendGemachOrderEmail שגוף ה-HTML שלהן
 * הופך ל-PDF): מסיר ברכת "שלום להנהלת הגמ"ח" מיותרת מפתיחת ה-body, ומיישר את ה-body
 * הטקסטואלי ל-RTL (RLE לכל שורה) כדי שפיסוק/רווחים/מספרים יתנהגו לפי כללי העברית.
 *
 * rtlBody=false משאיר את ה-body כמו שהוא (למשל גוף עם בלוק JSON שנקרא ע"י מכונה).
 *
 * @returns {Promise<{isSuccess:boolean, result:object, message:string|null}>}
 */
export async function postToMailer(payload, { bugRouting = false, scriptUrl, rtlBody = true } = {}) {
  const url = scriptUrl || await resolveScriptUrl({ bugRouting });
  const finalPayload = rtlBody && payload && !payload.action && typeof payload.body === 'string'
    ? { ...payload, body: rtlPlainText(stripManagementGreeting(payload.body)) }
    : payload;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(finalPayload)
  });
  const responseText = await response.text();
  let result;
  try {
    result = JSON.parse(responseText);
  } catch (e) {
    // Google Scripts sometimes return an HTML error page
    result = { status: 'error', message: responseText };
  }
  const isSuccess = result.status === 'success';
  return { isSuccess, result, message: isSuccess ? null : (result.message || 'Unknown error') };
}

async function resolveDriveFolderId() {
  try {
    const v = await getCachedSetting('email_drive_folder_id');
    return (v || '').trim();
  } catch {
    return '';
  }
}

/**
 * מנרמל רשימת קבצים מצורפים למבנה שה-GAS מצפה לו.
 * מקבל גם את הפורמט הישן (fileName/fileContent בודד) וגם מערך attachments.
 */
export function normalizeAttachments({ fileName, fileContent, attachments, sendMode, mimeType } = {}) {
  const list = [];
  if (Array.isArray(attachments)) {
    for (const a of attachments) {
      if (!a) continue;
      if (typeof a === 'string') continue;
      if (a.fileContent && a.fileName) {
        list.push({
          fileName: String(a.fileName),
          fileContent: String(a.fileContent),
          mimeType: a.mimeType || 'application/octet-stream',
          sizeBytes: a.sizeBytes ?? null,
          dest: a.dest || sendModeToDest(sendMode, a.dest)
        });
      }
    }
  }
  if (list.length === 0 && fileContent) {
    list.push({
      fileName: fileName || PLACEHOLDER_FILE_NAME,
      fileContent: String(fileContent),
      mimeType: mimeType || 'application/octet-stream',
      sizeBytes: null,
      dest: sendModeToDest(sendMode)
    });
  }
  return list;
}

function sendModeToDest(sendMode, fallback = 'email') {
  if (sendMode === 'drive') return 'drive';
  if (sendMode === 'both') return 'both';
  if (fallback === 'drive' || fallback === 'both' || fallback === 'email') return fallback;
  return 'email';
}

/**
 * בונה את ה-payload ל-GAS עבור קבצים + דרייב, תוך שמירת תאימות לאחור
 * (fileName/fileContent הראשון נשלח גם בשדות הישנים).
 */
export function buildGasPayload({
  to, cc, subject, body, htmlBody,
  attachments = [],
  sendMode = 'email',
  driveFolderId = '',
  driveShareEmail = '',
  grantFullDownload = true
}) {
  const normalized = normalizeAttachments({ attachments, sendMode });
  const first = normalized[0];
  return {
    // true = אין קובץ אמיתי; ה-fileName/fileContent שלמטה הם ממלא מקום בלבד (ר' למעלה)
    noAttachment: normalized.length === 0,
    to,
    cc: cc || '',
    subject: subject || 'הודעה ממערכת הגמ"ח',
    body: body || '',
    ...(htmlBody ? { htmlBody } : {}),
    // תאימות לאחור לפריסות GAS ישנות - הקובץ הראשון בשדות הבודדים
    fileName: first?.fileName || PLACEHOLDER_FILE_NAME,
    fileContent: first?.fileContent || PLACEHOLDER_FILE_B64,
    // הפורמט החדש - מערך מלא + הגדרות דרייב
    attachments: normalized.map(a => ({
      fileName: a.fileName,
      fileContent: a.fileContent,
      mimeType: a.mimeType || 'application/octet-stream',
      sizeBytes: a.sizeBytes ?? null,
      dest: a.dest || sendModeToDest(sendMode)
    })),
    sendMode,
    driveFolderId: driveFolderId || '',
    driveShareEmail: driveShareEmail || to || '',
    // ה-GAS נותן לנמען הרשאת הורדה מלאה (צפייה+הורדה + קישור פתוח)
    driveAllowDownload: grantFullDownload !== false,
    grantFullDownload: grantFullDownload !== false
  };
}

/**
 * Sends a plain-text/HTML email through the gemach's existing Google Apps Script mailer,
 * and records the attempt in EmailLog (same as the other senders in the app).
 *
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} [opts.subject]
 * @param {string} [opts.body] plain text body (also stored as-is in EmailLog)
 * @param {string} [opts.html] optional styled HTML body; when set, sent as `htmlBody`
 *   alongside `body` (same field the working order-email flow in
 *   app/api/orders/[id]/email/route.js already sends) so the script can render it if it
 *   supports htmlBody, with `body` as a plain-text fallback either way.
 * @param {string} [opts.employeeId] for EmailLog attribution
 * @param {string} [opts.confirmToken] optional unguessable random token (see
 *   app/api/bulk-email/route.js) stored on the EmailLog row so a later hit to
 *   /api/bulk-email/confirm?token=... can find this exact send and stamp
 *   acknowledgedAt. Unused by every other caller (stays null on their rows).
 * @param {Array<{fileName:string,fileContent:string(base64),mimeType?:string,sizeBytes?:number,dest?:'email'|'drive'|'both'}>} [opts.attachments]
 *   קבצים מצורפים מרובים. dest מגדיר לכל קובץ: 'email' (צרופה למייל), 'drive' (העלאה
 *   לדרייב + שיתוף), 'both' (גם וגם). ברירת מחדל נגזרת מ-sendMode.
 * @param {string} [opts.fileName] תאימות לאחור - קובץ בודד (נשמר כראשון ב-attachments)
 * @param {string} [opts.fileContent] base64 של הקובץ הבודד
 * @param {'email'|'drive'|'both'} [opts.sendMode='email'] יעד השליחה בהתאמה
 * @param {string} [opts.driveFolderId] תיקיית יעד בדרייב (רשות - אחרת שורש הדרייב של החשבון)
 * @param {boolean} [opts.grantFullDownload=true] הענקת הרשאת הורדה מלאה לנמען בדרייב
 * @param {boolean} [opts.bugRouting=false] מייל דיווח תקלה - מכבד את אסטרטגיית הניתוב 'bugs_b_rest_a'
 * @param {{html:string,fileName:string}} [opts.pdfFromHtml] כרטיס הזמנה: ה-Apps Script הופך את ה-HTML ל-PDF ומצרף
 *   אותו (action sendGemachOrderEmail, כמו app/api/orders/[id]/email/route.js). `html` הוא גוף המייל המלווה.
 * @param {boolean} [opts.rtlBody=true] false = לא לעטוף את ה-body הטקסטואלי ב-RLE (גוף שמכונה קוראת)
 * @param {string} [opts.cc]
 * @returns {Promise<{success: boolean, message?: string, driveLinks?: Array<{fileName:string,url:string,id:string}>}>}
 */
export async function sendSystemEmail({ to, subject, body, html, employeeId, attachments, fileName, fileContent, mimeType, sendMode = 'email', driveFolderId = '', grantFullDownload = true, confirmToken, bugRouting = false, rtlBody = true, cc, pdfFromHtml } = {}) {
  if (!to) {
    return { success: false, message: 'לא סופקה כתובת מייל' };
  }

  let isSuccess = false;
  let errorMessage = null;
  let driveLinks = [];

  try {
    const scriptUrl = await resolveScriptUrl({ bugRouting });
    const defaultFolder = driveFolderId || (await resolveDriveFolderId());
    // רק קבצים אמיתיים - "קובץ ממלא המקום" נוסף ב-buildGasPayload
    const normalized = normalizeAttachments({ fileName, fileContent, attachments, sendMode, mimeType });
    const payload = buildGasPayload({
      to,
      cc: cc || '',
      subject: subject || 'הודעה ממערכת הגמ"ח',
      body: body || '',
      htmlBody: html,
      attachments: normalized,
      sendMode,
      driveFolderId: defaultFolder,
      driveShareEmail: to,
      grantFullDownload
    });

    const finalPayload = pdfFromHtml
      ? { ...payload, action: 'sendGemachOrderEmail', htmlBody: pdfFromHtml.html, bodyText: html, fileName: pdfFromHtml.fileName }
      : payload;
    const posted = await postToMailer(finalPayload, { scriptUrl, rtlBody });
    const { result } = posted;
    isSuccess = posted.isSuccess;
    if (Array.isArray(result.driveLinks)) driveLinks = result.driveLinks;
    else if (Array.isArray(result.driveFiles)) driveLinks = result.driveFiles;
    if (!isSuccess) errorMessage = posted.message;
  } catch (e) {
    console.error('sendSystemEmail failed:', e);
    errorMessage = e.message || 'שגיאת רשת בשליחת המייל';
  }

  try {
    await prisma.emailLog.create({
      data: {
        to,
        subject: subject || null,
        body: body || null,
        fileName: (Array.isArray(attachments) && attachments[0]?.fileName) || fileName || null,
        status: isSuccess ? 'success' : 'error',
        errorMessage: isSuccess
          ? (driveLinks.length > 0 ? `Drive: ${driveLinks.map(d => d.url || d.fileName).join(', ')}` : null)
          : errorMessage,
        employeeId: employeeId || null,
        confirmToken: confirmToken || null,
        sentAt: new Date()
      }
    });
  } catch (e) {
    console.error('Failed to write EmailLog for password email:', e);
  }

  return isSuccess ? { success: true, driveLinks } : { success: false, message: errorMessage };
}