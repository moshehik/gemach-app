'use strict';
// lib/approvalTokens.js - short-lived SIGNED approval tokens (hardening branch, 2026-10-05).
//
// WHY: until now the server trusted a CLAIMED approver id (debtApprovedBy in PUT /api/orders/[id], employeeId in
// /api/orders/[id]/debt-approval): the id only had to belong to an employee holding feature:debt_approval - no
// proof that the approver's code was ever typed. Employee ids are readable by any logged-in user, so any employee
// could forge a DEBT_APPROVED row under a manager's name. POST /api/auth/verify-pin (which DOES check the typed
// code) now also returns `approvalToken`; the order / debt-approval / payments / refunds routes take the approver
// FROM THE TOKEN, never from the body. Rollout is per gemach behind SystemSetting `approval_tokens_required`
// (see lib/approvalGate.js and docs/server-approval-hardening.md).
//
// CommonJS + dependency-free on purpose (same as lib/authTokens.js): a plain `node` test script can require() the
// real code. No PIN / password ever enters a token; tokens are never logged.
//
// Token:   a1.<base64url(JSON payload)>.<base64url(HMAC-SHA256(key, "a1.<payload>"))>
// Payload: { ap: approverId, k: kind, o: [orderId,...], am?: amount, ac: actorEmployeeId|null, iat, exp, n: nonce }
// Key:     HMAC-SHA256(AUTH_SECRET, 'gemach/approval-token/v1') - a DISTINCT domain label, so an auth_session cookie
//          (signed with the raw AUTH_SECRET) can never be replayed as an approval token or the other way round.

const crypto = require('crypto');

const TOKEN_VERSION = 'a1';
const KEY_DOMAIN = 'gemach/approval-token/v1';
const APPROVAL_TTL_MS = 5 * 60 * 1000;
const MAX_ORDERS_PER_TOKEN = 100;
// A credit (Refund) may have NO order (Refund.orderId is nullable). Marking it done still needs feature:manual_payment_credit_add, so
// the approval token for it is bound to this documented sentinel instead of an order id: no real order ever gets this number (order
// ids are small sequential integers; 9 digits so it also passes the string form), and createApprovalToken only issues it for the
// manual_payment_credit kind and only on its own - a token for real orders can never unlock a no-order credit and the reverse.
// The cost: one approval covers ANY single no-order credit execution for 5 minutes, once (single use) - the same breadth a
// per-order token has for its order. Mirrored in lib/approvalTokenStore.js (client); a test keeps the two equal.
const NO_ORDER_ID = 999999999;

// kind <- verify-pin `requiredLevel`. Only these approvals mint a token (every other approval level is either
// re-verified with the typed code inside its own route - managerPin / orderDateApproverPin / ... - or not
// order-scoped).
const KINDS = Object.freeze({
  DEBT_APPROVAL: 'debt_approval',
  MANUAL_CHARGE: 'manual_charge',
  MANUAL_PAYMENT_CREDIT: 'manual_payment_credit', // manual payment/credit, payment deletion, credit execution (one catalog key)
});
const KIND_BY_REQUIRED_LEVEL = Object.freeze({
  'מאשר הזמנה ללא תשלום': KINDS.DEBT_APPROVAL,
  'feature:debt_approval': KINDS.DEBT_APPROVAL,
  'feature:manual_charge_add': KINDS.MANUAL_CHARGE,
  'feature:manual_payment_credit_add': KINDS.MANUAL_PAYMENT_CREDIT,
});
const PERMISSION_BY_KIND = Object.freeze({
  [KINDS.DEBT_APPROVAL]: 'feature:debt_approval',
  [KINDS.MANUAL_CHARGE]: 'feature:manual_charge_add',
  [KINDS.MANUAL_PAYMENT_CREDIT]: 'feature:manual_payment_credit_add',
});

function kindForRequiredLevel(requiredLevel) {
  return typeof requiredLevel === 'string' && Object.prototype.hasOwnProperty.call(KIND_BY_REQUIRED_LEVEL, requiredLevel)
    ? KIND_BY_REQUIRED_LEVEL[requiredLevel]
    : null;
}

function deriveKey(secret) {
  return crypto.createHmac('sha256', String(secret)).update(KEY_DOMAIN).digest();
}

function normalizeOrderIds(orderIds) {
  const list = Array.isArray(orderIds) ? orderIds : [orderIds];
  const out = [];
  for (const v of list) {
    const n = typeof v === 'number' ? v : (typeof v === 'string' && /^\d{1,9}$/.test(v) ? parseInt(v, 10) : NaN);
    if (Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n);
  }
  return out;
}

// Returns the token string, or null when it cannot be minted (no secret / bad arguments).
function createApprovalToken({ approverId, kind, orderIds, amount, actorEmployeeId = null }, secret, now = Date.now(), ttlMs = APPROVAL_TTL_MS) {
  if (!secret || !approverId || typeof approverId !== 'string') return null;
  if (!Object.values(KINDS).includes(kind)) return null;
  const o = normalizeOrderIds(orderIds);
  if (o.length === 0 || o.length > MAX_ORDERS_PER_TOKEN) return null;
  if (o.includes(NO_ORDER_ID) && (o.length !== 1 || kind !== KINDS.MANUAL_PAYMENT_CREDIT)) return null;
  const payload = {
    ap: approverId,
    k: kind,
    o,
    ...(typeof amount === 'number' && Number.isFinite(amount) ? { am: amount } : {}),
    ac: typeof actorEmployeeId === 'string' && actorEmployeeId ? actorEmployeeId : null,
    iat: now,
    exp: now + ttlMs,
    n: crypto.randomBytes(12).toString('base64url'),
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', deriveKey(secret)).update(`${TOKEN_VERSION}.${body}`).digest('base64url');
  return `${TOKEN_VERSION}.${body}.${sig}`;
}

// Authenticity + expiry only. { ok:true, payload } | { ok:false, reason }. Never throws.
function inspectApprovalToken(token, secret, now = Date.now()) {
  try {
    if (!secret) return { ok: false, reason: 'no_secret' };
    if (!token || typeof token !== 'string' || token.length > 2048) return { ok: false, reason: 'malformed' };
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return { ok: false, reason: 'malformed' };
    const expected = crypto.createHmac('sha256', deriveKey(secret)).update(`${parts[0]}.${parts[1]}`).digest();
    const given = Buffer.from(parts[2], 'base64url');
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return { ok: false, reason: 'signature' };
    const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!p || typeof p.ap !== 'string' || !p.ap || typeof p.n !== 'string' || !p.n) return { ok: false, reason: 'malformed' };
    if (!Array.isArray(p.o) || p.o.length === 0 || !p.o.every((x) => Number.isInteger(x) && x > 0)) return { ok: false, reason: 'malformed' };
    if (typeof p.iat !== 'number' || typeof p.exp !== 'number') return { ok: false, reason: 'malformed' };
    if (now > p.exp || p.iat > now + 60 * 1000) return { ok: false, reason: 'expired' };
    return { ok: true, payload: p };
  } catch (e) {
    return { ok: false, reason: 'malformed' };
  }
}

// Binding checks. expect = { kind | kinds, orderId, actorEmployeeId, amount? }.
// amount: the token approves up to its `am` (when it carries one) - a token without `am` is not amount-bound.
function matchApprovalPayload(payload, expect) {
  const kinds = expect.kinds || (expect.kind ? [expect.kind] : []);
  if (!kinds.includes(payload.k)) return { ok: false, reason: 'kind' };
  if (!payload.o.includes(Number(expect.orderId))) return { ok: false, reason: 'order' };
  const actor = typeof expect.actorEmployeeId === 'string' && expect.actorEmployeeId ? expect.actorEmployeeId : null;
  if ((payload.ac || null) !== actor) return { ok: false, reason: 'actor' };
  if (typeof payload.am === 'number' && typeof expect.amount === 'number' && expect.amount > payload.am + 0.01) return { ok: false, reason: 'amount' };
  return { ok: true };
}

// --- single use ------------------------------------------------------------------------------------------------
// In-process only (a serverless instance): a replay is refused on the instance that saw the first use. There is NO
// cross-instance memory (no AuditLog / DB-backed nonce): on another serverless instance the same token can be used once
// more inside its 5 minutes - see the residual-risk section of docs/server-approval-hardening.md. Keyed by nonce + orderId
// so one token may approve a batch of orders (refunds page) exactly once each.
const used = new Map(); // `${nonce}:${orderId}` -> exp
function purge(now) {
  for (const [k, exp] of used) if (exp < now) used.delete(k);
}
function claimApprovalToken(payload, orderId, now = Date.now()) {
  if (used.size > 200) purge(now);
  const key = `${payload.n}:${Number(orderId)}`;
  const exp = used.get(key);
  if (exp !== undefined && exp >= now) return false;
  used.set(key, payload.exp);
  return true;
}
// A request that was refused AFTER claiming (conflict, validation, crash) gives the claim back so the worker is
// not asked to type the code again.
function releaseApprovalToken(payload, orderId) {
  used.delete(`${payload.n}:${Number(orderId)}`);
}
function resetApprovalTokenUse() {
  used.clear();
}

// One-call convenience: authenticity + bindings + claim. { ok:true, payload } | { ok:false, reason }.
function verifyApprovalToken(token, secret, expect, now = Date.now(), { claim = true } = {}) {
  const r = inspectApprovalToken(token, secret, now);
  if (!r.ok) return r;
  const m = matchApprovalPayload(r.payload, expect);
  if (!m.ok) return m;
  if (claim && !claimApprovalToken(r.payload, expect.orderId, now)) return { ok: false, reason: 'replay' };
  return { ok: true, payload: r.payload };
}

module.exports = {
  APPROVAL_TTL_MS,
  MAX_ORDERS_PER_TOKEN,
  NO_ORDER_ID,
  KINDS,
  PERMISSION_BY_KIND,
  kindForRequiredLevel,
  normalizeOrderIds,
  createApprovalToken,
  inspectApprovalToken,
  matchApprovalPayload,
  claimApprovalToken,
  releaseApprovalToken,
  resetApprovalTokenUse,
  verifyApprovalToken,
};
