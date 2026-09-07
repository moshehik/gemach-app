import prisma from '@/app/lib/prisma';

export const dynamic = 'force-dynamic';

// תכונה 22 - "מעקב מי אישר את המייל ומי לא": קצה ציבורי, ללא אימות (הלקוח
// מגיע אליו בלחיצה על קישור מתוך תיבת הדואר שלו, לא מחובר למערכת). כל מייל
// bulk-email נשלח עם confirmToken אקראי וייחודי (32 בייטים, base64url) שנשמר
// על שורת ה-EmailLog המדויקת שלו (ראה app/api/bulk-email/route.js + lib/mailer.js).
// כאן רק מחפשים שורה לפי הטוקן ומסמנים acknowledgedAt.
//
// אבטחה: הטוקן הוא ערך אקראי לא-ניתן-לניחוש (לא UUID/מזהה לקוח ולא נגזר ממנו),
// כך שגם אם מישהו ינחש/יזייף טוקן - findUnique פשוט לא ימצא שורה, ומוחזרת אותה
// תשובה גנרית בדיוק כמו טוקן חסר; שום פרט לקוח/הזמנה לא נחשף בתשובה במקרה כזה.
function htmlPage({ title, message, tone = 'ok' }) {
  const color = tone === 'error' ? '#b3261e' : '#2f6f4f';
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  body { font-family: Arial, sans-serif; background:#f7f7f5; margin:0; padding:0; }
  .box { max-width:480px; margin:80px auto; background:#fff; border-radius:12px; box-shadow:0 2px 12px rgba(0,0,0,.08); padding:32px; text-align:center; }
  h1 { color:${color}; font-size:20px; margin:0 0 12px; }
  p { color:#444; font-size:15px; line-height:1.6; }
</style>
</head>
<body>
  <div class="box">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

function respond(status, page) {
  return new Response(htmlPage(page), {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    if (!token || typeof token !== 'string' || token.length < 16) {
      return respond(404, { title: 'קישור לא תקין', message: 'הקישור שנלחץ אינו תקין או שפג תוקפו.', tone: 'error' });
    }

    const log = await prisma.emailLog.findUnique({ where: { confirmToken: token } });
    if (!log) {
      // טוקן שגוי/מנוחש - אותה תשובה גנרית בדיוק כמו טוקן חסר, בלי לחשוף האם
      // בכלל קיימת שורה כזו במערכת.
      return respond(404, { title: 'קישור לא תקין', message: 'הקישור שנלחץ אינו תקין או שפג תוקפו.', tone: 'error' });
    }

    if (log.acknowledgedAt) {
      return respond(200, {
        title: 'כבר אישרת את קבלת ההודעה',
        message: `האישור נקלט בעבר בתאריך ${new Date(log.acknowledgedAt).toLocaleString('he-IL')}. תודה!`,
      });
    }

    await prisma.emailLog.update({
      where: { id: log.id },
      data: { acknowledgedAt: new Date() },
    });

    return respond(200, {
      title: 'תודה, האישור נקלט בהצלחה',
      message: 'קיבלנו את אישורך לקבלת ההודעה. אין צורך בפעולה נוספת.',
    });
  } catch (e) {
    console.error('bulk-email confirm failed', e);
    return respond(500, { title: 'שגיאה', message: 'אירעה שגיאה בעת עיבוד האישור, נסו שוב מאוחר יותר.', tone: 'error' });
  }
}
