// Pure display rules for one history row's changesJson (no JSX - shared by ChangesChips.js and
// HistoryViewer.js, tested in scripts/order-events.test.mjs).
// - ID display rule (AGENTS.md): a raw UUID is never shown - keys whose value (or from/to) is a UUID are
//   hidden, and so are technical keys (clientEventId). The approver of an order event is shown by NAME:
//   app/lib/auditLog.js attachEmployeeNames adds meta.approverName next to meta.approverId.
// - Machine values of the order events (lib/history/orderEvents.js) are shown as Hebrew labels.
import { getCatalogItem } from '../../lib/permissionsMetadata';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HIDDEN_KEYS = new Set(['clientEventId', 'approverId']);

export const VALUE_LABELS = {
  doc: { order: 'סיכום הזמנה', rental: 'דף השכרה', prep: 'דף הכנה', delivery: 'תעודת משלוח' },
  format: { xlsx: 'Excel', pdf: 'PDF', print: 'הדפסה' },
  source: { 'print-page': 'דף ההדפסה', card: 'כרטיס ההזמנה' },
  sheet: { 'PP-07': 'דף הכנה (PP-07)', 'PP-12': 'תעודת משלוח (PP-12)' },
  sendMode: { email: 'מייל', drive: 'דרייב', both: 'מייל ודרייב' },
  // EMAIL_SENT.type - only these two values are rewritten (the key `type` exists on other entities too)
  type: { order: 'הזמנה', rental: 'השכרה' },
};

const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v.trim());

function permissionLabel(v) {
  if (typeof v !== 'string' || !v.startsWith('feature:')) return null;
  const item = getCatalogItem(v);
  return item ? (item.approverLabel || item.label) : null;
}

export const REASSIGNED_LABEL = 'הוחלף';
export const ASSIGNED_LABEL = 'נקבע';
export const UNASSIGNED_LABEL = 'הוסר';

const isFromTo = (v) => v && typeof v === 'object' && !Array.isArray(v) && ('from' in v || 'to' in v);
const isEmpty = (v) => v === null || v === undefined || v === '';

/**
 * A {from,to} change of a UUID-valued key (dressItemId, dressModelId, customerId...) is a REAL change
 * (a reassignment) - it is shown with a placeholder instead of the ids: {from:null, to:'הוחלף'|'נקבע'|'הוסר'}.
 * Anything else is returned as is.
 */
export function normalizeChange(key, change) {
  if (!isFromTo(change) || !(isUuid(change.from) || isUuid(change.to))) return change;
  if (String(change.from) === String(change.to)) return change; // no change - the caller drops it
  if (isEmpty(change.from)) return { from: null, to: ASSIGNED_LABEL };
  if (isEmpty(change.to)) return { from: null, to: UNASSIGNED_LABEL };
  return { from: null, to: REASSIGNED_LABEL };
}

// true = this key is shown at all (pass the RAW change; reassignments of UUID keys stay visible)
export function isVisibleChangeKey(key, value) {
  if (HIDDEN_KEYS.has(key)) return false;
  if (isUuid(value)) return false;
  if (isFromTo(value) && (isUuid(value.from) || isUuid(value.to))) return String(value.from) !== String(value.to);
  return true;
}

/**
 * Hebrew text for a non-date, non-boolean value of `key` - or null to let the caller format it as before.
 * Arrays of files/attachments become a list of their names (never JSON).
 */
export function labelChangeValue(key, value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const map = VALUE_LABELS[key];
    if (map && Object.prototype.hasOwnProperty.call(map, value)) return map[value];
    if (key === 'featureKey' || key === 'level') return permissionLabel(value);
    return null;
  }
  if (Array.isArray(value)) {
    const names = value.map((x) => (x && typeof x === 'object') ? (x.name || x.fileName || x.url || null) : null);
    if (value.length > 0 && names.every(Boolean)) return names.join(', ');
    if (value.length === 0) return '-';
  }
  return null;
}
