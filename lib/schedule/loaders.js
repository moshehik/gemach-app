// lib/schedule/loaders.js — שליפת הפריטים של יום אחד לכל שלב בלו״ז, בכמה שפחות שאילתות.
//
// קריאה בלבד. ארבע שאילתות לכל היותר ליום (ועוד אחת קטנה לשמות דגמים):
//   1. הזמנות שנרשמו ביום (שלב 1)                          - Order לפי orderDate בחלון היום הישראלי.
//   2. הזמנות לפי תאריך האירוע (שלבים 2, 4, 6, 7, 8)        - שאילתת Order אחת על טווח מאוחד + סיווג ב-JS.
//   3. משלוחים (שלבים 5, 9)                                  - getDeliveriesForDate (lib/deliveries.js), אותה
//                                                              לוגיקה כמו /deliveries, במצב "לפי יום השליח".
//   4. מי במשמרת                                             - Shift, שמות בלבד (בלי שכר - בניגוד ל-/api/attendance).
//
// כללי סינון משותפים (CLAUDE.md, Standing rules → Data & database): isDeleted=false, וטיוטות מסוננות
// עם { OR: [{status: null}, {status: {not: DRAFT}}] } - אף פעם לא notIn/<> חשוף על Order.status
// (עמוס NULL). כל חלון יום = getIsraelDayRange דרך dates.js. אין קריאה בתוך $transaction.
// ימי עסקים (שלבים 2/4/6/8): הכלל האחיד של lib/businessDays.js דרך dates.js, עם רשימת הימים של הבעלים
// (ctx.nonWorkingDays, מההגדרות). שלבים 5/9: lib/deliveries.js מחיל את אותו כלל בעצמו.

import prisma from '@/app/lib/prisma';
import { getDeliveriesForDate } from '@/lib/deliveries';
import { DRAFT_ORDER_STATUS } from '@/lib/orderReservation';
import { SAFE_EMPLOYEE_SELECT } from '@/lib/safeSelect';
import { getHebrewDateString } from '@/lib/hebrewDate';
import { dayRange, unionRange, sourceKeysForDay, rolledSourceKeysForDay, rollForwardToWorkingDay, instantToKey, addBusinessDays, keyToLocalMidnight } from './dates';
import { isDeliveryOut, isDeliveryReturn } from './deliveryDirection';
import { orderPaymentView } from './payment';

const NOT_DRAFT = { OR: [{ status: null }, { status: { not: DRAFT_ORDER_STATUS } }] };
const DAY_MS = 24 * 60 * 60 * 1000;

// ---- עזרים על הזמנה/פריט ---------------------------------------------------------------------

// אותו כלל "יש תיקון" כמו app/api/alterations/route.js (ו-ALT_COND בחיפוש המתקדם). לא הכלל
// השבור של mark-done (INVENTORY G17).
export function itemHasAlteration(item) {
  if (!item) return false;
  if ((item.neckAlteration || 0) > 0) return true;
  if ((item.sleeveAlteration || 0) > 0) return true;
  const len = item.lengthAlteration;
  return len !== null && len !== undefined && !['', 'null', '0'].includes(String(len));
}

// "נלקח"/"הוחזר" כמו שכרטיס ההזמנה מציג (app/api/orders/[id]/route.js): הדגל או התאריך -
// הייבוא מ-Access השאיר דגלים לא מנורמלים.
export const itemTaken = (item) => !!(item && (item.isTaken || item.takenDate));
export const itemReturned = (item) => !!(item && (item.isReturned || item.returnDate));

const isCustomPeriod = (order) => !!order.isAbroad;

// "תאריך התחלה אפקטיבי" (INVENTORY 1.0ד): חו"ל - fromDate (נופל ל-eventDate), אחרת eventDate.
export function effectiveStartKey(order) {
  if (isCustomPeriod(order)) return instantToKey(order.fromDate || order.eventDate);
  return instantToKey(order.eventDate);
}

export function effectiveEndKey(order) {
  if (isCustomPeriod(order)) return instantToKey(order.toDate || order.fromDate || order.eventDate);
  return instantToKey(order.eventDate);
}

// מועד ההחזרה הצפוי: toDate ‖ returnDate ‖ אירוע + offset ימי עסקים לפי הכלל האחיד (החלטת הבעלים 3; ברירת
// המחדל offset 1 = nextWorkingDay של lib/lateReturn.js), ואז - החלטת הבעלים 2.10.2026 ("ההחזרה של אירוע בחמישי
// תהיה בראשון") - גלגול קדימה ליום עובד: תאריך מפורש שנופל על שישי/שבת/חג/יום סגור, או offset 0 על אירוע
// ביום כזה, מוצגים ביום העבודה הראשון אחריו. raw = המועד לפני הגלגול (לתצוגת "מועד מקורי").
// מאוחד (2.10.2026, "כן" של הבעלים): lib/lateReturn.js (כרטיס ההזמנה, רשימת האיחורים, ההדפסה, המיילים, "אמור
// לחזור מחר", שבבי החיפוש) מגלגל תאריך מפורש באותה פונקציה (rollForwardToWorkingDay ב-lib/businessDays.js);
// עם offset ברירת המחדל (1) due כאן == getExpectedReturnKey שם על כל הזמנה (return-roll-forward.test.mjs).
// קצה תיאורטי: toDate לא תקין + returnDate תקין - כאן נופלים ל-returnDate, ב-lib/lateReturn.js מוחזר null ("לא מאחרת").
export function returnDueKeys(order, { offset = 1, nonWorkingDays = null } = {}) {
  const explicit = instantToKey(order.toDate) || instantToKey(order.returnDate);
  const eventKey = instantToKey(order.eventDate);
  const raw = explicit || (eventKey ? addBusinessDays(eventKey, offset, nonWorkingDays) : null);
  return { raw, due: raw ? rollForwardToWorkingDay(raw, nonWorkingDays) : null };
}

export function returnDueKey(order, opts) {
  return returnDueKeys(order, opts).due;
}

// pure rule (null direction = 'הלוך-חזור'), shared with the print pages - lib/schedule/deliveryDirection.js
export { isDeliveryOut, isDeliveryReturn };

function customerOf(c) {
  const firstName = c?.firstName || '';
  const lastName = c?.lastName || '';
  return {
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim() || 'לא ידוע',
    phone1: c?.phone1 || '',
    phone2: c?.phone2 || '',
  };
}

// כתובת מגורים של הלקוחה (החזרה ידנית) - אותו פורמט "רחוב בית, עיר" כמו lib/deliveries.js.
function customerAddress(c) {
  const street = [c?.street, c?.houseNum].filter((x) => x !== null && x !== undefined && String(x).trim() !== '').join(' ');
  const city = c?.city || '';
  return { street, city, full: street && city ? `${street}, ${city}` : (street || city || '') };
}

function flagsOf(order) {
  return {
    isAbroad: !!order.isAbroad,
    extraDay: order.extraDay || null,
    customSpacing: order.customSpacing ?? null,
  };
}

function hebrewOf(order, eventKey) {
  if (order.eventDateHebrew) return order.eventDateHebrew;
  return eventKey ? (getHebrewDateString(keyToLocalMidnight(eventKey)) || null) : null;
}

const CUSTOMER_SELECT = { firstName: true, lastName: true, phone1: true, phone2: true, city: true, street: true, houseNum: true };

const ITEM_SELECT = {
  id: true, description: true, sizeText: true, barcodePrefix: true,
  dressItemId: true, // לסימון החזרה מהלו״ז (lib/schedule/marks.js): עדכון DressItem.location רק כש-SCHEDULE_RETURN_UPDATES_DRESS_LOCATION דולק (כבוי מ-4.10.2026); לא יוצא בשורה

  isTaken: true, takenDate: true, isReturned: true, returnDate: true, returnedOk: true,
  neckAlteration: true, lengthAlteration: true, sleeveAlteration: true, alterationDetails: true, alterationDone: true,
  dressItem: { select: { location: true, inRepair: true, sizeText: true, dress: { select: { name: true, barcodePrefix: true } } } },
};

// מיוצא גם ל-lib/schedule/marks.js: הסימון חוזר על אותה שליפה ואותו סיווג (classifyEventOrder) כדי לוודא בשרת
// שההזמנה באמת שייכת לשלב/יום לפני שכותבים "בוצע" - לא סומכים על הלקוח.
export const ORDER_SELECT = {
  orderId: true, orderDate: true, eventDate: true, eventDateHebrew: true, fromDate: true, toDate: true, returnDate: true,
  isAbroad: true, extraDay: true, customSpacing: true,
  branch: true, pickupBranch: true, notes: true, internalNotes: true,
  isDelivery: true, deliveryDirection: true,
  customer: { select: CUSTOMER_SELECT },
  items: { where: { isDeleted: false }, select: ITEM_SELECT },
};

// ---- שורה אחידה ----------------------------------------------------------------------------

function baseRow(order, stage, ctx, { eventKey }) {
  return {
    orderId: order.orderId,
    stage: stage.key,
    customer: customerOf(order.customer),
    eventDate: order.eventDate || null,
    eventKey: eventKey || null,
    eventDateHebrew: hebrewOf(order, eventKey),
    dressCount: order.items ? order.items.length : 0,
    branch: order.branch || null,
    pickupBranch: order.pickupBranch || null,
    flags: flagsOf(order),
    notes: order.notes || '',
    ...(ctx.includeInternalNotes ? { internalNotes: order.internalNotes || '' } : {}),
    done: null,
    doneSource: stage.doneSource,
    alerts: [],
  };
}

function itemView(item, modelByPrefix) {
  const modelName = item.dressItem?.dress?.name || (item.barcodePrefix != null ? modelByPrefix[item.barcodePrefix] : null) || item.description || null;
  return {
    orderItemId: item.id,
    model: modelName,
    modelPrefix: item.dressItem?.dress?.barcodePrefix ?? item.barcodePrefix ?? null,
    size: item.sizeText || item.dressItem?.sizeText || null,
    location: item.dressItem?.location || null,
    inRepair: !!item.dressItem?.inRepair,
  };
}

// ---- 1. הזמנות שנרשמו ביום -----------------------------------------------------------------
// החלטה A2: רק הזמנות שנרשמו באותו יום (orderDate בחלון היום הישראלי) - אין "ימים מהאירוע" לשלב 1.
// החלטה A7: הזמנות שעוד לא שולמו כן מופיעות - אין כאן סינון לפי isPaid/status, רק טיוטה/מחוקה.

export async function loadOrderStageRows(ctx) {
  const stage = ctx.stageDefs.order;
  const range = dayRange(ctx.dayKey);
  const orders = await prisma.order.findMany({
    where: { isDeleted: false, ...NOT_DRAFT, orderDate: { gte: range.start, lte: range.end } },
    select: {
      ...ORDER_SELECT,
      // סכום ההזמנה + התשלומים שנרשמו בפועל (לא מחוקים) - "שולם / שולם חלקי / טרם שולם" נגזר מהם, כמו totalPaid ב-
      // GET /api/orders. העמודה Order.isPaid היא דגל ישן מהייבוא מ-Access: האתר לא מעדכן אותה בהזמנות חדשות
      // (נשארת false גם להזמנה ששולמה במלואה), ולכן אסור להסתמך עליה (דיווח 7f3ee630, 5.10.2026).
      totalAmount: true,
      isPaid: true, // גיבוי בלבד: משמש רק להזמנות ישנות בלי שורות תשלום (ר' lib/schedule/payment.js)
      payments: { where: { isDeleted: false }, select: { amount: true } },
      items: { where: { isDeleted: false }, select: { id: true } },
      employee: { select: SAFE_EMPLOYEE_SELECT },
    },
    orderBy: { orderDate: 'asc' },
    take: ctx.maxScanRows + 1,
  });
  const truncated = orders.length > ctx.maxScanRows;
  const rows = [];
  for (const order of orders.slice(0, ctx.maxScanRows)) {
    // סינון-ביטחון נוסף ב-JS לפי היום הישראלי (השאילתה כבר משתמשת בחלון הנכון)
    if (instantToKey(order.orderDate) !== ctx.dayKey) continue;
    const eventKey = effectiveStartKey(order);
    const e = order.employee;
    const pay = orderPaymentView(order.totalAmount, order.payments, order.isPaid === true);
    rows.push({
      ...baseRow(order, stage, ctx, { eventKey }),
      orderDate: order.orderDate,
      registeredBy: e ? (e.fullName || [e.firstName, e.lastName].filter(Boolean).join(' ') || null) : null,
      totalAmount: order.totalAmount ?? null,
      totalPaid: pay.totalPaid,
      balance: pay.balance,
      payStatus: pay.payStatus,
      isPaid: pay.payStatus === 'paid', // תאימות לאחור לצרכנים של השדה - נגזר מהתשלומים, לא מ-Order.isPaid
    });
  }
  return { rows, truncated };
}

// ---- 2. שלבים לפי תאריך האירוע: 2 תיקונים, 4 הכנה, 6 איסוף, 7 אירוע, 8 החזרה ידנית --------

export function eventStageKeySets(ctx) {
  const sets = {};
  for (const key of ['repair', 'prep', 'pick']) {
    const cfg = ctx.stageSettings[key];
    if (!cfg?.enabled) continue;
    sets[key] = new Set(sourceKeysForDay(ctx.dayKey, cfg.offset, ctx.nonWorkingDays));
  }
  if (ctx.stageSettings.event?.enabled) sets.event = new Set([ctx.dayKey]);
  if (ctx.stageSettings.manret?.enabled) {
    const cfg = ctx.stageSettings.manret;
    // offset>=1: ההופכי של הספירה (נוחת תמיד על יום עובד); offset 0: היום עצמו + רצף הימים הסגורים שלפניו
    // (אירוע בשישי/שבת -> החזרה בראשון, החלטת הבעלים 2.10.2026)
    sets.manret = new Set(cfg.offset ? sourceKeysForDay(ctx.dayKey, cfg.offset, ctx.nonWorkingDays) : rolledSourceKeysForDay(ctx.dayKey, ctx.nonWorkingDays));
  }
  return sets;
}

export function buildEventStageWhere(ctx, keySets) {
  const day = dayRange(ctx.dayKey);
  const allKeys = new Set();
  for (const set of Object.values(keySets)) for (const k of set) allKeys.add(k);
  const or = [];
  const range = unionRange([...allKeys]);
  if (range) {
    or.push({ eventDate: { gte: range.start, lte: range.end } });
    // הזמנת חו"ל: "תאריך ההתחלה האפקטיבי" הוא fromDate (effectiveStartKey, B21), לא eventDate - חייב
    // להיות גם בחלון ה-SQL, אחרת ההזמנה לא מגיעה ל-JS בכלל ונעלמת מהכנה/איסוף/תיקונים (סקירה 2.10, חוסם 2).
    // יש אינדקס על fromDate (prisma/schema.prisma).
    or.push({ fromDate: { gte: range.start, lte: range.end } });
  }
  if (keySets.event) {
    // הזמנת חו"ל שהתקופה שלה משתרעת על היום (fromDate..toDate)
    or.push({ AND: [{ fromDate: { lte: day.end } }, { toDate: { gte: day.start } }] });
  }
  if (keySets.manret) {
    // תאריך מפורש שנופל על יום סגור מתגלגל ליום העובד הבא (returnDueKeys), לכן החלון = היום + רצף הימים
    // הסגורים שלפניו; ביום סגור אין חלון כזה בכלל (שום החזרה לא נוחתת עליו).
    const explicitWin = unionRange(rolledSourceKeysForDay(ctx.dayKey, ctx.nonWorkingDays));
    if (explicitWin) {
      or.push({ toDate: { gte: explicitWin.start, lte: explicitWin.end } });
      or.push({ returnDate: { gte: explicitWin.start, lte: explicitWin.end } });
    }
  }
  if (or.length === 0) return null;
  return { AND: [{ isDeleted: false }, NOT_DRAFT, { OR: or }] };
}

export function classifyEventOrder(order, ctx, keySets) {
  const out = [];
  if (!order.items || order.items.length === 0) return out; // הזמנה בלי פריטים פעילים - אין מה להכין/להחזיר
  const startKey = effectiveStartKey(order);
  const endKey = effectiveEndKey(order) || startKey;
  const day = ctx.dayKey;

  if (keySets.repair && startKey && keySets.repair.has(startKey) && order.items.some(itemHasAlteration)) out.push('repair');
  if (keySets.prep && startKey && keySets.prep.has(startKey)) out.push('prep');
  if (keySets.pick && startKey && keySets.pick.has(startKey) && !isDeliveryOut(order)) out.push('pick');
  if (keySets.event && startKey && (startKey === day || (startKey <= day && day <= endKey))) out.push('event');
  if (keySets.manret && !isDeliveryReturn(order)) {
    const cfg = ctx.stageSettings.manret;
    if (returnDueKey(order, { offset: cfg.offset, nonWorkingDays: ctx.nonWorkingDays }) === day) out.push('manret');
  }
  return out;
}

export function buildEventStageRow(order, stageKey, ctx, modelByPrefix = {}) {
  const stage = ctx.stageDefs[stageKey];
  const eventKey = effectiveStartKey(order);
  const row = baseRow(order, stage, ctx, { eventKey });
  const items = order.items;

  if (stageKey === 'repair') {
    const altItems = items.filter(itemHasAlteration);
    row.items = altItems.map((it) => ({
      ...itemView(it, modelByPrefix),
      neckAlteration: it.neckAlteration || 0,
      lengthAlteration: it.lengthAlteration || '',
      sleeveAlteration: it.sleeveAlteration || 0,
      alterationDetails: it.alterationDetails || '',
      done: !!it.alterationDone,
      taken: itemTaken(it),
      returned: itemReturned(it),
    }));
    row.done = altItems.every((it) => !!it.alterationDone);
  } else if (stageKey === 'prep' || stageKey === 'event') {
    row.items = items.map((it) => itemView(it, modelByPrefix));
  } else if (stageKey === 'pick') {
    row.items = items.map((it) => ({ ...itemView(it, modelByPrefix), taken: itemTaken(it) }));
    row.done = items.every(itemTaken);
  } else if (stageKey === 'manret') {
    row.address = customerAddress(order.customer);
    const returned = items.filter(itemReturned);
    row.takenCount = items.filter(itemTaken).length;
    row.returnedCount = returned.length;
    row.done = items.every(itemReturned);
    // מצב החזרה תקין/לא תקין (B17/A4): returnedOk=false על פריט שהוחזר נקרא "לא תקין" (כמו החיפוש המתקדם).
    // הכמות (dressCount, החלטה A3) כבר בשורה הבסיסית - מספר בלבד, בלי דגמים.
    row.returnCondition = row.done ? (returned.every((it) => it.returnedOk) ? 'ok' : 'not_ok') : null;
    row.dueKey = ctx.dayKey;
    // המועד לפני הגלגול ליום עובד (תאריך מפורש / אירוע + offset) - שונה מ-dueKey רק כשנפל על יום סגור
    row.dueKeyRaw = returnDueKeys(order, { offset: ctx.stageSettings.manret.offset, nonWorkingDays: ctx.nonWorkingDays }).raw;
  }
  return row;
}

export async function loadEventStageRows(ctx) {
  const keySets = eventStageKeySets(ctx);
  const where = buildEventStageWhere(ctx, keySets);
  const empty = { rowsByStage: {}, truncated: false };
  if (!where) return empty;

  const orders = await prisma.order.findMany({
    where,
    select: ORDER_SELECT,
    orderBy: { eventDate: 'asc' },
    take: ctx.maxScanRows + 1,
  });
  const truncated = orders.length > ctx.maxScanRows;

  const assignments = [];
  for (const order of orders.slice(0, ctx.maxScanRows)) {
    const stages = classifyEventOrder(order, ctx, keySets);
    if (stages.length) assignments.push({ order, stages });
  }

  // שמות דגמים לפריטים בלי DressItem משויך - שאילתה אחת לפי קידומת (כמו מסך התיקונים)
  const prefixes = new Set();
  for (const { order, stages } of assignments) {
    if (!stages.some((s) => ctx.stageDefs[s].showModel)) continue;
    for (const it of order.items) if (!it.dressItem?.dress?.name && it.barcodePrefix != null) prefixes.add(it.barcodePrefix);
  }
  let modelByPrefix = {};
  if (prefixes.size > 0) {
    const models = await prisma.dressModel.findMany({
      where: { barcodePrefix: { in: [...prefixes] } },
      select: { barcodePrefix: true, name: true },
    });
    modelByPrefix = Object.fromEntries(models.map((m) => [m.barcodePrefix, m.name]));
  }

  const rowsByStage = {};
  for (const { order, stages } of assignments) {
    for (const stageKey of stages) {
      (rowsByStage[stageKey] ||= []).push(buildEventStageRow(order, stageKey, ctx, modelByPrefix));
    }
  }
  return { rowsByStage, truncated };
}

// ---- 3. משלוחים: 5 הלוך, 9 חזור ------------------------------------------------------------

function deliveryRow(d, stageKey, ctx) {
  const stage = ctx.stageDefs[stageKey];
  const eventKey = instantToKey(d.eventDate);
  return {
    orderId: d.orderId,
    stage: stageKey,
    customer: {
      firstName: d.customerFirstName || '',
      lastName: d.customerLastName || '',
      name: d.customerName || 'לא ידוע',
      phone1: d.customerPhone || '',
      phone2: d.customerPhone2 || '',
    },
    eventDate: d.eventDate || null,
    eventKey,
    eventDateHebrew: d.eventDateHebrew || null,
    dressCount: d.dressCount ?? 0,
    branch: d.branch || null,
    pickupBranch: d.pickupBranch || null,
    flags: { isAbroad: !!d.isAbroad, extraDay: d.extraDay || null, customSpacing: d.customSpacing ?? null },
    notes: d.notes || '',
    ...(ctx.includeInternalNotes ? { internalNotes: d.internalNotes || '' } : {}),
    address: { street: d.street || '', city: d.city || '', full: d.address || '' },
    dispatchDate: d.dispatchDates ? (stageKey === 'dout' ? d.dispatchDates.out : d.dispatchDates.return) || null : null,
    chargeExists: !!(d.chargeExists && (stageKey === 'dout' ? d.chargeExists.out : d.chargeExists.return)),
    // מצב החזרה תקין/לא תקין (החלטה A4): מוחזר בשלב 9 כמו בשלב 8; במשלוח הלוך אין משמעות - null.
    ...(stageKey === 'dback' ? { returnCondition: d.returnCondition ?? null } : {}),
    done: null,
    doneSource: stage.doneSource,
    alerts: [],
  };
}

export async function loadDeliveryStageRows(ctx) {
  const wantOut = !!ctx.stageSettings.dout?.enabled;
  const wantBack = !!ctx.stageSettings.dback?.enabled;
  if (!wantOut && !wantBack) return { dout: [], dback: [], meta: null };
  const result = await getDeliveriesForDate(keyToLocalMidnight(ctx.dayKey), {
    byDispatchDate: true,
    includeInternalNotes: ctx.includeInternalNotes,
    excludeDrafts: true, // כמו שאר השלבים (סקירת WP1, ממצא 1): עגלה שנשמרה אוטומטית אינה משלוח
    withScheduleFields: true, // street/dressCount/branch/דגלים/returnCondition - רק ללו״ז; /api/deliveries לא משתנה
  });
  const dout = [];
  const dback = [];
  for (const d of result.data) {
    if (wantOut && d.directions.includes('out')) dout.push(deliveryRow(d, 'dout', ctx));
    if (wantBack && d.directions.includes('return')) dback.push(deliveryRow(d, 'dback', ctx));
  }
  return { dout, dback, meta: { daysBefore: result.daysBefore, daysAfter: result.daysAfter } };
}

// ---- 4. מי במשמרת ---------------------------------------------------------------------------
// שמות בלבד. /api/attendance מחזיר גם hourlyWageSnapshot/totalCalculated לכל מי שמחובר - לא לשימוש כאן.
// Shift.date נכתב לפי שעון השרת (UTC) ולכן לא משמש לסינון; הולכים לפי entryTime בחלון היום הישראלי.
// רק כשהיום המבוקש הוא היום (dayKey === todayKey) מצורפות גם משמרות פתוחות (exitTime ריק) שנפתחו עד
// יממה קודם (עובדת שנכנסה לפני חצות ועדיין בעבודה). ליום עתידי או יום שעבר "פתוחה עכשיו" לא אומר
// כלום על אותו יום (סקירת WP1, ממצא 5) - שם מוחזרות רק משמרות שנכנסו באותו יום.

export async function loadStaffOnShift(ctx) {
  const range = dayRange(ctx.dayKey);
  const isToday = ctx.dayKey === ctx.todayKey;
  const shifts = await prisma.shift.findMany({
    where: {
      isDeleted: false,
      OR: [
        { entryTime: { gte: range.start, lte: range.end } },
        ...(isToday ? [{ exitTime: null, entryTime: { gte: new Date(range.start.getTime() - DAY_MS), lte: range.end } }] : []),
      ],
    },
    select: {
      id: true, employeeId: true, entryTime: true, exitTime: true,
      employee: { select: { firstName: true, lastName: true, fullName: true } },
    },
    orderBy: { entryTime: 'asc' },
    take: 200,
  });
  return shifts
    .filter((s) => s.entryTime)
    .map((s) => ({
      employeeId: s.employeeId,
      name: s.employee?.fullName || [s.employee?.firstName, s.employee?.lastName].filter(Boolean).join(' ') || 'עובד/ת',
      entryTime: s.entryTime,
      exitTime: s.exitTime || null,
      open: !s.exitTime,
    }));
}
