// Order-card history feed: turns the raw rows that describe one order (AuditLog rows of the order,
// its items, payments, refunds and charges, plus the tables themselves and the e-mail / print logs)
// into ONE chronological list shaped like the A5 order history expects:
//
//   { id, ts, day, time, dateHe, weekdayHe, cat, icon, text, sub?, who, whoKnown, amt?, kind?,
//     det: [[label, value], ...], action, entityType, src, ...flags }
//
// Pure module: no React, no Prisma, no path aliases - the API route
// (app/api/orders/[id]/history/route.js) does the reading, this file only maps. The only imports are
// lib/hebrewDate.js (Hebrew calendar, needs @hebcal/core) and lib/history/labels.js (shared wording),
// both written with explicit ".js" so a plain `node scripts/order-history.test.mjs` can load it.
//
// What the AuditLog really holds (app/lib/prisma.js, verified 2026-09-29):
//   * an automatic UPDATE row stores ONLY the values that were written (`originalArgs.data`), never
//     the values they replaced; an order save writes the whole field list every time, so one row =
//     one save with every field in it, changed or not;
//   * `auditAs(action, args, changes)` rows and a few hand-written rows store `{field:{from,to}}`;
//   * automatic rows of an Order sit under its UUID, hand-written ones under its number;
//   * an OrderItem / Payment / PaymentObligation / Refund row sits under that record's own id and
//     carries no order id, so the route asks for them by the ids it read from the order first.
// The mapper handles BOTH shapes. For a new-values-only row the "before" comes, in this order, from
// (1) an explicit {from,to}, (2) the value the SAME record's earlier audit row wrote (`beforeSource:
// 'sequence'`, taken from its CREATE row or the previous save), or (3) nowhere - then the entry says
// `beforeUnknown: true` and no "before" is invented. A field that equals what the previous row wrote
// is not a change and produces no line (counted in `noopCount`).
//
// Nothing is dropped silently. Counters in the result:
//   dedupedCount / dedupedBy   rows / lines that describe an event another row already describes
//                              (rules D1-D7 below), with the rule that removed them;
//   noopCount                  UPDATE rows in which no field differs from the previous write;
//   hiddenSystemCount          entries flagged `system: true` (engine bookkeeping such as automatic
//                              charge recalculation) that are left out unless includeSystem is set;
//   unmappedCount              rows whose action has no specific wording (shown with a generic line).
//
// Dedupe rules (window DEDUPE_WINDOW_MS, same order):
//   D1 CANCEL_ORDER is written twice by DELETE /api/orders/[id] (automatic row under the UUID + a
//      hand-written one under the order number, route.js:1137 and :1157) - keep the hand-written row
//      (it carries the note with the item / charge counts), drop the other.
//   D2 the same route writes one CANCEL_ORDER row per item and per charge (updateMany) - folded into
//      the order-level line (its `det` says how many).
//   D3 refunds/[id] hand-writes an order-level ADD_PAYMENT next to the automatic Payment CREATE of the
//      reverse payment - drop the ADD_PAYMENT when a matching refund payment exists.
//   D4 refunds/[id] hand-writes REMOVE_PAYMENT next to the automatic Payment UPDATE {isDeleted:true} -
//      drop the REMOVE_PAYMENT when that row exists for the same payment.
//   D5 a Refund EXECUTE row (or the automatic Refund UPDATE {isExecuted:true}) next to the refund
//      payment it created - drop it, the payment line carries the money.
//   D6 the same item / payment / charge / refund line twice within the window (older code wrote a
//      generic row AND a detailed one for one edit) - keep the row that has an explicit before.
//      Cancel / restore lines (CANCEL_* / RESTORE_* actions and isDeleted flips) are never merged: a
//      remove / restore / remove inside the window is three real events. One exception (ORD-2): the old
//      double write - a generic UPDATE {isDeleted} next to the named CANCEL_ITEM / CANCEL_PAYMENT / ... row
//      of the same record within GENERIC_FLIP_WINDOW_MS (1 s), same wording and amount - drops the generic
//      flip, strictly one-to-one (the named row stays).
//      D1 is not applied across a restore: cancel / restore / cancel inside the window keeps both cancels.
//   D7 the order total written by the client's save and put back by the pricing engine in the same
//      request (route.js:665 then :909): the pair nets to zero, both lines dropped (window
//      TOTAL_REVERT_WINDOW_MS). A real total change (no revert) is kept.
//
// Sanitising (shared with the customer feed: lib/history/sanitize.js): every entity is read through an
// allow-list of fields, so nothing outside it can reach
// the feed. Never included: credit-card / Nedarim JSON (only "ספרות NNNN" and the instalment count),
// bank name / branch / account / holder / payment details / refund e-mail (a bank-details edit says so
// without values), Order.hokDetails (standing-order JSON), any UUID (employee, customer, item ids),
// Drive links of a sent e-mail (only file names). Every free-text field (notes of an item / rental, charge
// descriptions, mail subjects) masks card numbers and an ID / account number behind its keyword (ת.ז / ח-ן /
// חשבון / IBAN); order notes and internal notes use safeNoteText, which keeps phone and house numbers.
// Order e-mail recipient and delivery address stay:
// the current history tab already prints them. Text that came from a charge description is stripped
// of "(פריט #<id>)" tails.

//
// W6 (new order card, 2026-10-04) - the read side of PLAN §C.4:
//   * order events written by W0 (lib/history/orderEvents.js): ORDER_PRINTED, ORDER_PDF_DOWNLOADED,
//     ORDER_XLSX_EXPORTED, HISTORY_EXPORTED, MANAGER_APPROVAL, EMAIL_FAILED, the enriched EMAIL_SENT - each
//     with its own Hebrew line in the "docs" category ("הודפס סיכום הזמנה", "אישור מנהל: <שם> · <סיבה>" ...);
//     the approver is shown by NAME only (meta.approverName, added by attachEmployeeNames), never the id;
//   * D8  MANAGER_APPROVAL{feature:debt_approval} + DEBT_APPROVED within DEBT_MERGE_WINDOW_MS = one line;
//   * D9  the old PageVisitLog print line next to an ORDER_PRINTED row (same order, PRINT_VISIT_WINDOW_MS) is
//         dropped - the typed row says which document was printed;
//   * D10 a failed-mail EmailLog row next to its EMAIL_FAILED audit row is dropped (one line per failure);
//   * schedule "done" marks (entityType ScheduleStageMark, SCHEDULE_STAGE_DONE / _UNDONE) -> "סומן 'בוצע' בלו״ז · <שלב>";
//   * a customer swap (customerId {from,to}) -> "הוחלף לקוח" with the customer NAMES (input.customers);
//   * ALTERATION_UNDONE (schedule un-mark of repairs) is mapped;
//   * searchEntries(entries, q) - the feed search (text, details, who, Hebrew date, time).
// KNOWN_ACTIONS lists every action this mapper words specifically; the coverage test asserts unmappedCount 0.

import { getHebrewDateString, toIsraelCalendarDate } from '../hebrewDate.js';
import { formatMoney, isEmptyValue, paymentMethodPhrase, paymentMethodIcon, isUuidShaped } from './labels.js';
import { cleanText, redactFreeText, safePaymentNote, safeNoteText, safeMailError } from './sanitize.js';
import { getCatalogItem } from '../permissionsMetadata.js';
import { SCHEDULE_SHEET_LABELS } from './orderEvents.js';

export const DEDUPE_WINDOW_MS = 5000;
export const TOTAL_REVERT_WINDOW_MS = 15000;
export const GENERIC_FLIP_WINDOW_MS = 1000; // generic UPDATE {isDeleted} + its named CANCEL_* twin (ORD-2)
export const DEBT_MERGE_WINDOW_MS = 2 * 60 * 1000; // D8: MANAGER_APPROVAL(debt) + DEBT_APPROVED (PLAN §C.4)
export const PRINT_VISIT_WINDOW_MS = 15000; // D9: PageVisitLog print line vs the ORDER_PRINTED row of the same load
// the filter category of the schedule-stage mark lines ("סומן 'בוצע' בלו״ז"): the owner's decision (W6-MARK, 2026-10-04) is a NEW
// general category "כללי" ('gen') - neither "מסמכים" nor "פריטים". This is the ONE place to change (the C.6 coverage test reads it
// from here). F2 (owner, 2026-10-05): 'gen' = the schedule marks AND every other order-level row that belongs to no other filter -
// order creation / cancel / restore, status, notes (public + internal), order-detail saves, customer swap, manager approvals and
// "unsaved changes discarded" (all use GENERAL_CAT below).
export const SCHEDULE_MARK_CAT = 'gen';
export const GENERAL_CAT = 'gen';
export const EMAIL_FAIL_WINDOW_MS = 60000; // D10: EmailLog error vs its EMAIL_FAILED audit row

// Every action the mapper words specifically, per entity (anything else gets a generic "פעולה: X" line and
// counts in unmappedCount). The coverage test (scripts/order-card-tests/history.coverage.test.mjs) runs each.
export const KNOWN_ACTIONS = Object.freeze({
  Order: ['CREATE', 'UPDATE', 'UPDATE_ORDER', 'CANCEL_ORDER', 'RESTORE_ORDER', 'DEBT_APPROVED', 'CANCEL_DEBT_APPROVAL', 'CANCEL_CHANGES',
    'EMAIL_SENT', 'EMAIL_FAILED', 'ADD_PAYMENT', 'REMOVE_PAYMENT', 'ORDER_PRINTED', 'ORDER_PDF_DOWNLOADED', 'ORDER_XLSX_EXPORTED',
    'HISTORY_EXPORTED', 'MANAGER_APPROVAL'],
  OrderItem: ['CREATE', 'UPDATE', 'CANCEL_ITEM', 'RESTORE_ITEM', 'CONFIRM_RENTAL', 'RETURN_RENTAL', 'CANCEL_RENTAL', 'CANCEL_RETURN',
    'RETURN_CONDITION', 'CANCEL_SCAN', 'BARCODE_INVALID', 'ALTERATION_DONE', 'ALTERATION_UNDONE', 'CANCEL_ORDER'],
  Payment: ['CREATE', 'UPDATE', 'CANCEL_PAYMENT', 'RESTORE_PAYMENT'],
  PaymentObligation: ['CREATE', 'UPDATE', 'CANCEL_OBLIGATION', 'RESTORE_OBLIGATION', 'DELETE', 'CANCEL_ORDER'],
  Refund: ['CREATE', 'UPDATE', 'EXECUTE', 'AUTO_CREDIT_REFUND_CREATED', 'AUTO_CREDIT_REFUND_UPDATED', 'AUTO_CREDIT_REFUND_CLEARED'],
  ScheduleStageMark: ['SCHEDULE_STAGE_DONE', 'SCHEDULE_STAGE_UNDONE'],
});

// Document / format words of the order events (same wording as components/modern/changesDisplay.js VALUE_LABELS).
export const EVENT_DOC_LABELS = { order: 'סיכום הזמנה', rental: 'דף השכרה', prep: 'דף הכנה', delivery: 'תעודת משלוח' };
const PRINTED_TEXT = { order: 'הודפס סיכום הזמנה', rental: 'הודפס דף השכרה', prep: 'הודפס דף הכנה', delivery: 'הודפסה תעודת משלוח' };
const EXPORT_FORMAT_LABELS = { xlsx: 'Excel', pdf: 'PDF', print: 'הדפסה' };
const PRINT_SOURCE_LABELS = { 'print-page': 'דף ההדפסה', card: 'כרטיס ההזמנה' };
const MAIL_TYPE_LABELS = { order: 'הזמנה', rental: 'השכרה' };
const ATTACHMENT_KIND_LABELS = { 'order-pdf': 'סיכום הזמנה (PDF)', 'rental-pdf': 'דף השכרה (PDF)', delivery: 'תעודת משלוח', regulations: 'תקנון', payments: 'דף תשלומים', file: 'קובץ' };
const SCHEDULE_STAGE_LABELS = { repair: 'תיקונים', prep: 'הכנה', dout: 'משלוח הלוך', pick: 'איסוף מקומי', manret: 'החזרה ידנית', dback: 'משלוח חזור' };

// Short "what was approved" words for the history line "אישור מנהל: <שם> · <מה>" (the reason the card sends is a
// full sentence - it goes to the details). Unknown keys fall back to the permission catalog label.
export const APPROVAL_SHORT_LABELS = {
  'feature:debt_approval': 'הזמנה ללא תשלום',
  'feature:locked_order_edit': 'עריכת הזמנה נעולה',
  'feature:item_change_approval': 'שינוי פריטים בהזמנה',
  'feature:item_edit_reopen': 'עריכת פריט אחרי 15 דקות',
  'feature:manual_charge_add': 'חיוב ידני',
  'feature:manual_payment_credit_add': 'תשלום / זיכוי ידני',
  'feature:special_spacing_approval': 'שינוי ציפוף ימים',
  'feature:customer_email_approval': 'שליחת מייל ללקוח',
  'feature:barcode_mismatch_override': 'ברקוד שלא תואם להזמנה',
  'feature:early_return_approval': 'החזרה לפני מועד האירוע',
  'feature:reserve_rental_approval': 'השכרה מהרזרבה',
  'feature:warehouse_rental_approval': 'השכרה מהמחסן',
  'feature:payment_exit_approval': 'יציאה בלי תשלום מלא',
  'feature:past_date_order_approval': 'הזמנה לתאריך שעבר',
  'feature:missing_contact_approval': 'לקוח בלי אמצעי קשר נוסף',
  'feature:export_over_limit_approval': 'ייצוא מעל הכמות המרבית',
  'מנהל': 'פעולה באישור מנהל',
  'מתכנת': 'פעולה באישור מנהל',
  'הנהלה ראשית': 'פעולה באישור הנהלה',
  'מנהל סניף ומעלה': 'פעולה באישור מנהל',
};
export function approvalShortLabel(featureKey) {
  if (typeof featureKey !== 'string' || !featureKey) return 'פעולה באישור מנהל';
  if (APPROVAL_SHORT_LABELS[featureKey]) return APPROVAL_SHORT_LABELS[featureKey];
  const item = featureKey.startsWith('feature:') ? getCatalogItem(featureKey) : null;
  return item ? item.label : 'פעולה באישור מנהל';
}

// [id, Hebrew label, icon] - ids are the A5 category ids (HCATS in the order-card sample).
export const ORDER_HISTORY_CATEGORIES = [
  ['items', 'פריטים', 'dress'],
  ['pay', 'תשלומים', 'card'],
  ['del', 'משלוח', 'truck'],
  ['dates', 'תאריכים', 'cal'],
  ['docs', 'מסמכים', 'file'],
  ['gen', 'כללי', 'list'], // W6-MARK: schedule-stage marks (SCHEDULE_MARK_CAT)
];
const CATEGORY_IDS = new Set(ORDER_HISTORY_CATEGORIES.map(c => c[0]));
// Extra filter buckets A5 derives from the row icon (HF_MAP in the sample).
const ICON_BUCKETS = { sig: 'sig', print: 'print', mail: 'mail', fix: 'scissors' };

// ---- Order-specific wording (lib/history/labels.js only knows the customer card) ---------------

export const ORDER_FIELD_LABELS = {
  eventDate: 'תאריך האירוע',
  returnDate: 'תאריך החזרה',
  fromDate: 'מתאריך',
  toDate: 'עד תאריך',
  isAbroad: 'אירוע חו״ל',
  customSpacing: 'ציפוף ימים',
  extraDay: 'יום השכרה נוסף',
  notes: 'הערות להזמנה',
  internalNotes: 'הערות פנימיות',
  isDelivery: 'משלוח',
  deliveryDirection: 'כיוון משלוח',
  deliveryCity: 'עיר משלוח',
  deliveryAddress: 'כתובת משלוח',
  deliveryOneDayBefore: 'משלוח יום לפני האירוע',
  hasSignedRegulations: 'חתימה על תקנון',
  branch: 'סניף',
  pickupBranch: 'סניף איסוף',
  isPhoneOrder: 'הזמנה טלפונית',
  orderDate: 'תאריך ביצוע ההזמנה',
  totalAmount: 'סכום ההזמנה',
  status: 'סטטוס',
  isDeleted: 'ההזמנה בוטלה',
  customerId: 'לקוח',
};
const ORDER_DATE_FIELDS = new Set(['eventDate', 'returnDate', 'fromDate', 'toDate', 'orderDate']);
const ORDER_KNOWN_FIELDS = new Set(Object.keys(ORDER_FIELD_LABELS));
// Fields shown in the "saved, previous values not recorded" line (a null / false / empty value adds nothing).
const ORDER_SNAPSHOT_FIELDS = [
  'eventDate', 'returnDate', 'fromDate', 'toDate', 'isAbroad', 'customSpacing', 'extraDay',
  'isDelivery', 'deliveryDirection', 'deliveryCity', 'deliveryAddress', 'deliveryOneDayBefore',
  'hasSignedRegulations', 'branch', 'pickupBranch', 'isPhoneOrder', 'notes', 'internalNotes', 'totalAmount',
];
// A save row holding at most this many known fields was a targeted write (signature toggle, total
// recalculation, cancel, ...): its fields ARE the change even when the previous value is not recorded.
const TARGETED_ROW_MAX_FIELDS = 3;

const ITEM_FIELD_LABELS = {
  sizeText: 'מידה',
  neckAlteration: 'תיקון צוואר',
  sleeveAlteration: 'תיקון שרוול',
  lengthAlteration: 'תיקון אורך',
  alterationDetails: 'פירוט התיקון',
  alterationDone: 'תיקון בוצע',
  barcode: 'ברקוד',
  isDeleted: 'הפריט בוטל',
  dressItemId: 'היחידה הפיזית',
  description: 'תיאור',
};
const ITEM_KNOWN_FIELDS = new Set(Object.keys(ITEM_FIELD_LABELS));

const DIRECTION_LABELS = { 'הלוך': 'הלוך', 'חזור': 'חזור', 'הלוך-חזור': 'הלוך-חזור' };
const EXTRA_DAY_LABELS = { before: 'יום לפני', after: 'יום אחרי' };

// ---- generic helpers ---------------------------------------------------------------------------

function parseJson(text) {
  if (text && typeof text === 'object') return text;
  if (typeof text !== 'string' || !text) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function isFromTo(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v) && ('from' in v || 'to' in v);
}

// null / undefined / '' are the same "empty"; everything else is compared as text so 1 == '1' and
// an ISO date string equals itself.
function norm(v) {
  if (v === undefined || v === null || v === '') return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
const same = (a, b) => norm(a) === norm(b);

function toDate(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const IL_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
function israelParts(date) {
  const p = {};
  for (const part of IL_PARTS.formatToParts(date)) p[part.type] = part.value;
  return { y: +p.year, m: +p.month, d: +p.day, day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

const WEEKDAYS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];

// Hebrew calendar day of an instant, computed on the ISRAEL calendar day (lib/hebrewDate.js rule) and
// handed to @hebcal as local noon so the server's own timezone cannot move it.
function hebrewDay(date) {
  const d = toDate(date);
  if (!d) return '';
  const anchor = toIsraelCalendarDate(d);
  if (!anchor) return '';
  return getHebrewDateString(new Date(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate(), 12));
}
function weekdayHe(date) {
  const d = toDate(date);
  const anchor = d ? toIsraelCalendarDate(d) : null;
  return anchor ? WEEKDAYS[anchor.getUTCDay()] : '';
}
// "יום ה׳ ..." style line for an event date: weekday + Hebrew date. Never a Gregorian date.
function hebrewFull(date) {
  const h = hebrewDay(date);
  return h ? `${weekdayHe(date)} ${h}` : '';
}

// A schedule day key 'YYYY-MM-DD' (the Israel calendar day) -> its Hebrew date; noon UTC is the same Israel day.
export function hebrewOfDayKey(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return '';
  return hebrewDay(new Date(`${key}T12:00:00Z`));
}
// Notes written by server code may carry a day key ("מהלו״ז היומי (2026-10-05)", lib/schedule/marks.js) - the
// feed shows Hebrew dates only, so every ISO day / instant inside a note is replaced by its Hebrew date.
const ISO_IN_TEXT = /\b(\d{4}-\d{2}-\d{2})(?:T[\d:.]+Z?)?\b/g;
export function hebrewizeDates(text) {
  if (typeof text !== 'string' || !text) return text;
  return text.replace(ISO_IN_TEXT, (m, day) => (m.length > 10 ? hebrewDay(new Date(m)) : hebrewOfDayKey(day)) || m);
}
function noteText(v) {
  return hebrewizeDates(cleanText(v, 200));
}

// Legacy Access imports store date-only values at UTC midnight or at 21:00 / 22:00 UTC (= Israel
// midnight); their time of day carries no information.
function looksDateOnly(date) {
  const d = toDate(date);
  if (!d) return false;
  const h = d.getUTCHours();
  return d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && (h === 0 || h === 21 || h === 22);
}

const money = (n) => formatMoney(n);
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function paymentWords(method, amount, isRefund) {
  const m = String(method || '').trim();
  if (isRefund || (amount !== null && amount < 0)) return { text: `הוחזר ללקוח ${money(Math.abs(amount || 0))}`, icon: 'bank', kind: 'refund' };
  if (amount === 0) return { text: m ? `נרשם: ${m}` : 'נרשם תשלום ללא סכום', icon: 'shield', kind: 'pay' };
  let phrase = paymentMethodPhrase(m);
  let icon = paymentMethodIcon(m);
  if (!phrase) {
    if (/נדרים/.test(m)) { phrase = 'באשראי (נדרים פלוס)'; icon = 'card'; }
    else if (m.startsWith('אשראי')) { phrase = `באשראי${m.length > 5 ? ' ' + m.slice(5).trim() : ''}`; icon = 'card'; }
    else if (!m || m === 'לא ידוע') phrase = '';
    else phrase = `(${m})`;
  }
  return { text: `התקבל תשלום${phrase ? ' ' + phrase : ''}`, icon, kind: 'pay' };
}

// ---- entry building ----------------------------------------------------------------------------

function whoOf(actor) {
  if (!actor) return { who: null, whoKnown: false };
  if (actor.name) return { who: actor.name, whoKnown: true };
  if (actor.employeeId) return { who: 'עובד שנמחק', whoKnown: false };
  return { who: null, whoKnown: false };
}

function makeEntry(base, o) {
  const at = base.at;
  const p = israelParts(at);
  const { who, whoKnown } = whoOf(base.actor);
  const e = {
    id: o.id || base.id,
    ts: at.toISOString(),
    day: p.day,
    time: p.time,
    dateHe: hebrewDay(at),
    weekdayHe: weekdayHe(at),
    cat: o.cat,
    icon: o.icon,
    text: o.text,
    who,
    whoKnown,
    det: (o.det || []).filter(pair => pair && !isEmptyValue(pair[1])),
    action: base.action || null,
    entityType: base.entityType || null,
    src: base.src || 'audit',
  };
  if (o.sub) e.sub = o.sub;
  if (o.amt !== undefined && o.amt !== null && o.amt !== 0) e.amt = o.amt;
  if (o.kind) e.kind = o.kind;
  if (base.dateOnly) e.dateOnly = true;
  if (o.beforeUnknown) e.beforeUnknown = true;
  if (o.beforeSource) e.beforeSource = o.beforeSource;
  if (o.system) e.system = true;
  if (o.auto) e.auto = true;
  if (o.unmapped) e.unmapped = true;
  if (o.unparsed) e.unparsed = true;
  // internal ordering / dedupe keys (removed by publicEntry)
  e._ek = base.entityType && base.entityId ? `${base.entityType}:${base.entityId}` : null;
  if (o.tot) e._tot = o.tot;
  if (o.toggle) e._toggle = true; // a cancel / restore flip: never merged with an identical line (D6)
  e._at = at.getTime();
  e._ord = base.ord ?? 0;
  e._sub = o.subOrd ?? 0;
  return e;
}

// ---- state tracking (the "before" of a new-values-only row) ------------------------------------

class Baselines {
  constructor() { this.map = new Map(); }
  get(key) {
    let s = this.map.get(key);
    if (!s) { s = {}; this.map.set(key, s); }
    return s;
  }
}

// Returns [{field, before, after, src: 'explicit'|'sequence'|'unknown', changed}] for the known fields
// of one row and moves the record's baseline forward. CREATE rows only seed the baseline.
function diffRow(baselines, key, data, { isCreate, known }) {
  const st = baselines.get(key);
  const out = [];
  for (const [field, val] of Object.entries(data)) {
    if (isFromTo(val)) {
      if (known.has(field)) out.push({ field, before: val.from, after: val.to, src: 'explicit', changed: !same(val.from, val.to) });
      st[field] = val.to;
      continue;
    }
    if (isCreate) { st[field] = val; continue; }
    if (!known.has(field)) { st[field] = val; continue; }
    if (field in st) out.push({ field, before: st[field], after: val, src: 'sequence', changed: !same(st[field], val) });
    // a soft-delete flag that is false and has no recorded start is just "not deleted", not a restore
    else if (field === 'isDeleted' && val !== true && val !== 'true') { /* not a change */ }
    else out.push({ field, before: undefined, after: val, src: 'unknown', changed: true });
    st[field] = val;
  }
  return out;
}

// ---- value formatting per field ----------------------------------------------------------------

function fmtOrderValue(field, v) {
  if (isEmptyValue(v)) return field === 'customSpacing' ? 'רגיל' : field === 'extraDay' ? 'ללא' : 'ריק';
  if (ORDER_DATE_FIELDS.has(field)) return hebrewFull(v) || 'ריק';
  if (typeof v === 'boolean') return v ? 'כן' : 'לא';
  if (field === 'totalAmount') return money(v);
  if (field === 'extraDay') return EXTRA_DAY_LABELS[v] || String(v);
  if (field === 'deliveryDirection') return DIRECTION_LABELS[v] || String(v);
  if (field === 'customSpacing') return `${v} ימים`;
  // notes stay readable (phones, house numbers), but a card number and an ID / account number behind its
  // keyword (ת.ז / ח-ן / חשבון / IBAN) are masked (ORD-4)
  if (field === 'notes' || field === 'internalNotes') return safeNoteText(v, 300);
  return cleanText(v);
}

function deliverySummary(city, direction) {
  const parts = [direction && (DIRECTION_LABELS[direction] || direction), city].filter(x => !isEmptyValue(x));
  return parts.join(' · ');
}

// ---- Order rows --------------------------------------------------------------------------------

function orderEntries(ctx, row, diffs, isCreate) {
  const base = row.base;
  const out = [];
  let n = 0;
  const push = (o) => out.push(makeEntry(base, { ...o, id: `${base.id}#${n}`, subOrd: n++ }));

  if (isCreate) {
    const d = row.data;
    const det = [['מס׳ הזמנה', ctx.order ? `#${ctx.order.orderId}` : null]];
    if (d.eventDate) det.push(['תאריך האירוע', hebrewFull(d.eventDate)]);
    if (d.isDelivery) det.push(['משלוח', deliverySummary(d.deliveryCity, d.deliveryDirection) || 'כן']);
    if (!isEmptyValue(d.branch)) det.push(['סניף', cleanText(d.branch, 60)]);
    push({ cat: GENERAL_CAT, icon: 'file', text: 'ההזמנה נוצרה', det });
    return out;
  }

  const changed = diffs.filter(x => x.changed);
  const byField = Object.fromEntries(changed.filter(x => x.src !== 'unknown').map(x => [x.field, x]));
  const unknown = changed.filter(x => x.src === 'unknown');
  const targeted = diffs.length <= TARGETED_ROW_MAX_FIELDS;
  if (targeted) {
    for (const u of unknown) byField[u.field] = u;
  }
  const bsrc = (...fields) => {
    const list = fields.map(f => byField[f]).filter(Boolean);
    if (list.some(x => x.src === 'unknown')) return { beforeUnknown: true, beforeSource: 'unknown' };
    if (list.some(x => x.src === 'sequence')) return { beforeSource: 'sequence' };
    return { beforeSource: 'explicit' };
  };
  const pair = (f) => {
    const c = byField[f];
    if (!c) return [];
    if (c.src === 'unknown') return [['אחרי', fmtOrderValue(f, c.after)]];
    return [['לפני', fmtOrderValue(f, c.before)], ['אחרי', fmtOrderValue(f, c.after)]];
  };

  // cancel / restore through a plain UPDATE (scripts, older code paths); the CANCEL_ORDER action has its own line
  if (byField.isDeleted) {
    const to = byField.isDeleted.after === true || byField.isDeleted.after === 'true';
    push({ cat: GENERAL_CAT, icon: to ? 'alert' : 'undo', text: to ? 'ההזמנה בוטלה' : 'ההזמנה שוחזרה', toggle: true, ...bsrc('isDeleted') });
  }
  if (byField.hasSignedRegulations) {
    const c = byField.hasSignedRegulations;
    const to = c.after === true || c.after === 'true';
    push({ cat: 'docs', icon: 'sig', text: to ? 'הלקוח חתם על התקנון' : 'חתימת התקנון בוטלה', ...bsrc('hasSignedRegulations') });
  }
  // H06 customer swap: shown by the customers' NAMES (input.customers, read by the route) - never the ids
  if (byField.customerId) {
    const c = byField.customerId;
    const nameOf = (id) => (isEmptyValue(id) ? 'ללא לקוח' : (ctx.customers.get(String(id)) || 'לקוח שנמחק'));
    const det = c.src === 'unknown' ? [['לקוח', nameOf(c.after)]] : [['לפני', nameOf(c.before)], ['אחרי', nameOf(c.after)]];
    push({ cat: GENERAL_CAT, icon: 'user', text: 'הוחלף לקוח', sub: isEmptyValue(c.after) ? undefined : nameOf(c.after), det, ...bsrc('customerId') });
  }

  // dates: the event date is the headline; range / return date changes ride along as extra pairs
  const dateFields = ['eventDate', 'returnDate', 'fromDate', 'toDate'].filter(f => byField[f]);
  if (dateFields.length) {
    const head = byField.eventDate ? 'eventDate' : null;
    if (head) {
      const c = byField.eventDate;
      const wasEmpty = c.src !== 'unknown' && isEmptyValue(c.before);
      const det = [...pair('eventDate')];
      for (const f of ['returnDate', 'fromDate', 'toDate']) {
        if (!byField[f]) continue;
        const cc = byField[f];
        det.push([ORDER_FIELD_LABELS[f], cc.src === 'unknown'
          ? fmtOrderValue(f, cc.after)
          : `${fmtOrderValue(f, cc.before)} ← ${fmtOrderValue(f, cc.after)}`]);
      }
      push({
        cat: 'dates', icon: 'cal',
        text: wasEmpty ? 'נקבע תאריך האירוע' : 'עודכן תאריך האירוע',
        sub: hebrewFull(c.after) || undefined,
        det, ...bsrc('eventDate', ...dateFields),
      });
    } else {
      const det = [];
      for (const f of dateFields) {
        const cc = byField[f];
        det.push([ORDER_FIELD_LABELS[f], cc.src === 'unknown' ? fmtOrderValue(f, cc.after) : `${fmtOrderValue(f, cc.before)} ← ${fmtOrderValue(f, cc.after)}`]);
      }
      push({ cat: 'dates', icon: 'cal', text: 'עודכן טווח התאריכים', det, ...bsrc(...dateFields) });
    }
  }
  if (byField.isAbroad) {
    const to = byField.isAbroad.after === true || byField.isAbroad.after === 'true';
    push({ cat: 'dates', icon: 'cal', text: to ? 'האירוע סומן חו״ל' : 'האירוע סומן כאירוע רגיל', det: pair('isAbroad'), ...bsrc('isAbroad') });
  }
  if (byField.customSpacing) push({ cat: 'dates', icon: 'cal', text: 'עודכן ציפוף ימים', det: pair('customSpacing'), ...bsrc('customSpacing') });
  if (byField.extraDay) push({ cat: 'dates', icon: 'cal', text: 'עודכן יום השכרה נוסף', det: pair('extraDay'), ...bsrc('extraDay') });
  if (byField.orderDate) {
    push({ cat: 'dates', icon: 'cal', text: 'עודכן תאריך ביצוע ההזמנה', det: pair('orderDate'), ...bsrc('orderDate') });
  }

  // delivery
  const delFields = ['isDelivery', 'deliveryDirection', 'deliveryCity', 'deliveryAddress', 'deliveryOneDayBefore'].filter(f => byField[f]);
  if (delFields.length) {
    const st = ctx.baselines.get('Order');
    const summary = deliverySummary(st.deliveryCity, st.deliveryDirection);
    if (byField.isDelivery) {
      const on = byField.isDelivery.after === true || byField.isDelivery.after === 'true';
      const det = [];
      const b = byField.isDelivery;
      if (b.src !== 'unknown') det.push(['לפני', on ? 'ללא משלוח' : 'משלוח'], ['אחרי', on ? (summary || 'משלוח') : 'ללא משלוח']);
      push({ cat: 'del', icon: 'truck', text: on ? 'נוסף משלוח' : 'הוסר משלוח', sub: on ? (summary || undefined) : undefined, det, ...bsrc('isDelivery') });
    }
    const other = delFields.filter(f => f !== 'isDelivery');
    if (other.length) {
      const det = other.map(f => {
        const c = byField[f];
        const label = f === 'deliveryOneDayBefore' ? 'יציאת המשלוח' : ORDER_FIELD_LABELS[f];
        const fmt = (v) => f === 'deliveryOneDayBefore' ? (v === true || v === 'true' ? 'יום לפני האירוע' : 'יומיים לפני האירוע') : fmtOrderValue(f, v);
        return [label, c.src === 'unknown' ? fmt(c.after) : `${fmt(c.before)} ← ${fmt(c.after)}`];
      });
      push({ cat: 'del', icon: 'truck', text: 'עודכן משלוח', sub: summary || undefined, det, ...bsrc(...other) });
    }
  }

  if (byField.notes) push({ cat: GENERAL_CAT, icon: 'note', text: 'הערות ההזמנה עודכנו', det: pair('notes'), ...bsrc('notes') });
  if (byField.internalNotes) push({ cat: GENERAL_CAT, icon: 'note', text: 'הערות פנימיות עודכנו', det: pair('internalNotes'), ...bsrc('internalNotes') });

  const misc = ['branch', 'pickupBranch', 'isPhoneOrder'].filter(f => byField[f]);
  if (misc.length) {
    const det = misc.map(f => {
      const c = byField[f];
      return [ORDER_FIELD_LABELS[f], c.src === 'unknown' ? fmtOrderValue(f, c.after) : `${fmtOrderValue(f, c.before)} ← ${fmtOrderValue(f, c.after)}`];
    });
    push({ cat: GENERAL_CAT, icon: 'file', text: 'עודכנו פרטי ההזמנה', det, ...bsrc(...misc) });
  }

  if (byField.totalAmount) {
    const c = byField.totalAmount;
    const a = num(c.after);
    const b = c.src === 'unknown' ? null : num(c.before);
    const delta = a !== null && b !== null ? a - b : undefined;
    push({
      cat: 'pay', icon: 'wallet', text: 'סכום ההזמנה עודכן', sub: a !== null ? money(a) : undefined,
      amt: delta, kind: delta === undefined ? undefined : 'charge', det: pair('totalAmount'), ...bsrc('totalAmount'),
      tot: a !== null && b !== null ? { before: b, after: a } : undefined,
    });
  }
  if (byField.status) {
    push({ cat: GENERAL_CAT, icon: 'file', text: 'סטטוס ההזמנה עודכן', det: pair('status'), system: true, ...bsrc('status') });
  }

  // new-values-only snapshot in which some fields have no recorded previous value: one honest line
  // with the values that were saved instead of a guessed change per field
  if (!targeted && unknown.length) {
    const det = [];
    for (const f of ORDER_SNAPSHOT_FIELDS) {
      const u = unknown.find(x => x.field === f);
      if (!u || isEmptyValue(u.after) || u.after === false) continue;
      det.push([ORDER_FIELD_LABELS[f], fmtOrderValue(f, u.after)]);
    }
    push({
      cat: GENERAL_CAT, icon: 'file', text: 'ההזמנה נשמרה', sub: 'הערכים הקודמים אינם מתועדים ביומן',
      det, beforeUnknown: true, beforeSource: 'unknown', system: det.length === 0,
    });
  }
  return out;
}

// ---- OrderItem rows ----------------------------------------------------------------------------

function itemLabel(ctx, itemId, data) {
  const it = ctx.items.get(itemId) || {};
  const written = data && isFromTo(data.sizeText) ? data.sizeText.to : (data ? data.sizeText : null);
  const size = (!isEmptyValue(written) ? written : it.sizeText) || null;
  const code = it.prefix ?? null;
  const name = it.modelName || null;
  const model = code ? `דגם ${code}` : (name || cleanText(it.description, 40) || 'פריט');
  return size ? `${model}, מידה ${size}` : model;
}

function alterationWords(data) {
  const parts = [];
  if (data.neckAlteration === 1 || data.neckAlteration === '1' || data.neckAlteration === true) parts.push('צוואר');
  if (data.sleeveAlteration === 1 || data.sleeveAlteration === '1' || data.sleeveAlteration === true) parts.push('שרוול');
  if (!isEmptyValue(data.lengthAlteration) && String(data.lengthAlteration) !== '0') parts.push(`אורך ${data.lengthAlteration} ס״מ`);
  return parts.join(', ');
}

function fmtItemValue(field, v) {
  if (isEmptyValue(v)) return 'ריק';
  if (field === 'neckAlteration' || field === 'sleeveAlteration') return v === 1 || v === '1' || v === true ? 'כן' : 'לא';
  if (field === 'alterationDone' || field === 'isDeleted') return v === true || v === 'true' ? 'כן' : 'לא';
  if (field === 'barcode') return String(v).slice(0, 200); // a barcode is a long digit string but never a card number
  return cleanText(v, 200);
}

function itemEntries(ctx, row, diffs, isCreate) {
  const base = row.base;
  const label = itemLabel(ctx, row.entityId, row.data);
  const out = [];
  let n = 0;
  const push = (o) => out.push(makeEntry(base, { ...o, id: `${base.id}#${n}`, subOrd: n++ }));
  const it = ctx.items.get(row.entityId) || {};
  const modelDet = it.modelName ? [['שם הדגם', it.modelName]] : [];
  const codeDet = it.prefix ? [['קוד דגם', String(it.prefix)]] : [];

  switch (row.action) {
    case 'CREATE': {
      const d = row.data;
      const price = num(d.finalPrice) || num(d.price) || 0;
      const alt = alterationWords(d);
      push({
        cat: 'items', icon: 'dress', text: `נוסף פריט: ${label}`, amt: price > 0 ? price : undefined, kind: price > 0 ? 'charge' : undefined,
        det: [...modelDet, ...codeDet, ['תיקון', alt], ['פירוט התיקון', cleanText(d.alterationDetails, 200)]],
      });
      return out;
    }
    case 'CANCEL_ITEM':
      push({ cat: 'items', icon: 'dress', text: `הוסר פריט: ${label}`, det: [...modelDet, ...codeDet], toggle: true });
      return out;
    case 'RESTORE_ITEM':
      push({ cat: 'items', icon: 'undo', text: `שוחזר פריט: ${label}`, det: [...modelDet, ...codeDet], toggle: true });
      return out;
    case 'CONFIRM_RENTAL': {
      const c = parseJson(row.raw) || {};
      const bc = isFromTo(c.barcode) ? c.barcode.to : (row.data.barcode ?? null);
      const td = isFromTo(c.takenDate) ? c.takenDate.to : null;
      push({
        cat: 'items', icon: 'check', text: `נלקח: ${label}`,
        det: [...modelDet, ['ברקוד', bc], ['תאריך לקיחה', td ? hebrewFull(td) : null], ['הערה', noteText(c.note)]],
      });
      return out;
    }
    case 'RETURN_RENTAL': {
      const c = parseJson(row.raw) || {};
      const ok = isFromTo(c.returnedOk) ? c.returnedOk.to : null;
      push({
        cat: 'items', icon: 'check', text: `הוחזר: ${label}`,
        det: [...modelDet, ['מצב בהחזרה', ok === null ? null : (ok ? 'תקין' : 'לא תקין')], ['הערה', noteText(c.note)]],
      });
      return out;
    }
    case 'CANCEL_RENTAL':
      push({ cat: 'items', icon: 'undo', text: `בוטלה ההשכרה: ${label}`, det: [...modelDet, ['הערה', noteText((parseJson(row.raw) || {}).note)]] });
      return out;
    case 'CANCEL_RETURN':
      push({ cat: 'items', icon: 'undo', text: `בוטלה ההחזרה: ${label}`, det: [...modelDet, ['הערה', noteText((parseJson(row.raw) || {}).note)]] });
      return out;
    case 'RETURN_CONDITION': {
      const c = parseJson(row.raw) || {};
      const ok = isFromTo(c.returnedOk) ? c.returnedOk.to : null;
      push({
        cat: 'items', icon: ok === false ? 'alert' : 'check', text: `מצב ההחזרה עודכן: ${label}`,
        sub: ok === null ? undefined : (ok ? 'תקין' : 'לא תקין'), det: [...modelDet, ['הערה', noteText(c.note)]],
      });
      return out;
    }
    case 'CANCEL_SCAN':
      push({ cat: 'items', icon: 'undo', text: `בוטלה סריקת ברקוד שלא אושרה: ${label}`, det: [...modelDet] });
      return out;
    case 'BARCODE_INVALID':
      push({ cat: 'items', icon: 'alert', text: `ברקוד לא תקין סומן: ${label}`, det: [...modelDet] });
      return out;
    case 'ALTERATION_DONE':
      push({ cat: 'items', icon: 'scissors', text: `תיקון סומן כבוצע: ${label}`, det: [...modelDet, ['הערה', noteText((parseJson(row.raw) || {}).note)]] });
      return out;
    case 'ALTERATION_UNDONE': // lib/schedule/marks.js setAlterationsDone (un-mark of the repairs stage)
      push({ cat: 'items', icon: 'scissors', text: `סימון התיקון בוטל: ${label}`, det: [...modelDet, ['הערה', noteText((parseJson(row.raw) || {}).note)]] });
      return out;
    case 'CANCEL_ORDER':
      return out; // folded into the order line (D2) - never reaches here
    default:
      break;
  }

  // UPDATE (order save writes new values; the item edit route writes {from,to})
  const changed = diffs.filter(x => x.changed);
  const known = changed.filter(x => x.src !== 'unknown');
  const unknown = changed.filter(x => x.src === 'unknown');
  const pool = row.data && Object.keys(row.data).length <= TARGETED_ROW_MAX_FIELDS + 2 ? changed : known; // item saves are small
  const by = Object.fromEntries(pool.map(x => [x.field, x]));
  const bsrc = (...fs) => {
    const l = fs.map(f => by[f]).filter(Boolean);
    if (l.some(x => x.src === 'unknown')) return { beforeUnknown: true, beforeSource: 'unknown' };
    if (l.some(x => x.src === 'sequence')) return { beforeSource: 'sequence' };
    return { beforeSource: 'explicit' };
  };
  const p2 = (f) => {
    const c = by[f];
    if (!c) return [];
    return c.src === 'unknown' ? [['אחרי', fmtItemValue(f, c.after)]] : [['לפני', fmtItemValue(f, c.before)], ['אחרי', fmtItemValue(f, c.after)]];
  };

  if (by.isDeleted) {
    const to = by.isDeleted.after === true || by.isDeleted.after === 'true';
    push({ cat: 'items', icon: to ? 'dress' : 'undo', text: `${to ? 'הוסר' : 'שוחזר'} פריט: ${label}`, det: [...modelDet], toggle: true, ...bsrc('isDeleted') });
  }
  if (by.sizeText || by.dressItemId) {
    const c = by.sizeText;
    push({
      cat: 'items', icon: 'dress',
      text: c && c.src !== 'unknown' && !isEmptyValue(c.before) ? `הוחלפה מידה: ${labelWithoutSize(ctx, row.entityId)}` : `עודכנה מידה: ${labelWithoutSize(ctx, row.entityId)}`,
      sub: c ? `מידה ${fmtItemValue('sizeText', c.after)}` : 'הוחלפה היחידה הפיזית',
      det: [...modelDet, ...pair2(c, 'sizeText', fmtItemValue), by.dressItemId && !c ? ['שינוי', 'הוחלפה היחידה הפיזית'] : null].filter(Boolean),
      ...bsrc('sizeText', 'dressItemId'),
    });
  }
  const altFields = ['neckAlteration', 'sleeveAlteration', 'lengthAlteration', 'alterationDetails'].filter(f => by[f]);
  if (altFields.length) {
    push({
      cat: 'items', icon: 'scissors', text: `עודכן תיקון: ${label}`,
      det: [...modelDet, ...altFields.map(f => [ITEM_FIELD_LABELS[f], by[f].src === 'unknown' ? fmtItemValue(f, by[f].after) : `${fmtItemValue(f, by[f].before)} ← ${fmtItemValue(f, by[f].after)}`])],
      ...bsrc(...altFields),
    });
  }
  if (by.alterationDone) {
    const done = by.alterationDone.after === true || by.alterationDone.after === 'true';
    push({ cat: 'items', icon: 'scissors', text: `${done ? 'תיקון סומן כבוצע' : 'סימון התיקון בוטל'}: ${label}`, det: [...modelDet], ...bsrc('alterationDone') });
  }
  if (by.barcode) {
    push({ cat: 'items', icon: 'dress', text: `עודכן ברקוד: ${label}`, det: [...modelDet, ...p2('barcode')], ...bsrc('barcode') });
  }
  if (!out.length && unknown.length && !known.length && !pool.length) {
    // a large new-values row of an item without a recorded start: keep a line, mark it honestly
    push({ cat: 'items', icon: 'dress', text: `פרטי הפריט נשמרו: ${label}`, sub: 'הערכים הקודמים אינם מתועדים ביומן', det: [...modelDet], beforeUnknown: true, beforeSource: 'unknown', system: true });
  }
  return out;
}

function labelWithoutSize(ctx, itemId) {
  const it = ctx.items.get(itemId) || {};
  return it.prefix ? `דגם ${it.prefix}` : (it.modelName || cleanText(it.description, 40) || 'פריט');
}
function pair2(c, field, fmt) {
  if (!c) return [];
  return c.src === 'unknown' ? [['אחרי', fmt(field, c.after)]] : [['לפני', fmt(field, c.before)], ['אחרי', fmt(field, c.after)]];
}

// ---- Payment rows ------------------------------------------------------------------------------

const PAYMENT_FIELDS = new Set(['amount', 'paymentMethod', 'notes', 'isDeleted', 'isRefund']);

function paymentEntries(ctx, row, diffs, isCreate) {
  const base = row.base;
  const out = [];
  let n = 0;
  const push = (o) => out.push(makeEntry(base, { ...o, id: `${base.id}#${n}`, subOrd: n++ }));
  const table = ctx.payments.get(row.entityId) || {};

  if (isCreate) {
    const d = row.data;
    const amount = num(d.amount);
    const w = paymentWords(d.paymentMethod, amount, d.isRefund === true);
    const note = safePaymentNote(d.notes);
    push({
      cat: 'pay', icon: w.icon, text: w.text, amt: amount, kind: w.kind,
      sub: note.last4 ? `ספרות ${note.last4}` : (note.text || undefined),
      det: [['שיטה', d.paymentMethod], ['סכום', amount === null ? null : money(amount)], ['תשלומים', note.installments ? String(note.installments) : null], ['הערה', note.last4 ? note.text : null]],
    });
    return out;
  }

  const amount = num(table.amount);
  const method = table.paymentMethod;
  if (row.action === 'CANCEL_PAYMENT' || row.action === 'RESTORE_PAYMENT') {
    const cancel = row.action === 'CANCEL_PAYMENT';
    const a = num(row.data.amount) ?? amount ?? 0;
    const w = paymentWords(row.data.paymentMethod ?? method, a, false);
    push({
      cat: 'pay', icon: 'undo', text: cancel ? `תשלום בוטל: ${money(Math.abs(a))}${w.kind === 'refund' ? ' (החזר)' : ''}` : `תשלום שוחזר: ${money(Math.abs(a))}`,
      amt: cancel ? -a : a, kind: cancel ? 'reversal' : 'pay', det: [['שיטה', row.data.paymentMethod ?? method]], toggle: true,
    });
    return out;
  }

  const changed = diffs.filter(x => x.changed);
  const by = Object.fromEntries(changed.map(x => [x.field, x]));
  const knownAll = changed.every(x => x.src !== 'unknown');
  if (by.isDeleted) {
    const to = by.isDeleted.after === true || by.isDeleted.after === 'true';
    const a = num(row.data.amount) ?? amount ?? 0;
    push({
      cat: 'pay', icon: 'undo', text: to ? `תשלום בוטל: ${money(Math.abs(a))}` : `תשלום שוחזר: ${money(Math.abs(a))}`,
      amt: to ? -a : a, kind: to ? 'reversal' : 'pay', det: [['שיטה', row.data.paymentMethod ?? method]], toggle: true,
      ...(by.isDeleted.src === 'unknown' ? { beforeUnknown: true, beforeSource: 'unknown' } : {}),
    });
  }
  if (by.amount && by.amount.src !== 'unknown') {
    const b = num(by.amount.before);
    const a = num(by.amount.after);
    push({
      cat: 'pay', icon: 'cash', text: 'סכום התשלום עודכן', sub: a === null ? undefined : money(a),
      amt: a !== null && b !== null ? a - b : undefined, kind: 'pay',
      det: [['לפני', b === null ? null : money(b)], ['אחרי', a === null ? null : money(a)], ['שיטה', row.data.paymentMethod ?? method]],
      beforeSource: by.amount.src,
    });
  }
  if (by.paymentMethod && by.paymentMethod.src !== 'unknown') {
    push({
      cat: 'pay', icon: 'cash', text: 'אמצעי התשלום עודכן',
      det: [['לפני', by.paymentMethod.before], ['אחרי', by.paymentMethod.after]], beforeSource: by.paymentMethod.src,
    });
  }
  if (by.notes && by.notes.src !== 'unknown') {
    push({ cat: 'pay', icon: 'cash', text: 'הערת התשלום עודכנה', det: [['שיטה', row.data.paymentMethod ?? method]], beforeSource: by.notes.src });
  }
  if (!out.length && !by.isDeleted) {
    // nothing changed against the record's own history (or nothing is known): an order save re-writes
    // every payment; keep the row as hidden bookkeeping so the counters add up
    push({
      cat: 'pay', icon: 'cash', text: 'תשלום נשמר', det: [['שיטה', row.data.paymentMethod ?? method]],
      system: true, ...(knownAll ? {} : { beforeUnknown: true, beforeSource: 'unknown' }),
    });
  }
  return out;
}

// ---- PaymentObligation rows --------------------------------------------------------------------

const OBLIGATION_FIELDS = new Set(['amount', 'description', 'isDeleted', 'quantity']);

function obligationEntries(ctx, row, diffs, isCreate) {
  const base = row.base;
  const out = [];
  let n = 0;
  const push = (o) => out.push(makeEntry(base, { ...o, id: `${base.id}#${n}`, subOrd: n++ }));
  const table = ctx.obligations.get(row.entityId) || {};
  const isManual = row.action === 'CREATE' ? row.data.isManual !== false : table.isManual === true;
  const desc = cleanText(row.data.description ?? table.description, 120) || 'חיוב';

  if (isCreate) {
    const a = num(row.data.amount);
    push({
      cat: 'pay', icon: 'wallet', text: isManual ? `נוסף חיוב ידני: ${desc}` : `נוצר חיוב: ${desc}`,
      amt: a, kind: 'charge', det: [['סכום', a === null ? null : money(a)]], system: !isManual, auto: !isManual,
    });
    return out;
  }
  if (row.action === 'CANCEL_OBLIGATION' || row.action === 'RESTORE_OBLIGATION') {
    const cancel = row.action === 'CANCEL_OBLIGATION';
    const a = num(row.data.amount) ?? num(table.amount) ?? 0;
    push({
      cat: 'pay', icon: 'undo', text: cancel ? `חיוב בוטל: ${desc}` : `חיוב שוחזר: ${desc}`,
      amt: cancel ? -a : a, kind: 'charge', det: [['סכום', money(a)]], toggle: true,
    });
    return out;
  }
  if (row.action === 'DELETE') {
    const a = num(row.data.amount);
    push({ cat: 'pay', icon: 'wallet', text: `חיוב הוסר בחישוב מחדש: ${desc}`, amt: a === null ? undefined : -a, kind: 'charge', det: [['סכום', a === null ? null : money(a)]], system: true, auto: true });
    return out;
  }
  const changed = diffs.filter(x => x.changed);
  const by = Object.fromEntries(changed.map(x => [x.field, x]));
  if (by.isDeleted && by.isDeleted.src !== 'unknown') {
    const to = by.isDeleted.after === true || by.isDeleted.after === 'true';
    const a = num(row.data.amount) ?? num(table.amount) ?? 0;
    push({ cat: 'pay', icon: 'undo', text: to ? `חיוב בוטל: ${desc}` : `חיוב שוחזר: ${desc}`, amt: to ? -a : a, kind: 'charge', det: [['סכום', money(a)]], system: !isManual, auto: !isManual, toggle: true });
  }
  if (by.amount && by.amount.src !== 'unknown') {
    const b = num(by.amount.before);
    const a = num(by.amount.after);
    push({
      cat: 'pay', icon: 'wallet', text: `סכום החיוב עודכן: ${desc}`, amt: a !== null && b !== null ? a - b : undefined, kind: 'charge',
      det: [['לפני', b === null ? null : money(b)], ['אחרי', a === null ? null : money(a)]], system: !isManual, auto: !isManual, beforeSource: by.amount.src,
    });
  }
  if (!out.length) {
    push({ cat: 'pay', icon: 'wallet', text: `חיוב נשמר: ${desc}`, det: [['סכום', num(row.data.amount) === null ? null : money(num(row.data.amount))]], system: true, auto: !isManual, ...(changed.some(x => x.src === 'unknown') ? { beforeUnknown: true, beforeSource: 'unknown' } : {}) });
  }
  return out;
}

// ---- Refund rows -------------------------------------------------------------------------------

const REFUND_BANK_FIELDS = new Set(['bankName', 'bankBranch', 'bankAccount', 'bankAccountName', 'paymentDetails', 'email']);
const REFUND_FIELDS = new Set(['amount', 'reason', 'isExecuted', 'isDeleted', 'paymentId', ...REFUND_BANK_FIELDS]);

function refundEntries(ctx, row, diffs, isCreate) {
  const base = row.base;
  const out = [];
  let n = 0;
  const push = (o) => out.push(makeEntry(base, { ...o, id: `${base.id}#${n}`, subOrd: n++ }));
  const table = ctx.refunds.get(row.entityId) || {};
  const amountNow = num(row.data.amount) ?? num(table.amount);

  switch (row.action) {
    case 'CREATE':
      push({
        cat: 'pay', icon: 'bank', text: `נפתחה בקשת זיכוי ${amountNow === null ? '' : money(amountNow)}`.trim(),
        amt: amountNow === null ? undefined : -amountNow, kind: 'refund',
        det: [['סכום', amountNow === null ? null : money(amountNow)], ['סיבה', redactFreeText(row.data.reason, 200)], ['סטטוס', 'ממתין לביצוע']],
      });
      return out;
    case 'AUTO_CREDIT_REFUND_CREATED':
      push({
        cat: 'pay', icon: 'bank', text: `נוצרה בקשת זיכוי אוטומטית ${amountNow === null ? '' : money(amountNow)}`.trim(), sub: 'יתרת זכות בהזמנה',
        amt: amountNow === null ? undefined : -amountNow, kind: 'refund', auto: true, det: [['סכום', amountNow === null ? null : money(amountNow)]],
      });
      return out;
    case 'AUTO_CREDIT_REFUND_UPDATED': {
      const a = num(row.data.amount);
      push({ cat: 'pay', icon: 'bank', text: `סכום בקשת הזיכוי האוטומטית עודכן${a === null ? '' : ' ל-' + money(a)}`, auto: true, det: [['סכום', a === null ? null : money(a)]] });
      return out;
    }
    case 'AUTO_CREDIT_REFUND_CLEARED':
      push({ cat: 'pay', icon: 'undo', text: 'בקשת הזיכוי האוטומטית בוטלה', sub: 'יתרת הזכות נסגרה', auto: true, det: [] });
      return out;
    case 'EXECUTE':
      push({
        cat: 'pay', icon: 'bank', text: `הזיכוי בוצע ${amountNow === null ? '' : money(amountNow)}`.trim(),
        amt: amountNow === null ? undefined : -amountNow, kind: 'refund', det: [['סכום', amountNow === null ? null : money(amountNow)]],
      });
      return out;
    default:
      break;
  }

  const changed = diffs.filter(x => x.changed);
  const by = Object.fromEntries(changed.map(x => [x.field, x]));
  if (by.isExecuted && (by.isExecuted.after === true || by.isExecuted.after === 'true')) {
    push({ cat: 'pay', icon: 'bank', text: `הזיכוי בוצע ${amountNow === null ? '' : money(amountNow)}`.trim(), amt: amountNow === null ? undefined : -amountNow, kind: 'refund', det: [['סכום', amountNow === null ? null : money(amountNow)]] });
  } else if (by.isExecuted) {
    push({ cat: 'pay', icon: 'undo', text: 'ביצוע הזיכוי בוטל', det: [] });
  }
  if (by.isDeleted && (by.isDeleted.after === true || by.isDeleted.after === 'true')) {
    push({ cat: 'pay', icon: 'undo', text: 'בקשת הזיכוי בוטלה', det: [['סכום', amountNow === null ? null : money(amountNow)]] });
  }
  if (by.amount && by.amount.src !== 'unknown') {
    const b = num(by.amount.before);
    const a = num(by.amount.after);
    push({ cat: 'pay', icon: 'bank', text: 'סכום הזיכוי עודכן', det: [['לפני', b === null ? null : money(b)], ['אחרי', a === null ? null : money(a)]], beforeSource: by.amount.src });
  }
  if (changed.some(x => REFUND_BANK_FIELDS.has(x.field))) {
    push({ cat: 'pay', icon: 'bank', text: 'פרטי הבנק לזיכוי עודכנו', det: [] }); // values are never shown
  }
  if (!out.length) {
    // paymentId link written by the execute flow, or a re-save
    push({ cat: 'pay', icon: 'bank', text: 'בקשת זיכוי נשמרה', det: [], system: true, ...(changed.some(x => x.src === 'unknown') ? { beforeUnknown: true, beforeSource: 'unknown' } : {}) });
  }
  return out;
}

// ---- Order-level named actions (hand-written rows and the named auditAs rows) --------------------

function orderActionEntries(ctx, row) {
  const base = row.base;
  const c = parseJson(row.raw) || {};
  const out = [];
  let n = 0;
  const push = (o) => out.push(makeEntry(base, { ...o, id: `${base.id}#${n}`, subOrd: n++ }));
  switch (row.action) {
    case 'CANCEL_ORDER': {
      const folded = row.foldedChildren || 0;
      push({
        cat: GENERAL_CAT, icon: 'alert', text: 'ההזמנה בוטלה',
        sub: !isEmptyValue(c.note) ? noteText(c.note) : undefined,
        det: [['פריטים שבוטלו', folded.items ? String(folded.items) : null], ['חיובים שבוטלו', folded.obligations ? String(folded.obligations) : null]],
      });
      return out;
    }
    case 'DEBT_APPROVED': {
      const a = num(c.approvedDebtAmount);
      // approvedDebtAmount is total - paid as the page computed it (route.js:889); it can be <= 0 when
      // fees or delivery are not in that total, so it is only named a debt when positive
      push({ cat: 'pay', icon: 'shield', text: 'אושרה יציאה עם יתרת חוב', sub: a !== null && a > 0 ? `חוב שאושר ${money(a)}` : undefined, det: [['הסכום שנרשם ביומן', a === null ? null : money(a)]] });
      return out;
    }
    case 'CANCEL_DEBT_APPROVAL':
      push({ cat: 'pay', icon: 'undo', text: 'אישור יתרת החוב בוטל', det: [] });
      return out;
    case 'CANCEL_CHANGES':
      push({ cat: GENERAL_CAT, icon: 'undo', text: 'בוטלו שינויים שלא נשמרו', sub: noteText(c.discarded) || undefined, det: [] });
      return out;
    case 'EMAIL_SENT':
    case 'EMAIL_FAILED': {
      // H27: "נשלח מייל <סוג> · אל … · N קבצים · אושר ע״י …" (W0 §1.3 meta: attachments, attachmentCount, approverId
      // -> approverName); a failure: "שליחת המייל נכשלה" with the masked error
      const failed = row.action === 'EMAIL_FAILED';
      const type = MAIL_TYPE_LABELS[c.type] || null;
      const files = Array.isArray(c.files) ? c.files.map(f => cleanText(f && f.fileName, 80)).filter(Boolean) : [];
      const attachments = Array.isArray(c.attachments) ? c.attachments.filter(a => a && typeof a === 'object') : [];
      const attNames = attachments.map(a => cleanText(a.name, 80) || ATTACHMENT_KIND_LABELS[a.kind] || 'קובץ');
      const count = num(c.attachmentCount) ?? (attachments.length || files.length || null);
      const approver = !isEmptyValue(c.approverName) && !c.selfApproved ? cleanText(c.approverName, 60) : null;
      const subParts = [
        !isEmptyValue(c.to) ? `אל ${String(c.to)}` : null,
        count ? (count === 1 ? 'קובץ אחד' : `${count} קבצים`) : null,
        approver ? `אושר ע״י ${approver}` : null,
      ].filter(Boolean);
      push({
        cat: 'docs', icon: 'mail',
        text: failed ? 'שליחת המייל נכשלה' : (type ? `נשלח מייל ${type}` : 'נשלח מייל'),
        sub: subParts.length ? subParts.join(' · ') : undefined,
        det: [['נמען', c.to], ['נושא', cleanText(c.subject, 160)], ['קבצים', (attNames.length ? attNames : files).join(', ')],
          ['אופן שליחה', cleanText(c.sendMode, 40)], ['מאשר', approver], ['שגיאה', failed ? safeMailError(c.error) : null]],
      });
      return out;
    }
    case 'ORDER_PRINTED': {
      // H22/H23 (W0 §1.5): every /print/order load and the schedule PP-07/PP-12 pages with orderId
      // doc 'schedule' = דף לו״ז אחר מהכנה/משלוח (השם ב-meta.sheet). הדפסה מרוכזת מדף ההדפסה של הלו״ז = הדפסת יום שלמה שההזמנה הופיעה בה
      // (W7, AMB-20; REQUESTS-W7 #1): "הודפס דף הכנה (הדפסת יום)"
      const isSchedule = c.doc === 'schedule';
      const doc = (EVENT_DOC_LABELS[c.doc] || isSchedule) ? c.doc : null;
      const sheetLabel = isSchedule ? (SCHEDULE_SHEET_LABELS[c.sheet] || 'דף לו״ז') : null;
      const dayPrint = !!c.batch && c.source === 'print-page' && ['prep', 'delivery', 'schedule'].includes(c.doc);
      const n = num(c.count);
      push({
        cat: 'docs', icon: 'print',
        text: (isSchedule ? `הודפס ${sheetLabel}` : doc ? PRINTED_TEXT[doc] : 'הודפס מסמך של ההזמנה') + (dayPrint ? ' (הדפסת יום)' : ''),
        sub: c.batch && n && n > 1 ? `בהדפסה מרוכזת של ${n} הזמנות` : undefined,
        det: [['מסמך', isSchedule ? sheetLabel : doc ? EVENT_DOC_LABELS[doc] : null], ['הודפס מתוך', PRINT_SOURCE_LABELS[c.source] || null]],
      });
      return out;
    }
    case 'ORDER_PDF_DOWNLOADED': {
      const doc = c.doc === 'rental' ? 'rental' : 'order';
      push({
        cat: 'docs', icon: 'file', text: doc === 'rental' ? 'הורד דף ההשכרה (PDF)' : 'הורד סיכום ההזמנה (PDF)',
        det: [['מסמך', EVENT_DOC_LABELS[doc]], ['קובץ', cleanText(c.fileName, 120)]],
      });
      return out;
    }
    case 'ORDER_XLSX_EXPORTED':
      push({ cat: 'docs', icon: 'table', text: 'יוצאה ההזמנה ל-Excel', det: [['קובץ', cleanText(c.fileName, 120)]] });
      return out;
    case 'HISTORY_EXPORTED': {
      const fmt = EXPORT_FORMAT_LABELS[c.format] || null;
      const n = num(c.rows);
      push({
        cat: 'docs', icon: c.format === 'print' ? 'print' : (c.format === 'xlsx' ? 'table' : 'file'),
        text: fmt ? `יוצאה היסטוריית ההזמנה (${fmt})` : 'יוצאה היסטוריית ההזמנה',
        det: [['פורמט', fmt], ['שורות', n === null ? null : String(n)]],
      });
      return out;
    }
    case 'MANAGER_APPROVAL': {
      // H19-H21 (W0 §1.2): employeeId = who asked; meta.approverId -> approverName = whose code matched
      const approver = !isEmptyValue(c.approverName) ? cleanText(c.approverName, 60) : 'מאשר לא ידוע';
      const reason = cleanText(c.reason, 200);
      let what = approvalShortLabel(c.featureKey || c.level);
      if (c.featureKey === 'feature:debt_approval') {
        const merged = num(row.mergedDebt);
        const fromReason = reason && /^הזמנה ללא תשלום\s*₪/.test(reason) ? reason : null;
        what = merged !== null && merged > 0 ? `הזמנה ללא תשלום ${money(merged)}` : (fromReason || what);
      }
      push({
        cat: GENERAL_CAT, icon: 'shield', text: `אישור מנהל: ${approver} · ${what}`,
        det: [['מאשר', approver], ['אישור', approvalShortLabel(c.featureKey || c.level)], ['סיבה', reason && reason !== what ? reason : null],
          ['החוב שנרשם', row.mergedDebt !== undefined && num(row.mergedDebt) !== null ? money(num(row.mergedDebt)) : null]],
      });
      return out;
    }
    case 'RESTORE_ORDER':
      push({ cat: GENERAL_CAT, icon: 'undo', text: 'ההזמנה שוחזרה', det: [], toggle: true });
      return out;
    case 'ADD_PAYMENT': {
      const a = num(c.amount);
      push({
        cat: 'pay', icon: a !== null && a < 0 ? 'bank' : 'cash', text: a !== null && a < 0 ? `הוחזר ללקוח ${money(Math.abs(a))}` : `נוסף תשלום ${a === null ? '' : money(a)}`.trim(),
        amt: a === null ? undefined : a, kind: a !== null && a < 0 ? 'refund' : 'pay', det: [['סכום', a === null ? null : money(a)]],
      });
      return out;
    }
    case 'REMOVE_PAYMENT':
      push({ cat: 'pay', icon: 'undo', text: 'תשלום בוטל', sub: redactFreeText(c.note, 120) || undefined, det: [] });
      return out;
    default:
      return null;
  }
}

// ---- schedule "done" marks (ScheduleStageMark rows, lib/schedule/marks.js writeMark) -------------

function markEntries(row) {
  if (row.action !== 'SCHEDULE_STAGE_DONE' && row.action !== 'SCHEDULE_STAGE_UNDONE') return null;
  const c = parseJson(row.raw) || {};
  const done = row.action === 'SCHEDULE_STAGE_DONE';
  const stage = cleanText(c.scheduleStage, 40) || SCHEDULE_STAGE_LABELS[c.stageKey] || 'שלב בלו״ז';
  const outcome = isFromTo(c.outcome) ? c.outcome.to : c.outcome;
  return [makeEntry(row.base, {
    id: `${row.base.id}#0`, cat: SCHEDULE_MARK_CAT, icon: done ? 'check' : 'undo',
    text: done ? `סומן 'בוצע' בלו״ז · ${stage}` : `בוטל סימון 'בוצע' בלו״ז · ${stage}`,
    det: [['שלב', stage], ['יום בלו״ז', hebrewOfDayKey(c.scheduleDay) ? `${weekdayHe(new Date(`${c.scheduleDay}T12:00:00Z`))} ${hebrewOfDayKey(c.scheduleDay)}` : null],
      ['מצב החזרה', outcome === 'ok' ? 'תקין' : (outcome === 'not_ok' ? 'לא תקין' : null)]],
  })];
}

// ---- dedupe of raw rows (D1-D5, D8; D6 and D7 run on the built lines in buildOrderHistory) ----

function dedupeRows(rows) {
  const dropped = new Map(); // row -> rule
  const near = (a, b) => Math.abs(a.at - b.at) <= DEDUPE_WINDOW_MS;

  // D1 CANCEL_ORDER x2 on the order: keep the hand-written row (has the note), drop the automatic one
  //    (ORD-1) two cancels with a restore between them are two real cancels: cancel, restore, cancel within
  //    the window must keep the final cancel, or the feed would end in the wrong state
  const rowIndex = new Map(rows.map((r, i) => [r, i]));
  const isRestore = (r) => r.entityType === 'Order' && (r.action === 'RESTORE_ORDER'
    || ((r.action === 'UPDATE' || r.action === 'UPDATE_ORDER')
      && (r.data.isDeleted === false || r.data.isDeleted === 'false' || (isFromTo(r.data.isDeleted) && (r.data.isDeleted.to === false || r.data.isDeleted.to === 'false')))));
  const restoreBetween = (a, b) => {
    const lo = Math.min(rowIndex.get(a), rowIndex.get(b));
    const hi = Math.max(rowIndex.get(a), rowIndex.get(b));
    for (let i = lo + 1; i < hi; i++) if (isRestore(rows[i])) return true;
    return false;
  };
  const cancels = rows.filter(r => r.entityType === 'Order' && r.action === 'CANCEL_ORDER');
  const kept = [];
  for (const c of cancels) {
    const k = kept.find(x => near(x, c) && !restoreBetween(x, c));
    if (!k) { kept.push(c); continue; }
    const winner = hasKey(k, 'note') ? k : (hasKey(c, 'note') ? c : k);
    const loser = winner === k ? c : k;
    dropped.set(loser, 'D1');
    if (winner === c) kept[kept.indexOf(k)] = c;
  }
  // D2 children of a cancelled order fold into the order line
  const liveCancels = cancels.filter(r => !dropped.has(r));
  for (const r of rows) {
    if (r.action !== 'CANCEL_ORDER' || r.entityType === 'Order') continue;
    const parent = liveCancels.find(p => near(p, r));
    if (!parent) continue;
    dropped.set(r, 'D2');
    parent.foldedChildren = parent.foldedChildren || { items: 0, obligations: 0 };
    if (r.entityType === 'OrderItem') parent.foldedChildren.items++;
    else if (r.entityType === 'PaymentObligation') parent.foldedChildren.obligations++;
  }
  // D3 order-level ADD_PAYMENT vs the automatic refund Payment CREATE
  const payCreates = rows.filter(r => r.entityType === 'Payment' && r.action === 'CREATE');
  for (const r of rows) {
    if (r.entityType !== 'Order' || r.action !== 'ADD_PAYMENT') continue;
    const c = parseJson(r.raw) || {};
    const a = num(c.amount);
    const match = payCreates.find(p => near(p, r) && a !== null && num(p.data.amount) === a);
    if (match) dropped.set(r, 'D3');
  }
  // D4 order-level REMOVE_PAYMENT vs the automatic Payment UPDATE {isDeleted:true}
  for (const r of rows) {
    if (r.entityType !== 'Order' || r.action !== 'REMOVE_PAYMENT') continue;
    const c = parseJson(r.raw) || {};
    const pid = c.paymentId;
    if (!pid) continue;
    const match = rows.find(p => p.entityType === 'Payment' && p.entityId === pid && near(p, r)
      && (p.action === 'CANCEL_PAYMENT' || (p.action === 'UPDATE' && p.data.isDeleted === true)));
    if (match) dropped.set(r, 'D4');
  }
  // D5 refund EXECUTE (or the automatic UPDATE {isExecuted:true}) vs the refund payment it created
  for (const r of rows) {
    if (r.entityType !== 'Refund' || !(r.action === 'EXECUTE' || (r.action === 'UPDATE' && r.data.isExecuted === true))) continue;
    const match = payCreates.find(p => near(p, r) && (p.data.isRefund === true || num(p.data.amount) < 0));
    if (match) dropped.set(r, 'D5');
  }
  // D8 one "leave with a debt" approval = MANAGER_APPROVAL{feature:debt_approval} (verify-pin, the code) + DEBT_APPROVED
  //    (PUT, the amount) within DEBT_MERGE_WINDOW_MS: one line, the approval row carries the amount (PLAN §C.4)
  const approvals = rows.filter(r => r.entityType === 'Order' && r.action === 'MANAGER_APPROVAL' && (parseJson(r.raw) || {}).featureKey === 'feature:debt_approval');
  const usedApprovals = new Set();
  for (const r of rows) {
    if (r.entityType !== 'Order' || r.action !== 'DEBT_APPROVED') continue;
    let best = null;
    for (const a of approvals) {
      if (usedApprovals.has(a) || Math.abs(a.at - r.at) > DEBT_MERGE_WINDOW_MS) continue;
      if (!best || Math.abs(a.at - r.at) < Math.abs(best.at - r.at)) best = a;
    }
    if (!best) continue;
    usedApprovals.add(best);
    best.mergedDebt = (parseJson(r.raw) || {}).approvedDebtAmount ?? null;
    dropped.set(r, 'D8');
  }
  return dropped;
}
function hasKey(row, key) {
  const c = parseJson(row.raw);
  return !!c && key in c;
}

// ---- main --------------------------------------------------------------------------------------

/**
 * @param {object} input
 * @param {{id?:string, orderId:number, orderDate?:Date, employeeName?:string}} input.order
 * @param {Array} input.auditRows  {id, entityType, entityId, action, changesJson, createdAt, employeeId?, employeeName?}
 * @param {Array} [input.items]        {id, sizeText, description, prefix, modelName, isTaken, takenDate, isReturned, returnDate, returnedOk, isDeleted}
 * @param {Array} [input.payments]     {id, amount, paymentMethod, notes, paymentDate, isDeleted, isRefund}
 * @param {Array} [input.refunds]      {id, amount, reason, isExecuted, executionDate, isAutoGenerated, isDeleted, createdAt}
 * @param {Array} [input.obligations]  {id, description, amount, isManual, isDeleted}
 * @param {Array} [input.emailLogs]    failed order e-mails: {id, to, subject, status, errorMessage, sentAt}
 * @param {Array} [input.printVisits]  {id, pageUrl, timestamp, employeeName}
 * @param {Array} [input.customers]    {id, name} - customers named by a customerId change (H06), never shown as ids
 * @param {object} [options]
 * @param {boolean} [options.includeSystem=false] keep engine bookkeeping entries
 */
export function buildOrderHistory(input, options = {}) {
  const order = input.order || {};
  const rowsIn = Array.isArray(input.auditRows) ? input.auditRows : [];
  const ctx = {
    order,
    items: new Map((input.items || []).map(i => [i.id, i])),
    payments: new Map((input.payments || []).map(p => [p.id, p])),
    refunds: new Map((input.refunds || []).map(r => [r.id, r])),
    obligations: new Map((input.obligations || []).map(o => [o.id, o])),
    customers: new Map((input.customers || []).filter(c => c && c.id).map(c => [String(c.id), cleanText(c.name, 80) || 'לקוח'])),
    baselines: new Baselines(),
  };

  // normalise + order oldest -> newest (ties broken by the position the caller fetched them in, then id)
  const rows = rowsIn.map((r, i) => {
    const at = toDate(r.createdAt);
    return {
      raw: r.changesJson,
      data: parseJson(r.changesJson) || {},
      parsed: !!parseJson(r.changesJson),
      entityType: r.entityType,
      entityId: String(r.entityId),
      action: r.action,
      at: at ? at.getTime() : 0,
      pos: i,
      auditId: r.id,
      actor: { name: r.employeeName || null, employeeId: r.employeeId || null },
      base: null,
    };
  }).sort((a, b) => (a.at - b.at) || (b.pos - a.pos));
  rows.forEach((r, i) => {
    r.base = {
      id: `a:${r.auditId}`, at: new Date(r.at), actor: r.actor, action: r.action, entityType: r.entityType, entityId: r.entityId, src: 'audit', ord: i,
      dateOnly: false,
    };
  });

  const KNOWN = { Order: ORDER_KNOWN_FIELDS, OrderItem: ITEM_KNOWN_FIELDS, Payment: PAYMENT_FIELDS, PaymentObligation: OBLIGATION_FIELDS, Refund: REFUND_FIELDS };
  const dropped = dedupeRows(rows);
  const dedupedBy = {};
  for (const rule of dropped.values()) dedupedBy[rule] = (dedupedBy[rule] || 0) + 1;

  let noopCount = 0;
  let unmappedCount = 0;
  const entries = [];
  const covered = { payments: new Set(), refunds: new Set(), refundExec: new Set(), itemTaken: new Set(), itemReturned: new Set(), orderCreate: false };

  for (const row of rows) {
    const key = `${row.entityType === 'Order' ? 'Order' : row.entityType + ':' + row.entityId}`;
    const isCreate = row.action === 'CREATE';
    if (dropped.has(row)) {
      // a removed duplicate still moved the record's values forward
      if ((isCreate || row.action === 'UPDATE' || row.action === 'UPDATE_ORDER') && KNOWN[row.entityType]) diffRow(ctx.baselines, key, row.data, { isCreate, known: KNOWN[row.entityType] });
      continue;
    }
    let made = null;

    if (row.entityType === 'Order') {
      if (isCreate) covered.orderCreate = true;
      // UPDATE_ORDER: the name the write-side patch in the report may give to a save row with {from,to}
      if (isCreate || row.action === 'UPDATE' || row.action === 'UPDATE_ORDER') {
        const diffs = diffRow(ctx.baselines, key, row.data, { isCreate, known: ORDER_KNOWN_FIELDS });
        made = orderEntries(ctx, { ...row }, diffs, isCreate);
        if (!isCreate && !diffs.some(d => d.changed)) noopCount++;
      } else {
        made = orderActionEntries(ctx, row);
        if (made === null) {
          unmappedCount++;
          made = [makeEntry(row.base, { id: `${row.base.id}#0`, cat: GENERAL_CAT, icon: 'file', text: `פעולה: ${row.action}`, det: [], unmapped: true })];
        }
      }
    } else if (row.entityType === 'OrderItem') {
      const named = new Set(['CANCEL_ITEM', 'RESTORE_ITEM', 'CONFIRM_RENTAL', 'RETURN_RENTAL', 'CANCEL_RENTAL', 'CANCEL_RETURN', 'RETURN_CONDITION', 'CANCEL_SCAN', 'BARCODE_INVALID', 'ALTERATION_DONE', 'ALTERATION_UNDONE']);
      if (row.action === 'CONFIRM_RENTAL') covered.itemTaken.add(row.entityId);
      if (row.action === 'RETURN_RENTAL') covered.itemReturned.add(row.entityId);
      const diffs = (isCreate || row.action === 'UPDATE') ? diffRow(ctx.baselines, key, row.data, { isCreate, known: ITEM_KNOWN_FIELDS }) : [];
      if (!isCreate && row.action === 'UPDATE' && diffs.length && !diffs.some(d => d.changed)) noopCount++;
      if (isCreate || row.action === 'UPDATE' || named.has(row.action)) {
        // keep the baseline moving for named actions that carry {from,to} too
        if (named.has(row.action)) diffRow(ctx.baselines, key, row.data, { isCreate: false, known: ITEM_KNOWN_FIELDS });
        made = itemEntries(ctx, row, diffs, isCreate);
      } else {
        unmappedCount++;
        made = [makeEntry(row.base, { id: `${row.base.id}#0`, cat: 'items', icon: 'dress', text: `פעולה בפריט: ${row.action}`, sub: labelWithoutSize(ctx, row.entityId), det: [], unmapped: true })];
      }
    } else if (row.entityType === 'Payment') {
      if (isCreate) covered.payments.add(row.entityId);
      const named = row.action === 'CANCEL_PAYMENT' || row.action === 'RESTORE_PAYMENT';
      const diffs = (isCreate || row.action === 'UPDATE') ? diffRow(ctx.baselines, key, row.data, { isCreate, known: PAYMENT_FIELDS }) : [];
      if (!isCreate && row.action === 'UPDATE' && diffs.length && !diffs.some(d => d.changed)) { noopCount++; continue; }
      if (named) diffRow(ctx.baselines, key, row.data, { isCreate: false, known: PAYMENT_FIELDS });
      made = (isCreate || row.action === 'UPDATE' || named) ? paymentEntries(ctx, row, diffs, isCreate) : null;
      if (made === null) {
        unmappedCount++;
        made = [makeEntry(row.base, { id: `${row.base.id}#0`, cat: 'pay', icon: 'cash', text: `פעולה בתשלום: ${row.action}`, det: [], unmapped: true })];
      }
    } else if (row.entityType === 'PaymentObligation') {
      const named = row.action === 'CANCEL_OBLIGATION' || row.action === 'RESTORE_OBLIGATION' || row.action === 'DELETE';
      const diffs = (isCreate || row.action === 'UPDATE') ? diffRow(ctx.baselines, key, row.data, { isCreate, known: OBLIGATION_FIELDS }) : [];
      if (!isCreate && row.action === 'UPDATE' && diffs.length && !diffs.some(d => d.changed)) { noopCount++; continue; }
      if (named && row.action !== 'DELETE') diffRow(ctx.baselines, key, row.data, { isCreate: false, known: OBLIGATION_FIELDS });
      made = (isCreate || row.action === 'UPDATE' || named) ? obligationEntries(ctx, row, diffs, isCreate) : null;
      if (made === null) {
        unmappedCount++;
        made = [makeEntry(row.base, { id: `${row.base.id}#0`, cat: 'pay', icon: 'wallet', text: `פעולה בחיוב: ${row.action}`, det: [], unmapped: true, system: true })];
      }
    } else if (row.entityType === 'Refund') {
      if (isCreate || row.action === 'AUTO_CREDIT_REFUND_CREATED') covered.refunds.add(row.entityId);
      if (row.action === 'EXECUTE') covered.refundExec.add(row.entityId);
      const diffs = (isCreate || row.action === 'UPDATE') ? diffRow(ctx.baselines, key, row.data, { isCreate, known: REFUND_FIELDS }) : [];
      if (!isCreate && row.action === 'UPDATE' && diffs.length && !diffs.some(d => d.changed)) { noopCount++; continue; }
      if (row.action === 'UPDATE' && diffs.some(d => d.changed && d.field === 'isExecuted' && (d.after === true || d.after === 'true'))) covered.refundExec.add(row.entityId);
      const named = new Set(['AUTO_CREDIT_REFUND_CREATED', 'AUTO_CREDIT_REFUND_UPDATED', 'AUTO_CREDIT_REFUND_CLEARED', 'EXECUTE']);
      made = (isCreate || row.action === 'UPDATE' || named.has(row.action)) ? refundEntries(ctx, row, diffs, isCreate) : null;
      if (made === null) {
        unmappedCount++;
        made = [makeEntry(row.base, { id: `${row.base.id}#0`, cat: 'pay', icon: 'bank', text: `פעולה בזיכוי: ${row.action}`, det: [], unmapped: true })];
      }
    } else if (row.entityType === 'ScheduleStageMark') {
      made = markEntries(row);
      if (made === null) {
        unmappedCount++;
        made = [makeEntry(row.base, { id: `${row.base.id}#0`, cat: SCHEDULE_MARK_CAT, icon: 'check', text: `פעולה בלו״ז: ${row.action}`, det: [], unmapped: true })];
      }
    } else {
      continue; // an entity the route never asks for
    }
    for (const e of made) {
      if (!row.parsed && row.action !== 'CREATE') e.unparsed = true;
      entries.push(e);
    }
  }

  // D6 the same record's identical line twice within the window: older code wrote a generic row AND a
  //    detailed one for one item edit / item add (see the comments in items/route.js, items/[itemId]/route.js)
  const TOGGLE_ACTION = /^(CANCEL|RESTORE)_/;
  const RANK = { explicit: 3, sequence: 2 };
  const rankOf = (e) => RANK[e.beforeSource] || 1;
  const sameLine = (e) => `${e._ek}|${e.text}|${e.sub || ''}|${e.amt ?? ''}|${JSON.stringify(e.det)}`;
  const byLine = new Map();
  // per record (_ek): every line seen so far in order, so a dedupe can tell whether a DIFFERENT row's different line sits
  // between the two identical ones (done / undone / done: the later "done" is the final state, never a duplicate)
  const seqOf = new Map();
  const pushSeq = (e, k) => {
    let seq = seqOf.get(e._ek);
    if (!seq) seqOf.set(e._ek, seq = []);
    seq.push({ e, k });
    return seq.length - 1;
  };
  const interrupted = (e, k, seen) => (seqOf.get(e._ek) || []).slice(seen.idx + 1)
    .some(x => x.k !== k && x.e._ord !== seen.e._ord && x.e._ord !== e._ord && !drop6.has(x.e));
  const drop6 = new Set();
  // (ORD-2) rows written before auditAs existed: a generic UPDATE {isDeleted} AND the named CANCEL_ITEM /
  //    CANCEL_PAYMENT / ... row for the same record, a fraction of a second apart, print the same cancel line
  //    twice. The generic flip is dropped, the named row stays. Strictly one-to-one and only inside a tight
  //    window, so cancel (named) / restore / cancel (generic) inside 5 s is still three lines (B3).
  const isChildEk = (e) => e._ek && e._ek !== 'Order' && !e._ek.startsWith('Order:');
  const toggleKey = (e) => `${e._ek}|${e.text}|${e.amt ?? ''}`;
  const namedFlips = entries.filter(e => e._toggle && isChildEk(e) && TOGGLE_ACTION.test(e.action || ''));
  const genericFlips = entries.filter(e => e._toggle && isChildEk(e) && e.action === 'UPDATE');
  if (namedFlips.length && genericFlips.length) {
    const pairs = [];
    for (const g of genericFlips) {
      for (const n of namedFlips) {
        const gap = Math.abs(g._at - n._at);
        if (gap <= GENERIC_FLIP_WINDOW_MS && toggleKey(g) === toggleKey(n)) pairs.push({ g, n, gap });
      }
    }
    pairs.sort((x, y) => x.gap - y.gap || x.g._ord - y.g._ord);
    const usedNamed = new Set();
    for (const { g, n } of pairs) {
      if (drop6.has(g) || usedNamed.has(n)) continue;
      drop6.add(g);
      usedNamed.add(n);
    }
  }
  for (const e of [...entries].sort((a, b) => a._at - b._at || a._ord - b._ord)) {
    if (!e._ek || e._ek === 'Order' || e._ek.startsWith('Order:')) continue;
    // a cancel / restore flip is a real action each time: remove / restore / remove within 5 s is three
    // events, not one (the named auditAs rows CANCEL_* / RESTORE_* are single-writer, never doubled)
    if (e._toggle || TOGGLE_ACTION.test(e.action || '')) { pushSeq(e, `toggle|${e.action}|${e.text}`); continue; }
    const k = sameLine(e);
    const seen = byLine.get(k);
    const idx = pushSeq(e, k);
    if (seen && e._at - seen.e._at <= DEDUPE_WINDOW_MS && !interrupted(e, k, seen)) {
      if (rankOf(e) > rankOf(seen.e)) { drop6.add(seen.e); byLine.set(k, { e, idx }); } else drop6.add(e);
    } else byLine.set(k, { e, idx });
  }
  // D7 the order total written twice by one save: the client's copy first, the pricing engine right after
  //    puts it back (route.js:665 then recalculateOrderObligations). Both rows cancel out; drop the pair.
  const tots = entries.filter(e => e._tot).sort((a, b) => a._at - b._at || a._ord - b._ord);
  const drop7 = new Set();
  for (let i = 0; i < tots.length; i++) {
    if (drop7.has(tots[i])) continue;
    for (let j = i + 1; j < tots.length; j++) {
      if (drop7.has(tots[j])) continue;
      if (tots[j]._at - tots[i]._at > TOTAL_REVERT_WINDOW_MS) break;
      if (same(tots[j]._tot.after, tots[i]._tot.before) && same(tots[j]._tot.before, tots[i]._tot.after)) { drop7.add(tots[i]); drop7.add(tots[j]); break; }
    }
  }
  if (drop6.size) dedupedBy.D6 = drop6.size;
  if (drop7.size) dedupedBy.D7 = drop7.size;
  for (let i = entries.length - 1; i >= 0; i--) if (drop6.has(entries[i]) || drop7.has(entries[i])) entries.splice(i, 1);

  // ---- entries from the tables themselves (orders / rows that never got an audit row) ----------
  let ord = rows.length;
  const synth = (o) => {
    const at = toDate(o.at);
    if (!at) return;
    entries.push(makeEntry({
      id: o.id, at, actor: o.actor || null, action: null, entityType: o.entityType, src: o.src, ord: ord++, dateOnly: looksDateOnly(at),
    }, { cat: o.cat, icon: o.icon, text: o.text, sub: o.sub, amt: o.amt, kind: o.kind, det: o.det }));
  };

  if (!covered.orderCreate && order.orderDate) {
    synth({
      id: 't:order', at: order.orderDate, src: 'Order', entityType: 'Order', actor: order.employeeName ? { name: order.employeeName, employeeId: order.employeeId || null } : (order.employeeId ? { employeeId: order.employeeId } : null),
      cat: GENERAL_CAT, icon: 'file', text: 'ההזמנה נוצרה', det: [['מס׳ הזמנה', order.orderId ? `#${order.orderId}` : null]],
    });
  }
  // an order soft-deleted without an audit row (script, import) still says so
  if (order.isDeleted && order.deletedAt && !entries.some(e => e.entityType === 'Order' && (e.action === 'CANCEL_ORDER' || e.text === 'ההזמנה בוטלה'))) {
    synth({ id: 't:order-cancelled', at: order.deletedAt, src: 'Order', entityType: 'Order', cat: GENERAL_CAT, icon: 'alert', text: 'ההזמנה בוטלה', sub: 'נרשם בטבלת ההזמנות בלבד', det: [] });
  }
  for (const p of ctx.payments.values()) {
    if (covered.payments.has(p.id) || !p.paymentDate) continue;
    const a = num(p.amount);
    const w = paymentWords(p.paymentMethod, a, p.isRefund === true);
    const note = safePaymentNote(p.notes);
    synth({
      id: `t:payment:${p.id}`, at: p.paymentDate, src: 'Payment', entityType: 'Payment', cat: 'pay', icon: w.icon,
      text: w.text, amt: a, kind: w.kind, sub: note.last4 ? `ספרות ${note.last4}` : (note.text || undefined),
      det: [['שיטה', p.paymentMethod], ['סכום', a === null ? null : money(a)], ['סטטוס', p.isDeleted ? 'התשלום בוטל' : null]],
    });
  }
  for (const r of ctx.refunds.values()) {
    if (!covered.refunds.has(r.id) && r.createdAt) {
      const a = num(r.amount);
      synth({
        id: `t:refund:${r.id}`, at: r.createdAt, src: 'Refund', entityType: 'Refund', cat: 'pay', icon: 'bank',
        text: r.isAutoGenerated ? `נוצרה בקשת זיכוי אוטומטית ${a === null ? '' : money(a)}`.trim() : `נפתחה בקשת זיכוי ${a === null ? '' : money(a)}`.trim(),
        amt: a === null ? undefined : -a, kind: 'refund', det: [['סכום', a === null ? null : money(a)], ['סיבה', redactFreeText(r.reason, 200)]],
      });
    }
    if (r.isExecuted && r.executionDate && !covered.refundExec.has(r.id) && !covered.payments.has(r.paymentId)) {
      const a = num(r.amount);
      synth({
        id: `t:refund-exec:${r.id}`, at: r.executionDate, src: 'Refund', entityType: 'Refund', cat: 'pay', icon: 'bank',
        text: `הזיכוי בוצע ${a === null ? '' : money(a)}`.trim(), amt: a === null ? undefined : -a, kind: 'refund', det: [['סכום', a === null ? null : money(a)]],
      });
    }
  }
  for (const it of ctx.items.values()) {
    const label = itemLabel(ctx, it.id, null);
    if (it.takenDate && !covered.itemTaken.has(it.id)) {
      synth({ id: `t:taken:${it.id}`, at: it.takenDate, src: 'OrderItem', entityType: 'OrderItem', cat: 'items', icon: 'check', text: `נלקח: ${label}`, det: it.modelName ? [['שם הדגם', it.modelName]] : [] });
    }
    if (it.returnDate && !covered.itemReturned.has(it.id)) {
      synth({
        id: `t:returned:${it.id}`, at: it.returnDate, src: 'OrderItem', entityType: 'OrderItem', cat: 'items', icon: 'check', text: `הוחזר: ${label}`,
        det: [...(it.modelName ? [['שם הדגם', it.modelName]] : []), ['מצב בהחזרה', it.isReturned ? (it.returnedOk ? 'תקין' : 'לא תקין') : null]],
      });
    }
  }
  // D10: an EMAIL_FAILED audit row (W0) already says so - the EmailLog row of the same failure is not a second line
  const failedMailAt = rows.filter(r => r.entityType === 'Order' && r.action === 'EMAIL_FAILED' && !dropped.has(r)).map(r => r.at);
  // D9: the print page logs ORDER_PRINTED for every load (W0 §1.5) - the old untyped PageVisitLog line of the same load goes
  const printedAt = rows.filter(r => r.entityType === 'Order' && r.action === 'ORDER_PRINTED').map(r => r.at);
  for (const m of input.emailLogs || []) {
    if (m.status !== 'error' || !m.sentAt) continue;
    const t = toDate(m.sentAt);
    if (t) {
      // one-to-one: each EMAIL_FAILED audit row explains ONE EmailLog failure (the nearest, then consumed)
      let best = -1;
      for (let i = 0; i < failedMailAt.length; i++) {
        const gap = Math.abs(failedMailAt[i] - t.getTime());
        if (gap <= EMAIL_FAIL_WINDOW_MS && (best < 0 || gap < Math.abs(failedMailAt[best] - t.getTime()))) best = i;
      }
      if (best >= 0) { failedMailAt.splice(best, 1); dedupedBy.D10 = (dedupedBy.D10 || 0) + 1; continue; }
    }
    synth({
      id: `t:email:${m.id}`, at: m.sentAt, src: 'EmailLog', entityType: 'EmailLog', cat: 'docs', icon: 'mail', text: 'שליחת המייל נכשלה',
      sub: !isEmptyValue(m.to) ? String(m.to) : undefined, det: [['נמען', m.to], ['נושא', cleanText(m.subject, 160)], ['שגיאה', safeMailError(m.errorMessage)]],
    });
  }
  for (const v of input.printVisits || []) {
    const at = toDate(v.timestamp);
    if (!at) continue;
    if (printedAt.some(a => Math.abs(a - at.getTime()) <= PRINT_VISIT_WINDOW_MS)) { dedupedBy.D9 = (dedupedBy.D9 || 0) + 1; continue; }
    synth({
      id: `t:print:${v.id}`, at, src: 'PageVisitLog', entityType: 'PageVisitLog', actor: v.employeeName ? { name: v.employeeName } : null,
      cat: 'docs', icon: 'print', text: 'נפתח דף הדפסה של ההזמנה', sub: 'נרשם בפתיחת דף ההדפסה (בלי הבחנה בין הזמנה להשכרה)', det: [],
    });
  }

  // ---- visibility, counts, order ---------------------------------------------------------------
  const includeSystem = options.includeSystem === true;
  const visible = [];
  let hiddenSystemCount = 0;
  for (const e of entries) {
    if (e.system && !includeSystem) { hiddenSystemCount++; continue; }
    visible.push(e);
  }
  visible.sort((a, b) => (b._at - a._at) || (b._ord - a._ord) || (a._sub - b._sub));

  const counts = { all: visible.length, categories: {}, extras: {} };
  for (const c of CATEGORY_IDS) counts.categories[c] = 0;
  for (const k of Object.keys(ICON_BUCKETS)) counts.extras[k] = 0;
  for (const e of visible) {
    if (counts.categories[e.cat] !== undefined) counts.categories[e.cat]++;
    for (const [k, icon] of Object.entries(ICON_BUCKETS)) if (e.icon === icon) counts.extras[k]++;
  }

  return {
    entries: visible,
    counts,
    dedupedCount: Object.values(dedupedBy).reduce((a, b) => a + b, 0),
    dedupedBy,
    noopCount,
    hiddenSystemCount,
    unmappedCount,
  };
}

// ---- paging ------------------------------------------------------------------------------------

export const DEFAULT_LIMIT = 100;
export const MAX_LIMIT = 200;

// [instant, id, row position, line inside the row]: the last two let a page resume at the exact place in
// the feed order even when the cursor's own entry is no longer in the (filtered) list.
export function encodeCursor(entry) {
  const parts = entry._ord === undefined ? [entry._at, entry.id] : [entry._at, entry.id, entry._ord, entry._sub ?? 0];
  return Buffer.from(JSON.stringify(parts), 'utf8').toString('base64url');
}

export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const v = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
    if (Array.isArray(v) && Number.isFinite(v[0]) && typeof v[1] === 'string') {
      // cursors issued before ord/sub were added carry only [at, id]
      if (Number.isFinite(v[2])) return { at: v[0], id: v[1], ord: v[2], sub: Number.isFinite(v[3]) ? v[3] : 0 };
      return { at: v[0], id: v[1] };
    }
  } catch { /* fall through */ }
  return undefined; // malformed
}

// The route's id segment -> a usable order number, or null. Order.orderId is an INT4: anything above
// 2147483647 (or below 1) is not an order and must be a 404, not a Prisma error.
export const MAX_ORDER_NUMBER = 2147483647;
export function parseOrderNumber(id) {
  const n = parseInt(String(id ?? ''), 10); // same leniency as GET /api/orders/[id]
  return Number.isSafeInteger(n) && n >= 1 && n <= MAX_ORDER_NUMBER ? n : null;
}

// What the path segment of /api/orders/[id]/history may be (ID-1): a UUID-shaped string -> { id }, a positive
// integer that fits Order.orderId (INT4) -> { orderId }; anything else (NUL bytes, letters, "12abc", 0, 2^31)
// -> null, i.e. 404 before Prisma is touched.
export function resolveOrderRef(raw) {
  if (isUuidShaped(raw)) return { id: raw };
  if (typeof raw === 'string' && /^[0-9]{1,10}$/.test(raw)) {
    const orderId = parseOrderNumber(raw);
    if (orderId !== null) return { orderId };
  }
  return null;
}

export function normalizeLimit(raw) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

// categories: array of category ids and/or icon buckets (sig / print / mail / fix); empty = everything
export function filterByCategory(entries, categories) {
  const wanted = (categories || []).filter(Boolean);
  if (!wanted.length) return entries;
  return entries.filter(e => wanted.some(c => (ICON_BUCKETS[c] ? e.icon === ICON_BUCKETS[c] : e.cat === c)));
}

// The feed search (A21 / R41): every word must appear in the entry's visible text - the line, its details, who,
// the Hebrew date, the weekday, the time or the category name. Case-insensitive; empty query = everything.
const CATEGORY_LABEL = Object.fromEntries(ORDER_HISTORY_CATEGORIES.map(c => [c[0], c[1]]));
export function entryHaystack(e) {
  return [e.text, e.sub || '', e.who || '', e.dateHe || '', e.weekdayHe || '', e.time || '', CATEGORY_LABEL[e.cat] || '', ...(e.det || []).flat()]
    .join(' ').toLowerCase();
}
export function searchWords(q) {
  return String(q || '').trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 12);
}
export function searchEntries(entries, q) {
  const words = searchWords(q);
  if (!words.length) return entries;
  return entries.filter(e => { const h = entryHaystack(e); return words.every(w => h.includes(w)); });
}

export function publicEntry(e) {
  const { _at, _ord, _sub, _ek, _tot, _toggle, ...rest } = e;
  return rest;
}

/**
 * Cuts one page out of a newest-first list. Returns { entries, nextCursor }.
 * A cursor whose entry no longer exists (the category filter changed between pages) resumes at the first
 * entry that sorts after the cursor's position - same instant included - so a page never skips entries
 * that share the cursor's timestamp.
 */
export function paginateEntries(entries, { limit = DEFAULT_LIMIT, cursor = null } = {}) {
  const cap = normalizeLimit(limit);
  let start = 0;
  const c = typeof cursor === 'string' ? decodeCursor(cursor) : cursor;
  if (c) {
    const idx = entries.findIndex(e => e.id === c.id);
    if (idx >= 0) start = idx + 1;
    else {
      // feed order is (_at desc, _ord desc, _sub asc)
      const after = c.ord === undefined
        ? (e) => e._at <= c.at // old cursor without a position: may repeat an entry, never skips one
        : (e) => e._at < c.at || (e._at === c.at && (e._ord < c.ord || (e._ord === c.ord && e._sub > c.sub)));
      const older = entries.findIndex(after);
      start = older === -1 ? entries.length : older;
    }
  }
  const page = entries.slice(start, start + cap);
  const hasMore = start + cap < entries.length;
  return { entries: page.map(publicEntry), nextCursor: hasMore && page.length ? encodeCursor(page[page.length - 1]) : null };
}
