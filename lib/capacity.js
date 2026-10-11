// lib/capacity.js - חישוב "תפוסה" (מלאי / בתפוסה / רזרבה) לדגם+מידה: מקור אמת יחיד.
//
// נחלץ מ-app/api/inventory/capacity/route.js (12.10.2026) כדי שהחיפוש המתקדם (תחום "תפוסה"), טופס ההזמנה וגם פאנל התוצאות של
// החיפוש הראשי / המהיר (lib/searchPanel.js) יחשבו בדיוק אותו חישוב. ההתנהגות של ה-route לא השתנתה (אותן שאילתות, אותם כללים);
// נוסף רק גבול תחתון לתאריך ישירות בשאילתת ההזמנות (קודם נטענו כל ההזמנות של הדגם+מידה והסינון נעשה ב-JS) - התוצאה זהה והשאילתה מהירה יותר.
//
// הכללים (לא לשנות בלי להתאים את שלושת הצרכנים):
//   במלאי    = פריטי DressItem של קידומת+מידה: לא מחוק, לא "לא בשימוש", לא בתיקון, ומיקום ריק או שאינו מכיל מחסן/רזרבה (warehouse/reserve) - סכום quantity||1.
//   רזרבה    = אותם תנאים, אבל מיקום שמכיל רזרבה/reserve.   (פריט במחסן אינו במלאי ואינו ברזרבה.)
//   בתפוסה   = פריטי הזמנה (OrderItem) של קידומת+מידה, לא מחוקים, בהזמנה לא מחוקה, שחלון האירוע שלה [eventDate, returnDate||eventDate] נחתך עם
//              [from, to] (בשוליים של ±12 שעות לאזור הזמן של ישראל) - סכום quantity||1. isReturned לא נבדק (החלטה היסטורית של הטופס).

import prisma from '@/app/lib/prisma';
import { sizeTextFilter } from '@/lib/sizeSearch';

export const RESERVE_MARKERS = Object.freeze(['רזרבה', 'reserve']);
export const WAREHOUSE_MARKERS = Object.freeze(['מחסן', 'warehouse']);
const WINDOW_MARGIN_MS = 12 * 60 * 60 * 1000;

const has = (loc, markers) => typeof loc === 'string' && markers.some((m) => loc.includes(m));

/** מיקום שנחשב "רזרבה". (contains של Prisma רגיש לרישיות; אותו דבר כאן.) */
export function isReserveLocation(loc) { return has(loc, RESERVE_MARKERS); }
/** מיקום שנחשב "במלאי": ריק, או שאינו מחסן/רזרבה. */
export function isStockLocation(loc) { return loc == null || (!has(loc, WAREHOUSE_MARKERS) && !has(loc, RESERVE_MARKERS)); }

/** פריט DressItem (שורה) שנספר במלאי / ברזרבה (בנוסף לתנאי הקידומת+מידה): לא מחוק, בשימוש, לא בתיקון. */
export function isServiceable(item) { return !!item && !item.isDeleted && !item.notInUse && !item.inRepair; }
export const qty = (row) => (row && row.quantity) || 1;

/** שברי where של Prisma לפריטי המלאי / הרזרבה (חוץ מקידומת ומידה). */
export const STOCK_LOCATION_WHERE = Object.freeze({
  OR: [
    { location: null },
    { AND: [{ location: { not: { contains: 'מחסן' } } }, { location: { not: { contains: 'רזרבה' } } }, { location: { not: { contains: 'warehouse' } } }, { location: { not: { contains: 'reserve' } } }] },
  ],
});
export const RESERVE_LOCATION_WHERE = Object.freeze({ OR: [{ location: { contains: 'רזרבה' } }, { location: { contains: 'reserve' } }] });

/** חלון הבדיקה: from/to כ-'YYYY-MM-DD' (או כל מחרוזת ש-new Date מבין) -> גבולות עם שוליים של 12 שעות. */
export function capacityWindow(fromDateParam, toDateParam) {
  return {
    fromLimit: new Date(new Date(fromDateParam).getTime() - WINDOW_MARGIN_MS),
    toLimit: new Date(new Date(toDateParam).getTime() + WINDOW_MARGIN_MS),
  };
}

/** האם חלון ההזמנה נחתך עם חלון הבדיקה (הסינון שה-route עשה ב-JS: סוף ההזמנה = returnDate || eventDate). */
export function orderOverlapsWindow(order, { fromLimit, toLimit }) {
  if (!order || !order.eventDate) return false;
  if (order.eventDate > toLimit) return false;
  const end = order.returnDate || order.eventDate;
  return end >= fromLimit;
}

/** תנאי Prisma של ההזמנה בחלון (ה-JS לעיל, מוקדם ככל האפשר ב-SQL). */
export function orderWindowWhere({ fromLimit, toLimit }) {
  return {
    isDeleted: false,
    eventDate: { lte: toLimit },
    OR: [{ returnDate: { gte: fromLimit } }, { returnDate: null, eventDate: { gte: fromLimit } }],
  };
}

/**
 * החישוב המלא לקידומת+מידה אחת (גוף ה-route /api/inventory/capacity).
 * @returns {{inStock: number, reserve: number, occupiedCount: number, occupiedOrders: object[]}}
 */
export async function computeCapacity({ barcodePrefix, size, fromDate, toDate }) {
  // מידה שקולה בכל כתיב: "2" = "02" = "002" (ובנווה יעקב המידות שמורות בערבוב, ר' lib/searchNormalize.js sizeSpellings), לא 12/20/32.
  // התאמה מדויקת ב-IN (בלי LIKE); ערך שמור עם רווח מוביל/עוקב נתפס גם הוא.
  const sizeFilter = sizeTextFilter(size) || size;
  const win = capacityWindow(fromDate, toDate);

  // 1. במלאי: "ללא רזרבה ורק בשימוש" = location != 'רזרבה', notInUse == false, inRepair == false
  const inStockItems = await prisma.dressItem.findMany({
    where: { barcodePrefix, sizeText: sizeFilter, isDeleted: false, notInUse: false, inRepair: false, ...STOCK_LOCATION_WHERE },
    select: { quantity: true },
  });
  const inStock = inStockItems.reduce((acc, item) => acc + qty(item), 0);

  // 2. רזרבה
  const reserveItems = await prisma.dressItem.findMany({
    where: { barcodePrefix, sizeText: sizeFilter, isDeleted: false, notInUse: false, inRepair: false, ...RESERVE_LOCATION_WHERE },
    select: { quantity: true },
  });
  const reserve = reserveItems.reduce((acc, item) => acc + qty(item), 0);

  // 3. בתפוסה: כל פריטי ההזמנה של הקידומת+מידה שחלון האירוע שלהם נחתך עם הטווח המבוקש
  const occupiedOrdersList = await prisma.orderItem.findMany({
    where: {
      OR: [
        { barcodePrefix, size: sizeFilter },
        { barcodePrefix, sizeText: sizeFilter },
        { dressItem: { barcodePrefix, sizeText: sizeFilter } },
      ],
      isDeleted: false,
      order: orderWindowWhere(win),
    },
    select: {
      quantity: true,
      // ברקוד השמלה שיצאה למשפחה (חיפוש מתקדם > תפוסה, דיווח 113e5c37): רק פריט שכבר נלקח (isTaken) ויש לו ברקוד
      barcode: true,
      isTaken: true,
      order: {
        select: {
          id: true, orderId: true, eventDate: true, returnDate: true, eventDateHebrew: true,
          customer: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  // הסינון נשאר גם ב-JS (הוא אותו תנאי כמו ב-orderWindowWhere): גם שאילתה שלא סוננה (בדיקות, שינוי עתידי) נותנת אותה תוצאה.
  const validOccupiedOrders = occupiedOrdersList.filter((item) => orderOverlapsWindow(item.order, win));
  const occupiedCount = validOccupiedOrders.reduce((acc, item) => acc + qty(item), 0);

  // לתצוגה: מקובץ לפי מספר הזמנה (סכום כמויות של פריטים זהים באותה הזמנה)
  const groupedOrdersMap = new Map();
  validOccupiedOrders.forEach((item) => {
    const orderId = item.order.orderId;
    const quantity = qty(item);
    const bc = item.isTaken && typeof item.barcode === 'string' ? item.barcode.trim() : '';
    if (groupedOrdersMap.has(orderId)) {
      const g = groupedOrdersMap.get(orderId);
      g.quantity += quantity;
      if (bc && !g.barcodes.includes(bc)) g.barcodes.push(bc);
    } else {
      groupedOrdersMap.set(orderId, {
        id: orderId,
        orderId,
        internalOrderId: item.order.id,
        customerName: item.order.customer ? `${item.order.customer.firstName || ''} ${item.order.customer.lastName || ''}`.trim() : 'לא ידוע',
        eventDate: item.order.eventDate,
        returnDate: item.order.returnDate,
        eventDateHebrew: item.order.eventDateHebrew,
        quantity,
        barcodes: bc ? [bc] : [],
      });
    }
  });

  return { inStock, reserve, occupiedCount, occupiedOrders: Array.from(groupedOrdersMap.values()) };
}
