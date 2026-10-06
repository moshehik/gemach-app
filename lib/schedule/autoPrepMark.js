// lib/schedule/autoPrepMark.js — "הושכר = ההכנה בוצעה" (בעלים 2026-10-06): כשפריט בהזמנה נלקח (או הוחזר - אז בוודאי נלקח), נרשמת אוטומטית שורת סימון "הכנה"
// (ScheduleStageMark, stage prep, source 'auto', markedById = העובדת שלקחה) - כדי שמסך הלו״ז, רשימות ההכנה, כרטיס ההזמנה ושאר המסכים יסכימו שההזמנה הוכנה.
//
// כללים: כתיבה רגילה של Prisma דרך התוסף (writeMark → auditAs SCHEDULE_STAGE_DONE; בלי רישום ידני ל-AuditLog); בלי $transaction ובלי קריאות בתוך טרנזקציה (כל הקריאות
// לפני הכתיבה, מחוץ לכל $transaction של הקורא); אידמפוטנטי (קיימת שורת prep להזמנה - גם "בוטל" ע"י אדם - לא נוגעים: החלטה של אדם גוברת, והתצוגה ממילא מסיקה הכנה
// מהלקיחה); נכשל בשקט (לעולם לא מפיל את פעולת ההשכרה); בלי DDL (הטבלה קיימת; חסרה = דילוג). "תיקונים" (alterationDone) לא נכתב כאן - ר' W-notes: דורש החלטת בעלים.
// "בטל השכרה" לא מבטל את הסימון (בכוונה): סימון הכנה הוא עובדה על ההזמנה שנעשתה (השמלה הוכנה גם אם הלקיחה בוטלה), ולא מצב ממשיך; אדם יכול לבטל אותו בכרטיס.
import prisma, { getActingEmployeeId } from '@/app/lib/prisma';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { computeOrderStages, dayKeyOf } from './orderStages';
import { resolveScheduleSettings } from './settings';
import { writeMark, isMarksModelAvailable, isMissingTableError } from './marks';

const ORDER_PICK = {
  orderId: true, orderDate: true, isDeleted: true, eventDate: true, fromDate: true, toDate: true, returnDate: true, isAbroad: true,
  isDelivery: true, deliveryDirection: true, deliveryOneDayBefore: true,
  items: { select: { id: true, isDeleted: true, neckAlteration: true, sleeveAlteration: true, lengthAlteration: true, alterationDone: true, isTaken: true, takenDate: true, isReturned: true, returnDate: true, returnedOk: true } },
};

/**
 * @param {number|string} orderId  מספר ההזמנה (Order.orderId)
 * @param {{now?: Date, userId?: string|null}} [opts]
 * @returns {Promise<{status: 'marked'|'exists'|'no-prep-stage'|'not-taken'|'no-table'|'skipped'|'error', dayKey?: string}>}
 */
export async function autoMarkPrepForOrder(orderId, { now = new Date(), userId } = {}) {
  try {
    const id = Number(orderId);
    if (!Number.isInteger(id) || id <= 0) return { status: 'skipped' };
    if (!isMarksModelAvailable()) return { status: 'no-table' };
    const existing = await prisma.scheduleStageMark.findFirst({ where: { orderId: id, stageKey: 'prep' }, select: { id: true } });
    if (existing) return { status: 'exists' };
    const order = await prisma.order.findUnique({ where: { orderId: id }, select: ORDER_PICK });
    if (!order || order.isDeleted) return { status: 'skipped' };
    const taken = (order.items || []).some((it) => !it.isDeleted && (it.isTaken || it.isReturned || it.takenDate || it.returnDate));
    if (!taken) return { status: 'not-taken' };
    const rows = await getAllCachedSettings().catch(() => []);
    const map = {};
    for (const r of rows || []) if (r && r.key) map[r.key] = r.value;
    const schedule = resolveScheduleSettings(map);
    const delivery = { daysBefore: parseInt(map.delivery_days_before, 10) || 1, daysAfter: parseInt(map.delivery_days_after, 10) || 1, skipWeekends: map.delivery_skip_weekends === 'true' };
    const { stages } = computeOrderStages(order, { schedule, delivery, marks: [], todayKey: dayKeyOf(now) });
    const prep = stages.find((s) => s.key === 'prep');
    if (!prep) return { status: 'no-prep-stage' };
    const uid = userId === undefined ? await getActingEmployeeId() : userId;
    await writeMark({ orderId: id, stageKey: 'prep', dayKey: prep.dayKey, wanted: true, outcome: null, source: 'auto', userId: uid || null, now, stageLabel: 'הכנה' });
    return { status: 'marked', dayKey: prep.dayKey };
  } catch (e) {
    if (isMissingTableError(e)) return { status: 'no-table' };
    console.error('autoMarkPrepForOrder failed (rental action unaffected):', e);
    return { status: 'error' };
  }
}
