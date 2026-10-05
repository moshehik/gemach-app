// lib/approvalClient.js - browser helper for the signed approval tokens (docs/server-approval-hardening.md).
// Used by the LEGACY order page, ModernPaymentsManager and the refunds page (the new order card has its own dialog, OcApproval,
// and shares only lib/approvalTokenStore.js). Two jobs:
//   requestApproval  - the existing "manager code" popup (window.customAuthPrompt) + POST /api/auth/verify-pin, now naming the
//                      order, and stashing the returned approvalToken;
//   sendWithApproval - runs a request with the fresh tokens attached and, when the server answers 403 + approvalKind (a token that
//                      expired, or approval_permissions_enforced / approval_tokens_required switched on), asks for exactly that
//                      approval once more and resends. With both flags OFF (default) the server never answers that, so the
//                      behaviour of every legacy flow is unchanged.
// Never logs or stores a code; the token only lives in lib/approvalTokenStore.js (memory).
import {
  DEBT_APPROVAL_LEVEL, MANUAL_CHARGE_LEVEL, MANUAL_PAYMENT_CREDIT_LEVEL,
  stashApprovalToken, peekApprovalToken, clearApprovalToken,
} from './approvalTokenStore';

export const LEVEL_BY_KIND = {
  debt_approval: DEBT_APPROVAL_LEVEL,
  manual_charge: MANUAL_CHARGE_LEVEL,
  manual_payment_credit: MANUAL_PAYMENT_CREDIT_LEVEL,
};
const DEFAULT_MESSAGES = {
  debt_approval: 'נותרת יתרת חוב לתשלום. נדרש אישור מנהל. אנא בחר מנהל והזן סיסמה:',
  manual_charge: 'הוספה או מחיקה של חיוב ידני דורשת אישור מנהל. אנא בחר מאשר והזן סיסמה:',
  manual_payment_credit: 'הפעולה דורשת קוד מאשר. אנא בחר מאשר והזן סיסמה:',
};

// → { employeeId, approvalToken } | null (cancelled / wrong code - the wrong-code case already told the user)
export async function requestApproval({ level, orderId, message, prompt, fetchImpl, notify }) {
  const ask = prompt || ((m, l) => window.customAuthPrompt(m, l));
  const f = fetchImpl || ((...a) => fetch(...a));
  const say = notify || ((m) => { if (typeof alert === 'function') alert(m); });
  const auth = await ask(message, level);
  if (!auth || !auth.pin) return null;
  try {
    const res = await f('/api/auth/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: auth.pin, employeeId: auth.employeeId, requiredLevel: level, orderId }),
    });
    const data = await res.json();
    if (!data.success) { say(data.error || 'סיסמה שגויה או חסרת הרשאה.'); return null; }
    if (data.approvalToken) stashApprovalToken(level, orderId, data.approvalToken);
    return { employeeId: data.employeeId || auth.employeeId, approvalToken: data.approvalToken || null };
  } catch (e) {
    say('שגיאה באימות קוד עובד/מנהל.');
    return null;
  }
}

/**
 * @param {(extra:object)=>Promise<Response>} send   builds and sends the request; `extra` = body fields to merge in
 * @param {{orderId:number, kinds:string[], fieldFor:(kind:string)=>string, messages?:object, prompt?:Function, fetchImpl?:Function, notify?:Function}} o
 *   kinds    - the approvals this request may need (debt_approval only when the body carries a debtApprovedBy)
 *   fieldFor - the body field a kind's token travels in ('debtApprovalToken' | 'manualChargeApprovalToken' | 'paymentApprovalToken' | 'approvalToken')
 * @returns {Promise<Response>} the final response (the original 403 when the user cancels)
 */
export async function sendWithApproval(send, { orderId, kinds, fieldFor, messages = {}, prompt, fetchImpl, notify }) {
  const extra = {};
  for (const kind of kinds) {
    const token = peekApprovalToken(LEVEL_BY_KIND[kind], orderId);
    if (token) extra[fieldFor(kind)] = token;
  }
  let res = await send(extra);
  for (let attempt = 0; attempt < 3 && res.status === 403; attempt++) {
    const body = await res.clone().json().catch(() => null);
    const kind = body && body.approvalKind;
    if (!kind || !kinds.includes(kind)) break;
    const a = await requestApproval({ level: LEVEL_BY_KIND[kind], orderId, message: messages[kind] || DEFAULT_MESSAGES[kind], prompt, fetchImpl, notify });
    if (!a) return res;
    if (a.approvalToken) extra[fieldFor(kind)] = a.approvalToken;
    if (kind === 'debt_approval') extra.debtApprovedBy = a.employeeId; // the order PUT still reads the id in OFF mode
    res = await send(extra);
  }
  if (res.ok) for (const kind of kinds) if (extra[fieldFor(kind)]) clearApprovalToken(LEVEL_BY_KIND[kind], orderId);
  return res;
}

export { stashApprovalToken, peekApprovalToken, clearApprovalToken, DEBT_APPROVAL_LEVEL, MANUAL_CHARGE_LEVEL, MANUAL_PAYMENT_CREDIT_LEVEL };
