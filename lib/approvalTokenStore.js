// lib/approvalTokenStore.js - client-side holder for the signed approval tokens that POST /api/auth/verify-pin returns
// (lib/approvalTokens.js, docs/server-approval-hardening.md). A worker types the manager's code in one dialog and the
// request that needs it (order PUT, POST /api/payments, PUT /api/refunds/{id}, POST /api/orders/{id}/debt-approval) is sent
// later, often from another component - this tiny in-memory map carries the token between them (never localStorage: it
// dies with the tab, like the 5-minute server-side expiry). Keyed by (approval level, order). Dependency-free: runs in node tests.
//
// Levels are the verify-pin `requiredLevel` strings; the debt approval has three spellings that all mean the same thing.
export const DEBT_APPROVAL_LEVEL = 'מאשר הזמנה ללא תשלום';
export const MANUAL_CHARGE_LEVEL = 'feature:manual_charge_add';
export const MANUAL_PAYMENT_CREDIT_LEVEL = 'feature:manual_payment_credit_add';

// the server refuses after 5 minutes; do not even send a token older than 4.5 minutes (clock-skew margin)
export const CLIENT_TOKEN_TTL_MS = 270000;

const store = new Map();
const levelOf = (level) => (level === 'debt' || level === 'feature:debt_approval' ? DEBT_APPROVAL_LEVEL : level);
const keyOf = (level, orderId) => `${levelOf(level)}|${Number(orderId) || 0}`;

export function stashApprovalToken(level, orderId, token, now = Date.now()) {
  if (!token || typeof token !== 'string') return;
  store.set(keyOf(level, orderId), { token, at: now });
}
export function peekApprovalToken(level, orderId, now = Date.now()) {
  const e = store.get(keyOf(level, orderId));
  if (!e) return null;
  if (now - e.at >= CLIENT_TOKEN_TTL_MS) { store.delete(keyOf(level, orderId)); return null; }
  return e.token;
}
export function clearApprovalToken(level, orderId) {
  store.delete(keyOf(level, orderId));
}
export function resetApprovalTokenStore() {
  store.clear();
}
