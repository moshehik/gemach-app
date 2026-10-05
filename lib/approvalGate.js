// lib/approvalGate.js - server-side use of the signed approval tokens (lib/approvalTokens.js).
// Threat model + rollout: docs/server-approval-hardening.md.
//
// Two per-gemach SystemSettings (each gemach has its own DB, so each is flipped independently; absent = OFF):
//   approval_tokens_required    'true' -> a debt approval is accepted ONLY with a valid approval token (the approver
//                                is read FROM the token). A bare approver id in the body is refused.
//   approval_permissions_enforced 'true' -> the permissions that used to be client-only (manual charge on ANY body,
//                                manual payment/credit, payment deletion, credit execution, new payments) are enforced
//                                in the server: the logged-in employee must hold the permission, or an approver
//                                token of the right kind for THIS order must come with the request.
// OFF = exactly today's behavior (a bare id is still accepted, with a one-line deprecation log that carries no
// secrets - no ids, no tokens, no pins).
import prisma, { getActingEmployeeId } from '@/app/lib/prisma';
import { getCachedSetting } from '@/lib/settingsCache';
import { hasPermission } from '@/lib/permissions';
import tokens from './approvalTokens.js';
import receipts from './chargeReceipts.js';
import {
  MANUAL_CHARGE_APPROVAL_REQUIRED_CODE, detectManualChargeChanges, hasManualChargeChange, detectAutoLineRemovals, detectPaymentMoneyChanges,
} from '@/lib/history/orderEvents';

export const APPROVAL_TOKENS_SETTING = 'approval_tokens_required';
export const APPROVAL_PERMISSIONS_SETTING = 'approval_permissions_enforced';
export const APPROVAL_TOKEN_REQUIRED_CODE = 'APPROVAL_TOKEN_REQUIRED';
export const APPROVAL_TOKEN_INVALID_CODE = 'APPROVAL_TOKEN_INVALID';
export const APPROVAL_PERMISSION_REQUIRED_CODE = 'APPROVAL_PERMISSION_REQUIRED';

const { KINDS, PERMISSION_BY_KIND, inspectApprovalToken, matchApprovalPayload, claimApprovalToken, releaseApprovalToken } = tokens;
export { KINDS };

export function approvalSecret() {
  return process.env.AUTH_SECRET || null;
}

async function flag(key) {
  try {
    const row = await getCachedSetting(key);
    return !!row && String(row.value).trim().toLowerCase() === 'true';
  } catch (e) {
    console.error('[approval] could not read setting', key);
    return false; // same default as an absent row; the surrounding request fails on its own DB reads if the DB is really down
  }
}

// No AUTH_SECRET = tokens cannot be signed or verified (authTokens.js treats it the same way: legacy mode, never lock
// everybody out). Both live deployments have the secret.
let warnedNoSecret = false;
export async function getApprovalMode() {
  const secret = approvalSecret();
  const [tokensFlag, permsFlag] = await Promise.all([flag(APPROVAL_TOKENS_SETTING), flag(APPROVAL_PERMISSIONS_SETTING)]);
  if ((tokensFlag || permsFlag) && !secret && !warnedNoSecret) {
    warnedNoSecret = true;
    console.error('[approval] approval flags are ON but AUTH_SECRET is not configured - running in legacy mode');
  }
  return { secret, tokensRequired: tokensFlag && !!secret, permissionsEnforced: permsFlag && !!secret };
}

// Rate-limited deprecation line (kind + order only).
const lastLegacyLog = new Map();
function logLegacy(what, kind, orderId) {
  const key = `${what}:${kind}`;
  const now = Date.now();
  if ((lastLegacyLog.get(key) || 0) + 60 * 1000 > now) return;
  lastLegacyLog.set(key, now);
  console.warn(`[approval] ${what} accepted without an approval token (kind=${kind}, order=${orderId}); set ${APPROVAL_TOKENS_SETTING}=true to require tokens`);
}

// kind = which approval is missing (the clients re-ask for exactly that one and resend with the fresh token)
function reject(status, code, error, reason, kind) {
  return { ok: false, status, code, error, reason, kind };
}

// Verifies `token` for (kind, order, the logged-in actor) and claims it. { ok:true, approverId, payload } | { ok:false, reason }.
async function verifyToken(token, secret, kind, orderId, claims) {
  const inspected = inspectApprovalToken(token, secret);
  if (!inspected.ok) return inspected;
  const actorId = await getActingEmployeeId();
  const matched = matchApprovalPayload(inspected.payload, { kind, orderId, actorEmployeeId: actorId });
  if (!matched.ok) return matched;
  if (!claimApprovalToken(inspected.payload, orderId)) return { ok: false, reason: 'replay' };
  if (claims) claims.push({ payload: inspected.payload, orderId });
  return { ok: true, approverId: inspected.payload.ap, payload: inspected.payload };
}

// A request that failed AFTER its tokens were claimed hands them back (the worker is not asked for the code again).
// The money action behind the claims has been committed: the tokens stay spent even if a later step of the request fails.
export function commitApprovalClaims(claims) {
  if (claims) claims.length = 0;
}

export function releaseApprovalClaims(claims) {
  for (const c of claims || []) {
    if (c.receipt) receipts.releaseChargeReceipt(c.receipt);
    else releaseApprovalToken(c.payload, c.orderId);
  }
  if (claims) claims.length = 0;
}

// A credit-card payment row is un-gated ONLY when it carries the signed receipt that POST /api/nedarim returned for a charge that
// really went through (lib/chargeReceipts.js): bound to this order, this exact amount and the logged-in employee, single use.
// Returns true when the receipt is valid (and claimed - pushed on `claims`, so a failed request hands it back), else false.
export function claimChargeReceiptFor({ receipt, orderId, amount, claims, mode, actorId }) {
  if (!receipt || !mode || !mode.secret) return false;
  const inspected = receipts.inspectChargeReceipt(receipt, mode.secret);
  if (!inspected.ok) return false;
  if (!receipts.matchChargeReceipt(inspected.payload, { orderId, amount, actorEmployeeId: actorId }).ok) return false;
  if (!receipts.claimChargeReceipt(inspected.payload)) return false;
  if (claims) claims.push({ receipt: inspected.payload });
  return true;
}

// Debt approval (order PUT `debtApprovedBy`, /debt-approval POST/DELETE `employeeId`).
//   token    - body.debtApprovalToken
//   bareId   - the CLAIMED approver id from the body (legacy)
// Returns { ok:true, approverId|null, via:'token'|'legacy-id'|'none' } or { ok:false, status, code, error }.
// The caller still re-checks canApproveDebt(approverId) - a permission revoked within the 5 minutes must not pass.
export async function resolveDebtApprover({ orderId, token, bareId, claims, mode }) {
  const m = mode || (await getApprovalMode());
  const wantsApproval = !!(token || bareId);
  if (!wantsApproval) return { ok: true, approverId: null, via: 'none' };
  if (token) {
    const v = await verifyToken(token, m.secret, KINDS.DEBT_APPROVAL, orderId, claims);
    if (v.ok) return { ok: true, approverId: v.approverId, via: 'token' };
    if (m.tokensRequired) {
      return reject(403, APPROVAL_TOKEN_INVALID_CODE, 'אישור המנהל פג תוקף או אינו תקף - יש לאשר מחדש בקוד מנהל', v.reason, KINDS.DEBT_APPROVAL);
    }
    // OFF: an unusable token must not break a client that also sent the legacy id
    if (!bareId) return reject(403, APPROVAL_TOKEN_INVALID_CODE, 'אישור המנהל פג תוקף או אינו תקף - יש לאשר מחדש בקוד מנהל', v.reason, KINDS.DEBT_APPROVAL);
  }
  if (m.tokensRequired) {
    return reject(403, APPROVAL_TOKEN_REQUIRED_CODE, 'אישור חוב מחייב אימות בקוד מנהל - יש לאשר מחדש', 'bare_id', KINDS.DEBT_APPROVAL);
  }
  logLegacy('debt approver id', KINDS.DEBT_APPROVAL, orderId);
  return { ok: true, approverId: bareId, via: 'legacy-id' };
}

// Permission-backed actions (manual charge / manual payment-credit / payment deletion / credit execution / payments).
//   enforced only when mode.permissionsEnforced; otherwise { ok:true, via:'not-enforced' }.
//   allowed when: the logged-in employee holds `PERMISSION_BY_KIND[kind]`, or `token` is a valid token of that kind for
//   this order (its approver, re-checked now, holds the permission). `extraAllow()` lets a caller add its own proof
//   (the a5 card's typed manualChargeApproverPin, verified server-side).
export async function requireApprovalPermission({ kind, orderId, token, sessionEmployee, claims, mode, extraAllow }) {
  const m = mode || (await getApprovalMode());
  if (!m.permissionsEnforced) return { ok: true, via: 'not-enforced' };
  const permKey = PERMISSION_BY_KIND[kind];
  if (sessionEmployee && (await hasPermission(sessionEmployee, permKey))) return { ok: true, via: 'session' };
  if (token) {
    const v = await verifyToken(token, m.secret, kind, orderId, claims);
    if (v.ok) {
      const approver = await prisma.employee.findUnique({ where: { id: v.approverId }, select: { id: true, roleId: true, isActive: true } });
      if (approver && approver.isActive && (await hasPermission(approver, permKey))) return { ok: true, via: 'token', approverId: approver.id };
      releaseApprovalClaims(claims);
      if (extraAllow && (await extraAllow())) return { ok: true, via: 'extra' };
      return reject(403, APPROVAL_TOKEN_INVALID_CODE, 'המאשר אינו מורשה לפעולה זו', 'approver_permission', kind);
    }
    if (extraAllow && (await extraAllow())) return { ok: true, via: 'extra' };
    return reject(403, APPROVAL_TOKEN_INVALID_CODE, 'אישור המנהל פג תוקף או אינו תקף - יש לאשר מחדש בקוד מנהל', v.reason, kind);
  }
  if (extraAllow && (await extraAllow())) return { ok: true, via: 'extra' };
  return reject(403, APPROVAL_PERMISSION_REQUIRED_CODE, 'פעולה זו מותרת רק למי שהוגדר כמאשר (או באישור שלו בקוד)', 'no_permission', kind);
}

// ---- PUT /api/orders/[id] -----------------------------------------------------------------------------------------
// The money-affecting parts of an order save. `stored*` are the rows loaded before the transaction.
//   - manual charge added / edited / removed / restored: a5 bodies are ALWAYS gated (today's R35 rule: the logged-in
//     employee holds feature:manual_charge_add, or the typed manualChargeApproverId/Pin of one that does - now also a
//     manualChargeApprovalToken); any other body only when approval_permissions_enforced (H2: the cardVariant field was
//     the only switch, a direct call just left it out).
//   - stored non-manual obligation lines soft-deleted: same permission (enforced mode only).
//   - stored payment deleted or its amount changed: feature:manual_payment_credit_add (enforced mode only, H3).
// Returns { ok:true } or { ok:false, status, body } (body is ready for NextResponse.json).
export async function enforceOrderPutApprovals({ data, orderId, storedObligations, storedPayments, mode, claims, loadSessionEmployee, isA5Body, typedManualChargePinOk }) {
  const m = mode || (await getApprovalMode());
  const manual = detectManualChargeChanges(data.obligations, storedObligations);
  const autoRemoved = m.permissionsEnforced ? detectAutoLineRemovals(data.obligations, storedObligations) : 0;
  const needsCharge = (hasManualChargeChange(manual) && (isA5Body || m.permissionsEnforced)) || autoRemoved > 0;
  const money = m.permissionsEnforced ? detectPaymentMoneyChanges(data.payments, storedPayments) : { deleted: 0, edited: 0 };
  const needsPayment = money.deleted + money.edited > 0;
  if (!needsCharge && !needsPayment) return { ok: true };
  const sessionEmployee = loadSessionEmployee ? await loadSessionEmployee() : null; // one lookup, only when a gate applies
  if (needsCharge) {
    const gate = await requireApprovalPermission({
      kind: KINDS.MANUAL_CHARGE, orderId, token: data.manualChargeApprovalToken, sessionEmployee, claims,
      mode: { ...m, permissionsEnforced: true }, extraAllow: typedManualChargePinOk,
    });
    if (!gate.ok) {
      return {
        ok: false, status: 403,
        body: {
          code: MANUAL_CHARGE_APPROVAL_REQUIRED_CODE,
          approvalCode: gate.code,
          approvalKind: KINDS.MANUAL_CHARGE,
          error: 'הוספה או מחיקה של חיוב ידני מותרת רק למי שהוגדר כמאשר חיוב ידני (או באישור שלו).',
        },
      };
    }
  }
  if (needsPayment) {
    const gate = await requireApprovalPermission({
      kind: KINDS.MANUAL_PAYMENT_CREDIT, orderId, token: data.paymentApprovalToken, sessionEmployee, claims, mode: m,
    });
    if (!gate.ok) {
      return { ok: false, status: 403, body: { code: gate.code, approvalKind: KINDS.MANUAL_PAYMENT_CREDIT, error: 'מחיקה או שינוי של תשלום מותרים רק למי שהוגדר כמאשר תשלום/זיכוי ידני (או באישור שלו בקוד).' } };
    }
  }
  return { ok: true };
}
