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
  // W2a (לשונית משלוח): כתובת שונה, יום לפני, מחירון ערים (כמו CITY בעיצוב)
  ['delivery_allow_address_override', 'true'], ['delivery_one_day_before_option', 'true'],
  ['delivery_price_by_city', JSON.stringify({ 'ירושלים': 40, 'בית שמש': 60, 'בני ברק': 50, 'מודיעין עילית': 60 })],
];
const EMPLOYEES = [
  { id: 'e1', firstName: 'שרה', lastName: 'לוי', roleId: 1, department: { name: 'מנהלת' }, canApproveWithoutPayment: true, approvals: { 'feature:locked_order_edit': true, 'feature:item_change_approval': true, 'feature:manual_charge_add': true, 'feature:special_spacing_approval': true } },
  { id: 'e2', firstName: 'רחל', lastName: 'כהן', roleId: 1, department: { name: 'מנהלת סניף' }, canApproveWithoutPayment: true, approvals: { 'feature:locked_order_edit': true, 'feature:item_change_approval': true } },
  { id: 'e3', firstName: 'דנה', lastName: 'אברהם', roleId: 0, department: { name: 'הנהלה' }, canApproveWithoutPayment: true, approvals: { 'feature:locked_order_edit': true, 'feature:item_change_approval': true } },
  { id: 'e4', firstName: 'דוד', lastName: 'לוי', roleId: 1, department: { name: 'מנהל משמרת' }, canApproveWithoutPayment: false, approvals: { 'feature:locked_order_edit': true } },
  { id: 'e5', firstName: 'מיכל', lastName: 'לוי', roleId: 1, department: { name: 'מנהלת סניף' }, canApproveWithoutPayment: true, approvals: { 'feature:locked_order_edit': true } },
  { id: 'e6', firstName: 'יוסי', lastName: 'מזרחי', roleId: 1, department: { name: 'מנהל' }, canApproveWithoutPayment: true, approvals: { 'feature:locked_order_edit': true } },
  { id: 'e7', firstName: 'עובדת', lastName: 'רגילה', roleId: 3, department: { name: 'מכירות' }, canApproveWithoutPayment: false, approvals: {} },
];

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
  // W2a: אירוע חו"ל עם יום השכרה נוסף (enable_rental_extension) וציפוף ברירת מחדל 2 (5 גלולות כמו בעיצוב); משלוח בתוך "פרטים"
  xday: { settings: [...ORG2, ['enable_rental_extension', 'true'], ['inventory_buffer_days', '2']], order: { isAbroad: true, eventDate: '2026-10-05T21:00:00.000Z', fromDate: '2026-10-05T21:00:00.000Z', toDate: '2026-10-12T21:00:00.000Z', returnDate: '2026-10-12T21:00:00.000Z', extraDay: null } },
  inline: { settings: ORG2.filter(([k]) => k !== 'delivery_separate_tab') },
  // W3 — מצבי פריטים: מושכר (עם ברקוד), הוחזר לא תקין; מכסה מלאה (R32)
  items: { items: 'states' },
  quota: { settings: [...ORG2.filter(([k]) => k !== 'max_items_per_order'), ['max_items_per_order', '3']] },
  // W2b (R49, נווה): הצטרפות למשלוח / הטבלה חסרה (enabled:false מהשרת) / התראת מיקום שמלה / רצף ברקודים
  join: { settings: [...ORG2, ['enable_delivery_join', 'true'], ['delivery_join_price', '20']] },
  joinoff: { settings: [...ORG2, ['enable_delivery_join', 'true']], joinTableMissing: true },
  dressloc: { settings: [...ORG2, ['enable_dress_location_alert', 'true']] },
  seq: { items: 'states', settings: [...ORG2, ['enable_barcode_sequence_mode', 'true']] },
};
// W3: מצבי פריטים נוספים (תרחיש items) — אותם 4 פריטים של העיצוב + מושכר / הוחזר
const ITEMS_STATES = [
  { ...ITEMS[0], dressItem: { ...ITEMS[0].dressItem, barcodePrefix: 4512, dress: { ...ITEMS[0].dressItem.dress, barcodePrefix: 4512 } } },
  ITEMS[1],
  { ...ITEMS[2], isTaken: true, takenDate: '2026-10-01T08:00:00.000Z', barcode: '27644001', dressItem: { ...ITEMS[2].dressItem, barcodePrefix: 2764, dress: { ...ITEMS[2].dressItem.dress, barcodePrefix: 2764 } } },
  ITEMS[3],
  { id: 'a5', dressItem: dress('a5', '5120'), sizeText: '42', price: 160, finalPrice: 160, isDeleted: false, isTaken: true, isReturned: true, returnedOk: false, takenDate: '2026-10-01T08:00:00.000Z', returnDate: '2026-10-03T08:00:00.000Z', barcode: '51204201', createdAt: '2026-09-24T09:40:00.000Z' },
];
const MODELS = [
  { id: 'm-4519', name: '4519', barcodePrefix: 4519, priceCategory: 'שמלה', isPremium: false },
  { id: 'm-4512', name: '4512', barcodePrefix: 4512, priceCategory: 'שמלה', isPremium: false },
  { id: 'm-4510', name: '4510', barcodePrefix: 4510, priceCategory: 'שמלה', isPremium: false },
];
const STOCK = { stock: { 'm-4519': { 34: { total: 2 }, 36: { total: 3 }, 38: { total: 2 }, 40: { total: 1 }, 42: { total: 0 }, 44: { total: 2 } }, 'm-4512': { 36: { total: 1 }, 38: { total: 2 }, 40: { total: 2 } } }, bookings: [], settings: { bufferDays: 3, skipWeekends: true } };
const S = SCENARIOS[scn] || {};
const order = { ...ORDER, ...(S.order || {}), items: S.items === 'states' ? ITEMS_STATES : ITEMS, obligations: S.obligations || OBL, payments: S.payments || PAY, refunds: [] };
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
  if (u.startsWith('/api/inventory/preload')) return j(STOCK);
  // W2a: ערי/רחובות לקוחות, חיפוש לקוח, יצירת לקוח (ת״ז חובה כש-require_customer_id_number, כמו השרת)
  if (u.startsWith('/api/customers/locations')) return j({ cities: ['ירושלים', 'בית שמש', 'בני ברק', 'אלעד'], streets: ['עמוס', 'הרב קוק', 'יפו', 'בן יהודה', 'הנביאים'] });
  if (u.startsWith('/api/customers?')) return j({ data: [CUSTOMER, { id: 'c2', firstName: 'מרים', lastName: 'אברהם', phone1: '052-4331290', email: 'm.avraham@example.com', city: 'בני ברק' }] });
  if (u === '/api/customers' && method === 'POST') { const b = JSON.parse(opts.body); return b.zeout || !settings.some(x => x.key === 'require_customer_id_number' && x.value === 'true') ? j({ id: 'c-new', ...b }) : j({ error: 'תעודת זהות חובה' }, 400); }
  // W3 — לשונית פריטים
  if (u.startsWith('/api/inventory/models')) return j({ models: MODELS });
  if (u.startsWith('/api/inventory/capacity')) return j({ inStock: 4, occupiedCount: 2, reserve: 2, occupiedOrders: [{ id: 'x1', orderId: 53375, eventDate: ORDER.eventDate, customerName: 'מרים אברמוביץ', quantity: 1 }, { id: 'x2', orderId: 53311, eventDate: '2026-10-12T21:00:00.000Z', customerName: 'לאה כץ', quantity: 1 }] });
  if (u.startsWith('/api/audit/order-item/')) return j([{ id: 'l1', action: 'CREATE', employeeId: 'e2', createdAt: '2026-09-23T07:13:00.000Z', changesJson: JSON.stringify({ sizeText: '38', price: 150, dressItemId: 'di-a1' }) }, { id: 'l2', action: 'CONFIRM_RENTAL', employeeId: 'e1', createdAt: '2026-10-01T08:00:00.000Z', changesJson: JSON.stringify({ isTaken: { from: false, to: true } }) }]);
  // W2b: הצטרפות למשלוח (info / candidates / group), הטבלה חסרה = enabled:false, התראות מיקום שמלה
  if (u.startsWith('/api/deliveries/join')) {
    if (S.joinTableMissing) return j({ enabled: false, candidates: [], group: [], info: null });
    const m = new URL(u, location.origin).searchParams;
    if (m.get('mode') === 'info') return j({ enabled: true, info: { orderId: 53375, joinedToOrderId: null, rootOrderId: 53375, isPrimary: false, group: [] } });
    if (m.get('mode') === 'candidates') return j({ enabled: true, candidates: [{ orderId: 53301, customerName: 'שרה כהן', direction: 'הלוך-חזור', street: 'הרב קוק 4', city: 'בית שמש', address: 'הרב קוק 4, בית שמש', joinedCount: 1 }, { orderId: 53288, customerName: 'רבקה לוי', direction: 'הלוך-חזור', street: 'יפו 12', city: 'ירושלים', address: 'יפו 12, ירושלים', joinedCount: 0 }] });
    if (m.get('mode') === 'group') return j({ enabled: true, group: [{ orderId: 53301, customerName: 'שרה כהן', isPrimary: true, isRoot: true, street: 'הרב קוק 4', city: 'בית שמש' }, { orderId: 53299, customerName: 'מרים גולד', isPrimary: false, isRoot: false, street: 'הרב קוק 4', city: 'בית שמש' }] });
    return j({ enabled: true });
  }
  if (u.startsWith('/api/orders/dress-location-alerts')) return j({ enabled: true, orders: [{ orderId: 53375, eventDate: ORDER.eventDate, customerName: 'מרים אברמוביץ', alerts: [
    { key: '4512|38|model', modelName: 'דגם 4512', size: '38', needed: 1, homeCount: 0, shortage: 1, severity: 'critical', assigned: false, away: [{ barcode: '45123801', kind: 'out', orderId: 53190, expectedReturn: '2026-10-05T09:00:00.000Z', overdue: false, backBeforeEvent: true }, { barcode: '45123802', kind: 'branch', branch: 'בני ברק', backBeforeEvent: true }] },
    { key: '3087|36|assigned', modelName: 'דגם 3087', size: '36', needed: 1, homeCount: null, shortage: 1, severity: 'warning', assigned: true, away: [{ barcode: '30873601', kind: 'out', orderId: 53201, expectedReturn: '2026-10-03T09:00:00.000Z', overdue: true, backBeforeEvent: false }] }] }] });
  if (u.startsWith('/api/rentals/verify-item') && String(JSON.parse(opts.body).barcode).startsWith('999')) return j({ valid: false, error: 'ברקוד 99900001 אינו תקף להשכרה.' }, 400);
  if (u.startsWith('/api/rentals/verify-item')) { const b = JSON.parse(opts.body); return j({ valid: true, dressItem: { barcodePrefix: Number(String(b.barcode).slice(0, -4)), sizeText: String(b.barcode).slice(-4, -2) } }); }
  if (u.startsWith('/api/rentals/') || u.startsWith('/api/returns/')) return j({ success: true });
  if (u.startsWith('/api/orders/53375/items')) {
    const b = JSON.parse(opts.body);
    return j({ ...order, items: [...order.items, { ...b, id: `n${Date.now()}`, isNew: undefined, _localId: undefined, dressItem: { id: 'dn', dressModelId: b.dressModelId, dress: { id: b.dressModelId, name: b.description } }, price: 120, finalPrice: 120 }] });
  }
  if (u.startsWith('/api/orders/validate-inventory')) return j({ valid: true, errors: [] });
  if (u.startsWith('/api/orders/events')) return j({ ok: true, written: 1 });
  if (u.startsWith('/api/auth/verify-pin')) {
    const b = JSON.parse(opts.body);
    return b.pin === '1234' ? j({ success: true, employeeId: b.employeeId, employeeName: (EMPLOYEES.find(e => e.id === b.employeeId) || {}).firstName || '' }) : j({ success: false, error: 'סיסמה שגויה או משתמש לא פעיל' }, 401);
  }
  if (/\/api\/orders\/53375\/(preview-pricing)/.test(u)) {
    // W3 A27: פריט היפותטי של חלונית ההוספה → מחיר 120 / דמי ביטול 40 ("המנוע" המדומה)
    const hypo = (JSON.parse(opts.body).items || []).find(i => i.id === 'oc-add-preview');
    if (hypo) return j({ newObligations: hypo.isDeleted ? [{ orderItemId: hypo.id, amount: 120, description: 'חיוב מקורי' }, { orderItemId: hypo.id, amount: -120, description: 'זיכוי בגין ביטול' }, { orderItemId: hypo.id, amount: 40, description: 'דמי ביטול ותיקונים' }] : [{ orderItemId: hypo.id, amount: 120, description: 'השכרת שמלה' }] });
    return j({ newObligations: order.obligations.filter(o => o.isManual === false) });
  }
  if (/\/api\/orders\/53375\/cancel-changes/.test(u)) return j({ success: true });
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
