// lib/schedule/autoAlterationDone.js — "ברגע שפריט נלקח - התיקון נרשם כבוצע (משוער)" (בעלים 2026-10-06). נקרא אחרי לקיחה ב-POST /api/rentals/toggle (rent) וב-POST /api/rentals/confirm
// (גורף) - לא בהחזרה. כותב alterationDone=true + המשפט ESTIMATE_NOTE בסוף alterationDetails (lib/alterationEstimate.js) דרך prisma.orderItem.update(auditAs('ALTERATION_DONE', ...)) -
// כתיבה רגילה דרך התוסף (שורת היומן נכתבת אוטומטית עם העובדת, estimated:true; בלי רישום ידני), בלי $transaction ובלי קריאות בתוכה.
// אידמפוטנטי (פריט שכבר סומן בוצע - גם ע"י אדם - לא נוגעים; המשפט לעולם לא כפול), נכשל בשקט, ומוגבל בזמן (autoMarkAlterationBounded) כמו הכנה אוטומטית. הזמנה מבוטלת / פריט מחוק - דילוג.
import prisma, { auditAs } from '@/app/lib/prisma';
import { estimateOnTake } from '@/lib/alterationEstimate';

export const AUTO_ALT_TIMEOUT_MS = 1500;
const ITEM_PICK = {
  id: true, orderId: true, isDeleted: true, isTaken: true, neckAlteration: true, sleeveAlteration: true, lengthAlteration: true, alterationDetails: true, alterationDone: true,
  order: { select: { isDeleted: true } },
};

/** @returns {Promise<{status:'done'|'skipped'|'error', id?:string}>} */
export async function autoMarkAlterationForItem(itemId) {
  try {
    if (!itemId) return { status: 'skipped' };
    const it = await prisma.orderItem.findUnique({ where: { id: String(itemId) }, select: ITEM_PICK });
    if (!it || !it.isTaken || (it.order && it.order.isDeleted)) return { status: 'skipped' };
    const patch = estimateOnTake(it);
    if (!patch) return { status: 'skipped' };
    await prisma.orderItem.update(auditAs('ALTERATION_DONE', { where: { id: it.id }, data: patch }, {
      alterationDone: { from: false, to: true },
      alterationDetails: { from: it.alterationDetails ?? null, to: patch.alterationDetails },
      orderId: it.orderId,
      estimated: true,
      note: 'נרשם אוטומטית בלקיחה - ביצוע משוער',
    }));
    return { status: 'done', id: it.id };
  } catch (e) {
    console.error('autoMarkAlterationForItem failed (rental action unaffected):', e);
    return { status: 'error' };
  }
}

/** כל פריטי ההזמנה שנלקחו ועדיין בלי "בוצע" (לאישור הגורף) - אחד אחד, אידמפוטנטי */
export async function autoMarkAlterationsForOrder(orderId) {
  try {
    const id = Number(orderId);
    if (!Number.isInteger(id) || id <= 0) return { status: 'skipped', count: 0 };
    const items = await prisma.orderItem.findMany({ where: { orderId: id, isDeleted: false, isTaken: true, alterationDone: false }, select: { id: true } });
    let count = 0;
    for (const { id: itemId } of items) if ((await autoMarkAlterationForItem(itemId)).status === 'done') count++;
    return { status: 'ok', count };
  } catch (e) {
    console.error('autoMarkAlterationsForOrder failed (rental action unaffected):', e);
    return { status: 'error', count: 0 };
  }
}

async function bounded(work, timeoutMs) {
  let timer;
  const limit = new Promise((resolve) => { timer = setTimeout(() => resolve({ status: 'timeout' }), timeoutMs); });
  try { return await Promise.race([work, limit]); } finally { clearTimeout(timer); }
}
export const autoMarkAlterationBounded = (itemId, timeoutMs = AUTO_ALT_TIMEOUT_MS) => bounded(autoMarkAlterationForItem(itemId), timeoutMs);
export const autoMarkAlterationsForOrderBounded = (orderId, timeoutMs = AUTO_ALT_TIMEOUT_MS) => bounded(autoMarkAlterationsForOrder(orderId), timeoutMs);
