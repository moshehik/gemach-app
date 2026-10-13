// זרימת הברקוד ברצף (חיפוש מהיר -> חלון "השכרה והחזרה" -> ההזמנה הבאה), 12.10.2026.
// צד שרת: מסווג ברקוד אחד ל-state אחד, בלי לשנות שום דבר. ההחזרה עצמה נשארת POST /api/returns/scan (מנוע ההחזרה הקיים,
// כולל אישור מנהל להחזרה מוקדמת) וההשכרה נשארת POST /api/rentals/scan - כאן רק החלטה "מה עושים עם הברקוד הזה".
//
// states:
//   rented         - יש פריט מושכר (נלקח ולא הוחזר) בברקוד: { orderId, itemId, description }
//   already_returned - הפריט הוחזר בהזמנה { orderId } (ההחזרה האחרונה)
//   not_taken      - הברקוד משויך להזמנה אבל טרם סומן כנלקח { orderId }
//   free           - קיים פריט מלאי פנוי (לא מושכר, לא בתיקון, בשימוש) - rentalCandidates אם ההגדרה דלוקה
//   in_repair / not_in_use - פריט מלאי שאי אפשר להשכיר
//   unknown        - הברקוד לא מוכר בכלל
import prisma from '@/app/lib/prisma';
import { getHebrewDateString } from '@/lib/hebrewDate';
import { getCachedSetting } from '@/lib/settingsCache';

/** הגדרה: הקשת ברקוד בחיפוש המהיר פותחת השכרה מהירה. חסר/כבוי = ההתנהגות הקודמת (רק החזרה). */
export const QUICK_BARCODE_RENT_SETTING = 'quick_search_barcode_opens_rental';

/** ברקוד תקין הוא ספרות/אותיות בלבד (הקלדה מ-RTL יכולה להכניס תווים בלתי נראים) - אותה פונקציה כמו ב-/api/returns/scan. */
export function normalizeBarcode(raw) {
  return String(raw ?? '').replace(/[^0-9A-Za-z]/g, '');
}

export async function isQuickBarcodeRentEnabled() {
  try {
    const row = await getCachedSetting(QUICK_BARCODE_RENT_SETTING);
    return row?.value === 'true';
  } catch {
    return false;
  }
}

/**
 * הסבר למה אין פריט מושכר בברקוד (כבר הוחזר / טרם נלקח / לא מוכר). המקור היחיד לטקסטים ול-reason -
 * משמש גם את POST /api/returns/scan (barcodeNotRentedResponse) וגם את סיווג הזרימה כאן.
 * @returns {Promise<{ reason: 'already_returned'|'not_taken'|'unknown', error: string, orderId: number|null }>}
 */
export async function diagnoseUnrentedBarcode(barcode) {
  let reason = 'unknown';
  let error = 'לא נמצא פריט עם הברקוד הזה';
  let orderId = null;
  try {
    const returned = await prisma.orderItem.findFirst({
      where: { barcode, isTaken: true, isReturned: true, isDeleted: false },
      orderBy: [{ returnDate: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
      select: { orderId: true, returnDate: true }
    });
    if (returned) {
      reason = 'already_returned';
      orderId = returned.orderId;
      const when = returned.returnDate ? ` ב-${getHebrewDateString(returned.returnDate)}` : '';
      error = `השמלה הזו כבר סומנה כמוחזרת בהזמנה ${returned.orderId}${when}`;
    } else {
      const notTaken = await prisma.orderItem.findFirst({
        where: { barcode, isTaken: false, isDeleted: false },
        orderBy: { updatedAt: 'desc' },
        select: { orderId: true }
      });
      if (notTaken) {
        reason = 'not_taken';
        orderId = notTaken.orderId;
        error = `הברקוד הזה קיים בהזמנה ${notTaken.orderId} אבל טרם סומן כנלקח`;
      }
    }
  } catch (diagErr) {
    console.error('returns/scan diagnostic lookup failed:', diagErr);
  }
  return { reason, error, orderId };
}

// פענוח ברקוד כמו ב-/api/rentals/scan: קידומת = הכול פרט ל-4 הספרות האחרונות, מידה = 2 הספרות שלפניהן.
function splitBarcode(barcode) {
  const prefix = parseInt(barcode.substring(0, barcode.length - 4), 10);
  const size = parseInt(barcode.substring(barcode.length - 4, barcode.length - 2), 10);
  return { prefix: Number.isNaN(prefix) ? null : prefix, size: Number.isNaN(size) ? null : size };
}

const CANDIDATE_LIMIT = 6;

/**
 * הזמנות שמחכות לפריט הזה: שורות הזמנה שטרם נשכרו (בלי ברקוד, לא נלקחו, לא נמחקו) מאותו דגם ואותה מידה - אותו
 * כלל התאמה כמו ב-POST /api/rentals/scan (קידומת + מידה). ממוינות לפי תאריך האירוע הקרוב.
 */
export async function findRentalCandidates(barcode) {
  const { prefix, size } = splitBarcode(barcode);
  if (prefix === null || size === null) return [];
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // אירוע שעבר לפני יותר משלושה ימים - לא מחכה להשכרה
  const rows = await prisma.orderItem.findMany({
    where: {
      isDeleted: false,
      isTaken: false,
      barcode: null,
      order: { isDeleted: false, OR: [{ eventDate: null }, { eventDate: { gte: since } }] },
      OR: [
        { barcodePrefix: prefix },
        { dressItem: { is: { barcodePrefix: prefix } } },
        { dressItem: { is: { dress: { is: { barcodePrefix: prefix } } } } }
      ]
    },
    include: {
      dressItem: { include: { dress: true } },
      order: { select: { orderId: true, eventDate: true, eventDateHebrew: true, customer: { select: { firstName: true, lastName: true } } } }
    },
    orderBy: { order: { eventDate: 'asc' } },
    take: 60
  });
  const seen = new Set();
  const out = [];
  for (const item of rows) {
    const pfx = item.dressItem?.dress?.barcodePrefix || item.dressItem?.barcodePrefix || item.barcodePrefix;
    const sz = item.dressItem?.sizeText || item.sizeText || '';
    if (pfx !== prefix || parseInt(sz, 10) !== size) continue;
    if (!item.order || seen.has(item.order.orderId)) continue;
    seen.add(item.order.orderId);
    const c = item.order.customer;
    out.push({
      orderId: item.order.orderId,
      customerName: c ? `${c.firstName || ''} ${c.lastName || ''}`.trim() : '',
      eventDate: item.order.eventDate,
      eventDateHebrew: item.order.eventDateHebrew || (item.order.eventDate ? getHebrewDateString(item.order.eventDate) : ''),
      itemId: item.id,
      description: item.description || ''
    });
    if (out.length >= CANDIDATE_LIMIT) break;
  }
  return out;
}

/** סיווג ברקוד אחד. withRental: האם לחפש הזמנות מתאימות להשכרה (ההגדרה דלוקה). */
export async function classifyBarcode(barcode, { withRental = false } = {}) {
  const rented = await prisma.orderItem.findFirst({
    where: { barcode, isTaken: true, isReturned: false, isDeleted: false },
    select: { id: true, orderId: true, description: true }
  });
  if (rented) {
    return { state: 'rented', orderId: rented.orderId, itemId: rented.id, description: rented.description || '' };
  }
  const diag = await diagnoseUnrentedBarcode(barcode);
  // not_taken = משויך להזמנה וממתין לאישור השכרה.
  if (diag.reason === 'not_taken') return { state: 'not_taken', orderId: diag.orderId, error: diag.error };
  const dressItem = await prisma.dressItem.findFirst({
    where: { dressBarcode: barcode },
    select: { id: true, isDeleted: true, notInUse: true, inRepair: true }
  });
  if (!dressItem || dressItem.isDeleted) {
    if (diag.reason === 'already_returned') return { state: 'already_returned', orderId: diag.orderId, error: diag.error };
    return { state: 'unknown', error: diag.error };
  }
  if (dressItem.notInUse) return { state: 'not_in_use', error: 'הפריט הזה מסומן כ"לא בשימוש" - לא ניתן להשכרה' };
  if (dressItem.inRepair) return { state: 'in_repair', error: 'הפריט הזה נמצא בתיקון - לא ניתן להשכרה' };
  const out = { state: 'free', lastReturnOrderId: diag.reason === 'already_returned' ? diag.orderId : null, lastReturnError: diag.reason === 'already_returned' ? diag.error : '' };
  if (withRental) out.rentalCandidates = await findRentalCandidates(barcode);
  return out;
}
