/**
 * Order "events" — history rows for things that happen to an order WITHOUT a model write
 * (print, PDF download, Excel export, history export, manager approval, email).
 * Pure module: no imports, safe for server routes, client components and node tests.
 *
 * Every event is one AuditLog row: { entityType:'Order', entityId:String(orderId), action,
 * changesJson:JSON(meta), employeeId:<acting employee from the session cookie> }.
 * Rows are written ONLY through writeOrderEvents() in app/lib/auditLog.js (the single sanctioned
 * manual-AuditLog site for no-write events; a model write is logged by the Prisma extension).
 *
 * ============================================================================================
 * CONTRACT 1 — POST /api/orders/events            (app/api/orders/events/route.js)
 * --------------------------------------------------------------------------------------------
 * Request body (JSON):
 *   { orderId?: number,            // one order, OR
 *     orderIds?: number[],         // 1..200 orders (batch print). orderId and orderIds may be combined.
 *     action: 'ORDER_PRINTED' | 'ORDER_PDF_DOWNLOADED' | 'ORDER_XLSX_EXPORTED' | 'HISTORY_EXPORTED',
 *     meta?: object,               // per action, see EVENT_META_SCHEMAS (unknown keys are dropped)
 *     clientEventId?: string }     // optional idempotency key, [A-Za-z0-9_-]{8,64}
 * Meta per action:
 *   ORDER_PRINTED        { doc:'order'|'rental'|'prep'|'delivery' (required), sheet?:'PP-07'|'PP-12',
 *                          source?:'print-page'|'card' (default 'card'), batch?:boolean, count?:int }
 *   ORDER_PDF_DOWNLOADED { doc:'order'|'rental' (required), fileName?:string<=120 }
 *   ORDER_XLSX_EXPORTED  { fileName?:string<=120 }
 *   HISTORY_EXPORTED     { format:'xlsx'|'pdf'|'print' (required), rows?:int }
 * Who / when: the server takes the actor from the verified session cookie (getActingEmployeeId)
 *   and the time from the DB (createdAt default now()). Any identity in the body is ignored.
 * Responses:
 *   200 { ok:true, action, orderIds:number[], written:number, duplicate:false }
 *   200 { ok:true, action, orderIds, written:0, duplicate:true }   // same clientEventId already logged
 *   400 { ok:false, code:'BAD_REQUEST'|'UNKNOWN_ACTION'|'SERVER_ONLY_ACTION'|'BAD_META'|'BAD_ORDER_IDS'|'TOO_MANY_ORDERS', error, field? }
 *   401 { ok:false, code:'UNAUTHORIZED', error }
 *   403 { ok:false, code:'FORBIDDEN', error }        // needs page:orders | page:rentals | page:board
 *                                                    // (+ page:schedule for ORDER_PRINTED doc prep/delivery)
 *   404 { ok:false, code:'ORDER_NOT_FOUND', error, missing:number[] }   // nothing is written
 *   500 { ok:false, code:'SERVER_ERROR', error }
 * MANAGER_APPROVAL / EMAIL_SENT / EMAIL_FAILED are SERVER-ONLY: posting them here is a 400.
 *
 * CONTRACT 2 — POST /api/auth/verify-pin  (existing route; new OPTIONAL `context`)
 * --------------------------------------------------------------------------------------------
 *   body: { pin, requiredLevel, employeeId?, context?: { orderId:number, reason?:string<=200 } }
 *   Without `context` the route behaves exactly as before (legacy card / wizard unaffected).
 *   With `context`: an invalid context (orderId not a positive integer) -> 400 BEFORE the pin is checked.
 *   On success one MANAGER_APPROVAL row is written on that order:
 *     employeeId = the logged-in employee (session cookie) = who asked
 *     meta = { featureKey, level, reason, approverId }   // approverId = the employee whose code matched
 *   The response gains `approvalLogged: boolean` (false when the order does not exist or the write
 *   failed — the approval itself is still valid). Failed attempts are NOT logged (OQ-2). The PIN is
 *   never part of any row (and /api/auth/* bodies are never stored in PageVisitLog).
 *
 * CONTRACT 3 — POST /api/orders/[id]/email (existing; enriched rows, request unchanged)
 * --------------------------------------------------------------------------------------------
 *   Optional new body field per extra attachment: extraAttachments[i].kind (EMAIL_ATTACHMENT_KINDS).
 *   EMAIL_SENT row: employeeId = session employee; meta += { approverId, selfApproved, attachments:[{kind,name}], attachmentCount }.
 *   EmailLog row: employeeId = session employee.
 *   Send failure: EMAIL_FAILED row (same meta + error<=200).
 *
 * CONTRACT 4 — PUT /api/orders/[id] (existing; additions are backward compatible)
 * --------------------------------------------------------------------------------------------
 *   409 stock shortage -> { code:'STOCK_SHORTAGE', error, validationErrors }   (status unchanged)
 *   409 data collision -> { code:'CONFLICT', error:'Data Collision', message, serverUpdatedAt }
 *   New manual charges (obligations[i].isNew) / deleting a stored manual charge require
 *   feature:manual_charge_add when the body says cardVariant:'a5': the session employee holds it,
 *   or body.manualChargeApproverId + body.manualChargeApproverPin verify against it. Else 403
 *   { code:'MANUAL_CHARGE_APPROVAL_REQUIRED' }. Bodies without cardVariant:'a5' (legacy card) are unchanged.
 * ============================================================================================
 */

export const ORDER_EVENT_ACTIONS = Object.freeze({
  ORDER_PRINTED: 'ORDER_PRINTED',
  ORDER_PDF_DOWNLOADED: 'ORDER_PDF_DOWNLOADED',
  ORDER_XLSX_EXPORTED: 'ORDER_XLSX_EXPORTED',
  HISTORY_EXPORTED: 'HISTORY_EXPORTED',
  MANAGER_APPROVAL: 'MANAGER_APPROVAL',
  EMAIL_SENT: 'EMAIL_SENT',
  EMAIL_FAILED: 'EMAIL_FAILED',
});

// What a browser may post to /api/orders/events.
export const CLIENT_EVENT_ACTIONS = Object.freeze([
  ORDER_EVENT_ACTIONS.ORDER_PRINTED,
  ORDER_EVENT_ACTIONS.ORDER_PDF_DOWNLOADED,
  ORDER_EVENT_ACTIONS.ORDER_XLSX_EXPORTED,
  ORDER_EVENT_ACTIONS.HISTORY_EXPORTED,
]);

// Written only by server routes (verify-pin, the email route) - never accepted from a client.
export const SERVER_ONLY_EVENT_ACTIONS = Object.freeze([
  ORDER_EVENT_ACTIONS.MANAGER_APPROVAL,
  ORDER_EVENT_ACTIONS.EMAIL_SENT,
  ORDER_EVENT_ACTIONS.EMAIL_FAILED,
]);

export const ALL_ORDER_EVENT_ACTIONS = Object.freeze([...CLIENT_EVENT_ACTIONS, ...SERVER_ONLY_EVENT_ACTIONS]);

export const MAX_EVENT_ORDER_IDS = 200;
export const REDACTED_TEXT = '[מוסתר]';

// Page keys that may log events (same surfaces that may open /print/order + the order card).
export const EVENT_PAGE_KEYS = Object.freeze(['page:orders', 'page:rentals', 'page:board']);
// PP-07 / PP-12 prints come from the schedule print pages (W7) - page:schedule may log those too.
export const SCHEDULE_PRINT_DOCS = Object.freeze(['prep', 'delivery']);

export const STOCK_SHORTAGE_CODE = 'STOCK_SHORTAGE';
export const CONFLICT_CODE = 'CONFLICT';
export const MANUAL_CHARGE_PERMISSION = 'feature:manual_charge_add';
export const MANUAL_CHARGE_APPROVAL_REQUIRED_CODE = 'MANUAL_CHARGE_APPROVAL_REQUIRED';
export const A5_CARD_VARIANT = 'a5';

export const EMAIL_ATTACHMENT_KINDS = Object.freeze(['order-pdf', 'rental-pdf', 'delivery', 'regulations', 'payments', 'file']);

// ---- meta schemas -----------------------------------------------------------------------------

const enumSpec = (values, required = false) => ({ type: 'enum', values, required });
const textSpec = (max, required = false) => ({ type: 'text', max, required });
const intSpec = (min, max) => ({ type: 'int', min, max });
const boolSpec = () => ({ type: 'bool' });

export const EVENT_META_SCHEMAS = Object.freeze({
  ORDER_PRINTED: {
    doc: enumSpec(['order', 'rental', 'prep', 'delivery'], true),
    sheet: enumSpec(['PP-07', 'PP-12']),
    source: enumSpec(['print-page', 'card']),
    batch: boolSpec(),
    count: intSpec(1, 10000),
  },
  ORDER_PDF_DOWNLOADED: {
    doc: enumSpec(['order', 'rental'], true),
    fileName: textSpec(120),
  },
  ORDER_XLSX_EXPORTED: {
    fileName: textSpec(120),
  },
  HISTORY_EXPORTED: {
    format: enumSpec(['xlsx', 'pdf', 'print'], true),
    rows: intSpec(0, 100000),
  },
});

const DEFAULTS = Object.freeze({
  ORDER_PRINTED: { source: 'card', batch: false },
});

// 7+ digits in a row (card / bank account / id number / a typed code) never reach a history row:
// /api/audit returns changesJson raw to every logged-in employee.
const LONG_DIGIT_RUN = /\d(?:[\s-]?\d){6,}/g;
export function maskLongDigitRuns(text) {
  return String(text).replace(LONG_DIGIT_RUN, REDACTED_TEXT);
}

// Free text from a client: control characters out, trimmed, capped, long digit runs masked.
export function cleanText(value, max) {
  if (value === null || value === undefined) return '';
  const flat = String(value).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return maskLongDigitRuns(flat).slice(0, max);
}

/**
 * Validates + whitelists the meta of a client event.
 * @returns {{ok:true, meta:object} | {ok:false, error:string, field?:string}}
 */
export function sanitizeEventMeta(action, rawMeta) {
  const schema = EVENT_META_SCHEMAS[action];
  if (!schema) return { ok: false, error: 'פעולה לא מוכרת' };
  if (rawMeta !== undefined && rawMeta !== null && (typeof rawMeta !== 'object' || Array.isArray(rawMeta))) {
    return { ok: false, error: 'meta חייב להיות אובייקט' };
  }
  const src = rawMeta || {};
  const out = { ...(DEFAULTS[action] || {}) };
  for (const [field, spec] of Object.entries(schema)) {
    const v = src[field];
    if (v === undefined || v === null || v === '') {
      if (spec.required) return { ok: false, error: `חסר שדה ${field}`, field };
      continue;
    }
    if (spec.type === 'enum') {
      if (!spec.values.includes(v)) return { ok: false, error: `ערך לא חוקי בשדה ${field}`, field };
      out[field] = v;
    } else if (spec.type === 'bool') {
      if (typeof v !== 'boolean') return { ok: false, error: `שדה ${field} חייב להיות true/false`, field };
      out[field] = v;
    } else if (spec.type === 'int') {
      if (!Number.isInteger(v) || v < spec.min || v > spec.max) return { ok: false, error: `מספר לא חוקי בשדה ${field}`, field };
      out[field] = v;
    } else if (spec.type === 'text') {
      if (typeof v !== 'string') return { ok: false, error: `שדה ${field} חייב להיות טקסט`, field };
      const t = cleanText(v, spec.max);
      if (t) out[field] = t;
    }
  }
  if (action === 'ORDER_PRINTED' && out.sheet) {
    const expected = { prep: 'PP-07', delivery: 'PP-12' }[out.doc];
    if (out.sheet !== expected) return { ok: false, error: 'גיליון לא תואם לסוג המסמך', field: 'sheet' };
  }
  return { ok: true, meta: out };
}

const CLIENT_EVENT_ID = /^[A-Za-z0-9_-]{8,64}$/;

function toOrderId(v) {
  if (typeof v === 'number' && Number.isInteger(v) && v > 0) return v;
  if (typeof v === 'string' && /^\d{1,9}$/.test(v.trim())) {
    const n = parseInt(v.trim(), 10);
    return n > 0 ? n : null;
  }
  return null;
}

/**
 * Parses the body of POST /api/orders/events (no I/O).
 * @returns {{ok:true, orderIds:number[], action:string, meta:object, clientEventId:string|null}
 *          | {ok:false, status:number, code:string, error:string, field?:string}}
 */
export function parseEventsRequest(body) {
  const bad = (code, error, field) => ({ ok: false, status: 400, code, error, ...(field ? { field } : {}) });
  if (!body || typeof body !== 'object' || Array.isArray(body)) return bad('BAD_REQUEST', 'גוף הבקשה חסר או לא תקין');
  const { action } = body;
  if (typeof action !== 'string' || !action) return bad('UNKNOWN_ACTION', 'חסרה פעולה', 'action');
  if (SERVER_ONLY_EVENT_ACTIONS.includes(action)) return bad('SERVER_ONLY_ACTION', 'פעולה זו נרשמת בשרת בלבד', 'action');
  if (!CLIENT_EVENT_ACTIONS.includes(action)) return bad('UNKNOWN_ACTION', 'פעולה לא מוכרת', 'action');

  const rawIds = [];
  if (body.orderId !== undefined && body.orderId !== null) rawIds.push(body.orderId);
  if (body.orderIds !== undefined && body.orderIds !== null) {
    if (!Array.isArray(body.orderIds)) return bad('BAD_ORDER_IDS', 'orderIds חייב להיות מערך', 'orderIds');
    rawIds.push(...body.orderIds);
  }
  if (rawIds.length === 0) return bad('BAD_ORDER_IDS', 'לא צוינה הזמנה', 'orderIds');
  if (rawIds.length > MAX_EVENT_ORDER_IDS * 2) return bad('TOO_MANY_ORDERS', `עד ${MAX_EVENT_ORDER_IDS} הזמנות בבקשה אחת`, 'orderIds');
  const ids = [];
  for (const raw of rawIds) {
    const n = toOrderId(raw);
    if (n === null) return bad('BAD_ORDER_IDS', 'מספר הזמנה לא תקין', 'orderIds');
    if (!ids.includes(n)) ids.push(n);
  }
  if (ids.length > MAX_EVENT_ORDER_IDS) return bad('TOO_MANY_ORDERS', `עד ${MAX_EVENT_ORDER_IDS} הזמנות בבקשה אחת`, 'orderIds');

  let clientEventId = null;
  if (body.clientEventId !== undefined && body.clientEventId !== null && body.clientEventId !== '') {
    if (typeof body.clientEventId !== 'string' || !CLIENT_EVENT_ID.test(body.clientEventId)) {
      return bad('BAD_REQUEST', 'clientEventId לא תקין', 'clientEventId');
    }
    clientEventId = body.clientEventId;
  }

  const meta = sanitizeEventMeta(action, body.meta);
  if (!meta.ok) return bad('BAD_META', meta.error, meta.field);
  return { ok: true, orderIds: ids, action, meta: meta.meta, clientEventId };
}

// Page keys that allow logging this event (any one of them suffices).
export function eventPageKeys(action, meta) {
  if (action === 'ORDER_PRINTED' && meta && SCHEDULE_PRINT_DOCS.includes(meta.doc)) {
    return [...EVENT_PAGE_KEYS, 'page:schedule'];
  }
  return [...EVENT_PAGE_KEYS];
}

/**
 * The AuditLog `data` for one event row. `meta` must already be sanitized.
 * Batch rows carry `batch:true` + `count` so the history can say "הודפס יחד עם N הזמנות".
 */
export function buildOrderEventRow({ orderId, action, meta, actorId, clientEventId }) {
  const payload = { ...(meta || {}) };
  if (clientEventId) payload.clientEventId = clientEventId;
  return {
    entityType: 'Order',
    entityId: String(orderId),
    action,
    changesJson: JSON.stringify(payload),
    employeeId: actorId || null,
  };
}

// The fragment searched for in changesJson to find an already-logged clientEventId.
export function clientEventIdNeedle(clientEventId) {
  return `"clientEventId":${JSON.stringify(clientEventId)}`;
}

// ---- manager approvals (verify-pin) -------------------------------------------------------------

// Hebrew tiers that verify-pin accepts -> the permission key they correspond to (for the history mapper
// and the DEBT_APPROVED merge). Unknown tiers are kept verbatim.
const LEVEL_TO_FEATURE = Object.freeze({
  'מאשר הזמנה ללא תשלום': 'feature:debt_approval',
});

export function approvalFeatureKey(requiredLevel) {
  if (typeof requiredLevel !== 'string' || !requiredLevel) return 'unspecified';
  return LEVEL_TO_FEATURE[requiredLevel] || requiredLevel.slice(0, 80);
}

/**
 * Validates verify-pin's optional `context`.
 * @returns {{present:false} | {present:true, ok:true, orderId:number, reason:string} | {present:true, ok:false, error:string}}
 */
export function parseApprovalContext(context) {
  if (context === undefined || context === null) return { present: false };
  if (typeof context !== 'object' || Array.isArray(context)) return { present: true, ok: false, error: 'context לא תקין' };
  const orderId = toOrderId(context.orderId);
  if (orderId === null) return { present: true, ok: false, error: 'context.orderId לא תקין' };
  if (context.reason !== undefined && context.reason !== null && typeof context.reason !== 'string') {
    return { present: true, ok: false, error: 'context.reason חייב להיות טקסט' };
  }
  return { present: true, ok: true, orderId, reason: cleanText(context.reason || '', 200) };
}

export function buildApprovalMeta({ requiredLevel, reason, approverId }) {
  return {
    featureKey: approvalFeatureKey(requiredLevel),
    level: typeof requiredLevel === 'string' ? requiredLevel.slice(0, 80) : null,
    reason: reason || '',
    approverId: approverId || null,
  };
}

// ---- email (POST /api/orders/[id]/email) --------------------------------------------------------

/**
 * Names + kinds of what an order email carried (never contents/sizes of the bytes).
 * `extraRaw` is the request's extraAttachments; only entries the mailer accepts are counted
 * (same filter as lib/mailer.js normalizeAttachments).
 */
export function emailAttachmentSummary({ hasOrderPdf, printType, orderPdfName, extraRaw }) {
  const out = [];
  if (hasOrderPdf) out.push({ kind: printType === 'rental' ? 'rental-pdf' : 'order-pdf', name: cleanText(orderPdfName || '', 120) });
  if (Array.isArray(extraRaw)) {
    for (const a of extraRaw) {
      if (!a || typeof a === 'string' || !a.fileContent || !a.fileName) continue;
      const kind = EMAIL_ATTACHMENT_KINDS.includes(a.kind) ? a.kind : 'file';
      out.push({ kind, name: cleanText(a.fileName, 120) });
    }
  }
  return out;
}

export function emailEventMeta({ base, approverId, selfApproved, attachments, error }) {
  const meta = {
    ...(base || {}),
    approverId: approverId || null,
    selfApproved: !!selfApproved,
    attachments: attachments || [],
    attachmentCount: (attachments || []).length,
  };
  if (error) meta.error = cleanText(error, 200);
  return meta;
}

// ---- PUT /api/orders/[id]: manual charges (R35) -------------------------------------------------

/**
 * Which manual-charge changes a PUT body makes, relative to the stored obligations.
 * added   = new obligations in the body (isNew without id) - always manual (the route stores isManual:true)
 * removed = stored MANUAL obligations that this body flips from active to deleted
 * @param {Array} bodyObligations data.obligations
 * @param {Array<{id:string,isDeleted:boolean,isManual:boolean}>} stored
 */
export function detectManualChargeChanges(bodyObligations, stored) {
  const res = { added: 0, removed: 0 };
  if (!Array.isArray(bodyObligations)) return res;
  const byId = new Map((stored || []).map((o) => [o.id, o]));
  for (const obs of bodyObligations) {
    if (!obs) continue;
    if (!obs.id && obs.isNew) { res.added++; continue; }
    if (obs.id) {
      const s = byId.get(obs.id);
      if (s && s.isManual && !s.isDeleted && obs.isDeleted === true) res.removed++;
    }
  }
  return res;
}

// ---- PUT /api/orders/[id]: "before -> after" of the Order row (AMB-19) ---------------------------

// Order columns whose values never go into a history row (standing-order JSON may carry payment data).
const ORDER_DIFF_MASKED = new Set(['hokDetails']);

function diffValue(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString();
  if (v === undefined || v === '') return null;
  return v;
}

/**
 * {field:{from,to}} for every column of `updateData` (the Prisma `data` of tx.order.update) whose value
 * really changes against `existing` (the row loaded before the transaction). undefined = "not sent" and is
 * skipped; Dates compare by instant; '' and null are the same "empty". Empty object = a no-op save, which
 * the Prisma extension then does not log at all (auditAs with empty changes).
 */
export function diffOrderUpdate(existing, updateData) {
  const diff = {};
  if (!existing || !updateData) return diff;
  for (const [field, raw] of Object.entries(updateData)) {
    if (raw === undefined) continue;
    const to = diffValue(raw);
    const from = diffValue(existing[field]);
    const same = (from === null && to === null)
      || (typeof from === 'number' && typeof to === 'number' ? Math.abs(from - to) < 1e-9 : String(from) === String(to));
    if (same) continue;
    diff[field] = ORDER_DIFF_MASKED.has(field) ? { from: REDACTED_TEXT, to: REDACTED_TEXT } : { from, to };
  }
  return diff;
}

// ---- print page (/print/order) ------------------------------------------------------------------

// The ORDER_PRINTED request the print page sends once its data loaded (chunks of <= 200 ids).
export function printPageEventBodies({ orderIds, printType, isBatch, clientEventId }) {
  const ids = (orderIds || []).filter((n) => Number.isInteger(n) && n > 0);
  const doc = printType === 'rental' ? 'rental' : 'order';
  const batch = !!isBatch || ids.length > 1;
  const bodies = [];
  for (let i = 0; i < ids.length; i += MAX_EVENT_ORDER_IDS) {
    const chunk = ids.slice(i, i + MAX_EVENT_ORDER_IDS);
    bodies.push({
      orderIds: chunk,
      action: ORDER_EVENT_ACTIONS.ORDER_PRINTED,
      meta: { doc, source: 'print-page', batch, ...(batch ? { count: ids.length } : {}) },
      ...(clientEventId ? { clientEventId: `${clientEventId}-${i / MAX_EVENT_ORDER_IDS}` } : {}),
    });
  }
  return bodies;
}
