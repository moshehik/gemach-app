// lib/schedule/barcodeScan.js — רישום ברקוד לפריט הזמנה מהלו״ז (חלונית הברקוד / שורת הסריקה), ביטול רישום, מצב ההזמנה, ומסירה אוטומטית.
// התכנון: docs/schedule-barcode-plan.md (ה' = מקרי הקצה; ב' = המטריצה). מי קורא: app/api/schedule/barcodes/route.js, rentals/confirm, rentals/toggle.
//
// עקרונות:
//   * ההתאמה לפריט: lib/rentalItemMatch.js (אותו כלל כמו rentals/scan); פענוח ברקוד אחד - lib/rentalBarcodeMatch.js. אין פענוח מקביל.
//   * כל כתיבה = update בודד עם תנאי על המצב הצפוי (barcode:null / isTaken:false) + auditAs; P2025 נקרא מחדש ומוכרע (אותו מצב = הצלחה
//     אידמפוטנטית, אחרת 409). אין updateMany, אין AuditLog ידני.
//   * "העובדה" גוברת: שורת מסירה בלו״ז היא "בוצע" כשכל הפריטים הנדרשים נלקחו (isTaken); סימון ScheduleStageMark הוא מי/מתי. לכן כשל בכתיבת הסימון
//     אחרי הפריטים אינו משאיר מצב שקט, ואפשר ללחוץ שוב.
//   * הרישום בהכנה (gate 'register') לא נוגע ב-isTaken; במסירה (gate 'handover') הסריקה רושמת *ולוקחת* (D1). הלקוח שולח intent
//     ('register'|'handover') והשרת מסרב (409 mode_changed) אם ההגדרה השתנתה בינתיים - מטמון ההגדרות הוא 30 שנ׳ לכל אינסטנס.
//   * רישום בהכנה/בסריקה לא מזיז updatedAt של הפריט (נשמר ערכו הקודם): אחרת הוא היה מחדש את חלון העריכה של 15 הדקות ונספר כ"פריט נערך" ב"הזמנות שעודכנו".
import prisma, { auditAs } from '@/app/lib/prisma';
import { getCachedSetting, getAllCachedSettings } from '@/lib/settingsCache';
import { DRAFT_ORDER_STATUS } from '@/lib/orderReservation';
import { filterItemsForBarcode, matchesDifferInAlterations } from '@/lib/rentalItemMatch';
import { loadScheduleSettings } from './settings';
import { computeOrderStages, dayKeyOf } from './orderStages';
import { writeMark, isMissingTableError, isMarksTableKnownMissing, noteMarksTableMissing } from './marks';
import { isValidKey } from './dates';
import {
  HANDOVER_STAGE_BY_KIND, normalizeScannedBarcode, isDressBarcodeFormat, orderKind, gateTypeFor, summarizeItems, evaluateGate, isFeatureOn,
  itemHasBarcode, itemIsRegistered, itemBarcodeOf, itemIsTaken, itemIsDeleted, itemNeedsBarcode, itemModelPrefix, missingItemView,
} from './barcodeEntry';
import { loadItemsByOrder, takeRegisteredItems, summaryOf, findOpenHolders } from './barcodeData';

export class BarcodeError extends Error {
  constructor(status, code, message, extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra || null;
  }
}

const STAGE_LABELS = { prep: 'הכנה', pick: 'איסוף מקומי', dout: 'משלוח הלוך' };
const INTENT_BY_GATE = { register: 'register', handover: 'handover' };

const ORDER_SELECT = {
  orderId: true, isDeleted: true, status: true, isDelivery: true, deliveryDirection: true, deliveryOneDayBefore: true,
  orderDate: true, eventDate: true, fromDate: true, toDate: true, returnDate: true, isAbroad: true,
  customer: { select: { firstName: true, lastName: true } },
};

const modelNameOf = (it) => (it.dressItem && it.dressItem.dress && it.dressItem.dress.name) || it.description || null;

export function itemView(it) {
  return {
    orderItemId: it.id,
    model: modelNameOf(it),
    modelPrefix: itemModelPrefix(it),
    size: it.sizeText || (it.dressItem && it.dressItem.sizeText) || null,
    barcode: itemIsRegistered(it) ? itemBarcodeOf(it) : null,
    registered: itemIsRegistered(it),
    invalid: itemHasBarcode(it) && !itemIsRegistered(it),
    taken: itemIsTaken(it),
    returned: !!(it.isReturned || it.returnDate),
    needsBarcode: itemNeedsBarcode(it),
  };
}

const errFor = (reason) => (reason === 'order_not_found'
  ? new BarcodeError(404, reason, 'ההזמנה לא נמצאה')
  : new BarcodeError(400, reason, 'מספר הזמנה לא תקין'));

/**
 * הקשר ברקוד להזמנה: ההזמנה, פריטיה, הגדרות הלו״ז (כולל ברקוד) וסוג ההזמנה. לא זורק על "לא נמצא" - ok=false + reason.
 * @param {number} orderId
 * @param {object|null} settings  resolveScheduleSettings() (לבדיקות); אחרת נטען מהמטמון
 */
export async function loadBarcodeContext(orderId, settings = null) {
  const id = Number(orderId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, reason: 'bad_order_id' };
  const [order, resolved, itemsMap] = await Promise.all([
    prisma.order.findUnique({ where: { orderId: id }, select: ORDER_SELECT }),
    settings ? Promise.resolve(settings) : loadScheduleSettings(),
    loadItemsByOrder([id]),
  ]);
  if (!order) return { ok: false, reason: 'order_not_found' };
  const kind = orderKind(order);
  const eff = resolved.barcode || { delivery: 'off', local: 'off' };
  const when = eff[kind] || 'off';
  return {
    ok: true, order, settings: resolved, items: itemsMap.get(id) || [], kind, eff, when,
    handoverStage: HANDOVER_STAGE_BY_KIND[kind],
    closed: !!order.isDeleted || order.status === DRAFT_ORDER_STATUS,
  };
}

/** מצב ההזמנה לחלונית (GET). */
export async function getBarcodeState({ orderId, stageKey }, { settings = null } = {}) {
  const ctx = await loadBarcodeContext(orderId, settings);
  if (!ctx.ok) throw errFor(ctx.reason);
  const gate = gateTypeFor(stageKey, ctx.kind, ctx.when);
  const c = ctx.order.customer;
  const live = ctx.items.filter((it) => !itemIsDeleted(it));
  return {
    orderId: ctx.order.orderId,
    customerName: c ? `${c.firstName || ''} ${c.lastName || ''}`.trim() : '',
    stageKey,
    stageLabel: STAGE_LABELS[stageKey] || stageKey,
    kind: ctx.kind,
    when: ctx.when,
    gate,
    intent: INTENT_BY_GATE[gate] || null,
    closed: ctx.closed,
    items: live.map(itemView),
    summary: summaryOf(live),
  };
}

// ---- אילו כללי מלאי חלים על היחידה (העתק מבוקר של רכיב ה-reserve בראוט rentals/scan; בלי עקיפת מנהל - D5) ------------

async function dressUnavailable(barcode) {
  const dress = await prisma.dressItem.findFirst({
    where: { dressBarcode: barcode },
    select: { id: true, isDeleted: true, notInUse: true, inRepair: true, location: true },
  });
  if (!dress) return { code: 'unknown_barcode', status: 404, message: 'ברקוד לא קיים במאגר השמלות' };
  if (dress.isDeleted || dress.notInUse) return { code: 'dress_unavailable', status: 409, message: `הפריט עם ברקוד ${barcode} אינו בשימוש או שבוטל במאגר` };
  if (dress.inRepair) return { code: 'dress_unavailable', status: 409, message: `הפריט עם ברקוד ${barcode} נמצא בתיקון ולא ניתן להשכרה` };
  if (dress.location) {
    const [wh, rs] = await Promise.all([getCachedSetting('inventory_include_warehouse'), getCachedSetting('allow_renting_reserve_items')]);
    const includeWarehouse = !!wh && wh.value === 'true';
    const allowReserve = !!rs && rs.value === 'true';
    const loc = dress.location.toLowerCase();
    const whBlocked = !includeWarehouse && (loc.includes('מחסן') || loc.includes('warehouse'));
    const rsBlocked = !allowReserve && (loc.includes('רזרבה') || loc.includes('reserve'));
    if (whBlocked || rsBlocked) {
      return { code: 'reserved_location', status: 409, message: `הפריט עם ברקוד ${barcode} נמצא ב"${dress.location}" (רזרבה/מחסן) ולא ניתן להשכרה. אישור מנהל - דרך כרטיס ההזמנה.` };
    }
  }
  return null;
}

/** בדיקת "פתוח בהזמנה אחרת" - משותפת לדיאלוג ולמסלולי הכתיבה הישנים (rentals/toggle, rentals/scan) כשההגדרה פעילה. null = פנוי. */
export async function openElsewhereError(barcode, { orderId, exceptItemId = null, now = new Date() } = {}) {
  const holders = (await findOpenHolders(barcode, { exceptItemId })).filter((h) => h.orderId !== orderId);
  if (!holders.length) return null;
  const taken = holders.find((h) => h.isTaken || h.takenDate);
  if (taken) {
    return new BarcodeError(409, 'taken_elsewhere', `השמלה הזו עדיין מושכרת בהזמנה ${taken.orderId} ולא הוחזרה. החזרה/אישור מנהל - דרך כרטיס ההזמנה.`, { otherOrderId: taken.orderId });
  }
  const o = holders[0];
  const stale = !!(o.eventDate && new Date(o.eventDate).getTime() < now.getTime() - 24 * 3600 * 1000);
  return new BarcodeError(409, 'prepped_elsewhere', `הברקוד הזה כבר נרשם בהכנה להזמנה ${o.orderId}.${stale ? ' האירוע שלה עבר - אפשר לשחרר את הרישום בכרטיס ההזמנה שלה.' : ''}`, { otherOrderId: o.orderId, stale });
}

async function rereadItem(id) {
  return prisma.orderItem.findUnique({ where: { id }, select: { id: true, barcode: true, barcodeInvalid: true, barcodeInvalidHandled: true, isTaken: true, takenDate: true, isDeleted: true } });
}

/**
 * רישום ברקוד אחד לפריט המתאים בהזמנה.
 * @param {object} p
 * @param {'register'|'handover'} [p.intent]  מה הלקוח חושב שהסריקה עושה; לא תואם להגדרה העדכנית => 409 mode_changed
 * @returns {Promise<{status: 'registered'|'taken'|'already'|'ambiguous', item?: object, options?: object[], items: object[], summary: object, handover?: object, takenIds?: string[]}>}
 * @throws {BarcodeError}
 */
export async function registerBarcode({ orderId, barcode: rawBarcode, stageKey, dayKey = null, itemId = null, intent = null, user, source = 'schedule_dialog', now = new Date(), settings = null }) {
  if (!user || !user.id) throw new BarcodeError(401, 'unauthorized', 'יש להתחבר כדי לסרוק ברקוד');
  const barcode = normalizeScannedBarcode(rawBarcode);
  if (!barcode || !isDressBarcodeFormat(barcode)) throw new BarcodeError(400, 'invalid_format', 'ברקוד לא תקין - נדרשות ספרות בלבד (7 ספרות)');
  const ctx = await loadBarcodeContext(orderId, settings);
  if (!ctx.ok) throw errFor(ctx.reason);
  if (ctx.closed) throw new BarcodeError(409, 'order_closed', 'ההזמנה מבוטלת או טיוטה - אי אפשר לרשום בה ברקוד');
  if (ctx.when === 'off') throw new BarcodeError(409, 'feature_off', 'רישום ברקוד בלו״ז כבוי בהגדרות');
  const gate = gateTypeFor(stageKey, ctx.kind, ctx.when);
  if (gate === 'none') throw new BarcodeError(409, 'stage_mismatch', 'השלב הזה לא דורש רישום ברקוד לסוג ההזמנה הזו');
  if (intent && INTENT_BY_GATE[gate] !== intent) throw new BarcodeError(409, 'mode_changed', 'הגדרת הברקוד השתנתה - רעננו את החלונית', { intent: INTENT_BY_GATE[gate] });
  const oid = ctx.order.orderId;
  const live = ctx.items.filter((it) => !itemIsDeleted(it));

  // 1. הברקוד כבר רשום בפריט בהזמנה הזו: אידמפוטנטי. במסירה - סריקת אימות לוקחת את הפריט הרשום.
  const holder = live.find((it) => itemIsRegistered(it) && itemBarcodeOf(it) === barcode);
  if (holder) {
    if (gate === 'handover' && !itemIsTaken(holder)) return writeAndFinish({ ctx, itemRow: holder, barcode, gate, stageKey, dayKey, user, source, now, via: 'verify' });
    return { status: 'already', item: itemView(holder), items: live.map(itemView), summary: summaryOf(live) };
  }

  // 2. יחידה במאגר: קיימת, בשימוש, לא בתיקון, לא רזרבה/מחסן חסומים
  const bad = await dressUnavailable(barcode);
  if (bad) throw new BarcodeError(bad.status, bad.code, bad.message);

  // 3. הברקוד פתוח בהזמנה אחרת (לא נמחק, לא הוחזר, ההזמנה לא מבוטלת)
  const elsewhere = await openElsewhereError(barcode, { orderId: oid, now });
  if (elsewhere) throw elsewhere;

  // 4. הפריט המתאים בהזמנה (קידומת + מידה, פריט שעוד לא נרשם לו ברקוד תקף)
  const free = live.filter((it) => !itemIsRegistered(it));
  const matching = filterItemsForBarcode(free, barcode);
  if (!matching.length) {
    const sameModelFull = filterItemsForBarcode(live, barcode).length > 0;
    throw new BarcodeError(404, 'not_in_order', sameModelFull
      ? 'כל הפריטים מהדגם והמידה האלה בהזמנה כבר נסרקו'
      : 'הפריט לא קיים בהזמנה. אם הלקוחה מחליפה דגם/מידה - לעדכן את הפריט בכרטיס ההזמנה ואז לסרוק.');
  }
  let chosen = matching[0];
  if (itemId) {
    const forced = matching.find((it) => it.id === itemId);
    if (!forced) throw new BarcodeError(409, 'invalid_choice', 'הפריט שנבחר אינו בין הפריטים המתאימים לברקוד');
    chosen = forced;
  } else if (matching.length > 1 && matchesDifferInAlterations(matching)) {
    return { status: 'ambiguous', options: matching.map(itemView), items: live.map(itemView), summary: summaryOf(live) };
  }
  return writeAndFinish({ ctx, itemRow: chosen, barcode, gate, stageKey, dayKey, user, source, now, via: 'assign' });
}

// via 'assign' = רישום הברקוד בפריט (בהכנה בלבד; במסירה גם לקיחה); via 'verify' = הפריט כבר רשום והמסירה לוקחת אותו
async function writeAndFinish({ ctx, itemRow, barcode, gate, dayKey, user, source, now, via }) {
  const take = gate === 'handover';
  const oid = ctx.order.orderId;
  const writesTaken = take && !itemIsTaken(itemRow);
  const hadBarcode = itemHasBarcode(itemRow); // ברקוד "לא תקין" שנרשם קודם (rentals/scan) - מוחלף
  const changes = {
    barcode: { from: itemRow.barcode || null, to: barcode },
    ...(writesTaken ? { isTaken: { from: false, to: true }, takenDate: { from: itemRow.takenDate || null, to: now } } : {}),
    ...(itemRow.barcodeInvalid ? { barcodeInvalid: { from: true, to: false } } : {}),
    orderId: oid,
    stage: take ? 'handover' : 'prep',
    source,
    ...(via === 'verify' ? { verify: true } : {}),
    note: take ? 'רישום ולקיחה במסירה (חלונית הלו״ז)' : 'רישום בהכנה (חלונית הלו״ז)',
  };
  let status = take ? 'taken' : 'registered';
  const takenIds = [];
  if (via === 'assign') {
    try {
      await prisma.orderItem.update(auditAs(
        writesTaken ? 'CONFIRM_RENTAL' : 'REGISTER_BARCODE',
        {
          where: { id: itemRow.id, barcode: hadBarcode ? itemRow.barcode : null, isDeleted: false },
          data: {
            barcode,
            ...(itemRow.barcodeInvalid ? { barcodeInvalid: false } : {}),
            ...(writesTaken ? { isTaken: true, takenDate: now } : { updatedAt: itemRow.updatedAt }), // רישום בלבד לא מחדש את חלון העריכה / "הזמנות שעודכנו"
          },
          select: { id: true },
        },
        changes,
      ));
      if (writesTaken) takenIds.push(itemRow.id);
    } catch (e) {
      if (e && e.code === 'P2002') throw new BarcodeError(409, 'race', 'הברקוד נרשם באותו רגע גם בפריט אחר - סרקו שוב.', { itemId: itemRow.id });
      if (e && e.code === 'P2025') {
        const cur = await rereadItem(itemRow.id);
        if (cur && !cur.isDeleted && String(cur.barcode || '').trim() === barcode) {
          const items = ((await loadItemsByOrder([oid])).get(oid) || []);
          return { status: 'already', item: itemView(items.find((i) => i.id === itemRow.id) || itemRow), items: items.map(itemView), summary: summaryOf(items) };
        }
        throw new BarcodeError(409, 'race', 'הפריט כבר נסרק על ידי עובדת אחרת - רעננו את החלונית', { itemId: itemRow.id });
      }
      throw e;
    }
    // כתיבה-ואימות: אותו ברקוד לא יושב בשני פריטים פתוחים. מי שהגיע שנייה מבטל את הרישום שלו (במקרה תיקו שתיהן מבוטלות - בטוח).
    const holders = await findOpenHolders(barcode);
    if (holders.length > 1) {
      try {
        await prisma.orderItem.update(auditAs(
          'CANCEL_SCAN',
          { where: { id: itemRow.id, barcode }, data: { barcode: hadBarcode ? itemRow.barcode : null, ...(writesTaken ? { isTaken: false, takenDate: itemRow.takenDate || null } : {}) }, select: { id: true } },
          { barcode: { from: barcode, to: hadBarcode ? itemRow.barcode : null }, orderId: oid, note: 'בוטל: אותו ברקוד נרשם במקביל לפריט אחר' },
        ));
      } catch (e) {
        console.error('schedule barcode: rollback of duplicate registration failed', e);
      }
      throw new BarcodeError(409, 'race', 'הברקוד נרשם באותו רגע גם בפריט אחר - הרישום בוטל. סרקו שוב.', { itemId: itemRow.id });
    }
  } else if (writesTaken) {
    // verify: הברקוד כבר רשום בפריט - רק לוקחים אותו (תנאי isTaken:false + אותו ברקוד)
    try {
      await prisma.orderItem.update(auditAs(
        'CONFIRM_RENTAL',
        { where: { id: itemRow.id, isTaken: false, isDeleted: false, barcode }, data: { isTaken: true, takenDate: now }, select: { id: true } },
        changes,
      ));
      takenIds.push(itemRow.id);
    } catch (e) {
      if (!(e && e.code === 'P2025')) throw e; // נלקח / בוטל במקביל - אידמפוטנטי
    }
  }
  let items = ((await loadItemsByOrder([oid])).get(oid) || []);
  let sum = summarizeItems(items);
  let handover = null;
  if (take && sum.requiredAllTaken) {
    // כל הנדרשים נלקחו: פריטים פטורים מברקוד נלקחים איתם (אחרת ההזמנה נשארת "חלקית"), ואז המסירה נרשמת
    const t = await takeRegisteredItems({ orderId: oid, now, note: 'מסירה מהלו״ז - השלמת הפריטים הפטורים מברקוד', source });
    takenIds.push(...t.taken);
    items = t.items;
    sum = summarizeItems(items);
    if (sum.allTaken) handover = await completeHandover({ ctx, items, dayKey, user, now });
  }
  if (via === 'verify' && !writesTaken) status = 'already';
  return { status, item: itemView(items.find((i) => i.id === itemRow.id) || itemRow), items: items.map(itemView), summary: summaryOf(items), ...(handover ? { handover } : {}), takenIds };
}

/** ביטול רישום של פריט שעוד לא נלקח: barcode -> null + CANCEL_SCAN. */
export async function releaseBarcode({ orderId, itemId, user, now = new Date(), settings = null }) {
  if (!user || !user.id) throw new BarcodeError(401, 'unauthorized', 'יש להתחבר');
  const ctx = await loadBarcodeContext(orderId, settings);
  if (!ctx.ok) throw errFor(ctx.reason);
  const it = ctx.items.find((x) => x.id === itemId);
  if (!it) throw new BarcodeError(404, 'item_not_found', 'הפריט לא נמצא בהזמנה');
  const live = ctx.items.filter((x) => !itemIsDeleted(x));
  if (!itemHasBarcode(it)) {
    return { status: 'already', items: live.map(itemView), summary: summaryOf(live) };
  }
  if (itemIsTaken(it)) throw new BarcodeError(409, 'already_taken', 'הפריט כבר נלקח - לביטול יש לבטל קודם את המסירה');
  try {
    await prisma.orderItem.update(auditAs(
      'CANCEL_SCAN',
      { where: { id: it.id, isTaken: false, barcode: itemBarcodeOf(it) }, data: { barcode: null, updatedAt: it.updatedAt }, select: { id: true } },
      { barcode: { from: itemBarcodeOf(it), to: null }, orderId: ctx.order.orderId, note: 'ביטול רישום ברקוד מהלו״ז' },
    ));
  } catch (e) {
    if (!(e && e.code === 'P2025')) throw e;
  }
  const items = ((await loadItemsByOrder([ctx.order.orderId])).get(ctx.order.orderId) || []);
  return { status: 'released', items: items.map(itemView), summary: summaryOf(items) };
}

// ---- מסירה אוטומטית --------------------------------------------------------------------------------------

async function getAllSettingsMap() {
  try {
    const rows = await getAllCachedSettings();
    const map = {};
    for (const r of rows || []) if (r && r.key) map[r.key] = r.value;
    return map;
  } catch {
    return {};
  }
}
const intOr = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; }; // 0 הוא ערך תקף (autoPrepMark.js משתמש ב-||1 ומסלף אותו)

async function scheduledDayKey(ctx, items, stage, now) {
  const rows = await getAllSettingsMap();
  const delivery = { daysBefore: intOr(rows.delivery_days_before, 1), daysAfter: intOr(rows.delivery_days_after, 1), skipWeekends: rows.delivery_skip_weekends === 'true' };
  const { stages } = computeOrderStages({ ...ctx.order, items }, { schedule: ctx.settings, delivery, marks: [], todayKey: dayKeyOf(now) });
  const s = stages.find((x) => x.key === stage);
  return s ? s.dayKey : null;
}

/**
 * כל הפריטים נלקחו -> סימון המסירה (pick / dout) = מי/מתי. אידמפוטנטי; סימון קיים (בכל יום) = לא נוגעים. נכשל בשקט כשהטבלה חסרה.
 * "העובדה" (isTaken) כבר נשמרה, ולכן כשל כאן לא משאיר מצב שקט: השורה "בוצע" לפי העובדה והסימון נוצר בלחיצה/לקיחה הבאה.
 * @returns {Promise<{marked: boolean, stageKey: string, dayKey?: string, reason?: string}>}
 */
export async function completeHandover({ ctx, items, dayKey = null, user, now = new Date() }) {
  const stage = ctx.handoverStage;
  try {
    if (isMarksTableKnownMissing()) return { marked: false, stageKey: stage, reason: 'no-table' };
    const existing = await prisma.scheduleStageMark.findFirst({ where: { orderId: ctx.order.orderId, stageKey: stage, done: true }, select: { id: true, dayKey: true } });
    if (existing) return { marked: false, stageKey: stage, dayKey: existing.dayKey, reason: 'exists' };
    const day = dayKey && isValidKey(dayKey) ? dayKey : await scheduledDayKey(ctx, items, stage, now);
    if (!day) return { marked: false, stageKey: stage, reason: 'no-stage' };
    await writeMark({ orderId: ctx.order.orderId, stageKey: stage, dayKey: day, wanted: true, outcome: null, source: 'auto', userId: user && user.id ? user.id : null, now, stageLabel: STAGE_LABELS[stage], extraChanges: { trigger: 'barcode_complete' } });
    return { marked: true, stageKey: stage, dayKey: day };
  } catch (e) {
    if (isMissingTableError(e)) { noteMarksTableMissing(); return { marked: false, stageKey: stage, reason: 'no-table' }; }
    console.error('schedule barcode: auto handover mark failed (items are saved; the row is done by the items)', e);
    return { marked: false, stageKey: stage, reason: 'error' };
  }
}

/**
 * נקרא אחרי לקיחה בכל מסלול (rentals/toggle rent, rentals/confirm): כשהגדרת הברקוד לסוג ההזמנה פעילה וכל הפריטים נלקחו - המסירה נרשמת.
 * כבוי (ברירת מחדל) = לא עושה כלום ובלי שאילתות. לעולם לא זורק.
 */
export async function autoMarkHandoverForOrder(orderId, { now = new Date(), userId = null } = {}) {
  try {
    const resolved = await loadScheduleSettings();
    if (!isFeatureOn(resolved.barcode)) return { status: 'off' };
    const ctx = await loadBarcodeContext(orderId, resolved);
    if (!ctx.ok || ctx.closed || ctx.when === 'off') return { status: 'off' };
    const live = ctx.items.filter((it) => !itemIsDeleted(it));
    if (!summarizeItems(live).allTaken) return { status: 'not-all-taken' };
    const r = await completeHandover({ ctx, items: live, user: userId ? { id: userId } : null, now });
    return { status: r.marked ? 'marked' : r.reason || 'skipped' };
  } catch (e) {
    console.error('autoMarkHandoverForOrder failed (rental action unaffected):', e);
    return { status: 'error' };
  }
}

/**
 * נקרא אחרי ביטול לקיחה של פריט (rentals/toggle undoRent, rentals/cancel): אם ההזמנה כבר לא "נמסרה במלואה" והמסירה סומנה - הסימון מתבטל (H8).
 * כבוי = לא עושה כלום. לעולם לא זורק. (התצוגה בלו״ז נשענת על העובדה, לכן הסימון הישן לא מטעה גם אם הפעולה הזו נכשלת.)
 */
export async function autoUnmarkHandoverForOrder(orderId, { now = new Date(), userId = null } = {}) {
  try {
    const resolved = await loadScheduleSettings();
    if (!isFeatureOn(resolved.barcode)) return { status: 'off' };
    const ctx = await loadBarcodeContext(orderId, resolved);
    if (!ctx.ok || ctx.when === 'off') return { status: 'off' };
    const live = ctx.items.filter((it) => !itemIsDeleted(it));
    if (summarizeItems(live).allTaken) return { status: 'still-all-taken' };
    if (isMarksTableKnownMissing()) return { status: 'no-table' };
    const marks = await prisma.scheduleStageMark.findMany({ where: { orderId: ctx.order.orderId, stageKey: ctx.handoverStage, done: true }, select: { id: true, dayKey: true } });
    for (const m of marks) {
      await writeMark({ orderId: ctx.order.orderId, stageKey: ctx.handoverStage, dayKey: m.dayKey, wanted: false, outcome: null, source: 'auto', userId, now, stageLabel: STAGE_LABELS[ctx.handoverStage], extraChanges: { trigger: 'item_untaken' } });
    }
    return { status: marks.length ? 'unmarked' : 'none' };
  } catch (e) {
    if (isMissingTableError(e)) { noteMarksTableMissing(); return { status: 'no-table' }; }
    console.error('autoUnmarkHandoverForOrder failed (rental action unaffected):', e);
    return { status: 'error' };
  }
}

/**
 * האם ההגדרה פעילה להזמנה (לשימוש מסלולי הכתיבה הישנים: toggle / confirm). null = כבוי (ברירת מחדל) - הקורא ממשיך בדיוק כמו היום, בלי שאילתה על ההזמנה.
 * @returns {Promise<null|{when: string, kind: string, closed: boolean, handoverStage: string, eff: object, order: object}>}
 */
export async function barcodeFeatureFor(orderId, settings = null) {
  const resolved = settings || await loadScheduleSettings();
  if (!isFeatureOn(resolved.barcode)) return null;
  const id = Number(orderId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const order = await prisma.order.findUnique({ where: { orderId: id }, select: ORDER_SELECT });
  if (!order) return null;
  const kind = orderKind(order);
  const when = resolved.barcode[kind] || 'off';
  if (when === 'off') return null;
  return { when, kind, eff: resolved.barcode, order, handoverStage: HANDOVER_STAGE_BY_KIND[kind], closed: !!order.isDeleted || order.status === DRAFT_ORDER_STATUS };
}

/**
 * בדיקת שלמות לפני אישור לקיחה בחלון ההשכרה הישן (rentals/confirm): כשההגדרה פעילה - כל הפריטים הנדרשים חייבים להיות עם ברקוד.
 * @returns {Promise<null|{error: string, needBarcodes: true, missing: object[]}>} null = מותר להמשיך
 */
export async function checkHandoverGate(orderId, settings = null) {
  const f = await barcodeFeatureFor(orderId, settings);
  if (!f) return null;
  const items = (await loadItemsByOrder([f.order.orderId])).get(f.order.orderId) || [];
  const g = evaluateGate({ stageKey: f.handoverStage, order: f.order, items, eff: f.eff });
  if (!g.applies || g.ok) return null;
  return {
    error: `חסרים ${g.missing.length} ברקודים בהזמנה - יש לסרוק ברקוד לכל שמלה לפני אישור המסירה`,
    needBarcodes: true,
    missing: g.missing.map((it) => missingItemView(it)),
  };
}

export { takeRegisteredItems, missingItemView };
