/**
 * Nedarim Plus "Manage3" API - the newer, API-key-based institution management API
 * (list/edit/single-charge/etc. on existing standing orders - הוראות קבע/הו"ק), as
 * opposed to app/lib/nedarim.js which only ever CREATES a charge/standing-order via
 * the older DebitCard.aspx/DebitKeva.aspx WebServices. Auth is a per-institution
 * "ApiPassword" (starts npk_), created at reports.matara.pro > הגדרות > API > מפתחות
 * API - stored only as the NEDARIM_API_PASSWORD Vercel env var (never in the DB),
 * since it's a plain infra credential like AUTH_SECRET/GEMINI_API_KEYS, not user data.
 *
 * Full doc: the vendor-supplied markdown this was built from (not committed to the
 * repo - ask the owner for a fresh copy if it's needed again, or see
 * https://reports.matara.pro/more/api).
 */

const MANAGE3_URL = 'https://matara.pro/nedarimplus/Reports/Manage3.aspx';

function getApiPassword() {
  const pw = process.env.NEDARIM_API_PASSWORD;
  if (!pw) throw new Error('NEDARIM_API_PASSWORD אינו מוגדר בהגדרות הסביבה');
  return pw;
}

/**
 * Low-level call to Manage3.aspx. Always POSTs form-encoded (the doc's own general
 * rule says the server reads most actions from either channel - POST keeps the API
 * password and other params out of any URL/access log).
 * Returns { raw, json } - json is null when the response isn't valid JSON (several
 * actions return a bare success/error string instead, per the docs).
 */
async function callManage3(action, params = {}) {
  const body = new URLSearchParams({
    Action: action,
    ApiPassword: getApiPassword(),
    ...Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null)),
  });

  const response = await fetch(MANAGE3_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: body.toString(),
  });

  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // several actions (delete/disable/freeze) return bare text, not JSON - handled by callers
  }
  return { raw: text, json };
}

/** רשימת הוראות (כמו בממשק) - GetKevaNew. Hides frozen/inactive unless the institution's own UI setting shows them. */
export async function getKevaList({ mosadId }) {
  return callManage3('GetKevaNew', { MosadId: mosadId });
}

/** רשימת הוראות (מלאה, לסנכרון) - GetKevaJson. Rate-limited to 20 calls/hour by Nedarim. Max 2000 rows/call. */
export async function getKevaListFull({ mosadId, lastId, maxId }) {
  return callManage3('GetKevaJson', { MosadId: mosadId, LastId: lastId, MaxId: maxId });
}

/** פרטי הוראה - GetKevaId. Includes HistoryData (charge history) and KevaLog (action log) for one standing order. */
export async function getKevaDetails({ mosadId, kevaId }) {
  return callManage3('GetKevaId', { MosadId: mosadId, KevaId: kevaId });
}

/**
 * עריכת הוראה - UpdateKevaNew. Partial update: only fields actually present in
 * `fields` are changed; a field sent as an empty string CLEARS the stored value.
 * Never send a field you don't intend to touch.
 */
export async function updateKeva({ mosadId, kevaId, fields = {} }) {
  return callManage3('UpdateKevaNew', { MosadId: mosadId, KevaId: kevaId, ...fields });
}

/** גביית תשלום בודד - TashlumBodedNew. Charges the standing order's saved card NOW, without changing the order itself (balance/next date untouched). This is how you actually collect on a הוק. */
export async function chargeKevaSingle({ mosadId, kevaId, amount, currency = 1, installments = 1, groupe, comments, joinToKeva, ajaxId }) {
  return callManage3('TashlumBodedNew', {
    MosadId: mosadId,
    KevaId: kevaId,
    Amount: amount,
    Currency: currency,
    Tashlumim: installments,
    Groupe: groupe,
    Comments: comments,
    JoinToKevaId: joinToKeva ? 'Join' : 'NoJoin',
    AjaxId: ajaxId,
  });
}

/** מחיקת הוראה - DeleteKeva. Permanent (recorded in the order's own change log). Returns bare text, not JSON. */
export async function deleteKeva({ mosadId, kevaId }) {
  return callManage3('DeleteKeva', { MosadId: mosadId, KevaId: kevaId });
}

/** הקפאת הוראה - DisableKeva. Reversible (unlike delete). Returns bare text, not JSON. */
export async function disableKeva({ mosadId, kevaId }) {
  return callManage3('DisableKeva', { MosadId: mosadId, KevaId: kevaId });
}

/** הפעלת הוראה - EnableKevaNew. Re-activates a frozen order; a past-due next-charge date is auto-advanced. */
export async function enableKeva({ mosadId, kevaId }) {
  return callManage3('EnableKevaNew', { MosadId: mosadId, KevaId: kevaId });
}

/** הסטוריית עסקאות (כלל האשראי, לא רק הו"ק) - GetHistoryJson. Rate-limited to 20 calls/hour. Ascending by TransactionId, max 2000 rows/call - for "recent" payments, fetch and take the tail. */
export async function getTransactionHistory({ mosadId, lastId, maxId }) {
  return callManage3('GetHistoryJson', { MosadId: mosadId, LastId: lastId, MaxId: maxId });
}
