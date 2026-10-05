'use strict';
// lib/chargeReceipts.js - signed proof that a credit-card charge really went through (hardening, 2026-10-05).
//
// WHY: POST /api/payments used to treat any method containing 'אשראי' as "a card payment saved right after the Nedarim charge" and
// never gated it. With approval_permissions_enforced ON that let a worker without feature:manual_payment_credit_add post a
// payment of any amount labelled 'אשראי' (cash in disguise). The charge happens in a different request (POST /api/nedarim),
// and a Payment row has no confirmation column (the Nedarim answer lives in free-text `notes`, which anybody can type), so the
// payments route has nothing it can check - until the charge route hands back a receipt that only the server can sign.
//
// Receipt: c1.<base64url(JSON payload)>.<base64url(HMAC-SHA256(key, "c1.<payload>"))>
// Payload: { o: orderId|null, am: chargedAmount, cf: confirmation, ac: actorEmployeeId|null, iat, exp, n: nonce }
// Key:     HMAC-SHA256(AUTH_SECRET, 'gemach/charge-receipt/v1') - a domain of its own (never interchangeable with an
//          auth_session cookie or an approval token).
// Minted by app/api/nedarim/route.js ONLY after Nedarim answered success; consumed by app/api/payments/route.js (bound to the
// order, the amount and the logged-in employee; single use per server instance). No card data is ever inside.

const crypto = require('crypto');

const RECEIPT_VERSION = 'c1';
const KEY_DOMAIN = 'gemach/charge-receipt/v1';
// The card is already charged when this is minted: the clients save the payment immediately, but a slow network / retry must
// still work - a generous hour (the receipt only unlocks ONE payment row of exactly the charged amount, for that order).
const RECEIPT_TTL_MS = 60 * 60 * 1000;

function deriveKey(secret) {
  return crypto.createHmac('sha256', String(secret)).update(KEY_DOMAIN).digest();
}

function toOrderId(v) {
  const n = typeof v === 'number' ? v : (typeof v === 'string' && /^\d{1,9}$/.test(v) ? parseInt(v, 10) : NaN);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// null when it cannot be minted (no secret / no usable amount).
function createChargeReceipt({ orderId, amount, confirmation, actorEmployeeId = null }, secret, now = Date.now(), ttlMs = RECEIPT_TTL_MS) {
  const am = typeof amount === 'number' ? amount : parseFloat(amount);
  if (!secret || !Number.isFinite(am) || am <= 0) return null;
  const payload = {
    o: toOrderId(orderId),
    am,
    cf: String(confirmation == null ? '' : confirmation).slice(0, 64),
    ac: typeof actorEmployeeId === 'string' && actorEmployeeId ? actorEmployeeId : null,
    iat: now,
    exp: now + ttlMs,
    n: crypto.randomBytes(12).toString('base64url'),
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', deriveKey(secret)).update(`${RECEIPT_VERSION}.${body}`).digest('base64url');
  return `${RECEIPT_VERSION}.${body}.${sig}`;
}

// Authenticity + expiry. { ok:true, payload } | { ok:false, reason }. Never throws.
function inspectChargeReceipt(receipt, secret, now = Date.now()) {
  try {
    if (!secret) return { ok: false, reason: 'no_secret' };
    if (!receipt || typeof receipt !== 'string' || receipt.length > 2048) return { ok: false, reason: 'malformed' };
    const parts = receipt.split('.');
    if (parts.length !== 3 || parts[0] !== RECEIPT_VERSION) return { ok: false, reason: 'malformed' };
    const expected = crypto.createHmac('sha256', deriveKey(secret)).update(`${parts[0]}.${parts[1]}`).digest();
    const given = Buffer.from(parts[2], 'base64url');
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return { ok: false, reason: 'signature' };
    const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!p || typeof p.n !== 'string' || !p.n || typeof p.am !== 'number' || !Number.isFinite(p.am)) return { ok: false, reason: 'malformed' };
    if (p.o !== null && !(Number.isInteger(p.o) && p.o > 0)) return { ok: false, reason: 'malformed' };
    if (typeof p.iat !== 'number' || typeof p.exp !== 'number') return { ok: false, reason: 'malformed' };
    if (now > p.exp || p.iat > now + 60 * 1000) return { ok: false, reason: 'expired' };
    return { ok: true, payload: p };
  } catch (e) {
    return { ok: false, reason: 'malformed' };
  }
}

// expect = { orderId, amount, actorEmployeeId }. The receipt covers exactly the charged amount, for its order, for the
// employee who ran the charge. A receipt minted without an order id (a client that did not send it) is not order-bound.
function matchChargeReceipt(payload, expect) {
  if (payload.o !== null && payload.o !== Number(expect.orderId)) return { ok: false, reason: 'order' };
  const actor = typeof expect.actorEmployeeId === 'string' && expect.actorEmployeeId ? expect.actorEmployeeId : null;
  if ((payload.ac || null) !== actor) return { ok: false, reason: 'actor' };
  if (typeof expect.amount !== 'number' || !Number.isFinite(expect.amount) || Math.abs(expect.amount - payload.am) > 0.01) return { ok: false, reason: 'amount' };
  return { ok: true };
}

// single use - in process only (one serverless instance), like lib/approvalTokens.js
const used = new Map(); // nonce -> exp
function claimChargeReceipt(payload, now = Date.now()) {
  if (used.size > 200) for (const [k, exp] of used) if (exp < now) used.delete(k);
  const exp = used.get(payload.n);
  if (exp !== undefined && exp >= now) return false;
  used.set(payload.n, payload.exp);
  return true;
}
function releaseChargeReceipt(payload) {
  used.delete(payload.n);
}
function resetChargeReceiptUse() {
  used.clear();
}

module.exports = {
  RECEIPT_TTL_MS,
  createChargeReceipt,
  inspectChargeReceipt,
  matchChargeReceipt,
  claimChargeReceipt,
  releaseChargeReceipt,
  resetChargeReceiptUse,
};
