import { randomUUID } from 'crypto';
import prisma from '@/app/lib/prisma';
import { getAllCachedSettings, getCachedSetting } from '@/lib/settingsCache';
import { rtlPlainText, stripManagementGreeting } from '@/lib/emailTemplates';
import { resolveLoggedBody } from '@/lib/emailCatalog';
import { getSenderNameOverride } from '@/lib/emailConfig';
import { isHostingerMailEnabled, canSendViaHostinger, sendViaHostinger } from '@/lib/hostingerMail';

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

/** שם השולח במייל = ההגדרה gmach_name (ריק אם לא הוגדרה - ה-Apps Script ישתמש בברירת המחדל שלו). */
async function resolveSenderName() {
  try {
    // מרכז המיילים (/admin/email-center, "שדות קבועים"): שם שולח / שם גמ"ח שנערכו שם גוברים על ההגדרה gmach_name
    const override = await getSenderNameOverride();
    if (override) return override;
    const row = (await getAllCachedSettings()).find(s => s.key === 'gmach_name');
    return (row?.value || '').toString().trim();
  } catch {
    return '';
  }
}

/**
 * ה-Apps Script החי דורש fileName+fileContent בכל בקשה רגילה (הוא מפענח base64 ללא בדיקה),
 * ולכן כשאין קובץ אמיתי לצרף עדיין נשלח "קובץ ממלא מקום". הדגל noAttachment=true אומר
 * ל-Apps Script (בגרסה המעודכנת, ר' docs/gas-mailer-live.gs) לא לצרף אותו למייל.
 * בלי הגרסה המעודכנת הדגל מתעלמים ממנו והמייל יוצא כמו קודם - אין שבירה בשום כיוון.
 */
const PLACEHOLDER_FILE_NAME = 'הודעה.txt';
const PLACEHOLDER_FILE_B64 = Buffer.from('נשלח ממערכת הגמ"ח').toString('base64');

// --- שליחה לסקריפט עם ניסיון חוזר בטוח (ר' postToMailer) ---
const MAILER_MAX_ATTEMPTS = 3;
const MAILER_TIMEOUT_MS = 40000; // המרת PDF ב-Apps Script לוקחת בדרך כלל 2-10 שניות
const MAILER_BUDGET_MS = 45000; // אחרי זמן כולל כזה לא מתחילים ניסיון נוסף
const mailerSleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mailerPostOnce(url, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), MAILER_TIMEOUT_MS);
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: ctrl.signal });
    const text = await response.text();
    try {
      return { json: JSON.parse(text), text, http: response.status };
    } catch {
      return { json: null, text, http: response.status }; // Google Scripts sometimes return an HTML error page
    }
  } catch (e) {
    return { json: null, text: '', error: e.name === 'AbortError' ? 'timeout' : (e.message || String(e)) };
  } finally {
    clearTimeout(timer);
  }
}

async function mailerQueryStatus(url, requestId) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const sep = url.includes('?') ? '&' : '?';
    const res = await fetch(`${url}${sep}action=status&requestId=${encodeURIComponent(requestId)}`, { signal: ctrl.signal });
    clearTimeout(timer);
    return JSON.parse(await res.text());
  } catch {
    return null;
  }
}

// --- מצב יבש (EMAIL_DRY_RUN=1) ---
const DRY_OUTBOX_MAX = 200;
function dryRunPost(payload) {
  const box = (globalThis.__emailDryRunOutbox ||= []);
  const p = payload || {};
  box.push({
    at: new Date().toISOString(),
    to: p.to, cc: p.cc || '', subject: p.subject, senderName: p.senderName || '',
    body: String(p.body || '').slice(0, 20000),
    htmlBody: String(p.htmlBody || '').slice(0, 200000),
    attachments: (p.attachments || []).map((a) => ({ fileName: a.fileName, mimeType: a.mimeType, sizeBytes: a.sizeBytes ?? Math.round(String(a.fileContent || '').length * 0.75) })),
    noAttachment: !!p.noAttachment, action: p.action || null,
  });
  if (box.length > DRY_OUTBOX_MAX) box.splice(0, box.length - DRY_OUTBOX_MAX);
  console.log(`[mailer:dry-run] NOT SENT -> ${p.to} | ${p.subject}`);
  return { isSuccess: true, result: { status: 'success', dryRun: true }, message: null };
}
export function getDryRunOutbox() { return globalThis.__emailDryRunOutbox || []; }
export function clearDryRunOutbox() { globalThis.__emailDryRunOutbox = []; }
// EMAIL_DRY_RUN=1 לא מכובד בפרודקשן של Vercel (VERCEL_ENV==='production'): משתנה שהוגדר בטעות שם היה משתיק את כל המיילים בלי שגיאה (סקירת אבטחה 12.10.2026).
// בפרודקשן המייל נשלח כרגיל, ורק מופיעה אזהרה בלוג.
export function isDryRun() {
  if (process.env.EMAIL_DRY_RUN !== '1') return false;
  if (process.env.VERCEL_ENV === 'production') {
    if (!globalThis.__emailDryRunIgnoredWarned) { globalThis.__emailDryRunIgnoredWarned = true; console.error('[mailer] EMAIL_DRY_RUN=1 is IGNORED in production (VERCEL_ENV=production) - emails are sent normally'); }
    return false;
  }
  return true;
}

/**
 * מכסת המיילים היומית שנותרה ב-Apps Script (doGet?action=quota, גרסה 18+). null = לא ידוע (סקריפט ישן / שגיאת רשת).
 * חשבון Gmail רגיל = 100 נמענים ליום, משותף לכל האתרים והמערכות שמשתמשות באותו סקריפט.
 */
export async function getMailerQuota() {
  if (isDryRun()) return { remaining: null, dryRun: true };
  try {
    const url = await resolveScriptUrl();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}action=quota`, { signal: ctrl.signal });
    clearTimeout(timer);
    const j = JSON.parse(await res.text());
    const n = Number(j && j.remainingDailyQuota);
    return { remaining: Number.isFinite(n) ? n : null, dryRun: false };
  } catch {
    return { remaining: null, dryRun: false };
  }
}

/** הודעת שגיאה קצרה במקום להשליך לטבלת EmailLog דף HTML שלם של גוגל. */
function mailerShortError(r) {
  if (r.error) return `שגיאת רשת בשליחה ל-Apps Script: ${r.error}`;
  const html = r.text || '';
  const m = html.match(/monospace[^>]*>([^<]{3,200})</) || html.match(/<title>([^<]{1,120})/);
  const detail = m ? m[1].trim() : html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
  return `תשובה לא תקינה מ-Apps Script (HTTP ${r.http}): ${detail}`;
}

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
  // EMAIL_DRY_RUN=1 (סביבת פיתוח/בדיקות בלבד): לא פונים לרשת בכלל - המייל נרשם בתיבת יציאה בזיכרון (getDryRunOutbox) ומוחזרת הצלחה.
  // כך אפשר לבדוק מסכים ושליחה מלאה (כולל דיוורים) בלי לשלוח מייל אמיתי לאף כתובת. בפרודקשן המשתנה לא מוגדר.
  if (isDryRun()) return dryRunPost(payload);
  const url = scriptUrl || await resolveScriptUrl({ bugRouting });
  let finalPayload = rtlBody && payload && !payload.action && typeof payload.body === 'string'
    ? { ...payload, body: rtlPlainText(stripManagementGreeting(payload.body)) }
    : payload;
  // שם השולח מוצג ב-Gmail ("גמ"ח שמלות <כתובת>"). נקבע לפי שם הגמ"ח של האתר הנוכחי, כך שגם
  // גמח שני ששולח דרך אותו סקריפט יופיע בשמו. סקריפט שלא מכיר את השדה מתעלם ממנו (שם קבוע).
  if (finalPayload && !finalPayload.senderName) {
    const senderName = await resolveSenderName();
    if (senderName) finalPayload = { ...finalPayload, senderName };
  }

  // Hostinger Mail API (נווה יעקב): כשהמשתנים HOSTINGER_MAIL_TOKEN + HOSTINGER_MAILBOX_ID מוגדרים בפרויקט, מייל רגיל יוצא מתיבת
  // הדומיין ולא מ-Gmail. פעולות מיוחדות של ה-Apps Script (PDF מ-HTML, דרייב) ממשיכות דרכו. כשל "בטוח" (טוקן/הרשאה/קצב) נופל ל-Apps Script.
  if (isHostingerMailEnabled() && canSendViaHostinger(finalPayload)) {
    const hs = await sendViaHostinger(finalPayload);
    if (hs.isSuccess || !hs.fallback) return { isSuccess: hs.isSuccess, result: hs.result, message: hs.message };
    console.warn(`[mailer] ${hs.message} - falling back to Apps Script`);
  }

  // מזהה בקשה ייחודי: ה-Apps Script (גרסה 18+, 2026-10-07) משתמש בו כדי לא לשלוח את אותו מייל פעמיים
  // ולענות על "האם המייל הזה כבר יצא?" - ובזכותו אפשר לנסות שוב אחרי תשובה מפוקפקת של גוגל.
  const requestId = (finalPayload && finalPayload.requestId) || randomUUID();
  const body = JSON.stringify({ ...finalPayload, requestId });
  const startedAt = Date.now();

  let last;
  for (let attempt = 1; attempt <= MAILER_MAX_ATTEMPTS; attempt++) {
    last = await mailerPostOnce(url, body);
    if (last.json && (last.json.status === 'success' || last.json.status === 'error')) break; // תשובה חד-משמעית
    if (attempt === MAILER_MAX_ATTEMPTS || Date.now() - startedAt > MAILER_BUDGET_MS) break;

    // תשובה מפוקפקת (דף HTML של גוגל / ניתוק / timeout / "pending"): המייל אולי כבר יצא. שואלים את הסקריפט.
    let st = await mailerQueryStatus(url, requestId);
    for (let i = 0; i < 4 && st && st.status === 'pending'; i++) {
      await mailerSleep(3000);
      st = await mailerQueryStatus(url, requestId);
    }
    // אין תשובת סטטוס תקינה = סקריפט ישן בלי תמיכה באידמפוטנטיות -> לא מנסים שוב (סכנת כפילות)
    if (!st || !st.status) break;
    if (st.status === 'success') { last = { json: { status: 'success', recovered: true } }; break; }
    console.warn(`[mailer] attempt ${attempt} ambiguous (${last.error || last.http || 'bad response'}), script says "${st.status}" - retrying`);
    await mailerSleep(1500 * attempt);
  }
  const result = last.json || { status: 'error', message: mailerShortError(last) };
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
 * @param {string} [opts.body] plain text body (also stored in EmailLog - except for secret-bearing mails, see emailId/logBody)
 * @param {string} [opts.emailId] מזהה המייל ב-lib/emailCatalog.js. כשהרשומה מסומנת `containsSecret: true` (סיסמה זמנית וכו') גוף השורה
 *   ב-EmailLog נשמר כ-SECRET_BODY_PLACEHOLDER במקום הגוף האמיתי (המייל עצמו נשלח עם הסוד). מזהה לא מוכר = שגיאה מוקדמת.
 * @param {string|null} [opts.logBody] עקיפה מפורשת של מה שנשמר ב-EmailLog.body (גוברת על emailId); null/'' = לא נשמר גוף.
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
 * @param {string} [opts.requestId] מזהה בקשה קבוע (ברירת מחדל: אקראי). קבוע = אידמפוטנטיות ב-Apps Script (6 שעות) - משמש את הדיוורים נגד כפילות
 * @returns {Promise<{success: boolean, message?: string, driveLinks?: Array<{fileName:string,url:string,id:string}>}>}
 */
export async function sendSystemEmail({ to, subject, body, html, employeeId, attachments, fileName, fileContent, mimeType, sendMode = 'email', driveFolderId = '', grantFullDownload = true, confirmToken, bugRouting = false, rtlBody = true, cc, pdfFromHtml, emailId, logBody, requestId } = {}) {
  if (!to) {
    return { success: false, message: 'לא סופקה כתובת מייל' };
  }
  // נפתר לפני השליחה: emailId שגוי (שגיאת הקלדה) נכשל מיד ולא "נבלע" אחרי שהמייל כבר יצא עם סוד שנשמר ביומן
  const loggedBody = resolveLoggedBody({ body, subject, emailId, logBody });

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

    const basePayload = requestId ? { ...payload, requestId: String(requestId).slice(0, 80) } : payload; // מזהה קבוע = ה-Apps Script לא ישלח את אותו מייל פעמיים (דיוורים)
    const finalPayload = pdfFromHtml
      ? { ...basePayload, action: 'sendGemachOrderEmail', htmlBody: pdfFromHtml.html, bodyText: html, fileName: pdfFromHtml.fileName }
      : basePayload;
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
        body: loggedBody,
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