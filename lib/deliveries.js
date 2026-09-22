import prisma from '@/app/lib/prisma';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { calculateOrderStatus } from '@/lib/orderStatus';
import { getHebrewDateString, getIsraelDayRange, toIsraelCalendarDate } from '@/lib/hebrewDate';

// הועבר מ-app/api/deliveries/route.js (2026-09-16, §C/§D במסמך docs/deliveries-feature-plan-2026-09-16.md)
// כדי שגם שליחת נתונים למשלוחן במייל (courier-email route) תוכל להשתמש באותה שאילתה
// בדיוק - בלי לשכפל את חישוב חלונות ההלוך/חזור. ההתנהגות של app/api/deliveries/route.js
// עצמו לא השתנתה, רק פוצלה לכאן. שרת-בלבד (מייבא prisma) - לוגיקת הקיבוץ/כותרות
// שגם הדפסה (client-side) צריכה יושבת ב-lib/deliveryCourier.js, בלי תלות בפריזמה.

function addDays(date, days, skipWeekends = false) {
  if (!skipWeekends) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }
  // מדלג על שישי (5) ושבת (6) - דיווח a74ffa6d (נווה יעקב, 2026-09-22): תאריך
  // ההוצאה/איסוף של משלוח צריך להיספר בימי-עסקים בלבד, לא ימים קלנדריים.
  const result = new Date(date);
  let remaining = Math.abs(days);
  const direction = days > 0 ? 1 : -1;
  while (remaining > 0) {
    result.setDate(result.getDate() + direction);
    const day = result.getDay();
    if (day === 5 || day === 6) continue;
    remaining--;
  }
  return result;
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// גבולות היום לפי אזור הזמן של ישראל, לא לפי setHours (שתלוי באזור הזמן של השרת
// שמריץ את הקוד - UTC ב-Vercel, לא ישראל). דיווח e179c090 (משלוחים מציג הזמנות של
// יום אחר): eventDate של הזמנות שיובאו מ-Access נושא לפעמים שעה אמיתית שאינה חצות
// UTC, אז גבול לפי setHours היה מפספס אותן ליום הלועזי הלא-נכון. ר' getIsraelDayRange
// ב-lib/hebrewDate.js לתיעוד המלא (וגם toIsraelCalendarDate/toIsraelDateKey לאותה בעיה
// במקומות אחרים בקוד).
function dayRange(date) {
  return getIsraelDayRange(dateKey(date));
}

// 'YYYY-MM-DD' של יום קלנדרי ישראלי (עוגן UTC מ-toIsraelCalendarDate) פלוס/מינוס ימים.
function anchorPlusDaysIso(anchor, days, skipWeekends = false) {
  if (!skipWeekends) {
    const d = new Date(anchor);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }
  const result = new Date(anchor);
  let remaining = Math.abs(days);
  const direction = days > 0 ? 1 : -1;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + direction);
    const day = result.getUTCDay();
    if (day === 5 || day === 6) continue;
    remaining--;
  }
  return result.toISOString().slice(0, 10);
}

/**
 * כל ההזמנות שנופלות לחלון משלוח הלוך/חזור עבור תאריך נתון (Date, חצות מקומית) -
 * אותו חוזה בדיוק כמו GET /api/deliveries?date=, כולל directions/chargeExists לכל שורה.
 *
 * ברירת מחדל (deliveries_select_by_event_date כבוי): התאריך הוא יום ה"הוצאה/חזרה" -
 * מוצגות הזמנות שתאריך האירוע שלהן הוא התאריך + delivery_days_before (הלוך) או
 * התאריך - delivery_days_after (חזור).
 *
 * כשההגדרה deliveries_select_by_event_date דולקת (דיווח מייל 2026-09-18, סעיף 3): התאריך
 * הוא תאריך האירוע עצמו - מוצגות ההזמנות-עם-משלוח שהאירוע שלהן ביום הזה (לפי היום
 * הישראלי), והכיוונים נקבעים רק לפי deliveryDirection של ההזמנה. כדי שהדפסה/מייל
 * ימשיכו לציין את יום ההוצאה/האיסוף, כל שורה נושאת dispatchDates = { out?, return? }
 * ('YYYY-MM-DD' של היום שבו המשלוח יוצא/נאסף בפועל, לפי אותם ימים לפני/אחרי ואותה
 * התחשבות ב-deliveryOneDayBefore כמו במצב הרגיל). במצב הרגיל השדה לא נשלח.
 */
export async function getDeliveriesForDate(requestedDate) {
  const allSettings = await getAllCachedSettings();
  const settingsRows = allSettings.filter(s => ['delivery_days_before', 'delivery_days_after', 'deliveries_select_by_event_date', 'delivery_skip_weekends'].includes(s.key));
  const settingsMap = settingsRows.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
  const parsedBefore = parseInt(settingsMap.delivery_days_before, 10);
  const parsedAfter = parseInt(settingsMap.delivery_days_after, 10);
  const daysBefore = isNaN(parsedBefore) ? 1 : parsedBefore;
  const daysAfter = isNaN(parsedAfter) ? 1 : parsedAfter;
  // fallback כשהשורה חסרה ב-DB: כבוי = ההתנהגות הישנה
  const selectByEventDate = settingsMap.deliveries_select_by_event_date === 'true';
  // fallback כשהשורה חסרה ב-DB: כבוי = ימים קלנדריים כרגיל (ההתנהגות הישנה)
  const skipWeekends = settingsMap.delivery_skip_weekends === 'true';

  const outboundRange = dayRange(addDays(requestedDate, daysBefore, skipWeekends));
  const outboundOneDayBeforeRange = daysBefore !== 1 ? dayRange(addDays(requestedDate, 1, skipWeekends)) : null;
  const returnRange = dayRange(addDays(requestedDate, -daysAfter, skipWeekends));

  const eventDayRange = selectByEventDate ? dayRange(requestedDate) : null;
  const eventDateWhere = selectByEventDate
    ? [{ eventDate: { gte: eventDayRange.start, lte: eventDayRange.end } }]
    : [
        { eventDate: { gte: outboundRange.start, lte: outboundRange.end } },
        ...(outboundOneDayBeforeRange ? [{ eventDate: { gte: outboundOneDayBeforeRange.start, lte: outboundOneDayBeforeRange.end } }] : []),
        { eventDate: { gte: returnRange.start, lte: returnRange.end } }
      ];

  const orders = await prisma.order.findMany({
    where: {
      isDeleted: false,
      isDelivery: true,
      OR: eventDateWhere
    },
    include: {
      customer: { select: { firstName: true, lastName: true, phone1: true, phone2: true, city: true, street: true, houseNum: true } },
      items: { where: { isDeleted: false }, select: { description: true } },
      obligations: { where: { isDeleted: false }, select: { description: true } }
    },
    orderBy: { eventDate: 'asc' }
  });

  const data = [];
  for (const order of orders) {
    if (calculateOrderStatus(order) === 'מחוק') continue;
    if (!order.eventDate) continue;

    const eventTime = new Date(order.eventDate).getTime();
    const effectiveOutboundRange = order.deliveryOneDayBefore ? (outboundOneDayBeforeRange || outboundRange) : outboundRange;
    const orderDirection = order.deliveryDirection || 'הלוך-חזור';
    const directions = [];
    let dispatchDates;
    if (selectByEventDate) {
      // האירוע כבר נבחר לפי היום הישראלי בשאילתה - כאן רק כיוונים + ימי יציאה/איסוף מחושבים
      const eventAnchor = toIsraelCalendarDate(order.eventDate);
      dispatchDates = {};
      if (orderDirection !== 'חזור') {
        directions.push('out');
        dispatchDates.out = anchorPlusDaysIso(eventAnchor, -(order.deliveryOneDayBefore ? 1 : daysBefore), skipWeekends);
      }
      if (orderDirection !== 'הלוך') {
        directions.push('return');
        dispatchDates.return = anchorPlusDaysIso(eventAnchor, daysAfter, skipWeekends);
      }
    } else {
      if (orderDirection !== 'חזור' && eventTime >= effectiveOutboundRange.start.getTime() && eventTime <= effectiveOutboundRange.end.getTime()) directions.push('out');
      if (orderDirection !== 'הלוך' && eventTime >= returnRange.start.getTime() && eventTime <= returnRange.end.getTime()) directions.push('return');
    }
    if (directions.length === 0) continue;

    const dressModelNames = [...new Set(order.items.map(i => i.description).filter(Boolean))];

    const street = order.deliveryAddress || [order.customer?.street, order.customer?.houseNum].filter(Boolean).join(' ');
    const city = order.deliveryCity || order.customer?.city || '';
    const address = street && city ? `${street}, ${city}` : (street || city || '');

    data.push({
      orderId: order.orderId,
      customerFirstName: order.customer?.firstName || '',
      customerLastName: order.customer?.lastName || '',
      customerName: `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || 'לא ידוע',
      customerPhone: order.customer?.phone1 || '',
      customerPhone2: order.customer?.phone2 || '',
      address,
      // עיר לבד (לא "רחוב, עיר" כמו address) - נדרש לפילוח משלוחים לפי עיר (§B,
      // docs/deliveries-feature-plan-2026-09-16.md), שם צריך למנות לפי עיר בלבד.
      city,
      eventDate: order.eventDate,
      eventDateHebrew: order.eventDateHebrew || getHebrewDateString(order.eventDate) || null,
      dressModelNames,
      directions,
      ...(dispatchDates ? { dispatchDates } : {}),
      // "הערות כלליות להזמנה" (Order.notes) - אותו שדה שמודפס בדף ההזמנה ומוצג בכרטיס
      // ההזמנה; לא internalNotes (פנימי להנהלה). משמש את דף "לשקית".
      notes: order.notes || '',
      chargeExists: {
        out: order.obligations.some(o => o.description && o.description.includes('הלוך')),
        return: order.obligations.some(o => o.description && o.description.includes('חזור'))
      }
    });
  }

  return { daysBefore, daysAfter, selectByEventDate, data };
}
