// lib/schedule/updatedOrders.js — "הזמנות שעודכנו" ביום: הזמנות קיימות (שנרשמו ביום אחר) שביום הזה נוסף או נערך בהן פריט
// או נוסף תשלום. הגדרת הבעלים 7.10.2026: "עודכנה = הוספת / עריכת פריטים, הוספת תשלום, ובתנאי שאינה מופיעה בהזמנות חדשות".
//
// קריאה בלבד, ונטענת רק לפי דרישה (GET /api/schedule/updated) - לא חלק מ-getScheduleDay, כך שטעינת הדף לא משלמת עליה.
// ארבע שאילתות קטנות:
//   1. OrderItem.createdAt בחלון היום      - אינדקס קיים ([createdAt])       -> "נוסף פריט"
//   2. OrderItem.updatedAt בחלון היום      - אין אינדקס (סריקה, רק לפי דרישה) -> "נערך פריט" / "בוטל פריט"
//      (שורות שעודכנו רק בגלל לקיחה/החזרה בסריקה - takenDate/returnDate באותו יום - לא נחשבות עריכה)
//   3. Payment.paymentDate בחלון היום      - אינדקס קיים ([paymentDate])      -> "נוסף תשלום" (כולל זיכוי)
//   4. Order לפי המזהים שנאספו (PK)        - סינון מחוקות/טיוטות, "נרשמה ביום" (= כבר בהזמנות חדשות) ושם הלקוחה.
// חלון היום = getIsraelDayRange דרך dates.js. אין קריאה בתוך $transaction.

import prisma from '@/app/lib/prisma';
import { DRAFT_ORDER_STATUS } from '@/lib/orderReservation';
import { dayRange } from './dates';
import { buildUpdatedRows } from './updatedRows';

export { buildUpdatedRows };
const NOT_DRAFT = { OR: [{ status: null }, { status: { not: DRAFT_ORDER_STATUS } }] };
export const UPDATED_SCAN_CAP = 1500; // תקרה לכל שאילתת פריטים/תשלומים - חוסמת יום חריג (ייבוא המוני)

export async function getUpdatedOrders({ dayKey, branch = '' }) {
  const range = dayRange(dayKey);
  const dayWindow = { gte: range.start, lte: range.end };
  const [added, touched, payments] = await Promise.all([
    prisma.orderItem.findMany({
      where: { createdAt: dayWindow, orderId: { not: null } },
      select: { id: true, orderId: true, createdAt: true },
      take: UPDATED_SCAN_CAP + 1,
    }),
    prisma.orderItem.findMany({
      where: { updatedAt: dayWindow, createdAt: { lt: range.start }, orderId: { not: null } },
      select: { id: true, orderId: true, createdAt: true, updatedAt: true, isDeleted: true, takenDate: true, returnDate: true },
      take: UPDATED_SCAN_CAP + 1,
    }),
    prisma.payment.findMany({
      where: { isDeleted: false, paymentDate: dayWindow, orderId: { not: null } },
      select: { orderId: true, amount: true, isRefund: true, paymentDate: true },
      take: UPDATED_SCAN_CAP + 1,
    }),
  ]);
  const truncated = added.length > UPDATED_SCAN_CAP || touched.length > UPDATED_SCAN_CAP || payments.length > UPDATED_SCAN_CAP;
  const addedCap = added.slice(0, UPDATED_SCAN_CAP);
  const touchedCap = touched.slice(0, UPDATED_SCAN_CAP);
  const paymentsCap = payments.slice(0, UPDATED_SCAN_CAP);
  const ids = [...new Set([...addedCap, ...touchedCap, ...paymentsCap].map((x) => x.orderId))];
  const orders = new Map();
  if (ids.length) {
    const found = await prisma.order.findMany({
      where: { orderId: { in: ids }, isDeleted: false, ...NOT_DRAFT },
      select: { orderId: true, orderDate: true, branch: true, pickupBranch: true, eventDateHebrew: true, customer: { select: { firstName: true, lastName: true, phone1: true } } },
    });
    for (const o of found) {
      const c = o.customer || {};
      orders.set(o.orderId, {
        ...o,
        customer: { name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'לא ידוע', phone1: c.phone1 || '' },
      });
    }
  }
  let rows = buildUpdatedRows({ dayKey, added: addedCap, touched: touchedCap, payments: paymentsCap, orders });
  if (branch) rows = rows.filter((r) => (r.branch || r.pickupBranch) === branch);
  return { date: dayKey, total: rows.length, truncated, orders: rows };
}
