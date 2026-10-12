import prisma from '@/app/lib/prisma';
import { verifyUnsubscribeToken } from '@/lib/emailCampaign';
import { allow } from '@/lib/simpleRateLimit';
import { recordConsentEntries, MARKETING_WORDING, MARKETING_WORDING_VERSION } from '@/lib/customerConsent';

export const dynamic = 'force-dynamic';

// הסרה מרשימת הדיוור (חוק התקשורת, סעיף 30א) - קצה ציבורי, בלי התחברות (הלקוחה מגיעה מקישור בתיבת הדואר).
// GET  ?t=<טוקן>  -> דף אישור עם כפתור (GET בלבד לא משנה כלום: סורקי קישורים של תיבות דואר "לוחצים" על קישורים)
// POST ?t=<טוקן>  -> marketingConsent=false. אידמפוטנטי. התשובה זהה לטוקן שגוי ולטוקן של לקוחה שכבר הוסרה (בלי לחשוף מי קיים).
// הטוקן = HMAC של מזהה הלקוח (lib/emailCampaign.js makeUnsubscribeToken) - בלי טבלה, לא ניתן לניחוש/זיוף.
// השינוי עובר דרך תוסף ה-AuditLog של Prisma (מי: ללא עובד = הלקוחה עצמה).
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page({ title, message, token = '', tone = 'ok' }) {
  const color = tone === 'error' ? '#b3261e' : '#8a3457';
  const form = token
    ? `<form method="POST" action="/api/email/unsubscribe?t=${esc(encodeURIComponent(token))}"><button type="submit" style="margin-top:18px;background:${color};color:#fff;border:0;border-radius:10px;padding:12px 28px;font-size:16px;font-weight:700;cursor:pointer;font-family:inherit">אישור הסרה מרשימת הדיוור</button></form>`
    : '';
  return `<!DOCTYPE html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>body{font-family:Tahoma,Arial,sans-serif;background:#f3eee8;margin:0}.box{max-width:480px;margin:80px auto;background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:32px;text-align:center}h1{color:${color};font-size:21px;margin:0 0 12px}p{color:#444;font-size:15px;line-height:1.7}</style></head>
<body><div class="box"><h1>${esc(title)}</h1><p>${esc(message)}</p>${form}</div></body></html>`;
}

const respond = (status, html) => new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
const GENERIC_BAD = { title: 'קישור לא תקין', message: 'הקישור שנלחץ אינו תקין או שפג תוקפו. אם ברצונך להסיר את עצמך מרשימת הדיוור, אפשר לפנות אלינו ישירות.', tone: 'error' };

function clientKey(request) {
  const fwd = request.headers.get('x-forwarded-for') || '';
  return `unsub:${fwd.split(',')[0].trim() || 'unknown'}`;
}

export async function GET(request) {
  if (!allow(clientKey(request), 60, 10 * 60 * 1000)) return respond(429, page({ title: 'נסו שוב מאוחר יותר', message: 'בוצעו יותר מדי בקשות.', tone: 'error' }));
  const token = new URL(request.url).searchParams.get('t') || '';
  let id = null;
  try { id = verifyUnsubscribeToken(token); } catch { id = null; }
  if (!id) return respond(404, page(GENERIC_BAD));
  return respond(200, page({ title: 'הסרה מרשימת הדיוור', message: 'לחצו על הכפתור כדי להפסיק לקבל מאיתנו הודעות דיוור. הודעות על הזמנות קיימות ימשיכו להישלח כרגיל.', token }));
}

export async function POST(request) {
  if (!allow(clientKey(request), 30, 10 * 60 * 1000)) return respond(429, page({ title: 'נסו שוב מאוחר יותר', message: 'בוצעו יותר מדי בקשות.', tone: 'error' }));
  const token = new URL(request.url).searchParams.get('t') || '';
  let id = null;
  try { id = verifyUnsubscribeToken(token); } catch { id = null; }
  if (!id) return respond(404, page(GENERIC_BAD));
  try {
    const c = await prisma.customer.findUnique({ where: { id }, select: { id: true, marketingConsent: true } });
    if (c && c.marketingConsent) {
      await prisma.customer.update({ where: { id }, data: { marketingConsent: false } });
      // ראיה ביומן ההסכמות (CustomerConsent): ביטול הסכמה לדיוור שיווקי, ערוץ ציבורי / הלקוחה עצמה / מסך email-unsubscribe, בלי עובד.
      // recordConsentEntries לא זורקת לעולם: טבלה שעוד לא נוצרה / קליינט ישן = נרשם בקונסול והביטול עצמו (העמודה) כבר נשמר (סקירת אבטחה 12.10.2026, ממצא 10).
      await recordConsentEntries(prisma, id, [{
        channel: 'public', method: 'customer_self', surface: 'email-unsubscribe', recordedByEmployeeId: null, meta: null,
        kind: 'marketing', granted: false, documentVersion: MARKETING_WORDING_VERSION, documentRef: null, wording: MARKETING_WORDING,
      }]);
    }
  } catch (e) {
    console.error('email unsubscribe failed', e);
    return respond(500, page({ title: 'אירעה שגיאה', message: 'לא הצלחנו לעדכן כרגע. נסו שוב בעוד כמה דקות.', tone: 'error' }));
  }
  return respond(200, page({ title: 'הוסרת מרשימת הדיוור', message: 'לא יישלחו אליך יותר הודעות דיוור מאיתנו. תודה!' }));
}
