import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { getPrintPrepDate } from '@/lib/hebrewDate';

export const dynamic = 'force-dynamic';

// כמה ימי-לוח קדימה מספיק לחפש אירועים מ"תאריך ההכנה" המבוקש - 3 ימי עסקים
// יכולים "להימתח" עד כדי כ-7-8 ימי לוח כשיש חג ברצף לשישי/שבת; 12 יום נותן
// מרווח ביטחון בלי לסרוק את כל בסיס הנתונים.
const LOOKAHEAD_DAYS = 12;

// מנרמל מחרוזת "YYYY-MM-DD" ל-Date בחצות, באותה שיטה בדיוק כמו
// subtractSkippingWeekendsAndChag (lib/hebrewDate.js) - כדי שההשוואה בין
// prepDate המחושב לבין טווח היעד תהיה "תפוח מול תפוח" (אותו אזור זמן/מוסכמה).
function parseDateOnly(dateStr) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
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
      const eventWindowEnd = new Date(targetTo);
      eventWindowEnd.setHours(23, 59, 59, 999);

      const orders = await prisma.order.findMany({
        where: {
          isDeleted: false,
          eventDate: { gte: targetFrom, lte: eventWindowEnd }
        },
        select: { orderId: true },
        orderBy: { eventDate: 'asc' }
      });
      orderIds = orders.map(o => o.orderId);
    } else {
      const eventWindowStart = new Date(targetFrom);
      const eventWindowEnd = new Date(targetTo);
      eventWindowEnd.setDate(eventWindowEnd.getDate() + LOOKAHEAD_DAYS);
      eventWindowEnd.setHours(23, 59, 59, 999);

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
