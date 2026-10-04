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

/** מזהה תיקיית דרייב: רק תווים בטוחים. אחרת '' (השרת יפול להגדרת ברירת המחדל) */
export function safeDriveFolderId(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9_-]{10,100}$/.test(s) ? s : '';
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
    total += a.fileContent.length;
    list.push({
      fileName,
      fileContent: a.fileContent,
      mimeType: typeof a.mimeType === 'string' && /^[\w.+-]{1,60}\/[\w.+-]{1,100}$/.test(a.mimeType) ? a.mimeType : 'application/octet-stream',
      sizeBytes: Number.isFinite(a.sizeBytes) && a.sizeBytes >= 0 ? Math.round(a.sizeBytes) : null,
      dest: DESTS.includes(a.dest) ? a.dest : undefined,
      kind: typeof a.kind === 'string' ? a.kind.slice(0, 30) : undefined,
    });
  }
  if (list.length > QUICK_MAIL_MAX_FILES) return { ok: false, error: `אפשר לצרף עד ${QUICK_MAIL_MAX_FILES} קבצים` };
  if (total > QUICK_MAIL_MAX_BASE64_CHARS) return { ok: false, error: 'הקבצים גדולים מדי לשליחה' };
  return { ok: true, list };
}
