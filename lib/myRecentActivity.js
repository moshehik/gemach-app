// lib/myRecentActivity.js - "מה שינה העובד": הרשימה האישית של העובדת המחוברת (ההזמנות החדשות שיצרה והשינויים שעשתה).
// מודול טהור: בלי Prisma, בלי React, בלי נתיבי '@/' (נטען גם ב-`node scripts/test_my_recent_activity.mjs`).
// הנתיב GET /api/me/recent-activity (app/api/me/recent-activity/route.js) קורא את השורות; כאן רק ההחלטות:
//   * אילו שורות יומן שייכות להזמנה ואילו נספרות כ"שינוי" (ולא כחלק מיצירת ההזמנה עצמה);
//   * הנוסח העברי של השינוי - אותו מיפוי של היסטוריית כרטיס ההזמנה (lib/history/orderHistory.js buildOrderHistory),
//     כך שהנוסח כאן זהה לנוסח בלשונית ההיסטוריה של ההזמנה, ושינוי שהמערכת עשתה לבד (חישוב חיובים מחדש) לא נספר.
//
// כללים (החלטות התכנון, ר' scratch\mine-build\NOTES.md):
//   created  = הזמנות שנוצרו על ידי העובדת (שורת AuditLog CREATE של Order עם ה-employeeId שלה), החדשה ראשונה.
//   changed  = הזמנות שהעובדת ערכה (Order / OrderItem / Payment), הזמנה אחת פעם אחת, העריכה האחרונה שלה.
//   הזמנה שהעובדת יצרה לא נכנסת ל"שינויים" בגלל מה שנכתב בזמן היצירה (חלון CREATE_GRACE_MS: הפריטים, התשלום
//   וחישוב הסכום שאחרי השמירה הראשונה) - אלא רק אם ערכה אותה שוב אחרי החלון.
//   הזמנה שבוטלה / טיוטה ('טיוטה') לא מופיעה באף רשימה.

import { buildOrderHistory } from './history/orderHistory.js';
import { addDaysToDateKey, getIsraelDayRange, getIsraelTodayKey } from './hebrewDate.js';

export const MY_ACTIVITY_LIMITS = Object.freeze({
  windowDays: 60,                     // כמה ימי-לוח ישראליים אחורה (גם התקרה לשאילתת היומן - אין אינדקס על employeeId+createdAt)
  changeAuditRows: 400,               // שורות יומן אחרונות של העובדת (Order/OrderItem/Payment)
  createAuditRows: 60,                // שורות CREATE אחרונות של Order
  maxOrders: 30,                      // כמה הזמנות נבדקות לעומק (טעינת פריטים + תשלומים + יומן שלהן)
  perList: 20,                        // תקרה לכל רשימה בתשובה
  historyAuditRows: 3000,             // תקרת שורות היומן של ההזמנות הנבדקות (כמו MAX_AUDIT_ROWS בנתיב ההיסטוריה, מוכפל)
  itemRows: 600,
  paymentRows: 600,
});
export const CREATE_GRACE_MS = 10 * 60 * 1000;
export const MY_ENTITY_TYPES = Object.freeze(['Order', 'OrderItem', 'Payment']);
const ME = 'me';
const OTHER = 'other';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DRAFT_STATUS = 'טיוטה';

const ms = (v) => { const d = v instanceof Date ? v : new Date(v); const t = d.getTime(); return Number.isNaN(t) ? 0 : t; };

/** תחילת חלון השאילתה: תחילת היום הישראלי לפני windowDays ימים (לא חישוב ב-UTC / setHours). */
export function activitySince(now = new Date(), windowDays = MY_ACTIVITY_LIMITS.windowDays) {
  return getIsraelDayRange(addDaysToDateKey(getIsraelTodayKey(now), -windowDays)).start;
}

/** מפתחות החיפוש של שורות היומן שנקראו: מזהי Order (uuid / מספר), פריטים ותשלומים (למציאת ההזמנה שלהם). */
export function collectRefs(rows) {
  const orderUuids = new Set(); const orderNumbers = new Set(); const itemIds = new Set(); const paymentIds = new Set();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r.entityId !== 'string') continue;
    if (r.entityType === 'Order') {
      if (UUID.test(r.entityId)) orderUuids.add(r.entityId);
      else if (/^\d{1,10}$/.test(r.entityId)) orderNumbers.add(Number(r.entityId));
    } else if (r.entityType === 'OrderItem') itemIds.add(r.entityId);
    else if (r.entityType === 'Payment') paymentIds.add(r.entityId);
  }
  return { orderUuids: [...orderUuids], orderNumbers: [...orderNumbers], itemIds: [...itemIds], paymentIds: [...paymentIds] };
}

/**
 * מצמיד לכל שורת יומן את מספר ההזמנה שלה. lookups: { uuidToNumber: Map, itemToOrder: Map, paymentToOrder: Map } (מספרי הזמנה).
 * שורה שאי אפשר לשייך להזמנה נזרקת.
 */
export function attachOrderNumbers(rows, lookups) {
  const out = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r) continue;
    let n = null;
    if (r.entityType === 'Order') n = UUID.test(r.entityId) ? lookups.uuidToNumber.get(r.entityId) : (/^\d{1,10}$/.test(r.entityId) ? Number(r.entityId) : null);
    else if (r.entityType === 'OrderItem') n = lookups.itemToOrder.get(r.entityId);
    else if (r.entityType === 'Payment') n = lookups.paymentToOrder.get(r.entityId);
    if (typeof n === 'number' && Number.isFinite(n)) out.push({ ...r, orderNumber: n });
  }
  return out;
}

/**
 * שורות היומן של העובדת (כבר עם orderNumber) -> מועמדות לשתי הרשימות. הכל לפי הזמן, החדש ראשון.
 * @returns {{ created: Array<{orderNumber:number, at:number}>, changed: Array<{orderNumber:number, at:number}>, createdAt: Map<number, number> }}
 */
export function pickCandidates(rows, { graceMs = CREATE_GRACE_MS } = {}) {
  const list = (Array.isArray(rows) ? rows : []).map((r) => ({ ...r, at: ms(r.createdAt) })).filter((r) => r.at > 0);
  const createdAt = new Map(); // מספר הזמנה -> רגע היצירה (המוקדם ביותר של שורת CREATE של העובדת)
  for (const r of list) {
    if (r.entityType === 'Order' && r.action === 'CREATE') {
      const prev = createdAt.get(r.orderNumber);
      if (prev === undefined || r.at < prev) createdAt.set(r.orderNumber, r.at);
    }
  }
  const created = [...createdAt.entries()].map(([orderNumber, at]) => ({ orderNumber, at })).sort((a, b) => b.at - a.at);
  const seen = new Set(); const changed = [];
  for (const r of list.slice().sort((a, b) => b.at - a.at)) {
    if (r.entityType === 'Order' && r.action === 'CREATE') continue;
    const c = createdAt.get(r.orderNumber);
    if (c !== undefined && r.at >= c && r.at - c <= graceMs) continue; // חלק מיצירת ההזמנה
    if (seen.has(r.orderNumber)) continue;
    seen.add(r.orderNumber);
    changed.push({ orderNumber: r.orderNumber, at: r.at });
  }
  return { created, changed, createdAt };
}

/** הזמנה שמותר להציג: קיימת, לא בוטלה, לא טיוטה. */
export function isListable(order) {
  return !!order && !order.isDeleted && order.status !== DRAFT_STATUS;
}

export function customerNameOf(order) {
  const c = order && order.customer;
  return c ? [c.firstName, c.lastName].filter(Boolean).join(' ').trim() : '';
}

const iso = (v) => new Date(ms(v)).toISOString();

/** הנוסח והרגע של השינוי האחרון של העובדת בהזמנה אחת (מיפוי היסטוריית ההזמנה). null = אין שינוי מוצג. */
export function lastChangeOf({ order, auditRows, items, payments, me, afterMs = 0 }) {
  const rows = (Array.isArray(auditRows) ? auditRows : []).map((r) => ({ ...r, employeeName: r.employeeId && r.employeeId === me ? ME : OTHER }));
  const h = buildOrderHistory({
    order: { id: order.id, orderId: order.orderNumber, orderDate: order.orderDate, isDeleted: false },
    auditRows: rows, items: items || [], payments: payments || [],
  });
  let best = null;
  for (const e of h.entries || []) {
    if (e.who !== ME || e.system) continue;
    const t = ms(e.ts);
    if (t <= afterMs) continue;
    if (!best || t > best.t) best = { t, text: e.text };
  }
  return best ? { label: best.text, at: new Date(best.t).toISOString() } : null;
}

/**
 * הרכבה סופית. כל הקלטים כבר נקראו (ראו הנתיב): ordersByNumber: Map מספר -> {id, orderNumber, orderDate, status, isDeleted, customer},
 * historyByNumber: Map מספר -> { auditRows, items, payments } (היסטוריה מלאה של ההזמנה, לא רק של העובדת - בסיס ההשוואה של המיפוי).
 */
export function composeMyActivity({ candidates, ordersByNumber, historyByNumber, me, limits = MY_ACTIVITY_LIMITS }) {
  const created = [];
  for (const c of candidates.created) {
    if (created.length >= limits.perList) break;
    const o = ordersByNumber.get(c.orderNumber);
    if (!isListable(o)) continue;
    created.push({ orderId: o.id, orderNumber: o.orderNumber, customerName: customerNameOf(o), createdAt: iso(c.at) });
  }
  const changed = [];
  for (const c of candidates.changed) {
    if (changed.length >= limits.perList) break;
    const o = ordersByNumber.get(c.orderNumber);
    if (!isListable(o)) continue;
    const h = historyByNumber.get(c.orderNumber) || {};
    const created0 = candidates.createdAt.get(c.orderNumber);
    const last = lastChangeOf({ order: o, auditRows: h.auditRows, items: h.items, payments: h.payments, me, afterMs: created0 === undefined ? 0 : created0 + CREATE_GRACE_MS });
    if (!last) continue;
    changed.push({ orderId: o.id, orderNumber: o.orderNumber, customerName: customerNameOf(o), lastChangeLabelHe: last.label, lastChangeAt: last.at });
  }
  changed.sort((a, b) => ms(b.lastChangeAt) - ms(a.lastChangeAt));
  return { created, changed };
}

/** מספרי ההזמנות שצריך את פרטיהן (שם לקוחה, סטטוס, בוטלה): נוצרו + שונו, עד maxOrders מכל סוג. */
export function detailOrderNumbers(candidates, maxOrders = MY_ACTIVITY_LIMITS.maxOrders) {
  return [...new Set([...candidates.created.slice(0, maxOrders), ...candidates.changed.slice(0, maxOrders)].map((c) => c.orderNumber))];
}

/** מספרי ההזמנות שנטענת להן ההיסטוריה המלאה (פריטים + תשלומים + יומן): רק אלה שיש בהן שינוי, עד maxOrders. */
export function historyOrderNumbers(candidates, maxOrders = MY_ACTIVITY_LIMITS.maxOrders) {
  return candidates.changed.slice(0, maxOrders).map((c) => c.orderNumber);
}
