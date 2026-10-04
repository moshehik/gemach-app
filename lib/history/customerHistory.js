// Server-side history layer of the customer card (docs: A5 customer card, "היסטוריה" tab).
//
// One unified, newest-first feed for a customer, built from READ-ONLY sources:
//   * AuditLog rows of entityType 'Customer' (field edits, creation, auto-notes, mails);
//   * the customer's Orders (opened) + an allow-list of AuditLog actions on those orders;
//   * Payments and Refunds (money movements / refund requests);
//   * EmailLog rows of the customer.
//
// Write side is untouched (owner decision D6/D7): the audit extension keeps writing ONE row per
// save ({field:{from,to}} for all changed fields); this module explodes such a row into one entry
// per changed field AT READ TIME, all sharing a `groupId`. No AuditLog row is ever written here.
//
// Layout: the mappers (map*/explode*/build*/assemble*/cursor helpers) are pure functions - no
// Prisma, no Next, no path aliases - so scripts/customer-history.test.mjs runs them with plain
// `node`. Only loadCustomerHistorySources/getCustomerHistory touch a database, through a Prisma
// client INJECTED by the caller (app/api/customers/[id]/history/route.js).
//
// Entry shape (everything the A5 history tab renders):
//   { id, groupId, seq (position inside its group), at (ISO), day ('YYYY-MM-DD' Israel), time ('HH:MM' Israel), hebrewDate,
//     category ('cust'|'orders'|'pay'|'docs'), type, icon (design-system sprite id, no "i-"),
//     title, detail, details: [[label, value], ...], amount?, amountKind? ('pay'|'chg'|'crd'),
//     actor: {name} (employee ids are never returned), entityRef: {type, id, orderId?, href?} | null,
//     field?, fieldLabel?, from?, to?, source }
// `from`/`to` are DISPLAY strings (booleans -> כן/לא, empty -> "ריק", dates -> Hebrew date).

import {
  CATEGORIES,
  ACTION_LABELS,
  CUSTOMER_FIELD_LABELS,
  ISSUE_TYPE_LABELS,
  HIDDEN_CUSTOMER_FIELDS,
  fieldLabel,
  fieldIcon,
  updatedVerb,
  formatFieldValue,
  formatMoney,
  shorten,
  isEmptyValue,
  paymentMethodPhrase,
  paymentMethodIcon,
  EMPTY_TEXT,
} from './labels.js';
import {
  safeNoteText, redactFreeText, paymentNoteSummary, safeMailError, maskIdentifier,
} from './sanitize.js';
import { SCHEDULE_SHEET_LABELS } from './orderEvents.js';

export const DEFAULT_LIMIT = 100;
export const MAX_LIMIT = 200;
// Every source is read as its NEWEST `SOURCE_CAP` rows (one bounded, ordered query each, outside any
// transaction); the whole feed is assembled once from them and paged in memory (the same approach as the
// order feed). A source that hits the cap is named in `meta.truncated`: its oldest rows are missing.
export const SOURCE_CAP = 1500;
// AuditLog actions on a customer's ORDERS that belong in the customer feed. Everything else on an
// order (item-level actions, ADD_PAYMENT, ...) is either shown through its own table
// (payments/refunds) or is order-card business - deliberately not here.
// ORDER_PRINTED (lib/history/orderEvents.js): prints DO belong in the customer feed, manager approvals do
// not (OQ-3 default). UPDATE_ORDER = the order-save row with {from,to} (PUT /api/orders/[id], AMB-19) - it is
// fetched with the plain UPDATE rows (ORDER_UPDATE_ACTIONS), not with the rare actions.
export const ORDER_AUDIT_ACTIONS = ['CANCEL_ORDER', 'DEBT_APPROVED', 'CANCEL_DEBT_APPROVAL', 'EMAIL_SENT', 'ORDER_PRINTED', 'UPDATE', 'UPDATE_ORDER'];
export const ORDER_UPDATE_ACTIONS = ['UPDATE', 'UPDATE_ORDER'];
const ORDER_PRINT_DOC_LABELS = { order: 'סיכום הזמנה', rental: 'דף השכרה', prep: 'דף הכנה', delivery: 'תעודת משלוח' };

const DETAIL_MAX = 32;
const DETAIL_VALUE_MAX = 300; // one value in `details` / `from` / `to` (a 200k-char note must not become a 400 KB entry)
const NEAR_DUPLICATE_MS = 10 * 1000; // same logical event written as two audit rows
const BURST_GAP_MS = 2 * 60 * 1000; // consecutive UPDATE rows of one order save
const MAIL_DUPLICATE_MS = 2 * 60 * 1000; // EmailLog row + the EMAIL_SENT audit row of the same send
const UNKNOWN_ACTOR = 'עובד לא ידוע';
const SYSTEM_ACTOR = 'מערכת';

// ---- small helpers ----------------------------------------------------------------------------

const IL_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

// Israel calendar day + wall-clock time of an instant (servers run in UTC; never slice ISO strings).
export function israelParts(date) {
  const p = {};
  for (const part of IL_FORMAT.formatToParts(date)) p[part.type] = part.value;
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

function toDate(value) {
  if (!value) return new Date(0);
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

function safeParse(json) {
  if (json && typeof json === 'object') return { ok: true, value: json };
  try {
    return { ok: true, value: JSON.parse(json) };
  } catch {
    return { ok: false, value: null };
  }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isFromTo = (c) => isPlainObject(c) && ('from' in c || 'to' in c);
// Prisma write data may carry `{ set: value }` for a scalar.
const unwrapSet = (v) => (isPlainObject(v) && 'set' in v ? v.set : v);
const sameValue = (a, b) => (isEmptyValue(a) && isEmptyValue(b)) || String(a) === String(b);

const itemsText = (n) => (n === 1 ? 'פריט אחד' : `${n} פריטים`);
const orderHref = (orderId) => `/orders/${orderId}`;
const orderRef = (orderId) => (orderId == null ? null : { type: 'Order', id: String(orderId), orderId: Number(orderId), href: orderHref(orderId) });

// Internal shape {id, name}: makeEntry keeps only the name in the entry (the employee UUID never leaves
// the server) and remembers "was there a real employee" in a hidden field.
export function actorFor(ctx, employeeId) {
  if (!employeeId) return { id: null, name: SYSTEM_ACTOR };
  const name = ctx && ctx.actorNames ? ctx.actorNames.get(employeeId) : null;
  return { id: employeeId, name: name || UNKNOWN_ACTOR };
}

const clip = (v) => (typeof v === 'string' ? shorten(v, DETAIL_VALUE_MAX) : v);

function makeEntry(ctx, e) {
  const at = toDate(e.at);
  const { day, time } = israelParts(at);
  const hebrewDate = ctx && typeof ctx.hebrewDate === 'function' ? ctx.hebrewDate(at) || '' : '';
  const entry = {
    id: e.id,
    groupId: e.groupId || e.id,
    seq: e.seq || 0,
    at: at.toISOString(),
    day,
    time,
    hebrewDate,
    category: e.category,
    type: e.type,
    icon: e.icon,
    title: clip(e.title),
    detail: clip(e.detail || ''),
    details: (e.details || []).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, clip(v)]),
    actor: { name: e.actor ? e.actor.name : SYSTEM_ACTOR },
    entityRef: e.entityRef || null,
    source: e.source,
  };
  if (e.amount !== undefined && e.amount !== null) {
    entry.amount = e.amount;
    if (e.amountKind) entry.amountKind = e.amountKind;
  }
  if (e.field !== undefined) {
    entry.field = e.field;
    entry.fieldLabel = e.fieldLabel;
    if ('from' in e) entry.from = clip(e.from);
    if ('to' in e) entry.to = clip(e.to);
  }
  if (e.actor && e.actor.id) Object.defineProperty(entry, '_actorId', { value: true, enumerable: false });
  if (e.mailKey) Object.defineProperty(entry, '_mailKey', { value: e.mailKey, enumerable: false });
  if (e.dedupeKey) Object.defineProperty(entry, '_dedupeKey', { value: e.dedupeKey, enumerable: false });
  if (e.hasNote) Object.defineProperty(entry, '_hasNote', { value: true, enumerable: false });
  if (e.burstKey) Object.defineProperty(entry, '_burstKey', { value: e.burstKey, enumerable: false });
  return entry;
}

const customerRef = (ctx) => (ctx && ctx.customerId ? { type: 'Customer', id: ctx.customerId, href: `/customers/${ctx.customerId}` } : null);

// ---- Customer AuditLog rows -------------------------------------------------------------------

function fieldTitle(key, to, label) {
  if (key === 'isBlocked') return to === true ? 'הלקוח נחסם מהזמנות חדשות' : 'החסימה הוסרה';
  if (key === 'isDeleted') return to === true ? 'כרטיס הלקוח נמחק' : 'כרטיס הלקוח שוחזר';
  if (typeof to === 'boolean') return `${label} ${to ? 'סומן' : 'בוטל'}`;
  return `${updatedVerb(key)} ${label}`;
}

// ---- value display (what may be shown of a stored value) ----------------------------------------

// ID number and bank accounts: last 3-4 characters only.
const SENSITIVE_ID_KEYS = new Set(['bankAccount', 'hokBankAccount', 'zeout']);
// values that are secrets by nature: the line says the field changed, never the value
const HIDDEN_VALUE_KEY = /(password|pinhash|token|secret|cardnumber|lastnum|hokdetails|paymentdetails)/i;
const HIDDEN_VALUE_TEXT = 'לא מוצג';

// Display text of one stored value of field `key`: Hebrew date for dates, כן/לא for booleans, identifiers
// masked, card-like numbers masked, internal ids removed, length capped.
export function displayValue(key, raw, ctx) {
  const v = unwrapSet(raw);
  if (isEmptyValue(v)) return EMPTY_TEXT;
  if (HIDDEN_VALUE_KEY.test(key)) return HIDDEN_VALUE_TEXT;
  if (SENSITIVE_ID_KEYS.has(key)) return maskIdentifier(v);
  // notes / addresses / phones stay readable; card numbers and ID / account numbers behind their keyword are masked
  return safeNoteText(formatFieldValue(key, v, ctx), DETAIL_VALUE_MAX) || EMPTY_TEXT;
}

// "16.9.2026" / "2026-09-16" inside system-written text -> Hebrew date (the feed shows no Gregorian dates).
export function hebrewizeDates(text, ctx) {
  const s = String(text ?? '');
  if (!ctx || typeof ctx.hebrewDate !== 'function') return s;
  const conv = (y, mo, d, whole) => {
    const year = Number(y); const month = Number(mo); const day = Number(d);
    if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return whole;
    return ctx.hebrewDate(new Date(Date.UTC(year, month - 1, day, 12))) || whole;
  };
  // one pass: "d.m.yyyy" or "yyyy-mm-dd" (a second pass would re-read the digits of the first one's output)
  return s.replace(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b|\b(\d{4})-(\d{2})-(\d{2})\b/g,
    (m, d1, mo1, y1, y2, mo2, d2) => (y1 ? conv(y1, mo1, d1, m) : conv(y2, mo2, d2, m)));
}

// One UPDATE row ({field:{from,to}, ...}) -> one entry per changed field. Fields that are not a
// change (from == to, or both empty) and write-side bookkeeping columns get no line; a row that
// ends up with no line at all still yields ONE "no visible change" entry, so no row disappears.
export function explodeCustomerUpdate(row, changes, ctx) {
  const groupId = `audit:${row.id}`;
  const actor = actorFor(ctx, row.employeeId);
  const entries = [];
  let hidden = 0;
  let unknownKeys = 0; // columns nobody labelled: one generic line, no key name, no value
  for (const key of Object.keys(changes || {})) {
    if (HIDDEN_CUSTOMER_FIELDS.has(key)) { hidden += 1; continue; }
    if (!Object.prototype.hasOwnProperty.call(CUSTOMER_FIELD_LABELS, key)) {
      const c = changes[key];
      if (!(isFromTo(c) && sameValue(c.from, c.to))) unknownKeys += 1;
      continue;
    }
    const c = changes[key];
    const label = fieldLabel(key);
    let hasFrom = false;
    let from;
    let to;
    if (isFromTo(c)) {
      if (sameValue(c.from, c.to)) continue;
      hasFrom = true;
      from = c.from;
      to = c.to;
    } else {
      // generic snapshot rows (e.g. the refund flow updating bank details) hold plain values
      to = unwrapSet(c);
    }
    const fromText = hasFrom ? displayValue(key, from, ctx) : undefined;
    const toText = displayValue(key, to, ctx);
    entries.push(makeEntry(ctx, {
      id: `${groupId}#${key}`,
      groupId,
      seq: entries.length,
      at: row.createdAt,
      category: 'cust',
      type: 'field-update',
      icon: fieldIcon(key),
      title: fieldTitle(key, to, label),
      detail: hasFrom ? `${shorten(fromText, DETAIL_MAX)} ← ${shorten(toText, DETAIL_MAX)}` : shorten(toText, DETAIL_MAX),
      details: hasFrom ? [['לפני', fromText], ['אחרי', toText]] : [['ערך', toText]],
      actor,
      entityRef: customerRef(ctx),
      field: key,
      fieldLabel: label,
      ...(hasFrom ? { from: fromText } : {}),
      to: toText,
      source: 'customer-audit',
    }));
  }
  if (unknownKeys) {
    // The key list of an unreviewed column is never printed (raw English names, possibly secrets): the line
    // only says that more details were saved.
    entries.push(makeEntry(ctx, {
      id: `${groupId}#other`,
      groupId,
      seq: entries.length,
      at: row.createdAt,
      category: 'cust',
      type: 'field-update',
      icon: 'user',
      title: 'עודכנו פרטים',
      detail: '',
      details: [],
      actor,
      entityRef: customerRef(ctx),
      field: 'other',
      fieldLabel: 'פרטים נוספים',
      source: 'customer-audit',
    }));
  }
  if (entries.length === 0) {
    entries.push(makeEntry(ctx, {
      id: groupId,
      groupId,
      at: row.createdAt,
      category: 'cust',
      type: 'update-empty',
      icon: 'user',
      title: 'נשמר כרטיס הלקוח ללא שינוי בשדות',
      detail: hidden ? 'עודכנו נתוני מערכת בלבד' : '',
      details: [],
      actor,
      entityRef: customerRef(ctx),
      source: 'customer-audit',
    }));
  }
  return entries;
}

function mailEntry(ctx, { id, at, employeeId, subject, to, files, sendMode, category = 'docs', entityRef, source, title }) {
  const fileNames = Array.isArray(files) ? files.map((f) => (f && f.fileName) || '').filter(Boolean) : [];
  // a subject is typed text: a card number in it must not reach the feed (CUS-1); the twin key below is
  // computed from the RAW subject (it never leaves the server)
  const shownSubject = isEmptyValue(subject) ? '' : redactFreeText(subject, 120);
  return makeEntry(ctx, {
    id,
    at,
    category,
    type: 'mail',
    icon: 'mail',
    title: title || `נשלח מייל: ${shownSubject || 'ללא נושא'}`,
    detail: to ? `אל ${to}` : '',
    details: [['נמען', to], ['נושא', shownSubject], ['קבצים', fileNames.join(', ')], ['אופן שליחה', sendMode]],
    actor: actorFor(ctx, employeeId),
    entityRef,
    source,
    mailKey: mailKeyOf(to, subject),
  });
}

function mailKeyOf(to, subject) {
  return `${String(to || '').trim().toLowerCase()}|${String(subject || '').trim()}`;
}

// Keys an UNKNOWN-action audit row may show. Everything else (ids, standing-order JSON, snapshots of
// columns nobody reviewed) stays out of the feed: the row still yields its one generic line.
const GENERIC_KEY_LABELS = {
  note: 'הערה', subject: 'נושא', to: 'נמען', sendMode: 'אופן שליחה', amount: 'סכום', approvedDebtAmount: 'חוב מאושר',
  orderId: 'הזמנה', status: 'סטטוס', type: 'סוג', issueType: 'סוג', reason: 'סיבה', count: 'כמות', totalAmount: 'סכום ההזמנה',
  eventDate: 'תאריך האירוע', returnDate: 'תאריך החזרה', orderDate: 'תאריך ההזמנה', isDelivery: 'משלוח', discarded: 'בוטל',
};
const GENERIC_ALLOWED_KEYS = new Set([
  ...Object.keys(CUSTOMER_FIELD_LABELS).filter((k) => k !== 'id'),
  ...Object.keys(GENERIC_KEY_LABELS),
]);

function genericRowEntry(row, parsed, ctx, category, ref, source) {
  const action = row.action;
  const base = ACTION_LABELS[action] || `פעולה: ${action}`;
  const pairs = [];
  if (parsed.ok && isPlainObject(parsed.value)) {
    for (const key of Object.keys(parsed.value)) {
      if (!GENERIC_ALLOWED_KEYS.has(key)) continue;
      const v = parsed.value[key];
      const label = GENERIC_KEY_LABELS[key] || fieldLabel(key);
      pairs.push([label, isFromTo(v)
        ? `${displayValue(key, v.from, ctx)} ← ${displayValue(key, v.to, ctx)}`
        : displayValue(key, v, ctx)]);
    }
  }
  // an unparseable payload is never echoed (it can be card / standing-order JSON cut in the middle)
  const detail = parsed.ok ? pairs.slice(0, 3).map(([k, v]) => `${k}: ${shorten(v, 24)}`).join(' · ') : '';
  return makeEntry(ctx, {
    id: `audit:${row.id}`,
    at: row.createdAt,
    category,
    type: parsed.ok ? 'other' : 'unparsed',
    icon: 'note',
    title: base,
    detail,
    details: pairs,
    actor: actorFor(ctx, row.employeeId),
    entityRef: ref,
    source,
  });
}

// AuditLog row (entityType 'Customer') -> entries[]. Never returns an empty list.
export function mapCustomerAuditRow(row, ctx) {
  const parsed = safeParse(row.changesJson);
  const value = parsed.ok && isPlainObject(parsed.value) ? parsed.value : null;
  const ref = customerRef(ctx);
  const actor = actorFor(ctx, row.employeeId);
  const id = `audit:${row.id}`;

  if (!value) return [genericRowEntry(row, parsed, ctx, 'cust', ref, 'customer-audit')];

  switch (row.action) {
    case 'UPDATE':
      return explodeCustomerUpdate(row, value, ctx);
    case 'CREATE': {
      const name = [value.firstName, value.lastName].filter((x) => !isEmptyValue(x)).join(' ');
      return [makeEntry(ctx, {
        id, at: row.createdAt, category: 'cust', type: 'created', icon: 'user',
        title: 'כרטיס לקוח נפתח',
        detail: [name, value.phone1].filter((x) => !isEmptyValue(x)).join(' · '),
        details: [['שם', name], ['טלפון', value.phone1], ['עיר', value.city], ['דוא"ל', value.email]],
        actor, entityRef: ref, source: 'customer-audit',
      })];
    }
    case 'DELETE':
      return [makeEntry(ctx, {
        id, at: row.createdAt, category: 'cust', type: 'deleted', icon: 'alert',
        title: 'כרטיס הלקוח נמחק', detail: '', details: [], actor, entityRef: ref, source: 'customer-audit',
      })];
    case 'ADD_AUTO_NOTE': {
      const note = String(value.note || '');
      const orderNo = (note.match(/\(הזמנה\s+(\d+)\)/) || [])[1];
      // the stored text starts with a Gregorian "[16.9.2026] " stamp - the entry already carries its own (Hebrew) date
      const text = safeNoteText(hebrewizeDates(note.replace(/^\[[^\]]*\]\s*/, ''), ctx), DETAIL_VALUE_MAX);
      return [makeEntry(ctx, {
        id, at: row.createdAt, category: 'cust', type: 'auto-note', icon: 'note',
        title: 'נוספה הערה אוטומטית',
        detail: shorten(text, 80),
        details: [['הערה', text], ['סוג', ISSUE_TYPE_LABELS[value.issueType] || value.issueType]],
        actor, entityRef: orderNo ? orderRef(orderNo) : ref, source: 'customer-audit',
      })];
    }
    case 'EMAIL_SENT':
      return [mailEntry(ctx, {
        id, at: row.createdAt, employeeId: row.employeeId, subject: value.subject, to: value.to,
        files: value.files, sendMode: value.sendMode, entityRef: ref, source: 'customer-audit',
      })];
    default:
      return [genericRowEntry(row, parsed, ctx, 'cust', ref, 'customer-audit')];
  }
}

// ---- Orders -----------------------------------------------------------------------------------

// Order row -> "order opened" entry. `order._count.items` (non-deleted items) is optional.
export function mapOrderRow(order, ctx) {
  const n = order.orderId;
  const itemCount = order._count && typeof order._count.items === 'number' ? order._count.items : null;
  const eventHeb = order.eventDateHebrew || (order.eventDate && ctx && typeof ctx.hebrewDate === 'function' ? ctx.hebrewDate(toDate(order.eventDate)) : '');
  const delivery = order.isDelivery ? `משלוח${order.deliveryDirection ? ` ${order.deliveryDirection}` : ''}${order.deliveryCity ? ` · ${order.deliveryCity}` : ''}` : '';
  const total = typeof order.totalAmount === 'number' && order.totalAmount > 0 ? order.totalAmount : null;
  return [makeEntry(ctx, {
    id: `order:${order.id}`,
    at: order.orderDate || order.updatedAt,
    category: 'orders',
    type: 'order-opened',
    icon: 'file',
    title: `נפתחה הזמנה #${n}`,
    detail: [order.isDeleted ? 'בוטלה' : '', itemCount !== null ? itemsText(itemCount) : '', delivery, eventHeb ? `אירוע ${eventHeb}` : ''].filter(Boolean).join(' · '),
    details: [['הזמנה', `#${n}`], ['אירוע', eventHeb], ['פריטים', itemCount !== null ? String(itemCount) : ''], ['סטטוס', order.isDeleted ? 'בוטלה' : ''], ['משלוח', delivery], ['סכום', total !== null ? formatMoney(total) : '']],
    amount: total,
    amountKind: total !== null ? 'chg' : undefined,
    actor: actorFor(ctx, order.employeeId),
    entityRef: orderRef(n),
    source: 'order',
  })];
}

// AuditLog row on an Order (only the ORDER_AUDIT_ACTIONS are fetched). `ctx.orderByKey` maps both
// id forms (UUID and String(orderId)) to the order, because the table mixes them.
export function mapOrderAuditRow(row, ctx) {
  const order = ctx && ctx.orderByKey ? ctx.orderByKey.get(row.entityId) : null;
  const n = order ? order.orderId : (/^\d+$/.test(row.entityId) ? Number(row.entityId) : null);
  const label = n !== null ? `#${n}` : '';
  const parsed = safeParse(row.changesJson);
  const value = parsed.ok && isPlainObject(parsed.value) ? parsed.value : {};
  const ref = orderRef(n);
  const actor = actorFor(ctx, row.employeeId);
  const id = `audit:${row.id}`;
  const common = { id, at: row.createdAt, actor, entityRef: ref, source: 'order-audit' };

  switch (row.action) {
    case 'CANCEL_ORDER': {
      // the cancel note is typed text (it can carry a card / account number): CUS-1
      const note = typeof value.note === 'string' ? redactFreeText(value.note, DETAIL_VALUE_MAX) : '';
      return [makeEntry(ctx, {
        ...common, category: 'orders', type: 'order-cancelled', icon: 'file',
        title: `הזמנה ${label} בוטלה`, detail: note, details: [['הזמנה', label], ['הערה', note]],
        dedupeKey: `CANCEL_ORDER:${n}`, hasNote: Boolean(note),
      })];
    }
    case 'DEBT_APPROVED': {
      const amount = value.approvedDebtAmount;
      return [makeEntry(ctx, {
        ...common, category: 'orders', type: 'debt-approved', icon: 'shield',
        title: `אושרה יתרת חוב בהזמנה ${label}`,
        detail: typeof amount === 'number' ? formatMoney(amount) : '',
        details: [['הזמנה', label], ['חוב מאושר', typeof amount === 'number' ? formatMoney(amount) : '']],
      })];
    }
    case 'CANCEL_DEBT_APPROVAL':
      return [makeEntry(ctx, {
        ...common, category: 'orders', type: 'debt-approval-cancelled', icon: 'shield',
        title: `בוטל אישור יתרת חוב בהזמנה ${label}`, detail: '', details: [['הזמנה', label]],
      })];
    case 'EMAIL_SENT':
      return [mailEntry(ctx, {
        id, at: row.createdAt, employeeId: row.employeeId, subject: value.subject, to: value.to,
        files: value.files, sendMode: value.sendMode, entityRef: ref, source: 'order-audit',
        title: `נשלח מייל הזמנה ${label}`.trim(),
      })];
    case 'ORDER_PRINTED': {
      // doc 'schedule' = a schedule print page other than prep/delivery (named by `sheet`); a batch print by the schedule print page
      // is a WHOLE-DAY print of that page that listed this order (W7 / AMB-20): "הודפס דף הכנה #N (הדפסת יום)"
      const docLabel = value.doc === 'schedule' ? (SCHEDULE_SHEET_LABELS[value.sheet] || 'דף לו״ז') : (ORDER_PRINT_DOC_LABELS[value.doc] || 'הזמנה');
      const dayPrint = !!value.batch && value.source === 'print-page' && ['prep', 'delivery', 'schedule'].includes(value.doc);
      return [makeEntry(ctx, {
        ...common, category: 'docs', type: 'order-printed', icon: 'file',
        title: `הודפס ${docLabel} ${label}${dayPrint ? ' (הדפסת יום)' : ''}`.trim(), detail: dayPrint ? 'הדפסת יום' : (value.batch ? 'הדפסה מרוכזת' : ''),
        details: [['הזמנה', label], ['מסמך', docLabel]],
      })];
    }
    case 'UPDATE':
    case 'UPDATE_ORDER':
      return [makeEntry(ctx, {
        ...common, category: 'orders', type: 'order-updated', icon: 'file',
        title: `עודכנה הזמנה ${label}`.trim(), detail: '', details: [['הזמנה', label]],
        burstKey: `ORDER_UPDATE:${n}`,
      })];
    default:
      return [genericRowEntry(row, parsed, ctx, 'orders', ref, 'order-audit')];
  }
}

// ---- Payments / refunds -----------------------------------------------------------------------

export function mapPaymentRow(payment, ctx) {
  const amount = Number(payment.amount) || 0;
  const method = (payment.paymentMethod || '').trim();
  const phrase = paymentMethodPhrase(method);
  const orderNo = payment.orderId;
  const employeeId = ctx && ctx.paymentActors ? ctx.paymentActors.get(payment.id) : null;
  const isCredit = amount < 0 || payment.isRefund === true;
  let title;
  let type = 'payment';
  let amountKind;
  let shownAmount;
  if (payment.isDeleted) {
    title = `תשלום בוטל${phrase ? ` (${method})` : ''}`;
    type = 'payment-cancelled';
  } else if (amount === 0) {
    title = method || 'רישום תשלום ללא סכום';
  } else if (isCredit) {
    title = 'בוצע זיכוי';
    type = 'credit';
    amountKind = 'crd';
    shownAmount = -Math.abs(amount);
  } else {
    title = phrase ? `התקבל תשלום ${phrase}` : `התקבל תשלום${method ? ` (${method})` : ''}`;
    amountKind = 'pay';
    shownAmount = amount;
  }
  // raw Payment.notes hold the Nedarim response / refund bank details: only "ספרות NNNN" + instalments
  // for a card, redacted text otherwise
  const note = paymentNoteSummary(payment.notes);
  return [makeEntry(ctx, {
    id: `payment:${payment.id}`,
    at: payment.paymentDate,
    category: 'pay',
    type,
    icon: amount === 0 ? 'note' : (isCredit && !payment.isDeleted ? 'refresh' : paymentMethodIcon(method)),
    title,
    detail: [orderNo != null ? `הזמנה #${orderNo}` : '', note].filter(Boolean).join(' · '),
    details: [['שיטה', method], ['סכום', formatMoney(amount)], ['הזמנה', orderNo != null ? `#${orderNo}` : ''], ['הערות', note]],
    amount: shownAmount,
    amountKind,
    actor: actorFor(ctx, employeeId),
    entityRef: orderRef(orderNo),
    source: 'payment',
  })];
}

// A Refund row is a REQUEST (created) and, once done, an EXECUTION. The money only moves at the
// execution - so only that entry carries `amount`, and the reverse Payment row that the execution
// creates is excluded from the payments query (no double counting).
export function mapRefundRow(refund, ctx) {
  const amount = Math.abs(Number(refund.amount) || 0);
  const orderNo = refund.orderId;
  const createdBy = ctx && ctx.refundCreators ? ctx.refundCreators.get(refund.id) : null;
  const reason = redactFreeText(refund.reason, 200);
  const entries = [makeEntry(ctx, {
    id: `refund:${refund.id}`,
    at: refund.createdAt,
    category: 'pay',
    type: 'refund-requested',
    icon: 'refresh',
    title: refund.isAutoGenerated ? 'נוצרה בקשת זיכוי אוטומטית' : 'נפתחה בקשת זיכוי',
    detail: [formatMoney(amount), orderNo != null ? `הזמנה #${orderNo}` : '', reason].filter(Boolean).join(' · '),
    details: [['סכום', formatMoney(amount)], ['הזמנה', orderNo != null ? `#${orderNo}` : ''], ['סיבה', reason]],
    actor: actorFor(ctx, createdBy),
    entityRef: orderRef(orderNo),
    source: 'refund',
  })];
  if (refund.isExecuted && refund.executionDate) {
    entries.push(makeEntry(ctx, {
      id: `refund:${refund.id}:executed`,
      groupId: `refund:${refund.id}`,
      seq: 1,
      at: refund.executionDate,
      category: 'pay',
      type: 'refund-executed',
      icon: 'refresh',
      title: 'בוצע זיכוי',
      detail: [formatMoney(amount), orderNo != null ? `הזמנה #${orderNo}` : ''].filter(Boolean).join(' · '),
      details: [['סכום', formatMoney(amount)], ['הזמנה', orderNo != null ? `#${orderNo}` : '']],
      amount: -amount,
      amountKind: 'crd',
      actor: actorFor(ctx, ctx && ctx.refundExecutors ? ctx.refundExecutors.get(refund.id) : null),
      entityRef: orderRef(orderNo),
      source: 'refund',
    }));
  }
  return entries;
}

// ---- EmailLog ---------------------------------------------------------------------------------

export function mapEmailLogRow(log, ctx) {
  const failed = log.status && log.status !== 'success';
  const subject = isEmptyValue(log.subject) ? 'ללא נושא' : redactFreeText(log.subject, 120);
  const entry = mailEntry(ctx, {
    id: `email:${log.id}`,
    at: log.sentAt,
    employeeId: log.employeeId,
    subject: log.subject,
    to: log.to,
    files: log.fileName ? log.fileName.split(',').map((f) => ({ fileName: f.trim() })) : [],
    entityRef: customerRef(ctx),
    source: 'email-log',
    title: failed ? `שליחת מייל נכשלה: ${subject}` : `נשלח מייל: ${subject}`,
  });
  // SMTP errors carry the sender account / recipient address: only a generic reason is shown
  if (failed && log.errorMessage) entry.details.push(['שגיאה', safeMailError(log.errorMessage)]);
  if (!failed) Object.defineProperty(entry, '_mailOk', { value: true, enumerable: false });
  return [entry];
}

// ---- assembly ---------------------------------------------------------------------------------

// Newest first. Entries of the same instant: newer group first, and inside one group (one saved
// card = several field lines) the stored field order, top to bottom. Ties end on id, so the order
// is total and cursors are stable.
export function compareEntries(a, b) {
  if (a.at !== b.at) return a.at < b.at ? 1 : -1;
  if (a.groupId !== b.groupId) return a.groupId < b.groupId ? 1 : -1;
  if (a.seq !== b.seq) return a.seq - b.seq;
  if (a.id !== b.id) return a.id < b.id ? 1 : -1;
  return 0;
}

function dropNearDuplicates(entries) {
  // the same logical event written as two audit rows a few ms apart (CANCEL_ORDER is one) - keep
  // the one that carries the note, else the first written
  const byKey = new Map();
  for (const e of entries) {
    if (!e._dedupeKey) continue;
    if (!byKey.has(e._dedupeKey)) byKey.set(e._dedupeKey, []);
    byKey.get(e._dedupeKey).push(e);
  }
  const drop = new Set();
  for (const list of byKey.values()) {
    list.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    let anchor = null;
    for (const e of list) {
      if (anchor && Date.parse(e.at) - Date.parse(anchor.at) <= NEAR_DUPLICATE_MS) {
        if (e._hasNote && !anchor._hasNote) { drop.add(anchor.id); anchor = e; } else drop.add(e.id);
      } else {
        anchor = e;
      }
    }
  }
  return entries.filter((e) => !drop.has(e.id));
}

// One order-card save writes a run of UPDATE rows a few seconds apart (order, items, recalculation).
// A run on the same order (each row within BURST_GAP_MS of the previous one) is one line in the feed:
// the newest row stands for it, credited to the run's FIRST (oldest) real employee - the one who pressed
// save; later rows are the system's follow-ups and system rows carry no actor - with the run length in
// `detail`. The feed is assembled from ALL loaded rows before it is paged, so a page boundary can never
// cut a run in two (the old source-level cursor could).
function collapseBursts(entries) {
  const byKey = new Map();
  for (const e of entries) {
    if (!e._burstKey) continue;
    if (!byKey.has(e._burstKey)) byKey.set(e._burstKey, []);
    byKey.get(e._burstKey).push(e);
  }
  const drop = new Set();
  const replace = new Map();
  for (const list of byKey.values()) {
    list.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1));
    let run = [];
    const flush = () => {
      if (run.length > 1) {
        const newest = run[run.length - 1];
        const withActor = run.find((r) => r._actorId) || newest;
        for (const r of run) drop.add(r.id);
        replace.set(newest.id, { ...newest, actor: withActor.actor, detail: `${run.length} עדכונים ברצף` });
        drop.delete(newest.id);
      }
      run = [];
    };
    for (const e of list) {
      if (run.length && Date.parse(e.at) - Date.parse(run[run.length - 1].at) > BURST_GAP_MS) flush();
      run.push(e);
    }
    flush();
  }
  return entries.filter((e) => !drop.has(e.id)).map((e) => replace.get(e.id) || e);
}

function dropMailDuplicates(entries) {
  // sending from the customer card writes an EmailLog row AND an EMAIL_SENT audit row - one event.
  // The audit row wins (it knows the approver-side details); its SUCCESSFUL EmailLog twin is dropped.
  // One audit row absorbs at most one log row (a resend a few seconds later is a second event), and a
  // FAILED log row is never a twin: the failure must stay visible. Pairing is by distance: the closest
  // (log, audit) pairs of the same recipient + subject are matched first, so two sends inside the window
  // pair up correctly instead of the first log grabbing the wrong audit row.
  const audits = new Map();
  for (const e of entries) {
    if (e.type !== 'mail' || e.source === 'email-log' || !e._mailKey) continue;
    if (!audits.has(e._mailKey)) audits.set(e._mailKey, []);
    audits.get(e._mailKey).push(e);
  }
  if (!audits.size) return entries;
  const pairs = [];
  for (const log of entries) {
    if (log.source !== 'email-log' || !log._mailOk || !log._mailKey) continue;
    for (const a of audits.get(log._mailKey) || []) {
      const gap = Math.abs(Date.parse(a.at) - Date.parse(log.at));
      if (gap <= MAIL_DUPLICATE_MS) pairs.push({ log, a, gap });
    }
  }
  pairs.sort((x, y) => x.gap - y.gap || (x.log.id < y.log.id ? -1 : x.log.id > y.log.id ? 1 : 0) || (x.a.id < y.a.id ? -1 : x.a.id > y.a.id ? 1 : 0));
  const usedAudit = new Set();
  const drop = new Set();
  for (const { log, a } of pairs) {
    if (drop.has(log.id) || usedAudit.has(a.id)) continue;
    drop.add(log.id);
    usedAudit.add(a.id);
  }
  return entries.filter((e) => !drop.has(e.id));
}

// sources: { auditRows, orders, orderAuditRows, payments, refunds, emailLogs } (all optional)
// ctx: { customerId, actorNames: Map, hebrewDate?: fn, paymentActors?: Map, refundCreators?: Map, refundExecutors?: Map }
export function buildCustomerHistory(sources, ctx) {
  const s = sources || {};
  const orders = s.orders || [];
  const fullCtx = { ...ctx };
  if (!fullCtx.orderByKey) {
    fullCtx.orderByKey = new Map();
    for (const o of orders) { fullCtx.orderByKey.set(o.id, o); fullCtx.orderByKey.set(String(o.orderId), o); }
  }
  const entries = [
    ...(s.auditRows || []).flatMap((r) => mapCustomerAuditRow(r, fullCtx)),
    ...orders.flatMap((o) => mapOrderRow(o, fullCtx)),
    ...(s.orderAuditRows || []).flatMap((r) => mapOrderAuditRow(r, fullCtx)),
    ...(s.payments || []).flatMap((p) => mapPaymentRow(p, fullCtx)),
    ...(s.refunds || []).flatMap((r) => mapRefundRow(r, fullCtx)),
    ...(s.emailLogs || []).flatMap((l) => mapEmailLogRow(l, fullCtx)),
  ];
  return dropMailDuplicates(collapseBursts(dropNearDuplicates(entries))).sort(compareEntries);
}

// ---- cursor / paging --------------------------------------------------------------------------

// The cursor is the position of the last entry of the previous page in the total feed order (instant,
// group, line, id). It is opaque (base64url of a small JSON object) and never trusted: decodeCursor
// validates every field and returns null for anything else.
const MAX_CURSOR_TEXT = 200;
const b64 = {
  enc: (s) => {
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  dec: (s) => {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  },
};

export function encodeCursor(entry) {
  return b64.enc(JSON.stringify({ at: entry.at, g: entry.groupId, s: entry.seq || 0, id: entry.id }));
}

// -> { at: Date, id, groupId, seq } | null (null = malformed / tampered)
export function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== 'string' || cursor.length > 1000 || !/^[A-Za-z0-9_-]+$/.test(cursor)) return null;
  try {
    const obj = JSON.parse(b64.dec(cursor));
    if (!isPlainObject(obj)) return null;
    const at = typeof obj.at === 'string' ? new Date(obj.at) : null;
    if (!at || Number.isNaN(at.getTime())) return null;
    if (typeof obj.id !== 'string' || typeof obj.g !== 'string' || obj.id.length > MAX_CURSOR_TEXT || obj.g.length > MAX_CURSOR_TEXT) return null;
    const seq = Number(obj.s);
    if (!Number.isInteger(seq) || seq < 0 || seq > 1e6) return null;
    return { at, id: obj.id, groupId: obj.g, seq };
  } catch {
    return null;
  }
}

// entries strictly after the cursor in feed order (see compareEntries)
export function afterCursor(entries, cursor) {
  if (!cursor) return entries;
  const anchor = { at: cursor.at.toISOString(), groupId: cursor.groupId, seq: cursor.seq, id: cursor.id };
  return entries.filter((e) => compareEntries(anchor, e) < 0);
}

export function countByCategory(entries) {
  const counts = { all: entries.length };
  for (const c of CATEGORIES) counts[c] = 0;
  for (const e of entries) counts[e.category] = (counts[e.category] || 0) + 1;
  return counts;
}

export function normalizeLimit(value) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

// Cut one page out of the (already assembled and sorted) feed.
//   cursor      - decoded cursor | null: the page starts right after that position
//   categories  - Set of wanted categories (null = all); filters the page, not the counts
// `counts` describe the WHOLE assembled feed (all categories, before the cursor and the filter), so a filter
// menu can show every total; `countsScope` says so. The feed is bounded (SOURCE_CAP newest rows per source).
export function assemblePage(sortedEntries, { limit, cursor = null, categories = null }) {
  let list = afterCursor(sortedEntries, cursor);
  if (categories) list = list.filter((e) => categories.has(e.category));
  const page = list.slice(0, limit);
  return {
    entries: page,
    nextCursor: list.length > limit && page.length ? encodeCursor(page[page.length - 1]) : null,
    counts: countByCategory(sortedEntries),
    countsScope: 'feed',
  };
}

// ---- database access (Prisma client injected) --------------------------------------------------

function displayName(e) {
  if (!e) return null;
  if (e.fullName) return e.fullName;
  return [e.firstName, e.lastName].filter(Boolean).join(' ').trim() || null;
}

// Reads (bounded, no transaction, three sequential rounds) every source: the newest SOURCE_CAP rows of each.
// Returns raw rows + lookup maps + `truncated` (names of the sources that hit the cap).
export async function loadCustomerHistorySources(prisma, customerId) {
  const take = SOURCE_CAP + 1; // one extra row tells "exactly at the cap" from "more rows exist"
  const truncated = [];
  const capped = (rows, name) => {
    if (rows.length <= SOURCE_CAP) return rows;
    truncated.push(name);
    return rows.slice(0, SOURCE_CAP);
  };

  // round 1: everything that hangs off the customer directly
  const [auditFetched, ordersFetched, paymentsFetched, refundsFetched, emailFetched] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entityType: 'Customer', entityId: customerId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
    }),
    prisma.order.findMany({
      where: { customerId },
      select: {
        id: true, orderId: true, orderDate: true, updatedAt: true, eventDate: true, eventDateHebrew: true,
        totalAmount: true, isDeleted: true, isDelivery: true, deliveryDirection: true, deliveryCity: true,
        employeeId: true, _count: { select: { items: { where: { isDeleted: false } } } },
      },
      orderBy: { orderId: 'desc' },
      take,
    }),
    prisma.payment.findMany({
      where: {
        OR: [{ customerId }, { order: { customerId } }],
        // the reverse payment a refund execution creates is shown as that refund's own entry
        NOT: { isRefund: true, refunds: { some: {} } },
      },
      select: { id: true, orderId: true, amount: true, paymentDate: true, paymentMethod: true, notes: true, isDeleted: true, isRefund: true },
      orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }],
      take,
    }),
    prisma.refund.findMany({
      where: { customerId, isDeleted: false },
      select: { id: true, orderId: true, amount: true, reason: true, isExecuted: true, executionDate: true, executedBy: true, isAutoGenerated: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take,
    }),
    prisma.emailLog.findMany({
      where: { customerId },
      select: { id: true, to: true, subject: true, fileName: true, status: true, errorMessage: true, employeeId: true, sentAt: true },
      orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
      take,
    }),
  ]);
  const auditRows = capped(auditFetched, 'audit');
  const orders = capped(ordersFetched, 'orders');
  const payments = capped(paymentsFetched, 'payments');
  const refunds = capped(refundsFetched, 'refunds');
  const emailLogs = capped(emailFetched, 'emails');

  // round 2: audit rows of the customer's orders (plain UPDATE rows - a save writes many - in their own
  // query so they cannot crowd out the rare, important actions) + who created each payment/refund
  const orderKeys = orders.flatMap((o) => [o.id, String(o.orderId)]);
  const creatorIds = [...payments.map((p) => p.id), ...refunds.map((r) => r.id)];
  const otherActions = ORDER_AUDIT_ACTIONS.filter((a) => !ORDER_UPDATE_ACTIONS.includes(a));
  const orderAuditQuery = (action) => prisma.auditLog.findMany({
    where: { entityType: 'Order', entityId: { in: orderKeys }, action },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take,
  });
  const [otherOrderAudit, updateOrderAudit, creatorRows] = await Promise.all([
    orderKeys.length ? orderAuditQuery({ in: otherActions }) : [],
    orderKeys.length ? orderAuditQuery({ in: ORDER_UPDATE_ACTIONS }) : [],
    creatorIds.length
      ? prisma.auditLog.findMany({
        where: { entityType: { in: ['Payment', 'Refund'] }, action: { in: ['CREATE', 'EXECUTE'] }, entityId: { in: creatorIds } },
        select: { entityId: true, action: true, employeeId: true },
        take: creatorIds.length * 3,
      })
      : [],
  ]);
  const orderAuditRows = [...capped(otherOrderAudit, 'orderAudit'), ...capped(updateOrderAudit, 'orderUpdates')];

  // round 3: who created each payment/refund, and who executed each refund (audit rows know;
  // Refund.executedBy holds an employee code such as '141' (Employee.legacyId) or 'SYSTEM')
  const createdBy = new Map();
  const executedByAudit = new Map();
  for (const row of creatorRows) {
    if (!row.employeeId) continue;
    const target = row.action === 'EXECUTE' ? executedByAudit : createdBy;
    if (!target.has(row.entityId)) target.set(row.entityId, row.employeeId);
  }
  const paymentActors = new Map(payments.filter((p) => createdBy.has(p.id)).map((p) => [p.id, createdBy.get(p.id)]));
  const refundCreators = new Map(refunds.filter((r) => createdBy.has(r.id)).map((r) => [r.id, createdBy.get(r.id)]));
  const executorCodes = [...new Set(refunds.filter((r) => r.isExecuted && !executedByAudit.has(r.id) && r.executedBy && r.executedBy !== 'SYSTEM').map((r) => r.executedBy))];

  // every employee id/code met above, in one query (explicit safe columns - never `true`)
  const employeeIds = new Set();
  for (const r of [...auditRows, ...orderAuditRows]) if (r.employeeId) employeeIds.add(r.employeeId);
  for (const o of orders) if (o.employeeId) employeeIds.add(o.employeeId);
  for (const l of emailLogs) if (l.employeeId) employeeIds.add(l.employeeId);
  for (const id of [...paymentActors.values(), ...refundCreators.values(), ...executedByAudit.values()]) employeeIds.add(id);
  const legacyCodes = executorCodes.filter((c) => /^\d+$/.test(c)).map(Number);
  const employees = employeeIds.size || executorCodes.length
    ? await prisma.employee.findMany({
      where: { OR: [{ id: { in: [...employeeIds, ...executorCodes] } }, ...(legacyCodes.length ? [{ legacyId: { in: legacyCodes } }] : [])] },
      select: { id: true, legacyId: true, firstName: true, lastName: true, fullName: true },
    })
    : [];
  const actorNames = new Map(employees.map((e) => [e.id, displayName(e)]));
  const idByCode = new Map();
  for (const e of employees) { idByCode.set(e.id, e.id); if (e.legacyId != null) idByCode.set(String(e.legacyId), e.id); }
  const refundExecutors = new Map(refunds.filter((r) => r.isExecuted).map((r) => [r.id, executedByAudit.get(r.id) || (r.executedBy ? idByCode.get(r.executedBy) || null : null)]));

  return {
    sources: { auditRows, orders, orderAuditRows, payments, refunds, emailLogs },
    ctx: { actorNames, paymentActors, refundCreators, refundExecutors },
    truncated,
  };
}

// The whole read: sources -> ONE assembled feed -> one page. `options.hebrewDate` formats an instant as a
// Hebrew date (the route passes lib/hebrewDate.js through the Israel-day helper).
export async function getCustomerHistory(prisma, customerId, options = {}) {
  const limit = normalizeLimit(options.limit);
  const cursor = options.cursor ? decodeCursor(options.cursor) : null;
  if (options.cursor && !cursor) {
    const err = new Error('Invalid cursor');
    err.code = 'INVALID_CURSOR';
    throw err;
  }
  const categories = options.categories && options.categories.size ? options.categories : null;
  const loaded = await loadCustomerHistorySources(prisma, customerId);
  const all = buildCustomerHistory(loaded.sources, { customerId, hebrewDate: options.hebrewDate, ...loaded.ctx });
  const page = assemblePage(all, { limit, cursor, categories });
  return { ...page, meta: { limit, truncated: loaded.truncated } };
}
