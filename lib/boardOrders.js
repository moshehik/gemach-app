// ההזמנות של הלוח החודשי החדש (GET /api/board/orders) - CPU phase 1B, 2026-10-06.
//
// הלוח החדש (app/components/board/BoardPage.js) משתמש בהזמנות רק לדבר אחד: סימן "איחור החזרה" לתא (isOrderLate ב-boardLogic.js ->
// getLateReturnInfo ב-lib/lateReturn.js), שקורא מהזמנה: eventDate, toDate, returnDate, ומהפריטים: isDeleted, isTaken/takenDate,
// isReturned/returnDate. לפני כן הוא משך את GET /api/orders?limit=2000 - כל ההזמנות של החודש (±14 יום) עם לקוח, פריטים, תשלומים וחישובי
// סטטוס, ~531KB לקריאה. כאן: רק הזמנות שיכולות בכלל להיות באיחור (יש להן פריט לא מחוק שנלקח - דגל או תאריך - ולא הוחזר - דגל או תאריך),
// ורק השדות האלה. אותן שורות בדיוק שהלוח היה מסמן באיחור (הפילטר הוא על-קבוצה של התנאי של isOrderLate, והלקוח מריץ אותו שוב).
//
// זהה ל-/api/orders באופן מכוון: הזמנות לא מחוקות, eventDate בין from ל-to (כולל; בלי תאריך אירוע לא נכללות - כמו שם), ובהגדרה
// hide_taken_orders_from_orders_list=true גם סינון "יש פריט שלא נלקח" שהנתיב הישן מפעיל על filterStatus=all (ר' app/api/orders/route.js) -
// כך שהסימן בלוח לא משתנה בגלל המעבר לנתיב הזה. (זה מסתיר מהסימן הזמנות שכל פריטיהן נלקחו - התנהגות קיימת, החלטה נפרדת.)

export const BOARD_ORDERS_DEFAULT_LIMIT = 2000;
export const BOARD_ORDERS_MAX_LIMIT = 5000;

export function parseBoardRange(searchParams) {
  const from = new Date(searchParams.get('eventDateFrom') || '');
  const to = new Date(searchParams.get('eventDateTo') || '');
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return null;
  // טווח של הלוח החודשי הוא ~60 יום; תקרה של שנה מונעת שימוש בנתיב כשאילתה חופשית על כל הטבלה
  if (to.getTime() - from.getTime() > 400 * 24 * 3600 * 1000 || to < from) return null;
  return { from, to };
}

export function parseBoardLimit(raw) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return BOARD_ORDERS_DEFAULT_LIMIT;
  return Math.min(n, BOARD_ORDERS_MAX_LIMIT);
}

// פריט שיכול לתרום לאיחור: לא מחוק, לא הוחזר (דגל), ונלקח (דגל או תאריך). הלקוח בודק שוב את itemReturned לפי returnDate.
export const LATE_CANDIDATE_ITEM = { isDeleted: false, isReturned: false, OR: [{ isTaken: true }, { takenDate: { not: null } }] };

export function buildBoardOrdersArgs({ from, to, limit, hideTakenOrders }) {
  const conditions = [
    { isDeleted: false },
    { eventDate: { gte: from, lte: to } },
    { items: { some: LATE_CANDIDATE_ITEM } },
  ];
  if (hideTakenOrders) conditions.push({ items: { some: { isDeleted: false, isTaken: false } } });
  return {
    where: { AND: conditions },
    select: {
      orderId: true,
      eventDate: true,
      toDate: true,
      returnDate: true,
      items: { where: { isDeleted: false }, select: { isDeleted: true, isTaken: true, takenDate: true, isReturned: true, returnDate: true } },
    },
    orderBy: { eventDate: 'asc' },
    take: limit,
  };
}

/** תשובת הנתיב: { data, total } - data באותו מפתח כמו /api/orders כדי שמטמון הדף ימשיך לקרוא data/orders כמו קודם. */
export async function loadBoardOrders({ prisma, getSetting, from, to, limit }) {
  const hideSetting = await getSetting('hide_taken_orders_from_orders_list');
  const args = buildBoardOrdersArgs({ from, to, limit, hideTakenOrders: hideSetting?.value === 'true' });
  const data = await prisma.order.findMany(args);
  return { data, total: data.length };
}
