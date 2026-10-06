// lib/schedule/marks.js — "בוצע" בלו״ז היומי: קריאת הסימונים של יום, שילובם בשורות, וכתיבה
// (סימון / ביטול סימון / "הכל בוצע" לשלב).
//
// מקור האמת: scratch/schedule-build/DECISIONS-לוז-יומי.md + החלטות-schedule-open.json (C1, C2, A4, B2, JDG-04).
// הטבלה: ScheduleStageMark (prisma/schema.prisma; SQL ב-prisma/migrations-pending/2026-10-02-schedule-stage-mark.sql).
//
// מה "בוצע" עושה בכל שלב (שלבי המידע 1 ו-7 אינם ניתנים לסימון - החלטה):
//   2 תיקונים       שורת סימון + OrderItem.alterationDone על פריטי התיקון של ההזמנה (כמו מסך התיקונים, B11).
//   4 הכנה          שורת סימון בלבד (אין שדה קיים - INVENTORY G1).
//   5 משלוח הלוך    שורת סימון בלבד ("יצא בשליח" ≠ "הושכר" - לא נוגעים ב-isTaken).
//   6 איסוף מקומי   שורת סימון בלבד (החלטה C2: "סימון חדש ופשוט בלוז"; isTaken נשאר של ההשכרה/ברקוד).
//                   שורה שכל פריטיה כבר נלקחו נחשבת "בוצע" לפי ההשכרה גם בלי סימון.
//   8 החזרה ידנית   "בוצע" = החזרה תקינה של כל הפריטים שעוד לא הוחזרו (isReturned/returnedOk/returnDate, כמו
//                   POST /api/rentals/toggle action=return), "הוחזר לא תקין" = אותו דבר עם returnedOk=false
//                   (החלטה A4). עובר דרך הגנת ההחזרה המוקדמת (lib/earlyReturnGuard.js) - בלי עקיפה.
//                   פריט שכבר הוחזר קודם (בסריקה/בכרטיס) שומר את המצב שנקבע לו שם.
//   9 משלוח חזור    שורת סימון בלבד + מצב תקין/לא תקין על הסימון (A4). "השליח אסף" ≠ "חזר לגמ"ח" - ההחזרה
//                   הפיזית נרשמת בסריקת ההחזרות, לא כאן.
//
// כללים: בלי $transaction (CLAUDE.md); AuditLog אוטומטי דרך תוסף Prisma (create/update עם auditAs - אין
// רישום ידני); ייחודיות (orderId, stageKey, dayKey) + תפיסת P2002 = שתי עובדות שמסמנות בו-זמנית לא
// יוצרות כפילות; הפעולה אידמפוטנטית (סימון של שורה שכבר מסומנת = unchanged, בלי כתיבה).
// הטבלה חסרה (P2021 / 42P01): הקריאה מחזירה available=false והדף מסתיר את הסימון; הכתיבה מחזירה 503.

import prisma, { auditAs } from '@/app/lib/prisma';
import { checkEarlyReturn } from '@/lib/earlyReturnGuard';
import { STAGES, STAGE_BY_KEY } from './stages';
import { loadScheduleSettings } from './settings';
import {
  ORDER_SELECT, eventStageKeySets, buildEventStageWhere, classifyEventOrder, buildEventStageRow,
  loadDeliveryStageRows, itemHasAlteration, itemReturned,
} from './loaders';
import { isValidKey, isWithinReasonableRange, MAX_YEARS_FROM_TODAY, todayKey, instantToKey } from './dates';
import { alertsForRow } from './alerts';

export const MARKABLE_STAGE_KEYS = STAGES.filter((s) => !s.infoOnly).map((s) => s.key);
export const RETURN_OUTCOME_STAGES = ['manret', 'dback'];
export const OUTCOMES = ['ok', 'not_ok'];
export const MARK_ACTIONS = ['mark', 'unmark', 'mark_all'];
export const MARK_SOURCES = ['row', 'all'];
export const MARK_AUDIT_ACTIONS = { done: 'SCHEDULE_STAGE_DONE', undone: 'SCHEDULE_STAGE_UNDONE' };
// "הכל בוצע" - הרשאה בקטלוג (lib/permissionsMetadata.js). JDG-04 (אושרה): עובדת רגילה בלי "הכל בוצע".
export const MARK_ALL_PERMISSION = 'feature:schedule_mark_all_done';
export const MARK_ALL_MAX = 200;
// "הכל בוצע" בשלב 8 כותב לכל הזמנה גם את הפריטים (החזרה + שורות יומן; מיקום השמלה רק כשהמתג למטה דולק) - כ-16 שאילתות להזמנה, בלי
// טרנזקציה, עם תקרת 30 שניות לנתיב. 60 הזמנות בלחיצה נשארות רחוק מהתקרה; השאר נשארות "לא בוצע" והלקוח מציע ללחוץ
// שוב (remaining בתשובה). סקירה 2.10, SHOULD-FIX 5.
export const MARK_ALL_MAX_BY_STAGE = { manret: 60 };
export const markAllMax = (stageKey) => MARK_ALL_MAX_BY_STAGE[stageKey] || MARK_ALL_MAX;

// החזרה מהלו״ז (שלב 8) **לא** נוגעת במיקום השמלה (DressItem.location) - לא בסימון ולא בביטול הסימון. כמו לחצן
// ההחזרה בכרטיס ההזמנה: השמלה נשארת "מושכר" עד סריקת החזרה (/api/returns/scan) או עדכון ידני.
// החלטת הבעלים 4.10.2026 (SCH-RET-LOC = ב' "לא לעדכן מיקום"), שמחליפה את ההחלטה של 2.10.2026 (לעדכן כמו סריקה).
// ההתנהגות הקודמת נשארה במרחק קבוע אחד: true = 'חנות' בהחזרה ו-'מושכר' בביטול, רק לפריטים שהלו״ז עצמו
// החזיר/ביטל (setDressLocation למטה; docs/schedule-page-logic-spec.md "סימון בוצע → מיקום פריטים", docs/future-work.md §9).
// הקבוע הוא המתג היחיד - אין הגדרה ואין זריעה. applyStageMark מקבל updateDressLocation רק לבדיקות (ברירת מחדל = הקבוע;
// הנתיב /api/schedule/marks לא מעביר אותו).
export const SCHEDULE_RETURN_UPDATES_DRESS_LOCATION = false;
export const DRESS_LOCATION_ON_RETURN = 'חנות';   // כמו POST /api/returns/scan
export const DRESS_LOCATION_ON_UNDO = 'מושכר';    // כמו PUT /api/returns/scan (ביטול החזרה)

const MARK_SELECT = {
  id: true, orderId: true, stageKey: true, dayKey: true, done: true, outcome: true, source: true,
  markedById: true, markedAt: true, undoneById: true, undoneAt: true,
};

export class MarkError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra || null;
  }
}

export function isMissingTableError(e) {
  if (!e) return false;
  if (e.code === 'P2021') return true;
  const msg = String(e.message || e.meta?.message || '');
  return /ScheduleStageMark.*does not exist|does not exist.*ScheduleStageMark|42P01/i.test(msg);
}

// הקליינט של Prisma נבנה לפני שהמודל נוסף לסכימה (קליינט מיושן ב-globalThis בפיתוח, או build ישן) -
// prisma.scheduleStageMark הוא undefined ו-.findMany היה זורק TypeError סינכרוני. מתייחסים לזה כמו לטבלה חסרה.
export function isMarksModelAvailable(client = prisma) {
  try {
    return !!(client && typeof client.scheduleStageMark !== 'undefined' && client.scheduleStageMark);
  } catch {
    return false;
  }
}

export const markKey = (stageKey, orderId) => `${stageKey}:${orderId}`;

function displayName(e) {
  if (!e) return null;
  return e.fullName || [e.firstName, e.lastName].filter(Boolean).join(' ') || null;
}

async function employeeNames(ids) {
  const names = new Map();
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return names;
  const rows = await prisma.employee.findMany({
    where: { id: { in: list } },
    select: { id: true, firstName: true, lastName: true, fullName: true },
  });
  for (const e of rows) names.set(e.id, displayName(e));
  return names;
}

// אחרי שגיאת "הטבלה לא קיימת" לא שואלים שוב כמה דקות (אותו דפוס כמו lib/loginDeviceRegistry.js) - בלי
// שאילתה כושלת בכל טעינת דף עד שה-SQL יורץ.
const TABLE_RECHECK_MS = 5 * 60 * 1000;
let tableMissingUntil = 0;
export function resetMarksTableState() { tableMissingUntil = 0; }

const UNAVAILABLE = () => ({ available: false, byKey: new Map(), names: new Map(), rows: [], sinceKey: null });

function markTableMissing(reason) {
  tableMissingUntil = Date.now() + TABLE_RECHECK_MS;
  console.warn(`schedule marks: ${reason} - "done" marking hidden until the SQL is applied / the client is regenerated`);
  return UNAVAILABLE();
}

/**
 * כל הסימונים של יום (שאילתה אחת) + שמות המסמנות (שאילתה קטנה לפי מזהים, רק כשיש סימונים).
 * withSince: גם היום הישראלי של הסימון הראשון בטבלה (min(markedAt)) - ממנו והלאה "לא סומן ביום שעבר" הוא
 * באיחור לשלבים בלי שדה קיים (4/5/9); לפני כן איש לא יכול היה לסמן, ולכן אין להציף ימים ישנים בהתראות.
 * טבלה ריקה -> sinceKey=null -> אין התראות כאלה. נשאל רק כשצריך (יום שעבר).
 * @returns {{available: boolean, byKey: Map<string, object>, names: Map<string, string>, rows: object[], sinceKey: string|null}}
 */
export async function loadDayMarks(dayKey, { stageKey, withNames = true, withSince = false } = {}) {
  if (Date.now() < tableMissingUntil) return UNAVAILABLE();
  if (!isMarksModelAvailable()) return markTableMissing('ScheduleStageMark model is not in the generated Prisma client');
  let rows;
  let first = null;
  try {
    rows = await prisma.scheduleStageMark.findMany({
      where: { dayKey, ...(stageKey ? { stageKey } : {}) },
      select: MARK_SELECT,
    });
    if (withSince) first = await prisma.scheduleStageMark.findFirst({ orderBy: { markedAt: 'asc' }, select: { markedAt: true } });
  } catch (e) {
    if (isMissingTableError(e)) return markTableMissing('ScheduleStageMark table is missing');
    throw e;
  }
  const byKey = new Map(rows.map((m) => [markKey(m.stageKey, m.orderId), m]));
  const names = withNames ? await employeeNames(rows.flatMap((m) => [m.markedById, m.undoneById])) : new Map();
  const sinceKey = withSince ? marksSinceKey(first && first.markedAt) : null;
  return { available: true, byKey, names, rows, sinceKey };
}

export function marksSinceKey(firstMarkedAt) {
  return firstMarkedAt ? instantToKey(firstMarkedAt) : null;
}

function markView(m, names) {
  if (!m) return null;
  return {
    done: !!m.done,
    outcome: m.outcome || null,
    source: m.source || null,
    markedBy: m.markedById ? (names.get(m.markedById) || null) : null,
    markedAt: m.markedAt || null,
    undoneBy: m.undoneById ? (names.get(m.undoneById) || null) : null,
    undoneAt: m.undoneAt || null,
  };
}

/**
 * מעשיר שורה אחת ב-done / doneVia / doneBy / doneAt / outcome / mark / canMark לפי הסימון (אם יש) והעובדה
 * הקיימת (alterationDone / isTaken / isReturned שהשורה כבר נושאת ב-done). משנה את השורה במקום.
 *   done:    true  - סומן בלו״ז, או העובדה הקיימת אומרת "בוצע" (למשל כל הפריטים נלקחו)
 *            false - לא סומן (ויש טבלה / יש שדה קיים)
 *            null  - אין שום מקור (הטבלה חסרה ולשלב אין שדה קיים) -> "לא ידוע"
 *   doneVia: 'mark' | <doneSource של השלב> | null
 */
export function decorateRowWithMark(row, stage, marks) {
  if (!row || !stage || stage.infoOnly) return row;
  const fact = row.done; // true/false (שלב עם doneSource) או null (בלי)
  // העובדה הקיימת לפני שהסימון דורס אותה - הכתיבה (applyStageMark) צריכה אותה כדי שהטלאי אחרי ביטול
  // יהיה זהה לטעינה מחדש (הפריטים נלקחו/הוחזרו בכרטיס -> השורה נשארת "בוצע"; מצב ההחזרה לפי הפריטים)
  // לא enumerable - לא יוצא ב-JSON של /api/schedule, רק לשימוש פנימי של הכתיבה
  Object.defineProperty(row, 'fact', { value: { done: fact, returnCondition: row.returnCondition === undefined ? undefined : (row.returnCondition || null) }, enumerable: false, configurable: true, writable: true });
  const m = marks && marks.available ? marks.byKey.get(markKey(stage.key, row.orderId)) : null;
  const names = (marks && marks.names) || new Map();
  row.mark = markView(m, names);
  row.canMark = !!(marks && marks.available);
  if (m && m.done) {
    row.done = true;
    row.doneVia = 'mark';
    row.doneBy = row.mark.markedBy;
    row.doneAt = m.markedAt || null;
    row.outcome = m.outcome || null;
    if (RETURN_OUTCOME_STAGES.includes(stage.key) && !row.returnCondition && m.outcome) row.returnCondition = m.outcome;
  } else if (fact === true) {
    row.done = true;
    row.doneVia = stage.doneSource || null;
    row.doneBy = null;
    row.doneAt = null;
    row.outcome = null;
  } else {
    row.done = marks && marks.available ? false : fact; // fact: false (יש שדה) או null (אין שדה והטבלה חסרה)
    row.doneVia = null;
    row.doneBy = null;
    row.doneAt = null;
    row.outcome = null;
  }
  return row;
}

export function applyMarksToRows(rowsByStage, marks, stageDefs = STAGE_BY_KEY) {
  for (const [stageKey, rows] of Object.entries(rowsByStage || {})) {
    const stage = stageDefs[stageKey];
    if (!stage || stage.infoOnly || !Array.isArray(rows)) continue;
    for (const row of rows) decorateRowWithMark(row, stage, marks);
  }
  return rowsByStage;
}

// ---- קלט ------------------------------------------------------------------------------------

/**
 * בדיקת הקלט של POST /api/schedule/marks. זורק MarkError(400) בעברית. מחזיר קלט מנורמל.
 */
export function validateMarkInput(body, { today } = {}) {
  const b = body && typeof body === 'object' ? body : {};
  const action = String(b.action || '');
  if (!MARK_ACTIONS.includes(action)) throw new MarkError(400, 'פעולה לא מוכרת');
  const stageKey = String(b.stageKey || '');
  if (!MARKABLE_STAGE_KEYS.includes(stageKey)) throw new MarkError(400, 'שלב לא תקין - בשלב הזה אין סימון "בוצע"');
  const dayKey = String(b.dayKey || '');
  if (!isValidKey(dayKey)) throw new MarkError(400, 'תאריך לא תקין - נדרש YYYY-MM-DD');
  const todayK = today || todayKey();
  if (!isWithinReasonableRange(dayKey, todayK)) {
    throw new MarkError(400, `התאריך מחוץ לטווח - הלו״ז זמין עד ${MAX_YEARS_FROM_TODAY} שנים קדימה או אחורה מהיום`);
  }
  const toOrderId = (v) => {
    const n = typeof v === 'number' ? v : (typeof v === 'string' && /^\d+$/.test(v.trim()) ? parseInt(v, 10) : NaN);
    return Number.isInteger(n) && n > 0 && n < 1e9 ? n : null;
  };
  let orderId = null;
  let orderIds = null;
  if (action === 'mark_all') {
    if (b.orderIds !== undefined && b.orderIds !== null) {
      if (!Array.isArray(b.orderIds)) throw new MarkError(400, 'רשימת הזמנות לא תקינה');
      // התקרה נבדקת לפני המיפוי - רשימה ענקית לא מעובדת בכלל
      if (b.orderIds.length > MARK_ALL_MAX) throw new MarkError(400, `אפשר לסמן עד ${MARK_ALL_MAX} הזמנות בפעולה אחת`);
      orderIds = [...new Set(b.orderIds.map(toOrderId))];
      if (orderIds.some((x) => x === null)) throw new MarkError(400, 'מספר הזמנה לא תקין ברשימה');
    }
  } else {
    orderId = toOrderId(b.orderId);
    if (orderId === null) throw new MarkError(400, 'מספר הזמנה לא תקין');
  }
  let outcome = null;
  if (RETURN_OUTCOME_STAGES.includes(stageKey) && action !== 'unmark') {
    outcome = b.outcome === undefined || b.outcome === null || b.outcome === '' ? 'ok' : String(b.outcome);
    if (!OUTCOMES.includes(outcome)) throw new MarkError(400, 'מצב החזרה לא תקין (תקין / לא תקין)');
  } else if (b.outcome !== undefined && b.outcome !== null && b.outcome !== '') {
    throw new MarkError(400, 'מצב החזרה (תקין / לא תקין) שייך רק לשלבי ההחזרה');
  }
  const source = action === 'mark_all' ? 'all' : (MARK_SOURCES.includes(b.source) ? b.source : 'row');
  const overridePin = typeof b.overridePin === 'string' && b.overridePin ? b.overridePin.slice(0, 64) : undefined;
  const overrideEmployeeId = typeof b.overrideEmployeeId === 'string' && b.overrideEmployeeId ? b.overrideEmployeeId.slice(0, 64) : undefined;
  return { action, stageKey, dayKey, orderId, orderIds, outcome, source, overridePin, overrideEmployeeId };
}

// ---- טעינת השורות של שלב אחד (אותו סיווג כמו הדף) -------------------------------------------

function stageOnlyCtx(ctx, stageKey) {
  return { ...ctx, stageSettings: { [stageKey]: ctx.stageSettings[stageKey] } };
}

/**
 * השורות של שלב אחד ביום אחד, בדיוק כמו שהדף מחשב אותן (לא סומכים על הלקוח): שלבי אירוע דרך אותה שאילתה
 * ואותו classifyEventOrder; משלוחים דרך getDeliveriesForDate. orderIds מצמצם את השאילתה (סימון יחיד).
 * @returns {{rows: object[], orders: Map<number, object>}} orders = ההזמנות הגולמיות (לשלבים 2/8, לכתיבה על פריטים)
 */
export async function loadStageRowsForMarking(stageKey, ctx, { orderIds = null } = {}) {
  const only = stageOnlyCtx(ctx, stageKey);
  const stage = ctx.stageDefs[stageKey];
  if (stage.dateSource === 'deliveryOut' || stage.dateSource === 'deliveryReturn') {
    const res = await loadDeliveryStageRows(only);
    let rows = stageKey === 'dout' ? res.dout : res.dback;
    if (orderIds) rows = rows.filter((r) => orderIds.includes(r.orderId));
    return { rows, orders: new Map() };
  }
  const keySets = eventStageKeySets(only);
  const where = buildEventStageWhere(only, keySets);
  if (!where) return { rows: [], orders: new Map() };
  const orders = await prisma.order.findMany({
    where: orderIds ? { AND: [where, { orderId: { in: orderIds } }] } : where,
    select: ORDER_SELECT,
    orderBy: { eventDate: 'asc' },
    take: ctx.maxScanRows + 1,
  });
  const rows = [];
  const byId = new Map();
  for (const order of orders.slice(0, ctx.maxScanRows)) {
    if (!classifyEventOrder(order, only, keySets).includes(stageKey)) continue;
    rows.push(buildEventStageRow(order, stageKey, only, {}));
    byId.set(order.orderId, order);
  }
  return { rows, orders: byId };
}

// ---- כתיבה -----------------------------------------------------------------------------------

async function setAlterationsDone(order, wanted, dayKey) {
  const items = (order.items || []).filter(itemHasAlteration).filter((it) => !!it.alterationDone !== wanted);
  for (const it of items) {
    await prisma.orderItem.update(auditAs(
      wanted ? 'ALTERATION_DONE' : 'ALTERATION_UNDONE',
      { where: { id: it.id }, data: { alterationDone: wanted } },
      { alterationDone: { from: !!it.alterationDone, to: wanted }, orderId: order.orderId, note: `מהלו״ז היומי (${dayKey})` },
    ));
  }
  return items.length;
}

// שלב 8: החזרה / ביטול החזרה של פריטי ההזמנה - אותם שדות ואותם שמות פעולה כמו POST /api/rentals/toggle,
// ו-DressItem.location כמו /api/returns/scan רק כש-SCHEDULE_RETURN_UPDATES_DRESS_LOCATION דולק (כבוי מ-4.10.2026).
// ביטול: רק הפריטים שההחזרה שלהם נרשמה מהלו״ז עצמו - returnDate שווה ל-markedAt של הסימון (שניהם נכתבים
// עם אותו `now`). פריט שהוחזר בסריקה/בכרטיס נשאר "הוחזר" (ביטולו - משם). בלי סימון קודם אין מה לבטל.
// מחזיר { blocked } כשהגנת ההחזרה המוקדמת חסמה (NextResponse 409 מוכן), אחרת { changed, items }.
export function itemsReturnedBySchedule(order, mark) {
  const at = mark && mark.markedAt ? new Date(mark.markedAt).getTime() : null;
  if (!at) return [];
  return (order.items || []).filter((it) => itemReturned(it) && it.returnDate && new Date(it.returnDate).getTime() === at);
}

// הגנת ההחזרה המוקדמת בנפרד, לפני כל כתיבה (גם לפני שורת הסימון): null = אין פריטים להחזיר / אין חסימה מוקדמת
// לבדוק; אחרת התוצאה של checkEarlyReturn ({ response } כשנחסם, { auditNote } כשאושר).
async function earlyReturnGuard(order, { overridePin, overrideEmployeeId }) {
  const pending = (order.items || []).filter((it) => !itemReturned(it));
  if (!pending.length) return null;
  return checkEarlyReturn({ orderId: order.orderId, eventDate: order.eventDate }, { overridePin, overrideEmployeeId });
}

async function setReturned(order, wanted, outcome, { overridePin, overrideEmployeeId, now, dayKey, existingMark, guard: preGuard, updateDressLocation = SCHEDULE_RETURN_UPDATES_DRESS_LOCATION }) {
  const items = order.items || [];
  if (wanted) {
    const pending = items.filter((it) => !itemReturned(it));
    if (!pending.length) return { changed: 0, items: [] };
    const guard = preGuard || await checkEarlyReturn({ orderId: order.orderId, eventDate: order.eventDate }, { overridePin, overrideEmployeeId });
    if (guard.response) return { blocked: guard.response };
    const returnedOk = outcome !== 'not_ok';
    for (const it of pending) {
      const data = { isReturned: true, returnedOk, returnDate: now };
      const changes = {
        isReturned: { from: !!it.isReturned, to: true },
        returnedOk: { from: !!it.returnedOk, to: returnedOk },
        returnDate: { from: it.returnDate || null, to: now },
        orderId: order.orderId,
        note: (guard.auditNote ? guard.auditNote + ' · ' : '') + `מהלו״ז היומי (${dayKey})`,
      };
      await prisma.orderItem.update(auditAs('RETURN_RENTAL', { where: { id: it.id }, data }, changes));
      if (updateDressLocation) await setDressLocation(it, DRESS_LOCATION_ON_RETURN);
    }
    return { changed: pending.length, items: pending };
  }
  const returned = itemsReturnedBySchedule(order, existingMark);
  for (const it of returned) {
    const data = { isReturned: false, returnedOk: false, returnDate: null };
    const changes = {
      isReturned: { from: true, to: false },
      returnedOk: { from: !!it.returnedOk, to: false },
      returnDate: { from: it.returnDate || null, to: null },
      orderId: order.orderId,
      note: `ביטול מהלו״ז היומי (${dayKey})`,
    };
    await prisma.orderItem.update(auditAs('CANCEL_RETURN', { where: { id: it.id }, data }, changes));
    if (updateDressLocation) await setDressLocation(it, DRESS_LOCATION_ON_UNDO);
  }
  return { changed: returned.length, items: returned };
}

// מיקום השמלה - אותה כתיבה כמו /api/returns/scan (update רגיל, התוסף רושם UPDATE על DressItem). נקרא רק כשהמתג
// דולק (שני הקוראים ב-setReturned בודקים updateDressLocation; כבוי = אף כתיבה על DressItem, גם לא בביטול).
// פריט בלי dressItemId (לפני השכרה) - אין מה לעדכן. כשל כאן לא מפיל את ההחזרה עצמה (הפריט כבר "הוחזר").
async function setDressLocation(item, location) {
  if (!item || !item.dressItemId) return false;
  try {
    await prisma.dressItem.update({ where: { id: item.dressItemId }, data: { location } });
    return true;
  } catch (e) {
    console.error('schedule marks: DressItem.location update failed', item.dressItemId, e);
    return false;
  }
}

const uniqueWhere = (orderId, stageKey, dayKey) => ({ orderId_stageKey_dayKey: { orderId, stageKey, dayKey } });

/**
 * שורת הסימון עצמה: create כשאין, update כשיש; אידמפוטנטי (אותו מצב = בלי כתיבה). תפיסת P2002 = מישהי
 * אחרת יצרה את השורה באותו רגע -> ממשיכים כ-update על השורה שלה. AuditLog נכתב אוטומטית ע"י התוסף.
 */
export async function writeMark({ orderId, stageKey, dayKey, wanted, outcome, source, userId, now, stageLabel }) {
  const nextOutcome = wanted && RETURN_OUTCOME_STAGES.includes(stageKey) ? (outcome || 'ok') : null;
  let existing = await prisma.scheduleStageMark.findUnique({ where: uniqueWhere(orderId, stageKey, dayKey), select: MARK_SELECT });
  if (existing && !!existing.done === wanted && (existing.outcome || null) === nextOutcome) {
    return { mark: existing, unchanged: true };
  }
  const action = wanted ? MARK_AUDIT_ACTIONS.done : MARK_AUDIT_ACTIONS.undone;
  const changes = {
    orderId,
    scheduleStage: stageLabel || stageKey,
    scheduleDay: dayKey,
    done: { from: existing ? !!existing.done : null, to: wanted },
    ...(wanted && source === 'auto' ? { auto: true, source: 'auto' } : {}), // סימון אוטומטי (הכנה בלקיחה, lib/schedule/autoPrepMark.js) - ההיסטוריה מתייגת אותו אחרת
    ...(RETURN_OUTCOME_STAGES.includes(stageKey) ? { outcome: { from: existing ? existing.outcome || null : null, to: nextOutcome } } : {}),
  };
  if (!existing) {
    try {
      const mark = await prisma.scheduleStageMark.create(auditAs(action, {
        data: {
          orderId, stageKey, dayKey,
          done: wanted, outcome: nextOutcome, source: source || null,
          markedById: wanted ? userId || null : null,
          markedAt: now,
          undoneById: wanted ? null : userId || null,
          undoneAt: wanted ? null : now,
        },
        select: MARK_SELECT,
      }, changes));
      return { mark, unchanged: false };
    } catch (e) {
      if (e && e.code === 'P2002') {
        existing = await prisma.scheduleStageMark.findUnique({ where: uniqueWhere(orderId, stageKey, dayKey), select: MARK_SELECT });
        if (!existing) throw e;
        if (!!existing.done === wanted && (existing.outcome || null) === nextOutcome) return { mark: existing, unchanged: true };
      } else {
        throw e;
      }
    }
  }
  // סימון שכבר "בוצע" שנכתב שוב (למשל שתי לחיצות באותו רגע) שומר את markedAt/markedById המקוריים: ביטול שלב 8
  // מוצא את הפריטים שהלו״ז החזיר לפי returnDate == markedAt (itemsReturnedBySchedule) - הזזת markedAt הייתה מנתקת אותם
  const keepOriginal = wanted && existing.done;
  const data = wanted
    ? {
      done: true, outcome: nextOutcome, source: keepOriginal ? existing.source || source || null : source || null,
      markedById: keepOriginal ? existing.markedById || userId || null : userId || null,
      markedAt: keepOriginal && existing.markedAt ? existing.markedAt : now,
      undoneById: null, undoneAt: null,
    }
    : { done: false, outcome: null, undoneById: userId || null, undoneAt: now };
  const mark = await prisma.scheduleStageMark.update(auditAs(action, { where: { id: existing.id }, data, select: MARK_SELECT }, changes));
  return { mark, unchanged: false };
}

function returnConditionOf(order, fallback) {
  const items = order && order.items ? order.items : [];
  if (!items.length || !items.every(itemReturned)) return fallback || null;
  return items.every((it) => it.returnedOk) ? 'ok' : 'not_ok';
}

/** עבור /api/audit: מזהי שורות הסימון של הזמנה (ריק כשהטבלה/המודל חסרים או בכל שגיאה - לא זורק). */
export async function listOrderMarkIds(orderId) {
  try {
    if (Date.now() < tableMissingUntil || !isMarksModelAvailable()) return [];
    const rows = await prisma.scheduleStageMark.findMany({ where: { orderId }, select: { id: true } });
    return rows.map((r) => r.id);
  } catch (e) {
    if (isMissingTableError(e)) tableMissingUntil = Date.now() + TABLE_RECHECK_MS;
    return [];
  }
}

/**
 * סימון / ביטול / "הכל בוצע" לשלב ביום. בודק בשרת שההזמנה שייכת לשלב/יום (אותו סיווג כמו הדף), מבצע את
 * ההשלכות על השדות הקיימים (שלבים 2/8) וכותב את שורת הסימון. בלי טרנזקציה; כל הזמנה בנפרד.
 *
 * @returns {{dayKey, stageKey, results: Array<{orderId, status: 'marked'|'unmarked'|'unchanged'|'blocked'|'not_in_stage', row?, blocked?}>}}
 *   row = טלאי לשורה בדף: { orderId, stage, done, doneVia, doneBy, doneAt, outcome, returnCondition, mark, alerts, items? }
 *   blocked = NextResponse (409) מהגנת ההחזרה המוקדמת - הנתיב מחזיר אותו כמו שהוא לסימון יחיד.
 */
export async function applyStageMark(input, { user, settings, now = new Date(), updateDressLocation = SCHEDULE_RETURN_UPDATES_DRESS_LOCATION } = {}) {
  if (!user || !user.id) throw new MarkError(401, 'יש להתחבר כדי לסמן "בוצע"');
  const { action, stageKey, dayKey, orderId, orderIds, outcome, source, overridePin, overrideEmployeeId } = input;
  const stage = STAGE_BY_KEY[stageKey];
  if (!stage || stage.infoOnly) throw new MarkError(400, 'שלב לא תקין');
  const resolved = settings || (await loadScheduleSettings());
  const cfg = resolved.stages[stageKey];
  if (!cfg || !cfg.enabled) throw new MarkError(409, 'השלב הזה כבוי בהגדרות - אי אפשר לסמן בו "בוצע".');

  const today = todayKey(now);
  const ctx = {
    dayKey, todayKey: today, stageDefs: STAGE_BY_KEY, stageSettings: resolved.stages,
    maxScanRows: resolved.maxScanRows, nonWorkingDays: resolved.nonWorkingDays, includeInternalNotes: false,
  };
  const alertCtx = { dayKey, todayKey: today, lateReturnThresholdDays: resolved.lateReturnThresholdDays };
  const wanted = action !== 'unmark';

  // הטבלה קיימת? (שאילתת הסימונים הקיימים של השלב/יום - בלי שמות; sinceKey להתראות "באיחור" ביום שעבר)
  const marks = await loadDayMarks(dayKey, { stageKey, withNames: false, withSince: dayKey < today });
  if (!marks.available) throw new MarkError(503, 'סימון "בוצע" עדיין לא זמין - טבלת הסימונים של הלו״ז לא נוצרה במסד.', { unavailable: true });
  alertCtx.marksSinceKey = marks.sinceKey;

  const wantIds = action === 'mark_all' ? orderIds : [orderId];
  const loaded = await loadStageRowsForMarking(stageKey, ctx, { orderIds: wantIds });
  applyMarksToRows({ [stageKey]: loaded.rows }, marks);

  let targets;
  let remaining = 0;
  if (action === 'mark_all') {
    const pendingRows = loaded.rows.filter((r) => r.done !== true);
    targets = pendingRows.slice(0, markAllMax(stageKey));
    remaining = pendingRows.length - targets.length;
  } else {
    const row = loaded.rows.find((r) => r.orderId === orderId);
    if (!row) throw new MarkError(409, 'ההזמנה לא נמצאת בשלב הזה ביום הזה - ייתכן שהתאריכים השתנו. רעננו את הדף.', { notInStage: true });
    // מסך ישן (הדף לא מתרענן לבד): השורה כבר סומנה "בוצע" - ע"י מישהי אחרת, או במצב החזרה אחר. סימון נוסף היה
    // דורס את התוצאה (תקין/לא תקין) ומזיז את markedAt, ואז "ביטול" כבר לא מוצא את הפריטים שהלו״ז החזיר
    // (returnDate == markedAt) - סקירה 2.10, MUST-FIX 1. נדחה ב-409 עם שם המסמנת; הלקוח מרענן את היום.
    // אותה מסמנת + אותה תוצאה (לחיצה כפולה) = 'unchanged' אידמפוטנטי כמו קודם, בלי כתיבה.
    const existing = wanted ? marks.byKey.get(markKey(stageKey, orderId)) : null;
    if (existing && existing.done) {
      const sameOutcome = (existing.outcome || null) === (RETURN_OUTCOME_STAGES.includes(stageKey) ? (outcome || 'ok') : null);
      if (!(sameOutcome && existing.markedById === user.id)) {
        const names = await employeeNames([existing.markedById]).catch(() => new Map());
        const who = (existing.markedById && names.get(existing.markedById)) || 'עובדת אחרת';
        throw new MarkError(409, `כבר סומן ע״י ${who} - רעננו את הדף`, { alreadyMarked: true, markedBy: who, outcome: existing.outcome || null });
      }
    }
    targets = [row];
  }

  const actor = await prisma.employee.findUnique({ where: { id: user.id }, select: { firstName: true, lastName: true, fullName: true } }).catch(() => null);
  const actorName = displayName(actor);

  const results = [];
  for (const row of targets) {
    const order = loaded.orders.get(row.orderId) || null;
    const existingMark = marks.byKey.get(markKey(stageKey, row.orderId)) || null;
    // העובדה הקיימת (לפני שהסימון דרס אותה ב-applyMarksToRows): מה שהפריטים אומרים
    const fact = row.fact || { done: row.done, returnCondition: row.returnCondition };
    let factAfter = fact.done; // null לשלבים בלי שדה קיים
    let returnCondition = fact.returnCondition; // undefined בשלב שאינו החזרה
    let items = row.items;
    let note = null;
    // שלב 2, ביטול בלי סימון "בוצע" של הלו״ז: השורה "בוצע" כי התופרת סימנה את התיקונים במסך התיקונים - הלו״ז לא
    // מבטל עבודה שלא הוא סימן (אותו עיקרון כמו שלב 8: "רק מה שהלו״ז עשה"; סקירה 2.10, MUST-FIX 2). בלי כתיבה.
    if (!wanted && stageKey === 'repair' && !(existingMark && existingMark.done)) {
      const doneNow = !!fact.done;
      const patch = {
        orderId: row.orderId, stage: stageKey, done: doneNow, doneVia: doneNow ? stage.doneSource || null : null,
        doneBy: null, doneAt: null, outcome: null, mark: existingMark ? markView(existingMark, marks.names) : null,
        ...(row.items ? { items: row.items } : {}),
        note: 'לא סומן מהלו״ז - התיקונים סומנו במסך התיקונים, ושם אפשר לבטל אותם',
      };
      patch.alerts = alertsForRow({ ...row, done: doneNow, canMark: true, address: row.address }, stage, alertCtx);
      results.push({ orderId: row.orderId, status: 'unchanged', row: patch });
      continue;
    }
    // סימון: שורת הסימון נכתבת לפני הפריטים (סקירה 2.10, SHOULD-FIX 5) - אם הבקשה נקטעת באמצע (תקרת זמן, "הכל
    // בוצע" גדול) לא נשארים פריטים "הוחזרו"/"תוקנו" בלי סימון שאפשר לבטל. הגנת ההחזרה המוקדמת נבדקת קודם, כך
    // שהזמנה חסומה לא מקבלת סימון. ביטול: הפריטים קודם (לפי markedAt של הסימון הקיים), ואז הסימון.
    let guard = null;
    if (wanted && stageKey === 'manret' && order) {
      guard = await earlyReturnGuard(order, { overridePin, overrideEmployeeId });
      if (guard && guard.response) {
        results.push({ orderId: row.orderId, status: 'blocked', blocked: guard.response });
        continue;
      }
    }
    let written = wanted
      ? await writeMark({ orderId: row.orderId, stageKey, dayKey, wanted, outcome, source, userId: user.id, now, stageLabel: stage.label })
      : null;
    // הפריטים שהלו״ז מחזיר מקבלים returnDate == markedAt של הסימון (גם כשהסימון כבר היה קיים) - הקישור שהביטול נשען עליו
    const returnAt = written && written.mark && written.mark.markedAt ? new Date(written.mark.markedAt) : now;
    if (stageKey === 'repair' && order) {
      await setAlterationsDone(order, wanted, dayKey);
      items = (row.items || []).map((it) => ({ ...it, done: wanted }));
      factAfter = wanted;
    } else if (stageKey === 'manret' && order) {
      const r = await setReturned(order, wanted, outcome, { overridePin, overrideEmployeeId, now: wanted ? returnAt : now, dayKey, existingMark, guard, updateDressLocation });
      if (r.blocked) {
        results.push({ orderId: row.orderId, status: 'blocked', blocked: r.blocked });
        continue;
      }
      // המצב אחרי הכתיבה, בלי שליפה נוספת: הפריטים שהוחזרו עכשיו קיבלו את המצב שנבחר; בביטול - רק הפריטים
      // שהלו״ז החזיר חוזרים ל"לא הוחזר", השאר (סריקה/כרטיס) נשארים הוחזרו
      const touched = new Set(r.items.map((it) => it.id));
      const after = (order.items || []).map((it) => {
        if (!touched.has(it.id)) return it;
        return wanted
          ? { ...it, isReturned: true, returnedOk: outcome !== 'not_ok', returnDate: returnAt }
          : { ...it, isReturned: false, returnedOk: false, returnDate: null };
      });
      factAfter = after.length > 0 && after.every(itemReturned);
      returnCondition = returnConditionOf({ items: after }, wanted ? outcome : null);
      if (!wanted && factAfter) note = 'הפריטים הוחזרו בסריקה או בכרטיס ההזמנה - הסימון בלו״ז בוטל, אבל ההזמנה נשארת "בוצע" לפי ההחזרה שנרשמה שם';
    } else if (!wanted && stage.doneSource && factAfter) {
      note = 'הפריטים כבר נלקחו בהשכרה - הסימון בלו״ז בוטל, אבל ההזמנה נשארת "בוצע" לפי ההשכרה';
    }
    if (!written) written = await writeMark({ orderId: row.orderId, stageKey, dayKey, wanted, outcome, source, userId: user.id, now, stageLabel: stage.label });
    const { mark, unchanged } = written;
    const done = wanted ? true : !!factAfter;
    const names = new Map([[user.id, actorName]]);
    if (mark.markedById && mark.markedById !== user.id && marks.names.has(mark.markedById)) names.set(mark.markedById, marks.names.get(mark.markedById));
    const patch = {
      orderId: row.orderId,
      stage: stageKey,
      done,
      doneVia: wanted ? 'mark' : (done ? stage.doneSource || null : null),
      doneBy: wanted ? (names.get(mark.markedById) || actorName) : null,
      doneAt: wanted ? mark.markedAt || now : null,
      outcome: wanted ? mark.outcome || null : null,
      // מצב ההחזרה כמו בטעינה מחדש: לפי הפריטים; רק כשהם עוד לא הוחזרו - לפי הסימון (decorateRowWithMark)
      returnCondition: RETURN_OUTCOME_STAGES.includes(stageKey) ? (returnCondition || (wanted ? mark.outcome || null : null)) : undefined,
      mark: markView(mark, names),
      ...(items ? { items } : {}),
      ...(note ? { note } : {}),
    };
    patch.alerts = alertsForRow({ ...row, done: patch.done, canMark: true, address: row.address }, stage, alertCtx);
    results.push({ orderId: row.orderId, status: unchanged ? 'unchanged' : (wanted ? 'marked' : 'unmarked'), row: patch });
  }
  return { dayKey, stageKey, results, remaining };
}

/**
 * הסימונים של הזמנה אחת (לכרטיס ההזמנה, טאב "מידע"). חסר טבלה -> available=false בלי שגיאה.
 */
export async function listOrderMarks(orderId) {
  if (Date.now() < tableMissingUntil) return { available: false, marks: [] };
  if (!isMarksModelAvailable()) { markTableMissing('ScheduleStageMark model is not in the generated Prisma client'); return { available: false, marks: [] }; }
  let rows;
  try {
    rows = await prisma.scheduleStageMark.findMany({ where: { orderId }, select: MARK_SELECT, orderBy: [{ dayKey: 'asc' }, { stageKey: 'asc' }] });
  } catch (e) {
    if (isMissingTableError(e)) {
      tableMissingUntil = Date.now() + TABLE_RECHECK_MS;
      return { available: false, marks: [] };
    }
    throw e;
  }
  const names = await employeeNames(rows.flatMap((m) => [m.markedById, m.undoneById]));
  return {
    available: true,
    marks: rows.map((m) => {
      const stage = STAGE_BY_KEY[m.stageKey];
      return {
        id: m.id,
        stageKey: m.stageKey,
        stageNumber: stage ? stage.number : null,
        stageLabel: stage ? stage.label : m.stageKey,
        dayKey: m.dayKey,
        ...markView(m, names),
      };
    }),
  };
}
