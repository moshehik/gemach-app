// lib/orderQuickMail.js — "מייל מהיר" מכרטיס ההזמנה החדש (A8): נושא ותוכן חופשיים שהעובדת הקלידה, כגוף בקשה אופציונלי
// (`quick:{subject, bodyText}`) ל-POST /api/orders/[id]/email. טהור (בלי Prisma/next) - משמש גם את הלקוח (מגבלות) וגם את השרת (ניקוי).
// בלי `quick` הנתיב עובד בדיוק כמו קודם (כרטיס הזמנה/השכרה כ-PDF); עם `quick` נשלח מייל רגיל (ללא PDF שנוצר מ-HTML) עם הצרופות שנבחרו.
export const QUICK_MAIL_MAX_SUBJECT = 200;
export const QUICK_MAIL_MAX_BODY = 5000;

// תווי בקרה (חוץ מירידת שורה) מוסרים; בנושא גם ירידות שורה/טאב הופכות לרווח (נושא הוא כותרת מייל - אסור שיכיל שורות נוספות)
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

export function cleanQuickSubject(value) {
  return (typeof value === 'string' ? value : '').replace(CONTROL, '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, QUICK_MAIL_MAX_SUBJECT);
}
export function cleanQuickBody(value) {
  return (typeof value === 'string' ? value : '').replace(/\r\n?/g, '\n').replace(CONTROL, '').trim().slice(0, QUICK_MAIL_MAX_BODY);
}

/**
 * @param {unknown} raw  גוף השדה `quick` מהבקשה
 * @returns {null | {ok:true, subject:string, bodyText:string} | {ok:false, error:string}}  null = אין מייל מהיר בבקשה
 */
export function parseQuickMail(raw) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'פרטי המייל המהיר אינם תקינים' };
  const subject = cleanQuickSubject(raw.subject);
  const bodyText = cleanQuickBody(raw.bodyText);
  if (!subject) return { ok: false, error: 'נדרש נושא למייל' };
  if (!bodyText) return { ok: false, error: 'נדרש תוכן למייל' };
  return { ok: true, subject, bodyText };
}

// ---- מגבלות ניקוי נוספות למייל מהיר (השרת בלבד מפעיל; הלקוח כבר מגביל את עצמו באותם ערכים) ----
export const QUICK_MAIL_MAX_FILES = 10;
export const QUICK_MAIL_MAX_BASE64_CHARS = 6_000_000; // סך תווי base64 של כל הצרופות (~4.5MB קבצים; Vercel ממילא חותך גוף בקשה ~4.5MB)
const MAX_FILE_NAME = 150;
const DESTS = ['email', 'drive', 'both'];

/** כתובת נמען בודדת: מחרוזת, ללא רווחים/פסיקים/נקודה-פסיק/סוגריים זוויתיים/תווי בקרה (הזרקת כותרות / נמענים נוספים), עד 254 תווים */
export function isSafeRecipient(value) {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  if (!s || s.length > 254) return false;
  if (/[\s,;<>()"'\\\u0000-\u001f\u007f]/.test(s)) return false;
  return /^[^@]+@[^@]+\.[^@]+$/.test(s);
}

/** מזהה תיקיית דרייב: רק תווים בטוחים. אחרת ''. (מייל מהיר לא משתמש בו עם ערך מהלקוח - ר' quickDriveFolderId) */
export function safeDriveFolderId(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9_-]{10,100}$/.test(s) ? s : '';
}

/**
 * תיקיית הדרייב של מייל מהיר: אך ורק ההגדרה email_drive_folder_id. מזהה תיקייה שנשלח מהלקוח (driveFolderId בגוף) מתעלמים ממנו - אחרת עובדת
 * (או בקשה ישירה) יכלה לשלוח קבצים ללקוח לתיקיית דרייב שרירותית ולשתף אותה (סקירת אינטגרציה S4). הפרמטר השני נשאר לחתימה בלבד.
 */
export function quickDriveFolderId(settingValue, _clientValue) {
  return typeof settingValue === 'string' ? settingValue.trim() : '';
}

// סוגי הקבצים המותרים כצרופה למייל מהיר (מה שהכרטיס מייצר + קבצים שעובדת בוחרת): לפי סיומת. mimeType נקבע בשרת מהסיומת - לא מהלקוח.
export const QUICK_MAIL_FILE_TYPES = Object.freeze({
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  html: 'text/html',
});
export const QUICK_MAIL_ACCEPT = Object.keys(QUICK_MAIL_FILE_TYPES).map(e => `.${e}`).join(','); // לתכונת accept של בורר הקבצים בלקוח
export const quickMailFileExt = (name) => { const m = /\.([A-Za-z0-9]{1,8})$/.exec(String(name || '').trim()); return m ? m[1].toLowerCase() : ''; };
export const isAllowedQuickFile = (name) => Object.prototype.hasOwnProperty.call(QUICK_MAIL_FILE_TYPES, quickMailFileExt(name));
export const QUICK_MAIL_FILE_TYPES_HE = 'PDF, Excel (xlsx), תמונה (png / jpg) או HTML';

/** base64 תקין (בלי קידומת data:, בלי תווים זרים, אורך כפולה של 4 אחרי הסרת ירידות שורה). מחזיר את המחרוזת הנקייה או null. */
export function cleanBase64(value) {
  if (typeof value !== 'string') return null;
  const s = value.replace(/[\r\n]+/g, '');
  if (!s || s.length % 4 !== 0) return null;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(s) ? s : null;
}

function cleanFileName(value) {
  const base = String(value ?? '').replace(CONTROL, '').replace(/[\r\n\t]+/g, ' ').replace(/[\/]+/g, '_').replace(/\s{2,}/g, ' ').trim();
  return base.slice(0, MAX_FILE_NAME);
}

/**
 * צרופות המייל המהיר מגוף הבקשה: רק אובייקטים עם שם וקובץ (base64) - שם נקי (בלי בקרה/נתיב), mimeType תקין, dest מתוך email|drive|both,
 * kind כמו שנשלח (emailAttachmentSummary מנרמל מול הרשימה הסגורה). מגבלות: QUICK_MAIL_MAX_FILES קבצים, QUICK_MAIL_MAX_BASE64_CHARS תווים בסך הכול.
 * @returns {{ok:true, list:object[]} | {ok:false, error:string}}
 */
export function sanitizeQuickAttachments(raw) {
  if (raw === undefined || raw === null) return { ok: true, list: [] };
  if (!Array.isArray(raw)) return { ok: false, error: 'רשימת הצרופות אינה תקינה' };
  const list = [];
  let total = 0;
  for (const a of raw) {
    if (!a || typeof a !== 'object' || typeof a.fileContent !== 'string' || !a.fileContent) continue;
    const fileName = cleanFileName(a.fileName);
    if (!fileName) continue;
    // S4: רק סוגי קבצים מותרים (לפי סיומת) ורק base64 תקין - אחרת שגיאה מפורשת (לא מדלגים בשקט על צרופה שהעובדת בחרה)
    if (!isAllowedQuickFile(fileName)) return { ok: false, error: `סוג הקובץ "${fileName}" אינו מותר לצירוף - מותר: ${QUICK_MAIL_FILE_TYPES_HE}` };
    const content = cleanBase64(a.fileContent);
    if (!content) return { ok: false, error: `תוכן הקובץ "${fileName}" אינו תקין` };
    total += content.length;
    list.push({
      fileName,
      fileContent: content,
      mimeType: QUICK_MAIL_FILE_TYPES[quickMailFileExt(fileName)],
      sizeBytes: Number.isFinite(a.sizeBytes) && a.sizeBytes >= 0 ? Math.round(a.sizeBytes) : null,
      dest: DESTS.includes(a.dest) ? a.dest : undefined,
      kind: typeof a.kind === 'string' ? a.kind.slice(0, 30) : undefined,
    });
  }
  if (list.length > QUICK_MAIL_MAX_FILES) return { ok: false, error: `אפשר לצרף עד ${QUICK_MAIL_MAX_FILES} קבצים` };
  if (total > QUICK_MAIL_MAX_BASE64_CHARS) return { ok: false, error: 'הקבצים גדולים מדי לשליחה' };
  return { ok: true, list };
}

// ---- H4 (hardening 2026-10-05): the print-menu email ("שליחה במייל" with extra files) --------------------------------------------------
// Staff really attach arbitrary documents there (Word, scans...), so unlike the quick mail this path keeps accepting any ordinary file type -
// but the same server-side cleaning applies: a bounded number / total size, a clean file name, VALID base64 only, executable / script
// types refused, and the mimeType is decided by the server from the extension (never taken from the request). Its drive folder is only the
// email_drive_folder_id setting (the client-supplied driveFolderId is ignored, exactly as for the quick mail).
export const ORDER_MAIL_BLOCKED_EXTS = Object.freeze([
  'exe', 'com', 'bat', 'cmd', 'scr', 'msi', 'dll', 'js', 'mjs', 'vbs', 'vbe', 'wsf', 'ps1', 'psm1', 'jar', 'lnk', 'reg', 'hta', 'cpl', 'sh', 'apk', 'app', 'dmg', 'iso', 'svg',
]);
const ORDER_MAIL_EXTRA_TYPES = Object.freeze({
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', csv: 'text/csv', txt: 'text/plain', gif: 'image/gif', webp: 'image/webp',
  zip: 'application/zip', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
});
export const orderMailMimeType = (name) => QUICK_MAIL_FILE_TYPES[quickMailFileExt(name)] || ORDER_MAIL_EXTRA_TYPES[quickMailFileExt(name)] || 'application/octet-stream';

/** @returns {{ok:true, list:object[]} | {ok:false, error:string}}  same shape as sanitizeQuickAttachments */
export function sanitizeOrderMailAttachments(raw) {
  if (raw === undefined || raw === null) return { ok: true, list: [] };
  if (!Array.isArray(raw)) return { ok: false, error: 'רשימת הצרופות אינה תקינה' };
  const list = [];
  let total = 0;
  for (const a of raw) {
    if (!a || typeof a !== 'object' || typeof a.fileContent !== 'string' || !a.fileContent) continue;
    const fileName = cleanFileName(a.fileName);
    if (!fileName) continue;
    if (ORDER_MAIL_BLOCKED_EXTS.includes(quickMailFileExt(fileName))) return { ok: false, error: `סוג הקובץ "${fileName}" אינו מותר לצירוף` };
    const content = cleanBase64(a.fileContent);
    if (!content) return { ok: false, error: `תוכן הקובץ "${fileName}" אינו תקין` };
    total += content.length;
    list.push({
      fileName,
      fileContent: content,
      mimeType: orderMailMimeType(fileName),
      sizeBytes: Number.isFinite(a.sizeBytes) && a.sizeBytes >= 0 ? Math.round(a.sizeBytes) : null,
      dest: DESTS.includes(a.dest) ? a.dest : undefined,
      kind: typeof a.kind === 'string' ? a.kind.slice(0, 30) : undefined,
    });
  }
  if (list.length > QUICK_MAIL_MAX_FILES) return { ok: false, error: `אפשר לצרף עד ${QUICK_MAIL_MAX_FILES} קבצים` };
  if (total > QUICK_MAIL_MAX_BASE64_CHARS) return { ok: false, error: 'הקבצים גדולים מדי לשליחה' };
  return { ok: true, list };
}
