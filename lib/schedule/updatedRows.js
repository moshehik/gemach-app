// lib/schedule/updatedRows.js — החלק הטהור של "הזמנות שעודכנו" (בלי DB): איחוד תוצאות השאילתות לשורה לכל הזמנה. ר' updatedOrders.js.

import { instantToKey } from './dates';

const inKey = (instant, dayKey) => instantToKey(instant) === dayKey;

// פונקציה טהורה (נבדקת בלי DB): מאחדת את תוצאות השאילתות לשורה לכל הזמנה.
//   added   - [{orderId, createdAt}]               פריטים שנוצרו ביום
//   touched - [{orderId, createdAt, updatedAt, isDeleted, takenDate, returnDate}]  פריטים שעודכנו ביום
//   payments- [{orderId, amount, isRefund, paymentDate}]
//   orders  - Map(orderId -> {orderId, orderDate, branch, pickupBranch, eventDateHebrew, customer})
export function buildUpdatedRows({ dayKey, added = [], touched = [], payments = [], orders }) {
  const by = new Map();
  const row = (orderId) => {
    let r = by.get(orderId);
    if (!r) {
      r = { orderId, itemsAdded: 0, itemsEdited: 0, itemsRemoved: 0, paymentCount: 0, paymentTotal: 0, refundCount: 0, lastAt: null };
      by.set(orderId, r);
    }
    return r;
  };
  const bump = (r, at) => { const t = at ? new Date(at).getTime() : 0; if (t && (!r.lastAt || t > r.lastAt)) r.lastAt = t; };
  const addedIds = new Set();
  for (const it of added) {
    if (it.orderId == null) continue;
    addedIds.add(it.id);
    const r = row(it.orderId);
    r.itemsAdded++;
    bump(r, it.createdAt);
  }
  for (const it of touched) {
    if (it.orderId == null || addedIds.has(it.id)) continue; // פריט שנוסף ביום וגם עודכן - נספר פעם אחת, כהוספה
    if (inKey(it.createdAt, dayKey)) continue;
    // לקיחה/החזרה בסריקה מעדכנות את OrderItem בלי שזו עריכה של הפריט
    if (inKey(it.takenDate, dayKey) || inKey(it.returnDate, dayKey)) continue;
    const r = row(it.orderId);
    if (it.isDeleted) r.itemsRemoved++; else r.itemsEdited++;
    bump(r, it.updatedAt);
  }
  for (const p of payments) {
    if (p.orderId == null) continue;
    const r = row(p.orderId);
    if (p.isRefund) r.refundCount++;
    else { r.paymentCount++; r.paymentTotal += Number(p.amount) || 0; }
    bump(r, p.paymentDate);
  }
  const out = [];
  for (const r of by.values()) {
    const o = orders.get(r.orderId);
    if (!o) continue; // מחוקה / טיוטה / לא קיימת
    if (inKey(o.orderDate, dayKey)) continue; // נרשמה באותו יום - מופיעה ב"הזמנות חדשות"
    out.push({
      orderId: r.orderId,
      customer: o.customer,
      branch: o.branch || null,
      pickupBranch: o.pickupBranch || null,
      eventDateHebrew: o.eventDateHebrew || null,
      itemsAdded: r.itemsAdded,
      itemsEdited: r.itemsEdited,
      itemsRemoved: r.itemsRemoved,
      paymentCount: r.paymentCount,
      paymentTotal: Math.round(r.paymentTotal * 100) / 100,
      refundCount: r.refundCount,
      lastAt: r.lastAt ? new Date(r.lastAt).toISOString() : null,
    });
  }
  out.sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || '') || b.orderId - a.orderId);
  return out;
}
