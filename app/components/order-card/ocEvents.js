// ocEvents.js — מתאם דק לרישום אירועי "בלי כתיבת מודל" של הזמנה (הדפסה/הורדה/ייצוא/מייל) דרך POST /api/orders/events.
// החוזה (PLAN §C.3.3, נבנה ע"י W0 במקביל): גוף {orderIds:number[≤200], action, meta, clientEventId?}; השרת דוחה MANAGER_APPROVAL
// מהלקוח (אישור מנהל נרשם רק בשרת, דרך verify-pin עם context). כשהקובץ של W0 (lib/history/orderEvents.js) ימוזג, רק הקובץ הזה
// משתנה (למשל ייבוא רשימת הפעולות המותרות משם) - שאר הכרטיס קורא ל-postOrderEvent / oc.logEvent בלבד.

// הפעולות שהכרטיס החדש רשאי לשלוח (העתק של ה-allow-list מ-§C.3.1 בלי MANAGER_APPROVAL שהוא שרת-בלבד).
// הבדיקה הסטטית (scripts/order-card-tests/static.test.mjs) מוודאת שכל logEvent בכרטיס משתמש באחת מהן.
export const ORDER_EVENT_ACTIONS = Object.freeze(['ORDER_PRINTED', 'ORDER_PDF_DOWNLOADED', 'ORDER_XLSX_EXPORTED', 'HISTORY_EXPORTED']);

export const ORDER_EVENTS_URL = '/api/orders/events';

// מזהה אירוע לחסימת שליחה כפולה (§C.3.3 clientEventId)
export function newClientEventId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `ev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// מסנן meta בצד לקוח: רק ערכים פשוטים, בלי מפתחות שנראים כמו סוד (השרת מסנן שוב - זה רק כדי לא לשלוח בכלל).
const SECRET_KEY = /pin|password|secret|card|cvv|token|bank|account|iban|zeout/i;
export function cleanMeta(meta) {
  const out = {};
  if (!meta || typeof meta !== 'object') return out;
  Object.keys(meta).forEach((k) => {
    if (SECRET_KEY.test(k)) return;
    const v = meta[k];
    if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) out[k] = typeof v === 'string' ? v.slice(0, 200) : v;
  });
  return out;
}

/**
 * @param {{orderIds:number[], action:string, meta?:object, clientEventId?:string}} ev
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{ok:boolean,status:number}>}
 */
export async function postOrderEvent({ orderIds, action, meta, clientEventId }, fetchImpl) {
  const f = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!f) return { ok: false, status: 0 };
  if (!ORDER_EVENT_ACTIONS.includes(action)) return { ok: false, status: 400 };
  const ids = (orderIds || []).map(Number).filter(Number.isFinite).slice(0, 200);
  if (!ids.length) return { ok: false, status: 400 };
  try {
    const res = await f(ORDER_EVENTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds: ids, action, meta: cleanMeta(meta), clientEventId: clientEventId || newClientEventId() })
    });
    return { ok: !!res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}
