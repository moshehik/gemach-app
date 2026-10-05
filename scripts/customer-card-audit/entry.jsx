// כרטיס הלקוח האמיתי (CustomerCardA5 / NewCustomerA5 + customer-card.css + כל ה-CSS הגלובלי של האתר) עם API מדומה - בלי DB ובלי
// שרת פיתוח. הנתונים = הלקוחה של העיצוב המאושר (מרים אברמוביץ, 4 הזמנות, יתרה ₪150) כדי שההשוואה מול כרטיס-לקוח.html תהיה אחד-לאחד.
// תרחישים לפי ?scn=: '' (רגיל), blocked (לקוחה חסומה), new (טופס לקוח חדש), loading, notfound, nopay (תשלום מהכרטיס כבוי).
import '../../app/globals.css';
import '../../app/design-overrides.css';
import '../../app/design-system.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import CustomerCardA5 from '../../app/components/customer-card/CustomerCardA5.js';
import NewCustomerA5 from '../../app/components/customer-card/NewCustomerA5.js';

const scn = new URLSearchParams(location.search).get('scn') || '';
const CID = '11111111-2222-4333-8444-555555555555';
const iso = (d) => `${d}T10:00:00.000Z`;
const item = (prefix, size, price) => ({ id: `it-${prefix}-${size}`, isDeleted: false, barcodePrefix: prefix, size, description: `דגם ${prefix}`, price, dressItem: { barcodePrefix: prefix, dressName: `דגם ${prefix}` } });
const obl = (id, amount) => ({ id, amount, isDeleted: false });
const pay = (id, amount, method, date, notes = '') => ({ id, amount, paymentMethod: method, paymentDate: iso(date), notes, isDeleted: false });
const ORDERS = [
  { id: 'o4', orderId: 53375, orderDate: iso('2026-09-23'), eventDate: iso('2026-10-08'), isDeleted: false, hasSignedRegulations: true, isDelivery: true, deliveryDirection: 'הלוך-חזור', deliveryCity: 'ירושלים', totalAmount: 530,
    items: [item(4512, '38', 150), item(3087, '36', 120), item(2764, '40', 140)], obligations: [obl('b1', 410), obl('b2', 80), obl('b3', 40)], payments: [pay('p1', 300, 'מזומן', '2026-09-23'), pay('p2', 80, 'אשראי', '2026-09-23')] },
  { id: 'o3', orderId: 52940, orderDate: iso('2026-06-02'), eventDate: iso('2026-06-18'), isDeleted: false, hasSignedRegulations: true, totalAmount: 240,
    items: [item(3310, '38', 130), item(2201, '38', 110)], obligations: [obl('b4', 240)], payments: [pay('p3', 240, 'אשראי', '2026-06-02')] },
  { id: 'o2', orderId: 51216, orderDate: iso('2025-03-04'), eventDate: iso('2025-03-14'), isDeleted: false, hasSignedRegulations: false, isDelivery: true, deliveryDirection: 'הלוך', deliveryCity: 'בית שמש', totalAmount: 160,
    items: [item(1893, '38', 100)], obligations: [obl('b5', 100), obl('b6', 60)], payments: [pay('p4', 160, 'מזומן', '2025-03-04')] },
  { id: 'o1', orderId: 50077, orderDate: iso('2024-11-19'), eventDate: iso('2024-12-02'), isDeleted: true, hasSignedRegulations: false, totalAmount: 40,
    items: [], obligations: [obl('b7', 40)], payments: [pay('p5', 40, 'מזומן', '2024-11-19')] },
];
const CUSTOMER = {
  id: CID, legacyId: 4182, firstName: 'מרים', lastName: 'אברמוביץ', phone1: '050-712-3456', phone2: '02-581-0044', email: 'miriam.abr@example.com', emailSuffix: null,
  city: 'ירושלים', street: 'עמוס', houseNum: 14, zeout: '123456782', marketingConsent: true,
  notes: 'לקוחה ותיקה. מעדיפה שיחה בשעות הבוקר. תמיד מבקשת ניילון הגנה לשמלות.\n[14.6.2026] אוטומטי: שמלה 331038 (הזמנה 52940) הוחזרה עם כתם קל',
  bankName: 'לאומי', bankBranch: '902', bankAccount: '1234567', bankAccountName: 'מרים אברמוביץ',
  isBlocked: scn === 'blocked', blockedReason: scn === 'blocked' ? 'החזרה לא תקינה בהזמנה #52940' : null, isDeleted: false,
  updatedAt: iso('2026-09-24'), orders: ORDERS,
};
const E = (id, at, category, icon, title, detail, who, extra = {}) => ({ id, groupId: id, at: `${at}:00.000Z`, day: at.slice(0, 10), time: at.slice(11, 16), hebrewDate: '', category, type: 'x', icon, title, detail, details: [], actor: { name: who }, entityRef: null, source: 's', ...extra });
const HIST = [
  E('h14', '2026-09-24T09:40', 'cust', 'pin', 'עודכן רחוב', '', 'דוד לוי', { field: 'street', from: 'הנביאים', to: 'עמוס' }),
  E('h13', '2026-09-24T09:05', 'docs', 'mail', 'נשלח מייל אישור ללקוחה', 'miriam.abr@example.com', 'דוד לוי', { details: [['נמען', 'miriam.abr@example.com']] }),
  E('h12', '2026-09-23T10:35', 'docs', 'print', 'הודפס סיכום הזמנה', '', 'רחל כהן', { details: [['מסמך', 'סיכום ללקוחה']] }),
  E('h11', '2026-09-23T10:19', 'pay', 'card', 'התקבל תשלום באשראי', 'ספרות 4432', 'רחל כהן', { amount: 80, amountKind: 'pay', details: [['שיטה', 'אשראי'], ['סכום', '₪80']] }),
  E('h10', '2026-09-23T10:18', 'pay', 'cash', 'התקבל תשלום במזומן', '', 'רחל כהן', { amount: 300, amountKind: 'pay', details: [['שיטה', 'מזומן'], ['סכום', '₪300']] }),
  E('h9', '2026-09-23T10:12', 'orders', 'file', 'נפתחה הזמנה #53375', '3 פריטים · הלוך-חזור', 'רחל כהן', { amount: 530, amountKind: 'chg', details: [['הזמנה', '#53375']], entityRef: { type: 'Order', id: '53375', orderId: 53375, href: '/orders/53375' } }),
  E('h8', '2026-06-02T09:58', 'pay', 'card', 'התקבל תשלום באשראי', 'ספרות 4432', 'דוד לוי', { amount: 240, amountKind: 'pay' }),
  E('h7', '2026-06-02T09:50', 'orders', 'file', 'נפתחה הזמנה #52940', 'דגמים 3310, 2201', 'דוד לוי', { amount: 240, amountKind: 'chg' }),
  E('h6', '2025-08-14T15:44', 'cust', 'mail', 'עודכן מייל', '', 'דוד לוי', { field: 'email', from: 'miriam.abr@gmail.com', to: 'miriam.abr@example.com' }),
  E('h5', '2025-03-04T10:31', 'pay', 'cash', 'התקבל תשלום במזומן', '', 'רחל כהן', { amount: 160, amountKind: 'pay' }),
  E('h4', '2025-03-04T10:20', 'orders', 'file', 'נפתחה הזמנה #51216', 'דגם 1893 · הלוך · בית שמש', 'רחל כהן', { amount: 160, amountKind: 'chg' }),
  E('h3', '2024-11-19T11:12', 'orders', 'file', 'נפתחה הזמנה #50077', 'בוטלה · דמי ביטול ₪40', 'רחל כהן', { amount: 40, amountKind: 'chg' }),
  E('h2', '2024-11-19T11:06', 'docs', 'sig', 'נחתם תקנון', '', 'רחל כהן'),
  E('h1', '2024-11-19T11:02', 'cust', 'user', 'כרטיס לקוח נפתח', 'מרים אברמוביץ · 050-712-3456', 'רחל כהן'),
].map((e) => ({ ...e, hebrewDate: new Date(e.at).toLocaleDateString('he-IL-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric' }) }));
const SETTINGS = [
  { key: 'allow_additional_payment_on_order', value: scn === 'nopay' ? 'false' : 'true' },
  { key: 'enable_deliveries', value: 'true' },
  { key: 'gmach_name', value: 'גמ״ח שמלות נווה יעקב' },
];
const EMPLOYEES = [
  { id: 'e1', firstName: 'שרה', lastName: 'לוי', roleId: 1, isActive: true, approvals: { 'feature:customer_email_approval': true, 'feature:customer_delete_approval': true }, department: { name: 'מנהלת' } },
  { id: 'e2', firstName: 'דנה', lastName: 'אברהם', roleId: 3, isActive: true, approvals: {}, department: { name: 'מכירות' } },
  { id: 'e3', firstName: 'רחל', lastName: 'כהן', roleId: 0, isActive: true, approvals: { 'feature:customer_email_approval': true, 'feature:customer_delete_approval': true } },
];
const j = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
window.__calls = [];
const realFetch = window.fetch.bind(window);
window.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (!u.startsWith('/api/')) return realFetch(url, opts);
  const method = opts.method || 'GET';
  window.__calls.push({ url: u, method, body: opts.body ? String(opts.body).replace(/"(pin|password|approverPin)":"[^"]*"/g, '"$1":"<redacted>"') : null });
  await new Promise((r) => setTimeout(r, scn === 'loading' && u.startsWith('/api/customers/') ? 60000 : 20));
  if (u.startsWith(`/api/customers/${CID}/history`)) return j({ entries: HIST, nextCursor: null, counts: {}, countsScope: 'feed', meta: {} });
  if (u.startsWith(`/api/customers/${CID}/events`)) return j({ ok: true, written: 1, duplicate: false, approverId: 'e1', approverName: 'שרה לוי' });
  if (u.startsWith('/api/customers/locations')) return j({ cities: ['ירושלים', 'בית שמש', 'בני ברק', 'ביתר עילית', 'מודיעין עילית'], streets: ['עמוס', 'הנביאים', 'יפו', 'עזרא', 'עמנואל נח', 'עמק רפאים'] });
  if (u.startsWith(`/api/customers/${CID}`)) {
    if (scn === 'notfound') return j({ error: 'Customer not found' }, 404);
    if (method === 'PUT') { const b = JSON.parse(opts.body); const { orders, cardVariant, ...rest } = b; return j({ ...rest, updatedAt: new Date().toISOString() }); }
    if (method === 'PATCH') return j({ ...CUSTOMER, isBlocked: false, blockedReason: null });
    if (method === 'DELETE') return j({ success: true });
    return j(CUSTOMER);
  }
  if (u.startsWith('/api/customers') && method === 'POST') return j({ id: CID });
  if (u.startsWith('/api/refunds')) return j([]);
  if (u.startsWith('/api/settings')) return j(SETTINGS);
  if (u.startsWith('/api/me')) return j({ success: true, employee: { id: 'e3', firstName: 'רחל', lastName: 'כהן', roleId: 0 } });
  if (u.startsWith('/api/employees')) return j(EMPLOYEES);
  if (u.startsWith('/api/payments')) return j({ id: 'np', amount: JSON.parse(opts.body).amount });
  if (u.startsWith('/api/send-email')) return j({ success: true, driveLinks: [] });
  if (u.startsWith('/api/pdf')) return new Response(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), { status: 200 });
  return j({});
};
const App = scn === 'new' ? NewCustomerA5 : () => <CustomerCardA5 customerId={CID} />;
createRoot(document.getElementById('root')).render(<App />);
