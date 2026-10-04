// מצב החשבון של לקוח וכללי המחיקה שלו - מודול טהור אחד (בלי imports), משותף לכרטיס הלקוח החדש (תצוגה + חלון המחיקה)
// ולשרת (DELETE /api/customers/[id], שהוא הסמכות). כך הכרטיס והשרת לא יכולים להכריע אחרת על אותה לקוחה.
//
// נוסחת החוב = כמו הכרטיס הישן (ModernCustomerPaymentsTab): חיובים − (תשלומים − זיכויים), על כל ההזמנות (גם מחוקות - דמי ביטול).
// כלל המחיקה (נקודה פתוחה לבעלים - scratch/customer-card-build/NOTES.md): חסום כשיש
//   1. הזמנה פעילה: הזמנה לא מחוקה שתאריך ההחזרה / האירוע שלה היום או בעתיד (שעון ישראל);
//   2. שמלה אצל הלקוחה: פריט בהזמנה לא מחוקה שנסרק (barcode) ולא הוחזר - כולל השכרה באיחור שהתאריך שלה כבר עבר;
//   3. יתרת חוב (balance > 0);
//   4. זיכוי שלא בוצע (כסף שהגמ"ח חייב לה).

export const orderRequired = (o) => (o && o.obligations && o.obligations.length > 0
  ? o.obligations.reduce((s, x) => s + (x.isDeleted ? 0 : (x.amount || 0)), 0)
  : ((o && o.totalAmount) || 0));
export const orderPaid = (o) => ((o && o.payments) || []).reduce((s, p) => s + (p.isDeleted ? 0 : (p.amount || 0)), 0);

export function accountSummary(customer, refunds = []) {
  const orders = (customer && customer.orders) || [];
  const required = orders.reduce((s, o) => s + orderRequired(o), 0);
  const paid = orders.reduce((s, o) => s + orderPaid(o), 0);
  const refundTotal = (refunds || []).filter((r) => !r.isDeleted).reduce((s, r) => s + (r.amount || 0), 0);
  const effectivePaid = paid - refundTotal;
  const balance = required - effectivePaid; // > 0 חוב, < 0 זכות
  const pct = required > 0 ? Math.max(0, Math.min(100, Math.round((Math.max(0, effectivePaid) / required) * 100))) : 100;
  return { required, paid, refunds: refundTotal, effectivePaid, balance, pct };
}

const money = (n) => `₪${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('he-IL')}`;

/**
 * מה מונע מחיקה של הלקוחה.
 * @param {{orders:Array, refunds:Array, todayKey:string, dateKey:(d)=>string|null}} p
 *   orders: עם items (barcode, isReturned), obligations, payments; refunds: שורות Refund לא מחוקות של הלקוחה.
 *   todayKey / dateKey: מפתחות יום בשעון ישראל (lib/hebrewDate.js getIsraelTodayKey / getIsraelDateKey) - מוזרקים.
 * @returns {{blocked:boolean, activeOrders:number[], holdingOrders:number[], debt:number, pendingRefunds:number, messages:string[]}}
 */
export function deleteBlockers({ orders = [], refunds = [], todayKey, dateKey }) {
  const live = (orders || []).filter((o) => o && !o.isDeleted);
  const activeOrders = live.filter((o) => {
    const last = o.toDate || o.returnDate || o.eventDate;
    const k = last ? dateKey(last) : null;
    return k !== null && k >= todayKey;
  }).map((o) => o.orderId);
  const holdingOrders = live.filter((o) => (o.items || []).some((i) => i && i.barcode !== null && i.barcode !== undefined && i.barcode !== '' && !i.isReturned)).map((o) => o.orderId);
  const { balance } = accountSummary({ orders }, refunds);
  const debt = balance > 0.004 ? Math.round(balance * 100) / 100 : 0;
  const pending = (refunds || []).filter((r) => r && !r.isDeleted && !r.isExecuted);
  const pendingRefunds = Math.round(pending.reduce((s, r) => s + (r.amount || 0), 0) * 100) / 100;
  const messages = [];
  if (activeOrders.length) messages.push(`יש הזמנות פעילות: ${activeOrders.map((n) => `#${n}`).join(', ')}`);
  if (holdingOrders.length) messages.push(`יש שמלות שלא הוחזרו: ${holdingOrders.map((n) => `#${n}`).join(', ')}`);
  if (debt > 0) messages.push(`יש יתרת חוב של ${money(debt)}`);
  if (pending.length) messages.push(`יש זיכוי שטרם בוצע (${money(pendingRefunds)})`);
  return { blocked: messages.length > 0, activeOrders, holdingOrders, debt, pendingRefunds, messages };
}
