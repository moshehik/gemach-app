// FROZEN COPY of origin/main 00104dc4 lib/deliveries.js - "before" oracle for deliveries-parity.test.mjs. Imports rewritten only.
import prisma from '@/app/lib/prisma';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { calculateOrderStatus } from '@/lib/orderStatus';
import { getHebrewDateString, getIsraelDayRange, getIsraelDateKey } from '@/lib/hebrewDate';
import { NON_WORKING_DAYS_SETTING_KEY, parseNonWorkingDaysSetting, addBusinessDays, inverseBusinessDays, keyFromLocalDate, rollForwardToWorkingDay, rolledSourceRange } from './businessDays.main.mjs';
import { DRAFT_ORDER_STATUS } from '@/lib/orderReservation';

// הועבר מ-app/api/deliveries/route.js (2026-09-16, §C/§D במסמך docs/deliveries-feature-plan-2026-09-16.md)
// כדי שגם שליחת נתונים למשלוחן במייל (courier-email route) תוכל להשתמש באותה שאילתה
// בדיוק - בלי לשכפל את חישוב חלונות ההלוך/חזור. ההתנהגות של app/api/deliveries/route.js
// עצמו לא השתנתה, רק פוצלה לכאן. שרת-בלבד (מייבא prisma) - לוגיקת הקיבוץ/כותרות
// שגם הדפסה (client-side) צריכה יושבת ב-lib/deliveryCourier.js, בלי תלות בפריזמה.
//
// ספירת "ימים לפני/אחרי האירוע" (2026-10-01, החלטת הבעלים - DECISIONS-לוז-יומי.md סעיפים 1/3/4):
// דרך הכלל האחיד של lib/businessDays.js. חג, ערב חג והימים שהבעלים סימן "ללא פעילות" מדולגים
// תמיד (אין משלוח ביום טוב - בשני הגמ"חים); שישי/שבת מדולגים רק כש-delivery_skip_weekends דולק,
// בדיוק כמו קודם (דיווח a74ffa6d). בלי ימים כאלה בטווח התוצאה זהה לחלוטין לקוד הקודם
// (הוכח ב-scripts/business-days-tests/deliveries-parity.test.mjs).
//
// תיקון האי-סימטריה (אותה החלטה): במצב הרגיל התאריך המבוקש הוא יום היציאה/האיסוף, והקוד
// הקודם חיפש רק את האירוע ש"N ימי עסקים קדימה" נוחת עליו - כך שאירוע שנופל בעצמו על יום לא
// עובד (שבת, חג) לא נמצא לעולם, למרות שההדפסה/המייל (שמחשבים אחורה מהאירוע) כן נותנים לו יום
// יציאה. עכשיו החלון הוא ההופכי המלא (inverseBusinessDays): כל האירועים שיום היציאה המחושב
// אחורה מהם הוא התאריך המבוקש. כשאין ימים לא-עובדים בדרך החלון מתכווץ ליום אחד, כמו קודם.
//
// delivery_days_after = 0 (החלטת הבעלים 4.10.2026, SCH-DELIV-0 = ב' "ליום העבודה הבא"): משלוח החזרה ביום
// האירוע עצמו, אבל כשהאירוע נופל על יום סגור (שישי / שבת / חג / ערב חג / יום שהבעלים סגר) האיסוף עובר ליום
// העבודה הבא - בדיוק כמו החזרה ידנית (rollForwardToWorkingDay, הכלל המלא, בלי תלות ב-delivery_skip_weekends:
// "יום סגור" כאן הוא היום הסגור של הגמ"ח, כמו בשלב 8). החלון ההופכי: rolledSourceRange (היום המבוקש + רצף
// הימים הסגורים שלפניו; יום סגור לא אוסף כלום). days_after > 0 - בלי שינוי (addBusinessDays/inverseBusinessDays).
// הוכחה: scripts/schedule-tests/deliveries-days-after-zero.test.mjs.
export function returnDispatchKey(eventKey, daysAfter, nonWorking, countOpts) {
  if (daysAfter === 0) return rollForwardToWorkingDay(eventKey, nonWorking);
  return addBusinessDays(eventKey, daysAfter, nonWorking, countOpts);
}

export function returnEventKeyRange(dispatchKey, daysAfter, nonWorking, countOpts) {
  if (daysAfter === 0) return rolledSourceRange(dispatchKey, nonWorking);
  return inverseBusinessDays(dispatchKey, daysAfter, nonWorking, countOpts);
}

// גבולות היום לפי אזור הזמן של ישראל, לא לפי setHours (שתלוי באזור הזמן של השרת
// שמריץ את הקוד - UTC ב-Vercel, לא ישראל). דיווח e179c090 (משלוחים מציג הזמנות של
// יום אחר): eventDate של הזמנות שיובאו מ-Access נושא לפעמים שעה אמיתית שאינה חצות
// UTC, אז גבול לפי setHours היה מפספס אותן ליום הלועזי הלא-נכון. ר' getIsraelDayRange
// ב-lib/hebrewDate.js לתיעוד המלא (וגם toIsraelCalendarDate/toIsraelDateKey לאותה בעיה
// במקומות אחרים בקוד).
function windowRange(win) {
  if (!win) return null;
  return { start: getIsraelDayRange(win.startKey).start, end: getIsraelDayRange(win.endKey).end };
}

function inWindow(eventTime, range) {
  return !!range && eventTime >= range.start.getTime() && eventTime <= range.end.getTime();
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
 *
 * אפשרויות (2026-10-01, לו״ז יומי - lib/schedule/loaders.js; בלי אפשרויות ההתנהגות זהה לקודם):
 *   byDispatchDate: true  - התאריך הוא תמיד יום ההוצאה/האיסוף של השליח, גם כשההגדרה
 *                           deliveries_select_by_event_date דולקת (הלו״ז שואל "מה השליח עושה היום",
 *                           לא "אילו אירועים היום"). dispatchDates נשלח גם במצב הזה.
 *   includeInternalNotes  - מוסיף internalNotes לשורה. כבוי כברירת מחדל: /api/deliveries חשוף לכל
 *                           עובד מחובר, והערות פנימיות הן להנהלה בלבד.
 *   excludeDrafts         - מסנן טיוטות (Order.status = 'טיוטה' - עגלה שנשמרה אוטומטית במסך הזמנה חדשה)
 *                           כבר בשאילתה, בצורה בטוחה ל-NULL: { OR: [{status: null}, {status: {not: 'טיוטה'}}] }
 *                           (אף פעם לא notIn/<> חשוף על Order.status, שעמוס NULL - CLAUDE.md). כבוי כברירת
 *                           מחדל: /api/deliveries הקיים הציג טיוטות גם קודם (סקירת WP1, ממצא 1) ושינוי שם
 *                           דורש אישור נפרד; הלו״ז היומי מעביר true כדי להתיישר עם שאר השלבים.
 *   withScheduleFields    - מוסיף לשורה את השדות שרק הלו״ז צריך (street, dressCount, branch, pickupBranch, דגלי
 *                           חו"ל/אמצע שבוע/יום נוסף/מרווח, fromDate/toDate, returnCondition) ובוחר לפריטים גם
 *                           isReturned/returnDate/returnedOk. כבוי כברירת מחדל: בלי האפשרות השורה, ה-select
 *                           וה-include זהים בית-לבית ל-/api/deliveries שלפני הלו״ז (business-days-tests, test D) -
 *                           הקוראים הקיימים (דף המשלוחים, מייל השליח, a5/adv-b) לא מקבלים שדות עודפים.
 */
export async function getDeliveriesForDate(requestedDate, { byDispatchDate = false, includeInternalNotes = false, excludeDrafts = false, withScheduleFields = false } = {}) {
  const allSettings = await getAllCachedSettings();
  const settingsRows = allSettings.filter(s => ['delivery_days_before', 'delivery_days_after', 'deliveries_select_by_event_date', 'delivery_skip_weekends', NON_WORKING_DAYS_SETTING_KEY].includes(s.key));
  const settingsMap = settingsRows.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
  const parsedBefore = parseInt(settingsMap.delivery_days_before, 10);
  const parsedAfter = parseInt(settingsMap.delivery_days_after, 10);
  const daysBefore = isNaN(parsedBefore) ? 1 : parsedBefore;
  const daysAfter = isNaN(parsedAfter) ? 1 : parsedAfter;
  // fallback כשהשורה חסרה ב-DB: כבוי = ההתנהגות הישנה
  const selectByEventDate = !byDispatchDate && settingsMap.deliveries_select_by_event_date === 'true';
  // fallback כשהשורה חסרה ב-DB: כבוי = שישי/שבת נספרים כימים רגילים (ההתנהגות הישנה);
  // חג/ערב חג/רשימת הבעלים מדולגים בכל מקרה (ר' הערת הכותרת).
  const skipWeekends = settingsMap.delivery_skip_weekends === 'true';
  const nonWorking = parseNonWorkingDaysSetting(settingsMap[NON_WORKING_DAYS_SETTING_KEY] ?? null);
  const countOpts = { skipWeekend: skipWeekends };
  const plusBusiness = (key, n) => addBusinessDays(key, n, nonWorking, countOpts);
  const inverse = (key, n) => inverseBusinessDays(key, n, nonWorking, countOpts);

  // requestedDate הוא Date בחצות מקומית (ר' parseDateParam בנתיב) - המפתח לפי הרכיבים המקומיים, כמו קודם.
  const requestedKey = keyFromLocalDate(requestedDate);

  // חלונות תאריכי-אירוע שיום היציאה/האיסוף שלהם הוא התאריך המבוקש (ר' הערת הכותרת על הסימטריה).
  const outboundRange = windowRange(inverse(requestedKey, -daysBefore));
  // חלון נפרד להזמנות "משלוח יום לפני" רק כש-delivery_days_before אינו 1 (אחרת זה אותו חלון, ואין
  // להוסיף אותו פעמיים לשאילתה). null = אין יום כזה (התאריך המבוקש אינו יום עובד) - לא נופלים לחלון
  // הרגיל, אחרת הזמנת "יום לפני" הייתה מופיעה ביום הלא נכון.
  const outboundOneDayBeforeRange = daysBefore !== 1 ? windowRange(inverse(requestedKey, -1)) : null;
  const oneDayBeforeEffectiveRange = daysBefore !== 1 ? outboundOneDayBeforeRange : outboundRange;
  const returnRange = windowRange(returnEventKeyRange(requestedKey, daysAfter, nonWorking, countOpts));

  const eventDayRange = selectByEventDate ? getIsraelDayRange(requestedKey) : null;
  const eventDateWhere = selectByEventDate
    ? [{ eventDate: { gte: eventDayRange.start, lte: eventDayRange.end } }]
    : [
        ...(outboundRange ? [{ eventDate: { gte: outboundRange.start, lte: outboundRange.end } }] : []),
        ...(outboundOneDayBeforeRange ? [{ eventDate: { gte: outboundOneDayBeforeRange.start, lte: outboundOneDayBeforeRange.end } }] : []),
        ...(returnRange ? [{ eventDate: { gte: returnRange.start, lte: returnRange.end } }] : [])
      ];

  // יום לא עובד במצב הרגיל: שום משלוח לא יוצא ולא נאסף בו (אין חלון בכלל) - בלי שאילתה.
  if (eventDateWhere.length === 0) return { daysBefore, daysAfter, selectByEventDate, data: [] };

  const orders = await prisma.order.findMany({
    where: {
      isDeleted: false,
      isDelivery: true,
      OR: eventDateWhere,
      ...(excludeDrafts ? { AND: [{ OR: [{ status: null }, { status: { not: DRAFT_ORDER_STATUS } }] }] } : {})
    },
    include: {
      customer: { select: { firstName: true, lastName: true, phone1: true, phone2: true, city: true, street: true, houseNum: true } },
      // isReturned/returnDate/returnedOk: רק ללו״ז היומי (withScheduleFields - מצב החזרה תקין/לא תקין בשלב 9,
      // החלטה A4) - מאותה שליפה, בלי שאילתה נוספת; בלי האפשרות ה-select זהה לקודם.
      items: { where: { isDeleted: false }, select: { description: true, ...(withScheduleFields ? { isReturned: true, returnDate: true, returnedOk: true } : {}) } },
      obligations: { where: { isDeleted: false }, select: { description: true } }
    },
    orderBy: { eventDate: 'asc' }
  });

  const data = [];
  for (const order of orders) {
    if (calculateOrderStatus(order) === 'מחוק') continue;
    if (!order.eventDate) continue;

    const eventTime = new Date(order.eventDate).getTime();
    const effectiveOutboundRange = order.deliveryOneDayBefore ? oneDayBeforeEffectiveRange : outboundRange;
    const orderDirection = order.deliveryDirection || 'הלוך-חזור';
    const directions = [];
    let dispatchDates;
    if (selectByEventDate) {
      // האירוע כבר נבחר לפי היום הישראלי בשאילתה - כאן רק כיוונים + ימי יציאה/איסוף מחושבים
      const eventKey = getIsraelDateKey(order.eventDate);
      dispatchDates = {};
      if (orderDirection !== 'חזור') {
        directions.push('out');
        dispatchDates.out = plusBusiness(eventKey, -(order.deliveryOneDayBefore ? 1 : daysBefore));
      }
      if (orderDirection !== 'הלוך') {
        directions.push('return');
        dispatchDates.return = returnDispatchKey(eventKey, daysAfter, nonWorking, countOpts);
      }
    } else {
      if (orderDirection !== 'חזור' && inWindow(eventTime, effectiveOutboundRange)) directions.push('out');
      if (orderDirection !== 'הלוך' && inWindow(eventTime, returnRange)) directions.push('return');
      if (byDispatchDate && directions.length > 0) {
        // ללו״ז: יום ההוצאה/האיסוף בפועל גם במצב הרגיל - אותה נוסחה (אותו כלל אחיד) כמו במצב "לפי אירוע" למעלה
        const eventKey = getIsraelDateKey(order.eventDate);
        dispatchDates = {};
        if (directions.includes('out')) dispatchDates.out = plusBusiness(eventKey, -(order.deliveryOneDayBefore ? 1 : daysBefore));
        if (directions.includes('return')) dispatchDates.return = returnDispatchKey(eventKey, daysAfter, nonWorking, countOpts);
      }
    }
    if (directions.length === 0) continue;

    const dressModelNames = [...new Set(order.items.map(i => i.description).filter(Boolean))];

    const street = order.deliveryAddress || [order.customer?.street, order.customer?.houseNum].filter(Boolean).join(' ');
    const city = order.deliveryCity || order.customer?.city || '';
    const address = street && city ? `${street}, ${city}` : (street || city || '');

    // שדות ללו״ז היומי בלבד (lib/schedule/loaders.js) - מהשורה שכבר נטענה, בלי שאילתה נוספת. opt-in: בלי
    // withScheduleFields צורת השורה של /api/deliveries לא משתנה.
    let scheduleFields = {};
    if (withScheduleFields) {
      // מצב החזרה (החלטה A4/B17, שלב 9): 'ok' / 'not_ok' רק אחרי שכל הפריטים הוחזרו, אחרת null.
      // "הוחזר" = הדגל או התאריך (הייבוא מ-Access השאיר דגלים לא מנורמלים), אותו כלל כמו כרטיס ההזמנה.
      const returnedItems = order.items.filter(i => i.isReturned || i.returnDate);
      const allReturned = order.items.length > 0 && returnedItems.length === order.items.length;
      scheduleFields = {
        // רחוב לבד (deliveryAddress או רחוב+בית של הלקוחה) - הלו״ז מתריע "חסרה כתובת משלוח" כשחסר רחוב או עיר;
        // מהמחרוזת המאוחדת address אי אפשר לדעת איזה חלק חסר.
        street,
        dressCount: order.items.length,
        branch: order.branch || null,
        pickupBranch: order.pickupBranch || null,
        isAbroad: !!order.isAbroad,
        isWeekdayEvent: !!order.isWeekdayEvent,
        extraDay: order.extraDay || null,
        customSpacing: order.customSpacing ?? null,
        fromDate: order.fromDate || null,
        toDate: order.toDate || null,
        returnCondition: allReturned ? (returnedItems.every(i => i.returnedOk) ? 'ok' : 'not_ok') : null,
      };
    }

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
      ...scheduleFields,
      ...(includeInternalNotes ? { internalNotes: order.internalNotes || '' } : {}),
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
