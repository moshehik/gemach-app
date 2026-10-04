/**
 * Customer "events" — history rows for things that happen to a CUSTOMER without a model write
 * (print, PDF download, Excel export, history export, manager approval).
 * Pure module: no imports, safe for server routes, client components and node tests.
 *
 * Mirrors the order-event contract of the order-card build (W0, lib/history/orderEvents.js on
 * feature/order-card-w0) for entity 'Customer' — same action vocabulary, same meta rules, same
 * identity rule — WITHOUT depending on any W0 file (it is not merged yet).
 *
 * Every event is one AuditLog row: { entityType:'Customer', entityId:<Customer.id uuid>, action,
 * changesJson:JSON(meta), employeeId:<acting employee from the session cookie> }.
 * Written only by app/api/customers/[id]/events/route.js. A model write is logged by the Prisma
 * extension (app/lib/prisma.js) — never through this contract.
 *
 * ============================================================================================
 * CONTRACT — POST /api/customers/[id]/events
 * --------------------------------------------------------------------------------------------
 * Request body (JSON):
 *   { action: 'CUSTOMER_PRINTED' | 'CUSTOMER_PDF_DOWNLOADED' | 'CUSTOMER_XLSX_EXPORTED'
 *            | 'HISTORY_EXPORTED' | 'MANAGER_APPROVAL',
 *     meta?: object,                 // per action, see CUSTOMER_EVENT_META_SCHEMAS (unknown keys are dropped)
 *     clientEventId?: string,        // optional idempotency key, [A-Za-z0-9_-]{8,64}
 *     approval?: { employeeId, pin, requiredLevel } }   // MANAGER_APPROVAL only (see below)
 * Meta per action:
 *   CUSTOMER_PRINTED        { doc:'card'|'account'|'contact' (required), source?:'print-page'|'card' (default 'card') }
 *   CUSTOMER_PDF_DOWNLOADED { doc:'card'|'account'|'contact' (required), fileName?:string<=120 }
 *   CUSTOMER_XLSX_EXPORTED  { fileName?:string<=120 }
 *   HISTORY_EXPORTED        { format:'xlsx'|'pdf'|'print' (required), rows?:int }
 *   MANAGER_APPROVAL        { reason?:string<=200 }   // + server-built featureKey/level/approverId
 * MANAGER_APPROVAL is VERIFIED ON THE SERVER: the route checks approval.pin against approval.employeeId
 *   and approval.requiredLevel with the same rules as POST /api/auth/verify-pin, and only then writes
 *   the row (meta = { featureKey, level, reason, approverId }). The pin is never stored or echoed.
 *   Failed attempts are not logged (same as W0 OQ-2). The response carries { approverId, approverName }.
 * Who / when: actor = verified session cookie (getActingEmployeeId); time = DB createdAt default.
 *   Any identity in the body is ignored.
 * Responses:
 *   200 { ok:true, action, customerId, written:1, duplicate:false [, approverId, approverName] }
 *   200 { ok:true, action, customerId, written:0, duplicate:true }    // same clientEventId already logged
 *   400 { ok:false, code:'BAD_REQUEST'|'UNKNOWN_ACTION'|'BAD_META'|'BAD_APPROVAL', error, field? }
 *   401 { ok:false, code:'UNAUTHORIZED'|'BAD_PIN', error }
 *   403 { ok:false, code:'FORBIDDEN'|'NOT_ALLOWED', error }   // needs page:customers; NOT_ALLOWED = approver lacks the level
 *   404 { ok:false, code:'CUSTOMER_NOT_FOUND', error }
 *   500 { ok:false, code:'SERVER_ERROR', error }
 * EMAIL_SENT stays server-only (written by POST /api/send-email, unchanged).
 * ============================================================================================
 */

export const CUSTOMER_EVENT_ACTIONS = Object.freeze({
  CUSTOMER_PRINTED: 'CUSTOMER_PRINTED',
  CUSTOMER_PDF_DOWNLOADED: 'CUSTOMER_PDF_DOWNLOADED',
  CUSTOMER_XLSX_EXPORTED: 'CUSTOMER_XLSX_EXPORTED',
  HISTORY_EXPORTED: 'HISTORY_EXPORTED',
  MANAGER_APPROVAL: 'MANAGER_APPROVAL',
});

export const CLIENT_CUSTOMER_EVENT_ACTIONS = Object.freeze(Object.values(CUSTOMER_EVENT_ACTIONS));
export const SERVER_ONLY_CUSTOMER_EVENT_ACTIONS = Object.freeze(['EMAIL_SENT', 'EMAIL_FAILED']);

export const CUSTOMER_EVENT_PAGE_KEYS = Object.freeze(['page:customers']);
export const CUSTOMER_DOCS = Object.freeze(['card', 'account', 'contact']);
export const CUSTOMER_DOC_LABELS = Object.freeze({ card: 'כרטיס לקוחה', account: 'דף חשבון', contact: 'דף פרטי קשר' });
export const REDACTED_TEXT = '[מוסתר]';

const enumSpec = (values, required = false) => ({ type: 'enum', values, required });
const textSpec = (max, required = false) => ({ type: 'text', max, required });
const intSpec = (min, max) => ({ type: 'int', min, max });

export const CUSTOMER_EVENT_META_SCHEMAS = Object.freeze({
  CUSTOMER_PRINTED: { doc: enumSpec([...CUSTOMER_DOCS], true), source: enumSpec(['print-page', 'card']) },
  CUSTOMER_PDF_DOWNLOADED: { doc: enumSpec([...CUSTOMER_DOCS], true), fileName: textSpec(120) },
  CUSTOMER_XLSX_EXPORTED: { fileName: textSpec(120) },
  HISTORY_EXPORTED: { format: enumSpec(['xlsx', 'pdf', 'print'], true), rows: intSpec(0, 100000) },
  MANAGER_APPROVAL: { reason: textSpec(200) },
});

const DEFAULTS = Object.freeze({ CUSTOMER_PRINTED: { source: 'card' } });

// 7+ digits in a row (card / bank account / id number / a typed code) never reach a history row.
const LONG_DIGIT_RUN = /\d(?:[\s-]?\d){6,}/g;
export function maskLongDigitRuns(text) {
  return String(text).replace(LONG_DIGIT_RUN, REDACTED_TEXT);
}
export function cleanText(value, max) {
  if (value === null || value === undefined) return '';
  const flat = String(value).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return maskLongDigitRuns(flat).slice(0, max);
}

/** @returns {{ok:true, meta:object} | {ok:false, error:string, field?:string}} */
export function sanitizeCustomerEventMeta(action, rawMeta) {
  const schema = CUSTOMER_EVENT_META_SCHEMAS[action];
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
    } else if (spec.type === 'int') {
      if (!Number.isInteger(v) || v < spec.min || v > spec.max) return { ok: false, error: `מספר לא חוקי בשדה ${field}`, field };
      out[field] = v;
    } else if (spec.type === 'text') {
      if (typeof v !== 'string') return { ok: false, error: `שדה ${field} חייב להיות טקסט`, field };
      const t = cleanText(v, spec.max);
      if (t) out[field] = t;
    }
  }
  return { ok: true, meta: out };
}

const CLIENT_EVENT_ID = /^[A-Za-z0-9_-]{8,64}$/;
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isCustomerIdShaped = (id) => typeof id === 'string' && id.length === 36 && UUID_SHAPE.test(id);

/**
 * Parses the body of POST /api/customers/[id]/events (no I/O).
 * @returns {{ok:true, action, meta, clientEventId, approval:null|{employeeId,pin,requiredLevel}}
 *          | {ok:false, status:number, code:string, error:string, field?:string}}
 */
export function parseCustomerEventRequest(body) {
  const bad = (code, error, field) => ({ ok: false, status: 400, code, error, ...(field ? { field } : {}) });
  if (!body || typeof body !== 'object' || Array.isArray(body)) return bad('BAD_REQUEST', 'גוף הבקשה חסר או לא תקין');
  const { action } = body;
  if (typeof action !== 'string' || !action) return bad('UNKNOWN_ACTION', 'חסרה פעולה', 'action');
  if (SERVER_ONLY_CUSTOMER_EVENT_ACTIONS.includes(action)) return bad('UNKNOWN_ACTION', 'פעולה זו נרשמת בשרת בלבד', 'action');
  if (!CLIENT_CUSTOMER_EVENT_ACTIONS.includes(action)) return bad('UNKNOWN_ACTION', 'פעולה לא מוכרת', 'action');

  let clientEventId = null;
  if (body.clientEventId !== undefined && body.clientEventId !== null && body.clientEventId !== '') {
    if (typeof body.clientEventId !== 'string' || !CLIENT_EVENT_ID.test(body.clientEventId)) {
      return bad('BAD_REQUEST', 'clientEventId לא תקין', 'clientEventId');
    }
    clientEventId = body.clientEventId;
  }

  const meta = sanitizeCustomerEventMeta(action, body.meta);
  if (!meta.ok) return bad('BAD_META', meta.error, meta.field);

  let approval = null;
  if (action === CUSTOMER_EVENT_ACTIONS.MANAGER_APPROVAL) {
    const a = body.approval;
    if (!a || typeof a !== 'object' || Array.isArray(a)) return bad('BAD_APPROVAL', 'חסרים פרטי האישור', 'approval');
    if (typeof a.pin !== 'string' || !a.pin) return bad('BAD_APPROVAL', 'לא סופקה סיסמה', 'approval.pin');
    if (typeof a.requiredLevel !== 'string' || !a.requiredLevel || a.requiredLevel.length > 80) return bad('BAD_APPROVAL', 'רמת אישור לא תקינה', 'approval.requiredLevel');
    if (a.employeeId !== undefined && a.employeeId !== null && a.employeeId !== '' && (typeof a.employeeId !== 'string' || a.employeeId.length > 64)) {
      return bad('BAD_APPROVAL', 'מזהה מאשר לא תקין', 'approval.employeeId');
    }
    approval = { employeeId: a.employeeId || null, pin: a.pin, requiredLevel: a.requiredLevel };
  }
  return { ok: true, action, meta: meta.meta, clientEventId, approval };
}

// Hebrew tiers -> permission key (same mapping as W0 approvalFeatureKey).
const LEVEL_TO_FEATURE = Object.freeze({ 'מאשר הזמנה ללא תשלום': 'feature:debt_approval' });
export function approvalFeatureKey(requiredLevel) {
  if (typeof requiredLevel !== 'string' || !requiredLevel) return 'unspecified';
  return LEVEL_TO_FEATURE[requiredLevel] || requiredLevel.slice(0, 80);
}

export function buildCustomerApprovalMeta({ requiredLevel, reason, approverId }) {
  return {
    featureKey: approvalFeatureKey(requiredLevel),
    level: typeof requiredLevel === 'string' ? requiredLevel.slice(0, 80) : null,
    reason: reason || '',
    approverId: approverId || null,
  };
}

/** The AuditLog `data` for one customer event row. `meta` must already be sanitized. */
export function buildCustomerEventRow({ customerId, action, meta, actorId, clientEventId }) {
  const payload = { ...(meta || {}) };
  if (clientEventId) payload.clientEventId = clientEventId;
  return {
    entityType: 'Customer',
    entityId: String(customerId),
    action,
    changesJson: JSON.stringify(payload),
    employeeId: actorId || null,
  };
}

export function clientEventIdNeedle(clientEventId) {
  return `"clientEventId":${JSON.stringify(clientEventId)}`;
}

// ---- read side (history feed) -------------------------------------------------------------------

const PRINT_TITLES = Object.freeze({ card: 'הודפס כרטיס לקוחה', account: 'הודפס דף חשבון', contact: 'הודפס דף פרטי קשר' });
const PDF_TITLES = Object.freeze({ card: 'הורד כרטיס לקוחה כקובץ', account: 'הורד דף חשבון כקובץ', contact: 'הורד דף פרטי קשר כקובץ' });
const HISTORY_FORMAT_LABELS = Object.freeze({ xlsx: 'Excel', pdf: 'קובץ PDF', print: 'הדפסה' });

/**
 * Display data for one event row in the customer history feed: {title, detail, icon, details}.
 * `approverName` is resolved by the caller (never show the id). Returns null for a non-event action.
 */
export function describeCustomerEvent(action, meta, { approverName } = {}) {
  const m = meta && typeof meta === 'object' ? meta : {};
  switch (action) {
    case CUSTOMER_EVENT_ACTIONS.CUSTOMER_PRINTED:
      return { title: PRINT_TITLES[m.doc] || 'הודפס מסמך לקוח', detail: '', icon: 'print', details: [['מסמך', CUSTOMER_DOC_LABELS[m.doc] || '']] };
    case CUSTOMER_EVENT_ACTIONS.CUSTOMER_PDF_DOWNLOADED:
      return { title: PDF_TITLES[m.doc] || 'הורד מסמך לקוח', detail: m.fileName || '', icon: 'file', details: [['מסמך', CUSTOMER_DOC_LABELS[m.doc] || ''], ['קובץ', m.fileName || '']] };
    case CUSTOMER_EVENT_ACTIONS.CUSTOMER_XLSX_EXPORTED:
      return { title: 'כרטיס הלקוחה יוצא ל-Excel', detail: m.fileName || '', icon: 'file', details: [['קובץ', m.fileName || '']] };
    case CUSTOMER_EVENT_ACTIONS.HISTORY_EXPORTED:
      return { title: `ההיסטוריה יוצאה (${HISTORY_FORMAT_LABELS[m.format] || m.format || ''})`, detail: Number.isInteger(m.rows) ? `${m.rows} רישומים` : '', icon: m.format === 'print' ? 'print' : 'file', details: [['פורמט', HISTORY_FORMAT_LABELS[m.format] || ''], ['רישומים', Number.isInteger(m.rows) ? String(m.rows) : '']] };
    case CUSTOMER_EVENT_ACTIONS.MANAGER_APPROVAL:
      return { title: 'אישור מנהל', detail: [m.reason, approverName ? `אושר ע״י ${approverName}` : ''].filter(Boolean).join(' · '), icon: 'shield', details: [['פעולה', m.reason || ''], ['אושר ע״י', approverName || '']] };
    default:
      return null;
  }
}
