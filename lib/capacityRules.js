// lib/capacityRules.js - כללי "תפוסה" הטהורים (בלי prisma): מה נחשב מלאי / רזרבה, חלון התאריכים, ואיזה פריט הזמנה תופס.
// נחלץ מ-lib/capacity.js כדי שגם הלוגיקה הטהורה של פאנל החיפוש (lib/searchPanelCore.js, נבדק ב-node בלי DB) תשתמש באותם כללים בדיוק.
// ההגדרות המלאות (במלאי / רזרבה / בתפוסה) בכותרת של lib/capacity.js.

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
