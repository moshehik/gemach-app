// lib/schedule/autoPrepMark.js — "הושכר = ההכנה בוצעה" (בעלים 2026-10-06): כשפריט בהזמנה נלקח (או הוחזר - אז בוודאי נלקח), נרשמת אוטומטית שורת סימון "הכנה"
// (ScheduleStageMark, stage prep, source 'auto', markedById = העובדת שלקחה) - כדי שמסך הלו״ז, רשימות ההכנה, כרטיס ההזמנה ושאר המסכים יסכימו שההזמנה הוכנה.
//
// כללים: כתיבה רגילה של Prisma דרך התוסף (writeMark → auditAs SCHEDULE_STAGE_DONE עם auto:true; בלי רישום ידני ל-AuditLog); בלי $transaction ובלי קריאות בתוך טרנזקציה;
// אידמפוטנטי (קיימת שורת prep להזמנה - גם "בוטל" ע"י אדם - לא נוגעים); נכשל בשקט (לעולם לא מפיל את פעולת ההשכרה); בלי DDL. "תיקונים" (alterationDone) לא נכתב כאן (החלטת בעלים ממתינה).
// "בטל השכרה" לא מבטל את הסימון (בכוונה): הכנה היא עובדה שנעשתה; אדם יכול לבטל אותו בכרטיס (ואז ההסקה לתצוגה לא פועלת עליו - lib/schedule/orderStages.js).
// ביצועים (סריקות): (א) טבלה חסרה = מטמון 5 הדקות של marks.js (בלי ניסיון חוזר); (ב) זיכרון קצר-טווח לכל הזמנה (60 ש׳, עד 500 הזמנות): "כבר מסומנת" / "אין שלב הכנה" - בלי findFirst
// ובלי טעינת הזמנה בסריקות הבאות; (ג) autoMarkPrepBounded: מזהה העובדת נקרא לפני כל await (עוגיות), והעבודה מוגבלת ב-Promise.race ל-1500ms - לא מוסיפה השהיה לסריקה.
import prisma, { getActingEmployeeId } from '@/app/lib/prisma';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { computeOrderStages, dayKeyOf } from './orderStages';
import { resolveScheduleSettings } from './settings';
import { writeMark, isMissingTableError, isMarksTableKnownMissing, noteMarksTableMissing } from './marks';

export const AUTO_PREP_TIMEOUT_MS = 1500;
const MEMO_TTL_MS = 60 * 1000;
const MEMO_MAX = 500;
const memo = new Map(); // orderId -> { state: 'marked'|'no-prep-stage', until }
export function resetAutoPrepMemo() { memo.clear(); }
const remember = (id, state, now) => {
  if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value);
  memo.set(id, { state, until: now + MEMO_TTL_MS });
};

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
    // מזהה העובדת לפני כל await אחר - העוגייה זמינה רק בהקשר הבקשה (גם כשהעבודה ממשיכה ברקע אחרי ה-race)
    const uid = userId === undefined ? await getActingEmployeeId() : userId;
    if (isMarksTableKnownMissing()) return { status: 'no-table' };
    const known = memo.get(id);
    if (known && known.until > now.getTime()) return { status: known.state === 'marked' ? 'exists' : 'no-prep-stage' };
    const existing = await prisma.scheduleStageMark.findFirst({ where: { orderId: id, stageKey: 'prep' }, select: { id: true } });
    if (existing) { remember(id, 'marked', now.getTime()); return { status: 'exists' }; }
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
    if (!prep) { remember(id, 'no-prep-stage', now.getTime()); return { status: 'no-prep-stage' }; }
    await writeMark({ orderId: id, stageKey: 'prep', dayKey: prep.dayKey, wanted: true, outcome: null, source: 'auto', userId: uid || null, now, stageLabel: 'הכנה' });
    remember(id, 'marked', now.getTime());
    return { status: 'marked', dayKey: prep.dayKey };
  } catch (e) {
    if (isMissingTableError(e)) { noteMarksTableMissing(); return { status: 'no-table' }; }
    console.error('autoMarkPrepForOrder failed (rental action unaffected):', e);
    return { status: 'error' };
  }
}

/**
 * הגרסה לראוטים של השכרה/החזרה: לא מוסיפה השהיה - מחכה לכל היותר timeoutMs; אם העבודה ארוכה היא ממשיכה ברקע (נכשלת בשקט) והתשובה לא ממתינה לה.
 * @returns {Promise<object>} תוצאת autoMarkPrepForOrder או { status: 'timeout' }
 */
export async function autoMarkPrepBounded(orderId, opts = {}, timeoutMs = AUTO_PREP_TIMEOUT_MS) {
  let timer;
  const work = autoMarkPrepForOrder(orderId, opts);
  const limit = new Promise((resolve) => { timer = setTimeout(() => resolve({ status: 'timeout' }), timeoutMs); });
  try {
    return await Promise.race([work, limit]);
  } finally {
    clearTimeout(timer);
  }
}
