// כרטיס ההזמנה החדש האמיתי (OrderCardA5 + כל ה-CSS הגלובלי של האתר) עם API מדומה - בלי DB, בלי שרת פיתוח. גנרי: כל תרחיש
// מוגדר ב-SCENARIOS לפי ?scn= (W8 מוסיף תרחישים כאן). כל קריאה נרשמת ב-window.__calls (גופים עם pin/password מוסתרים).
import '../../app/globals.css';
import '../../app/design-overrides.css';
import '../../app/design-system.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import OrderCardA5 from '../../app/components/order-card/OrderCardA5.js';

const qs = new URLSearchParams(location.search);
const scn = qs.get('scn') || 'neve';

const CUSTOMER = { id: 'c1', firstName: 'מרים', lastName: 'אברמוביץ', phone1: '050-7123456', phone2: '02-5810044', email: 'miriam.abr@example.com', city: 'ירושלים', street: 'עמוס', houseNum: 14, zeout: '' };
const dress = (id, name) => ({ id: `di-${id}`, dressModelId: `m-${name}`, dress: { id: `m-${name}`, name } });
const ITEMS = [
  { id: 'a1', dressItem: dress('a1', '4512'), sizeText: '38', price: 150, finalPrice: 150, isDeleted: false, isTaken: false, isReturned: false, createdAt: '2026-09-23T07:13:00.000Z' },
  { id: 'a2', dressItem: dress('a2', '3087'), sizeText: '36', price: 120, finalPrice: 120, isDeleted: false, isTaken: false, isReturned: false, sleeveAlteration: 1, alterationDetails: 'קיצור שרוול' },
  { id: 'a3', dressItem: dress('a3', '2764'), sizeText: '40', price: 140, finalPrice: 140, isDeleted: false, isTaken: false, isReturned: false },
  { id: 'a4', dressItem: dress('a4', '1893'), sizeText: '38', price: 100, finalPrice: 100, isDeleted: true, deletedAt: '2026-09-23T07:31:00.000Z', isTaken: false, isReturned: false },
];
const OBL = [
  { id: 'ob1', amount: 150, description: 'השכרת שמלה דגם 4512 מידה 38 (פריט #a1)', orderItemId: 'a1', isManual: false, isDeleted: false },
  { id: 'ob2', amount: 120, description: 'השכרת שמלה דגם 3087 מידה 36 (פריט #a2)', orderItemId: 'a2', isManual: false, isDeleted: false },
  { id: 'ob3', amount: 140, description: 'השכרת שמלה דגם 2764 מידה 40 (פריט #a3)', orderItemId: 'a3', isManual: false, isDeleted: false },
  { id: 'ob4', amount: 80, description: 'משלוח הלוך-חזור - ירושלים', isManual: false, isDeleted: false },
  { id: 'ob5', amount: 40, description: 'דמי ביטול דגם 1893 (פריט #a4)', orderItemId: 'a4', isManual: false, isDeleted: false },
];
const PAY = [
  { id: 'p1', amount: 300, paymentMethod: 'מזומן', isDeleted: false, paymentDate: '2026-09-23T07:18:00.000Z' },
  { id: 'p2', amount: 230, paymentMethod: 'אשראי', isDeleted: false, paymentDate: '2026-09-23T07:19:00.000Z' },
];
const ORDER = {
  id: 'o-1', orderId: 53375, customerId: 'c1', customer: CUSTOMER, orderDate: '2026-09-23T07:12:00.000Z',
  eventDate: '2026-10-07T21:00:00.000Z', eventDateHebrew: 'כ״ו תשרי תשפ״ז', returnDate: null, isAbroad: false, isWeekdayEvent: false,
  fromDate: null, toDate: null, customSpacing: null, extraDay: null, notes: 'הלקוח מבקש ניילון הגנה לשמלות.', internalNotes: '',
  isDelivery: true, deliveryDirection: 'הלוך-חזור', deliveryCity: 'ירושלים', deliveryAddress: '', deliveryOneDayBefore: false,
  status: null, hasSignedRegulations: false, isDeleted: false, totalAmount: 530, updatedAt: '2026-10-01T10:00:00.000Z',
};
const ORG1 = [
  ['enable_local_order_drafts', 'false'], ['enable_order_edit_summary_confirm', 'false'], ['order_edit_redirect_screen', 'orders_list'],
  ['enable_deliveries', 'false'], ['require_customer_id_number', 'true'],
];
const ORG2 = [
  ['enable_local_order_drafts', 'true'], ['enable_order_edit_summary_confirm', 'true'], ['consolidate_manual_payment_credit_ui', 'true'],
  ['order_edit_redirect_screen', 'new_order'], ['enable_deliveries', 'true'], ['delivery_separate_tab', 'true'], ['require_customer_id_number', 'true'],
  ['require_manager_code_for_item_changes', 'true'], ['max_items_per_order', '6'],
];
const EMPLOYEES = [
  { id: 'e1', firstName: 'שרה', lastName: 'לוי', roleId: 1, department: { name: 'מנהלת' }, canApproveWithoutPayment: true, approvals: { 'feature:locked_order_edit': true, 'feature:item_change_approval': true, 'feature:manual_charge_add': true } },
  { id: 'e2', firstName: 'רחל', lastName: 'כהן', roleId: 1, department: { name: 'מנהלת סניף' }, canApproveWithoutPayment: true, approvals: { 'feature:locked_order_edit': true, 'feature:item_change_approval': true } },
  { id: 'e3', firstName: 'דנה', lastName: 'אברהם', roleId: 0, department: { name: 'הנהלה' }, canApproveWithoutPayment: true, approvals: { 'feature:locked_order_edit': true, 'feature:item_change_approval': true } },
  { id: 'e4', firstName: 'דוד', lastName: 'לוי', roleId: 1, department: { name: 'מנהל משמרת' }, canApproveWithoutPayment: false, approvals: { 'feature:locked_order_edit': true } },
  { id: 'e5', firstName: 'מיכל', lastName: 'לוי', roleId: 1, department: { name: 'מנהלת סניף' }, canApproveWithoutPayment: true, approvals: { 'feature:locked_order_edit': true } },
  { id: 'e6', firstName: 'יוסי', lastName: 'מזרחי', roleId: 1, department: { name: 'מנהל' }, canApproveWithoutPayment: true, approvals: { 'feature:locked_order_edit': true } },
  { id: 'e7', firstName: 'עובדת', lastName: 'רגילה', roleId: 3, department: { name: 'מכירות' }, canApproveWithoutPayment: false, approvals: {} },
];

// W6: לשונית היסטוריה - אותם רישומים כמו `logs` בדגימה (כרטיס-הזמנה.html), בצורה ש-GET /api/orders/[id]/history מחזיר
// (lib/history/orderHistory.js): dateHe/weekdayHe/time עבריים במקום התאריך הלועזי של הדגימה; ts למיון בלבד.
const HE = { '2026-09-23': ['יב תשרי תשפ"ז', 'יום רביעי'], '2026-09-24': ['יג תשרי תשפ"ז', 'יום חמישי'] };
const hEntry = (id, ts, o) => { const d = ts.slice(0, 10); return { id: `h${id}`, ts: new Date(`${ts}:00+03:00`).toISOString(), day: d, time: ts.slice(11), dateHe: HE[d][0], weekdayHe: HE[d][1], whoKnown: true, det: [], ...o }; };
const HISTORY = [
  hEntry(1, '2026-09-23T10:12', { cat: 'items', icon: 'file', text: 'ההזמנה נוצרה', sub: 'סניף נווה יעקב', who: 'רחל כהן', det: [['מס׳ הזמנה', '#53375'], ['לקוחה', 'מרים אברמוביץ']] }),
  hEntry(2, '2026-09-23T10:13', { cat: 'items', icon: 'dress', text: 'נוסף פריט: דגם 4512, מידה 38', who: 'רחל כהן', amt: 150, kind: 'charge', det: [['מחיר', '₪150'], ['סטטוס', 'טרם נלקחה']] }),
  hEntry(3, '2026-09-23T10:14', { cat: 'items', icon: 'dress', text: 'נוסף פריט: דגם 3087, מידה 36', who: 'רחל כהן', amt: 120, kind: 'charge', det: [['מחיר', '₪120'], ['תיקון', 'שרוול']] }),
  hEntry(4, '2026-09-23T10:14', { cat: 'items', icon: 'dress', text: 'נוסף פריט: דגם 2764, מידה 40', who: 'רחל כהן', amt: 140, kind: 'charge', det: [['מחיר', '₪140']] }),
  hEntry(5, '2026-09-23T10:15', { cat: 'del', icon: 'truck', text: 'נוסף משלוח', sub: 'הלוך-חזור · ירושלים', who: 'רחל כהן', amt: 80, kind: 'charge', det: [['לפני', 'ללא משלוח'], ['אחרי', 'הלוך-חזור · ירושלים · ₪80']] }),
  hEntry(6, '2026-09-23T10:16', { cat: 'dates', icon: 'cal', text: 'נקבע תאריך האירוע', sub: 'יום חמישי כז תשרי', who: 'רחל כהן', det: [['לפני', 'לא נקבע'], ['אחרי', 'יום חמישי כז תשרי']] }),
  hEntry(7, '2026-09-23T10:18', { cat: 'pay', icon: 'cash', text: 'התקבל תשלום במזומן', who: 'רחל כהן', amt: 300, kind: 'pay', det: [['שיטה', 'מזומן'], ['סכום', '₪300']] }),
  hEntry(8, '2026-09-23T10:19', { cat: 'pay', icon: 'card', text: 'התקבל תשלום באשראי', sub: 'ספרות 4432', who: 'רחל כהן', amt: 230, kind: 'pay', det: [['שיטה', 'אשראי'], ['סכום', '₪230']] }),
  hEntry(9, '2026-09-23T10:31', { cat: 'items', icon: 'dress', text: 'הוסר פריט: דגם 1893, מידה 38', sub: 'דמי ביטול ₪40', who: 'רחל כהן', amt: 40, kind: 'charge', det: [['מחיר', '₪100'], ['דמי ביטול', '₪40']] }),
  hEntry(10, '2026-09-23T10:35', { cat: 'docs', icon: 'print', text: 'הודפס סיכום הזמנה', who: 'רחל כהן', det: [['מסמך', 'סיכום ללקוחה']] }),
  hEntry(11, '2026-09-24T09:05', { cat: 'docs', icon: 'mail', text: 'נשלח מייל אישור ללקוחה', sub: 'miriam.abr@example.com', who: 'דוד לוי', det: [['נמען', 'miriam.abr@example.com']] }),
  hEntry(12, '2026-09-24T09:40', { cat: 'items', icon: 'scissors', text: 'נוספה בקשת תיקון', sub: 'דגם 3087 · שרוול', who: 'דוד לוי', det: [['פריט', 'דגם 3087'], ['תיקון', 'שרוול']] }),
].reverse();
const counts = { all: HISTORY.length, categories: { items: 6, pay: 2, del: 1, dates: 1, docs: 2 }, extras: { sig: 0, print: 1, mail: 1, fix: 1 } };
// "שלבי ההזמנה" + "יומן הזמנה" כמו stageList()/pProcess() בדגימה (נווה: משלוח הלוך-חזור; היום = 24.9)
const DAY = (k, he, heShort, wd, wdFull) => ({ dayKey: k, he, heShort, wd, wdFull });
const D = {
  '2026-09-23': DAY('2026-09-23', 'יב תשרי תשפ"ז', 'יב תשרי', "יום ד'", 'יום רביעי'), '2026-09-28': DAY('2026-09-28', 'יז תשרי תשפ"ז', 'יז תשרי', "יום ב'", 'יום שני'),
  '2026-10-05': DAY('2026-10-05', 'כד תשרי תשפ"ז', 'כד תשרי', "יום ב'", 'יום שני'), '2026-10-06': DAY('2026-10-06', 'כה תשרי תשפ"ז', 'כה תשרי', "יום ג'", 'יום שלישי'),
  '2026-10-08': DAY('2026-10-08', 'כז תשרי תשפ"ז', 'כז תשרי', "יום ה'", 'יום חמישי'), '2026-10-09': DAY('2026-10-09', 'כח תשרי תשפ"ז', 'כח תשרי', "יום ו'", 'יום שישי'),
  '2026-09-24': DAY('2026-09-24', 'יג תשרי תשפ"ז', 'יג תשרי', "יום ה'", 'יום חמישי'),
};
const stg = (key, label, icon, k, o) => ({ key, label, icon, dayKey: k, day: D[k], infoOnly: false, markable: false, done: false, doneVia: null, mark: null, outcome: null, current: false, ...o });
const SHIFT = { title: 'משמרת · 08:00–16:00', from: '08:00', to: '16:00', open: false, names: ['רחל כהן', 'שרה כהן', 'מיכל לוי'] };
const when = (k, t) => ({ ts: new Date(`${k}T${t}:00+03:00`).toISOString(), dayKey: k, day: D[k], time: t, dateOnly: false });
const JOURNAL = {
  orderId: 53375, today: D['2026-09-24'], currentKey: 'repair', marksAvailable: true, canMark: true,
  stages: [
    stg('order', 'הזמנה', 'file', '2026-09-23', { infoOnly: true, done: true, doneVia: 'info' }),
    stg('repair', 'תיקונים', 'scissors', '2026-09-28', { current: true }),
    stg('prep', 'הכנה', 'bag', '2026-10-05', { markable: true }),
    stg('dout', 'משלוח הלוך', 'truck', '2026-10-06'),
    stg('event', 'אירוע', 'gift', '2026-10-08', { infoOnly: true, doneVia: 'info' }),
    stg('dback', 'משלוח חזור', 'truck', '2026-10-09'),
  ],
  journal: [
    { key: 'order', label: 'הזמנה', icon: 'file', infoOnly: true, done: true, current: false, plannedDay: D['2026-09-23'], when: when('2026-09-23', '10:12'), who: 'רחל כהן', via: 'audit', shift: SHIFT, outcome: null },
    { key: 'pay', label: 'תשלום', icon: 'wallet', infoOnly: false, done: true, current: false, plannedDay: null, when: when('2026-09-23', '10:20'), who: 'רחל כהן', via: 'audit', shift: SHIFT, outcome: null, paid: 530, paidText: 'שולם ₪530' },
    { key: 'dout', label: 'משלוח הלוך', icon: 'truck', infoOnly: false, done: false, current: true, plannedDay: D['2026-10-06'], when: null, who: null, via: null, shift: null, outcome: null },
    { key: 'event', label: 'אירוע', icon: 'gift', infoOnly: true, done: false, current: false, plannedDay: D['2026-10-08'], when: null, who: null, via: null, shift: null, outcome: null },
    { key: 'dback', label: 'משלוח חזור', icon: 'truck', infoOnly: false, done: false, current: false, plannedDay: D['2026-10-09'], when: null, who: null, via: null, shift: null, outcome: null },
  ],
};

// תרחישים: הזמנה + הגדרות + התנהגות שרת
const SCENARIOS = {
  neve: {},
  main: { settings: ORG1, order: { isDelivery: false, deliveryDirection: null, deliveryCity: null }, obligations: OBL.filter(o => o.id !== 'ob4'), payments: [{ ...PAY[0] }, { ...PAY[1], amount: 150 }] },
  debt: { payments: [PAY[0]] },
  locked: { order: { eventDate: '2026-09-01T21:00:00.000Z' } },
  deleted: { order: { isDeleted: true } },
  missing: { order: { customer: { ...CUSTOMER, email: '', phone1: '', phone2: '' } } },
  draft: { draft: true },
  conflict: { draft: true, put409: true, settings: ORG2.filter(([k]) => k !== 'enable_order_edit_summary_confirm') },
  stock: { draft: true, put409stock: true, settings: ORG2.filter(([k]) => k !== 'enable_order_edit_summary_confirm') },
  notfound: { notfound: true },
  loading: { hang: true },
};
const S = SCENARIOS[scn] || {};
const order = { ...ORDER, ...(S.order || {}), items: ITEMS, obligations: S.obligations || OBL, payments: S.payments || PAY, refunds: [] };
const settings = (S.settings || ORG2).map(([key, value]) => ({ key, value }));

if (S.draft) {
  try {
    localStorage.setItem('gemachOrderDraft:53375', JSON.stringify({
      savedAt: Date.now() - 3600e3, baseUpdatedAt: ORDER.updatedAt, summary: ['הערות השתנה'], rows: [{ icon: '#i-file', text: 'הערות להזמנה' }],
      state: { order: { ...order, notes: 'הערה מטיוטה שלא נשמרה' }, items: order.items, obligations: order.obligations, payments: order.payments, refunds: [] },
    }));
  } catch { /* noop */ }
} else {
  try { localStorage.removeItem('gemachOrderDraft:53375'); } catch { /* noop */ }
}

const j = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
window.__calls = [];
const realFetch = window.fetch.bind(window);
let putCount = 0;
window.fetch = async (url, opts) => {
  const u = String(url);
  if (!u.startsWith('/api/')) return realFetch(url, opts);
  const method = (opts && opts.method) || 'GET';
  window.__calls.push({ url: u, method, body: opts && opts.body ? String(opts.body).replace(/"(pin|password|managerPin|manualChargeApproverPin)":"[^"]*"/g, '"$1":"<redacted>"') : null });
  await new Promise((r) => setTimeout(r, S.hang && u.startsWith('/api/orders/53375') ? 600000 : 20));
  if (u.startsWith('/api/settings')) return j(settings);
  if (u.startsWith('/api/employees')) return j(EMPLOYEES);
  // העובדת המחוברת לא מורשית לאשר (כמו בעיצוב: אף שם לא מסומן מראש). me=e2 בכתובת = מנהלת מורשית (מסומנת מראש, כמו בישן)
  if (u.startsWith('/api/me')) return j(qs.get('me') === 'e2' ? { success: true, employee: { id: 'e2', firstName: 'רחל', lastName: 'כהן' } } : { success: true, employee: { id: 'e7', firstName: 'עובדת', lastName: 'רגילה' } });
  if (u.startsWith('/api/inventory/preload')) return j({});
  if (u.startsWith('/api/orders/validate-inventory')) return j({ valid: true, errors: [] });
  if (u.startsWith('/api/orders/events')) return j({ ok: true, written: 1 });
  if (u.startsWith('/api/auth/verify-pin')) {
    const b = JSON.parse(opts.body);
    return b.pin === '1234' ? j({ success: true, employeeId: b.employeeId, employeeName: (EMPLOYEES.find(e => e.id === b.employeeId) || {}).firstName || '' }) : j({ success: false, error: 'סיסמה שגויה או משתמש לא פעיל' }, 401);
  }
  if (/\/api\/orders\/53375\/(preview-pricing)/.test(u)) return j({ newObligations: order.obligations.filter(o => o.isManual === false) });
  if (/\/api\/orders\/53375\/cancel-changes/.test(u)) return j({ success: true });
  if (/\/api\/orders\/53375\/journal/.test(u)) return j(JOURNAL);
  if (/\/api\/orders\/53375\/history/.test(u)) return j({ entries: HISTORY, nextCursor: null, total: HISTORY.length, counts, unmappedCount: 0, exportTruncated: false });
  if (u.startsWith('/api/schedule/marks')) return j({ ok: true, status: 'marked' });
  if (u.startsWith('/api/pdf')) return new Response(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), { status: 200 });
  if (/^\/api\/orders\/53375$/.test(u)) {
    if (S.notfound) return j({ error: 'Order not found' }, 404);
    if (method === 'PUT') {
      putCount++;
      if (S.put409 && putCount === 1) return j({ error: 'Data Collision', code: 'CONFLICT', message: 'הזמנה זו עודכנה בשרת לאחר הסנכרון האחרון שלך.' }, 409);
      if (S.put409stock) return j({ error: 'אחד או יותר מהפריטים אינם זמינים במלאי בתאריכים החדשים.', code: 'STOCK_SHORTAGE', validationErrors: [{ dressName: '4512', sizeText: '38', requested: 1, available: 0, isCustomSpacingIssue: true }] }, 409);
      const b = JSON.parse(opts.body);
      return j({ ...order, ...b, customer: order.customer, items: order.items, obligations: order.obligations, payments: order.payments, refunds: [], updatedAt: new Date().toISOString() });
    }
    if (method === 'DELETE') return j({ success: true });
    return j(order);
  }
  return j({});
};

createRoot(document.getElementById('root')).render(<OrderCardA5 orderRef="53375" />);
