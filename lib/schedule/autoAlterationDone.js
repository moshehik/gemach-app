// lib/schedule/autoAlterationDone.js — "ברגע שפריט נלקח - התיקון נרשם כבוצע (משוער)" (בעלים 2026-10-06). נקרא אחרי לקיחה ב-POST /api/rentals/toggle (rent) וב-POST /api/rentals/confirm
// (גורף) - לא בהחזרה. כותב alterationDone=true + המשפט ESTIMATE_NOTE בסוף alterationDetails (lib/alterationEstimate.js) דרך prisma.orderItem.update(auditAs('ALTERATION_DONE', ...)) -
// כתיבה רגילה דרך התוסף (שורת היומן נכתבת אוטומטית עם העובדת, estimated:true; בלי רישום ידני), בלי $transaction ובלי קריאות בתוכה.
// מופעל רק כשהגדרת המערכת auto_alteration_done_on_take === 'true' (ברירת מחדל כבוי - הגמח הראשי לא משתנה); קריאה דרך מטמון ההגדרות (lib/settingsCache.js).
// אידמפוטנטי (פריט שכבר סומן בוצע - גם ע"י אדם - לא נוגעים; המשפט לעולם לא כפול); הכתיבה מותנית ב-alterationDone=false (where) - שתי בקשות מקבילות לא יוצרות שתי שורות יומן
// (המפסידה מקבלת P2025 ומדלגת). נכשל בשקט, ומוגבל בזמן (autoMarkAlterationBounded). הזמנה מבוטלת / פריט מחוק - דילוג.
// האישור הגורף מקבל את מזהי הפריטים שאושרו בפועל (לא כל פריטי ההזמנה) ושולף אותם בשאילתה אחת.
import prisma, { auditAs } from '@/app/lib/prisma';
import { getCachedSettingValue } from '@/lib/settingsCache';
import { estimateOnTake } from '@/lib/alterationEstimate';

export const AUTO_ALT_TIMEOUT_MS = 1500;
export const AUTO_ALT_SETTING_KEY = 'auto_alteration_done_on_take';
const ITEM_PICK = {
  id: true, orderId: true, isDeleted: true, isTaken: true, neckAlteration: true, sleeveAlteration: true, lengthAlteration: true, alterationDetails: true, alterationDone: true,
  order: { select: { isDeleted: true } },
};

/** הפיצ'ר פעיל רק כשההגדרה === 'true' (חסר / כל ערך אחר = כבוי). שגיאת מסד = כבוי. */
export async function isAutoAlterationEnabled() {
  try { return (await getCachedSettingValue(AUTO_ALT_SETTING_KEY, null)) === 'true'; } catch { return false; }
}

const usable = (it) => !!it && !!it.isTaken && !(it.order && it.order.isDeleted);

/** כותב את הרישום המשוער לפריט שנטען (כתיבה מותנית ב-alterationDone=false). @returns {'done'|'skipped'} */
async function writeEstimate(it) {
  if (!usable(it)) return 'skipped';
  const patch = estimateOnTake(it);
  if (!patch) return 'skipped';
  try {
    await prisma.orderItem.update(auditAs('ALTERATION_DONE', { where: { id: it.id, alterationDone: false }, data: patch }, {
      alterationDone: { from: false, to: true },
      alterationDetails: { from: it.alterationDetails ?? null, to: patch.alterationDetails },
      orderId: it.orderId,
      estimated: true,
      note: 'נרשם אוטומטית בלקיחה - ביצוע משוער',
    }));
    return 'done';
  } catch (e) {
    if (e && e.code === 'P2025') return 'skipped'; // מישהו (בקשה מקבילה / אדם) סימן "בוצע" בינתיים - לא כותבים שוב
    throw e;
  }
}

/** @returns {Promise<{status:'done'|'skipped'|'disabled'|'error', id?:string}>} */
export async function autoMarkAlterationForItem(itemId) {
  try {
    if (!itemId) return { status: 'skipped' };
    if (!(await isAutoAlterationEnabled())) return { status: 'disabled' };
    const it = await prisma.orderItem.findUnique({ where: { id: String(itemId) }, select: ITEM_PICK });
    const r = await writeEstimate(it);
    return r === 'done' ? { status: 'done', id: it.id } : { status: 'skipped' };
  } catch (e) {
    console.error('autoMarkAlterationForItem failed (rental action unaffected):', e);
    return { status: 'error' };
  }
}

/** האישור הגורף: רק הפריטים שאושרו עכשיו (itemIds), שאילתה אחת עם כל מה שצריך. @returns {Promise<{status:'ok'|'skipped'|'disabled'|'error', count:number}>} */
export async function autoMarkAlterationsForItems(itemIds) {
  try {
    const ids = [...new Set((itemIds || []).filter(Boolean).map(String))];
    if (!ids.length) return { status: 'skipped', count: 0 };
    if (!(await isAutoAlterationEnabled())) return { status: 'disabled', count: 0 };
    const items = await prisma.orderItem.findMany({ where: { id: { in: ids }, isDeleted: false, isTaken: true, alterationDone: false }, select: ITEM_PICK });
    let count = 0;
    for (const it of items) {
      try { if ((await writeEstimate(it)) === 'done') count++; } catch (e) { console.error('autoMarkAlterationsForItems item failed (rental action unaffected):', e); }
    }
    return { status: 'ok', count };
  } catch (e) {
    console.error('autoMarkAlterationsForItems failed (rental action unaffected):', e);
    return { status: 'error', count: 0 };
  }
}

async function bounded(work, timeoutMs) {
  let timer;
  const limit = new Promise((resolve) => { timer = setTimeout(() => resolve({ status: 'timeout' }), timeoutMs); });
  try { return await Promise.race([work, limit]); } finally { clearTimeout(timer); }
}
export const autoMarkAlterationBounded = (itemId, timeoutMs = AUTO_ALT_TIMEOUT_MS) => bounded(autoMarkAlterationForItem(itemId), timeoutMs);
export const autoMarkAlterationsForItemsBounded = (itemIds, timeoutMs = AUTO_ALT_TIMEOUT_MS) => bounded(autoMarkAlterationsForItems(itemIds), timeoutMs);
