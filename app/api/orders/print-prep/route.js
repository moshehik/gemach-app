import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { getPrintPrepDate, getIsraelDayRange } from '@/lib/hebrewDate';

export const dynamic = 'force-dynamic';

// כמה ימי-לוח קדימה מספיק לחפש אירועים מ"תאריך ההכנה" המבוקש - 3 ימי עסקים
// יכולים "להימתח" עד כדי כ-7-8 ימי לוח כשיש חג ברצף לשישי/שבת; 12 יום נותן
// מרווח ביטחון בלי לסרוק את כל בסיס הנתונים.
const LOOKAHEAD_DAYS = 12;

// מנרמל מחרוזת "YYYY-MM-DD" ל-Date בחצות UTC מילולית, באותה שיטה בדיוק כמו
// parseSafeDate ב-app/api/orders/[id]/route.js (המוסכמה שהזמנות חדשות נשמרות
// לפיה) - נחוץ ל-mode=prep, שם ההשוואה למטה (שורה prepDate.getTime() <=
// targetTo.getTime()) מבוססת על שוויון-חצות מדויק מול prepDate (הפרש ימים
// שלמים מ-eventDate, ר' subtractSkippingWeekendsAndChag) ולא על טווח - אסור
// להזיז אותה בלי לשבור את ההשוואה.
function parseDateOnly(dateStr) {
  const d = new Date(dateStr);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// דיווח 54daaa2e (2026-09-14, org2): "בחרתי תאריך אחר להדפסה, הוא הדפיס לי יום
// אח"כ" (mode=event, "תאריך אחר"/"טווח תאריכים") - התברר (בדיקה ישירה מול ה-DB)
// ש-Order.eventDate נשמר בפועל בשתי מוסכמות שונות בו-זמנית: הזמנות חדשות
// (מ-app/api/orders/route.js / app/api/orders/[id]/route.js:parseSafeDate)
// שומרות "YYYY-MM-DD" כחצות UTC מילולית (new Date(str), בלי שום התאמת אזור
// זמן - זה התיקון המתועד שם), אבל כמות גדולה של הזמנות ותיקות/מיובאות עדיין
// שמורות לפי חצות-ישראל-מומרת-ל-UTC (כ-21:00/22:00 היום הקודם ב-UTC - אותה
// מוסכמה בדיוק ש-getIsraelDayRange מניחה, ושכבר משמשת את app/api/alterations/
// route.js). כדי לא להתערב בין שתי המוסכמות בלי הגירת נתונים (סיכון גבוה, לא
// משהו להחליט כאן) - mode=event משווה לרשימת ה"נקודות" המדויקות האפשריות (לא
// טווח מורחב): לכל יום ביעד יש בדיוק שתי מוסכמות אפשריות, אלה נקודות זמן
// בודדות (כל הזמנה שמורה בדיוק בשעה אחת, לא איפשהו לאורך היום), אז equality
// מדויקת מול שתיהן היא הדרך היחידה שלא "דולפת" ליום הסמוך - טווח יום שלם
// (00:00-23:59:59) לפי המוסכמה החדשה חופף בפועל לתחילת המוסכמה הישנה של היום
// שאחריו (21:00-22:00 אותו יום UTC), וזה נבדק ישירות מול ה-DB האמיתי לפני
// שהוחלט על equality ולא על טווח.
function candidateInstantsForRange(fromStr, toStr) {
  const instants = [];
  let cur = new Date(`${fromStr}T00:00:00.000Z`);
  const end = new Date(`${toStr}T00:00:00.000Z`);
  while (cur.getTime() <= end.getTime()) {
    const ds = cur.toISOString().slice(0, 10);
    instants.push(parseDateOnly(ds), getIsraelDayRange(ds).start);
    cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
  }
  return instants;
}

// מחזיר את רשימת מספרי ההזמנות (orderId) המתאימות לתאריך/טווח המבוקש.
// שני מצבים (query param mode, ר' דיווח df17fb16):
// - mode=prep (ברירת מחדל, "הכנות להיום") - האירוע דורש הכנת הדפסה בתאריך/טווח
//   המבוקש, לפי הכלל "3 ימי עסקים לפני האירוע" (getPrintPrepDate).
// - mode=event ("תאריך אחר"/"טווח תאריכים") - תאריך האירוע עצמו נופל בתאריך/טווח
//   המבוקש, בלי שום חישוב הכנה - "תאריך אחר" אמור להדפיס את כל האירועים של אותו
//   תאריך, לא רק את מי שההכנה שלו יוצאת לתאריך הזה.
// ר' גם דיווחים c5032b47 (/orders, "הכנות להיום") ו-ed6c69bc (/board, אותה בקשה
// מזווית הלוח החודשי). נקרא מ-app/components/PrintWizardModal.js, שמעביר את
// התוצאה הלאה ל-/print/order?orderId=... (שכבר תומך בהדפסה מרוכזת של כמה הזמנות,
// כולל מיון משלוחים קודם ותג משלוח הלוך/חזור על כל עמוד - ר' app/print/order/page.js).
export async function GET(request) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const mode = searchParams.get('mode') === 'event' ? 'event' : 'prep';

    const fromStr = dateParam || fromParam;
    const toStr = dateParam || toParam;
    if (!fromStr || !toStr) {
      return NextResponse.json({ error: 'יש לספק date, או from+to' }, { status: 400 });
    }

    const targetFrom = parseDateOnly(fromStr);
    const targetTo = parseDateOnly(toStr);
    if (isNaN(targetFrom.getTime()) || isNaN(targetTo.getTime())) {
      return NextResponse.json({ error: 'תאריך לא תקין' }, { status: 400 });
    }

    let orderIds;
    if (mode === 'event') {
      const orders = await prisma.order.findMany({
        where: {
          isDeleted: false,
          eventDate: { in: candidateInstantsForRange(fromStr, toStr) }
        },
        select: { orderId: true },
        orderBy: { eventDate: 'asc' }
      });
      orderIds = orders.map(o => o.orderId);
    } else {
      const eventWindowStart = new Date(targetFrom);
      const eventWindowEnd = new Date(targetTo);
      eventWindowEnd.setDate(eventWindowEnd.getDate() + LOOKAHEAD_DAYS);
      eventWindowEnd.setUTCHours(23, 59, 59, 999);

      const candidates = await prisma.order.findMany({
        where: {
          isDeleted: false,
          eventDate: { gte: eventWindowStart, lte: eventWindowEnd }
        },
        select: { orderId: true, eventDate: true },
        orderBy: { eventDate: 'asc' }
      });

      const matches = candidates.filter(o => {
        if (!o.eventDate) return false;
        const prepDate = getPrintPrepDate(o.eventDate);
        return prepDate.getTime() >= targetFrom.getTime() && prepDate.getTime() <= targetTo.getTime();
      });
      orderIds = matches.map(o => o.orderId);
    }

    return NextResponse.json({ orderIds, count: orderIds.length });
  } catch (err) {
    console.error('GET /api/orders/print-prep error:', err);
    return NextResponse.json({ error: 'שגיאה בשליפת הזמנות להכנה' }, { status: 500 });
  }
}
