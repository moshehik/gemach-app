// בדיקת עשן למתאם ההיסטוריה: node docs/redesign-v3/reports/history-adapter-selftest.mjs
import { buildFeed, searchHay, missingLabels } from '../../../app/v3/history/adapter.js';

const T = (d) => `2026-09-${d}Z`;
const J = JSON.stringify;
const rows = [
  { id: 'a1', entityType: 'Order', entityId: 'uuid-1', action: 'CREATE', createdAt: '2026-09-20T07:00:00Z', employeeId: 'e1', employeeName: 'רחל כהן',
    changesJson: J({ orderId: 4512, branch: 'נווה יעקב', isDelivery: false, eventDate: '2026-10-03T00:00:00Z', totalAmount: 0, notes: '' }) },
  { id: 'a2', entityType: 'OrderItem', entityId: 'it-1', action: 'CREATE', createdAt: '2026-09-20T07:00:01Z', employeeId: 'e1', employeeName: 'רחל כהן',
    changesJson: J({ description: 'דגם 4512', sizeText: '38', finalPrice: 150, isDeleted: false, isTaken: false }) },
  { id: 'a3', entityType: 'Order', entityId: 'uuid-1', action: 'UPDATE', createdAt: '2026-09-20T09:00:00Z', employeeId: 'e1', employeeName: 'רחל כהן',
    changesJson: J({ isDelivery: true, branch: 'נווה יעקב', eventDate: '2026-10-03T00:00:00Z', hokDetails: 'x' }) },
  { id: 'a4', entityType: 'Order', entityId: 'uuid-1', action: 'UPDATE', createdAt: '2026-09-21T09:00:00Z', employeeId: null,
    changesJson: J({ isDelivery: true, branch: 'נווה יעקב' }) }, // רעש: זהה לחלוטין
  { id: 'a5', entityType: 'Payment', entityId: 'p-1', action: 'CREATE', createdAt: '2026-09-22T10:13:00Z', employeeId: 'e2', employeeName: 'שרה לוי',
    changesJson: J({ amount: 300, paymentMethod: 'אשראי', isRefund: false, isDeleted: false }) },
  { id: 'a6', entityType: 'Customer', entityId: 'c-1', action: 'UPDATE', createdAt: '2026-09-22T11:00:00Z', employeeId: 'e2', employeeName: 'שרה לוי',
    changesJson: J({ phone1: { from: '0501234567', to: '0527654321' } }) },
  { id: 'a7', entityType: 'Order', entityId: '4512', action: 'CANCEL_ORDER', createdAt: '2026-09-23T08:00:00Z', employeeId: 'e1', employeeName: 'רחל כהן',
    changesJson: J({ isDeleted: { from: false, to: true }, note: 'הלקוחה ויתרה' }) },
  { id: 'a8', entityType: 'OrderItem', entityId: 'it-1', action: 'CANCEL_ORDER', createdAt: '2026-09-23T08:00:00Z', employeeId: 'e1', employeeName: 'רחל כהן',
    changesJson: J({ isDeleted: { from: false, to: true } }) },
  { id: 'a9', entityType: 'Employee', entityId: 'e1', action: 'UPDATE', createdAt: '2026-09-23T09:00:00Z', employeeId: null,
    changesJson: J({ password: '***', someNewField: 1 }) },
];
const ctx = { itemsById: { 'it-1': { model: 'דגם 4512', size: '38' } } };
const feed = buildFeed(rows, ctx);
for (const d of feed.days) {
  console.log('== ' + d.day);
  for (const e of d.entries) console.log(`  [${e.cat}/${e.icon}] ${e.text}${e.sub ? ' | ' + e.sub : ''}${e.amt ? ' | ' + e.kind + ' ' + e.amt : ''} | ${e.who} ${e.ts.slice(11)}`, JSON.stringify(e.det));
}
console.log('קטגוריות:', feed.catCounts, '| רשומות:', feed.entries.length, 'מתוך', rows.length, 'שורות');
console.log('חיפוש "0527":', feed.entries.filter((e) => searchHay(e).includes('0527')).map((e) => e.id));
console.log('חסרים במילון:', [...missingLabels]);
const ok = feed.entries.length === 7 && !feed.entries.find((e) => e.id === 'a4') && !feed.entries.find((e) => e.id === 'a8');
console.log(ok ? 'OK' : 'FAIL');
process.exit(ok ? 0 : 1);
