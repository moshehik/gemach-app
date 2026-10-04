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
