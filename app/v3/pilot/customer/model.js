// app/v3/pilot/customer/model.js — חישובים טהורים לכרטיס הלקוח v3 (פיילוט).
// כל נוסחה כאן היא **העתקה נאמנה** של מה שעושה העמוד הקיים ב-main (R8 — לא משנים חישוב):
//   - totals/balance = components/customers/modern/ModernCustomerPaymentsTab.js
//   - orderTotals/sort = components/customers/modern/ModernCustomerOrdersTab.js
//   - allPayments = app/customers/[id]/page.js
// סטטוס הזמנה/תשלום נלקח מ-lib/orderStatus.js בלבד (מקור אמת יחיד).
import { calculateOrderStatus, calculatePaymentStatus } from '@/lib/orderStatus';

/** השדות שהמשתמש עורך בכרטיס (רשימת השינויים ברייל נגזרת מהם). סדר = סדר התצוגה. */
export const EDIT_FIELDS = [
  'firstName', 'lastName', 'phone1', 'phone2', 'email', 'city', 'street', 'houseNum', 'zeout', 'marketingConsent', 'notes',
  'bankName', 'bankBranch', 'bankAccount', 'bankAccountName',
];
export const DETAIL_FIELDS = EDIT_FIELDS.slice(0, 11);
export const BANK_FIELDS = EDIT_FIELDS.slice(11);
export const LTR_FIELDS = new Set(['phone1', 'phone2', 'email', 'houseNum', 'zeout', 'bankBranch', 'bankAccount']);
export const FIELD_ICON = {
  firstName: 'user', lastName: 'user', phone1: 'phone', phone2: 'phone', email: 'mail', city: 'pin', street: 'pin', houseNum: 'pin',
  zeout: 'id', marketingConsent: 'mail', notes: 'file', bankName: 'wallet', bankBranch: 'wallet', bankAccount: 'wallet', bankAccountName: 'user',
};

/** השוואה לרשימת השינויים: השרת מחזיר houseNum כמספר, zeout ריק כ-null — אלה לא "שינוי". */
export const norm = (k, v) => (k === 'marketingConsent' ? !!v : String(v ?? '').trim());
export function diffFields(cur, orig) {
  if (!cur || !orig) return [];
  return EDIT_FIELDS.filter((k) => norm(k, cur[k]) !== norm(k, orig[k])).map((k) => ({ k, from: orig[k], to: cur[k] }));
}

export const fullName = (c) => [c?.firstName, c?.lastName].filter((n) => n && String(n).toLowerCase() !== 'null').join(' ');
export const initials = (c) => (((c?.firstName || '')[0] || '') + ((c?.lastName || '')[0] || '')) || '?';
export const address = (c) => [c?.street && `${c.street} ${c.houseNum || ''}`.trim(), c?.city].filter(Boolean).join(', ');

export function orderRequired(order) {
  return order.obligations?.length > 0
    ? order.obligations.reduce((sum, o) => sum + (o.isDeleted ? 0 : o.amount), 0)
    : (order.totalAmount || 0);
}
export const orderPaid = (order) => order.payments?.reduce((sum, p) => sum + (p.isDeleted ? 0 : p.amount), 0) || 0;

export function sortOrders(orders = []) {
  const at = (o) => ((o.isWeekdayEvent || o.isAbroad) ? (o.fromDate || o.eventDate || o.orderDate || o.createdAt || 0) : (o.eventDate || o.orderDate || o.createdAt || 0));
  return [...orders].sort((a, b) => new Date(at(b)) - new Date(at(a)));
}

export function orderRow(order) {
  const required = orderRequired(order);
  const paid = orderPaid(order);
  return { order, required, paid, status: calculateOrderStatus(order), payStatus: calculatePaymentStatus(required, paid) };
}

export function allPayments(customer, refunds) {
  if (!customer?.orders) return [];
  return [
    ...customer.orders.flatMap((order) => (order.payments || []).map((p) => ({ ...p, orderId: order.orderId, entryType: 'payment' }))),
    ...refunds.map((r) => ({ ...r, entryType: 'refund', paymentDate: r.createdAt, paymentMethod: 'זיכוי' })),
  ].sort((a, b) => new Date(b.paymentDate || b.createdAt || 0) - new Date(a.paymentDate || a.createdAt || 0));
}

/** אותה נוסחה בדיוק: יתרה = חיובים − (תשלומים − זיכויים). (ספירה כפולה אפשרית — REVIEW-1 OQ-2, לא משנים) */
export function totals(customer, payments) {
  const required = (customer?.orders || []).reduce((acc, o) => acc + orderRequired(o), 0);
  const paid = payments.filter((p) => p.entryType !== 'refund').reduce((s, p) => s + (p.amount || 0), 0);
  const refunded = payments.filter((p) => p.entryType === 'refund').reduce((s, p) => s + (p.amount || 0), 0);
  return { required, paid, refunded, balance: required - (paid - refunded) };
}

/** "ההזמנה הקרובה" — UI בלבד, נגזר מאותו calculateOrderStatus ('בקרוב'), הקרובה בזמן. */
export function upcomingOrder(orders = []) {
  const soon = orders.filter((o) => calculateOrderStatus(o) === 'בקרוב' && o.eventDate);
  soon.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
  return soon[0] || null;
}

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('he-IL') : '');
export const fmtMoney = (n) => `₪${Math.abs(Number(n) || 0).toLocaleString('he-IL')}`;

const PAY_CHIP = { 'שולם': 'done', 'שולם חלקי': 'gold', 'ממתין לזיכוי': 'info', 'לא שולם': 'attn' };
const ORDER_CHIP = { 'הוחזר': 'done', 'הוחזר חלקי': 'done', 'הושכר': 'info', 'הושכר חלקי': 'info', 'בקרוב': 'gold' };
export const payChip = (s) => PAY_CHIP[s];
export const orderChip = (s) => ORDER_CHIP[s];

/** פירוק הערה אוטומטית — אותו regex בדיוק כמו renderCustomerNotes (הפורמט נקבע בשרת; לא לשנות). */
const AUTO_NOTE = /\[(\d{1,2}\.\d{1,2}\.\d{4})\] אוטומטי: שמלה (\d+) \(הזמנה (\d+)\) (.*)/;
export function parseNoteLine(line) {
  const m = line.match(AUTO_NOTE);
  if (!m) return { text: line };
  const [, dateStr, barcode, orderId, rest] = m;
  const [day, month, year] = dateStr.split('.').map(Number);
  return { auto: true, date: new Date(year, month - 1, day), model: barcode.substring(0, 3), size: barcode.substring(3, 5) || '', orderId, text: rest };
}
