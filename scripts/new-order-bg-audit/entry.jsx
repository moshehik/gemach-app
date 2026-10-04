// אשף "הזמנה חדשה" האמיתי (NewOrderA5 + new-order.css + כל ה-CSS הגלובלי של האתר) עם API מדומה - בלי DB, בלי שרת פיתוח.
// ההגדרות המדומות תואמות את ברירות המחדל של סרגל ההדגמה בעיצוב (SET בהזמנה-חדשה.html): משלוחים, סניף ביצוע, הזמנה טלפונית,
// כתובת שונה, "יום לפני", נדרים, תיקונים - פועלים; סניף איסוף / הו"ק כבויים; PAYMENT_APPROVAL_LEVEL = כולם.
// ?org=2 מוסיף את הגדרות נווה יעקב (ת"ז חובה, דיוור מוצג). כל קריאה נרשמת ב-window.__calls.
import '../../app/globals.css';
import '../../app/design-overrides.css';
import '../../app/design-system.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import NewOrderA5 from '../../app/components/new-order/NewOrderA5.js';

const qs = new URLSearchParams(location.search);
const org2 = qs.get('org') === '2';
const SETTINGS = {
  enable_deliveries: 'true', track_branch_on_order: 'true', phone_order_marker_enabled: 'true', delivery_allow_address_override: 'true',
  delivery_one_day_before_option: 'true', branch_list: 'נוה יעקב,בית שמש', branches_enabled: 'false', hok_enabled: 'false',
  nedarim_plus_enabled: 'true', enable_alterations: 'true', PAYMENT_APPROVAL_LEVEL: 'כולם', max_items_per_order: '6',
  delivery_price_by_city: JSON.stringify({ 'ירושלים': 60, 'בית שמש': 80, 'בני ברק': 70 }), inventory_hold_minutes: '15',
  hide_marketing_consent_field: org2 ? 'false' : 'true', require_customer_id_number: org2 ? 'true' : 'false', require_id_for_edit_cancel: 'true',
  auto_email_on_order_create: 'true', mailing_list_auto_sync: 'true',
};
const CUSTOMERS = [
  { id: 'c1', firstName: 'מרים', lastName: 'אברמוביץ', phone1: '052-3341290', phone2: '02-5812234', email: 'miriam.a@gmail.com', city: 'ירושלים', street: 'עמוס', houseNum: '12' },
  { id: 'c6', firstName: 'תמר', lastName: 'פרידמן', phone1: '052-3341290', phone2: '', email: 'tamar.f@gmail.com', city: 'ירושלים', street: 'בר אילן', houseNum: '31' },
  { id: 'c2', firstName: 'רחל', lastName: 'כהן', phone1: '054-7712340', phone2: '', email: '', city: 'בית שמש', street: 'הרב קוק', houseNum: '4' },
  { id: 'c4', firstName: 'חנה', lastName: 'גרין', phone1: '053-2205671', phone2: '', email: '', city: 'מודיעין עילית', street: '', houseNum: '', isBlocked: true, blockedReason: 'שמלה לא הוחזרה בזמן' },
];
const MODELS = [
  { id: 'm-4512', name: 'שמלת תחרה קרם', barcodePrefix: '4512' }, { id: 'm-3087', name: 'שמלת סאטן שנהב', barcodePrefix: '3087' },
  { id: 'm-2764', name: 'שמלת נסיכה תחרה', barcodePrefix: '2764' }, { id: 'm-x', name: 'ללא שם 17', barcodePrefix: '1893' },
];
const SIZES = ['34', '36', '38', '40', '42', '44', '46'];
const stock = {};
MODELS.forEach(m => { stock[m.id] = {}; SIZES.forEach((z, i) => { stock[m.id][z] = { total: i === 6 ? 0 : 1 + (i % 3), itemId: `${m.id}-${z}` }; }); });
const PRICE = 180;
const j = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
window.__calls = [];
const realFetch = window.fetch.bind(window);
window.fetch = async (url, opts) => {
  const u = String(url);
  await new Promise((r) => setTimeout(r, 30));
  if (!u.startsWith('/api/')) return realFetch(url, opts);
  const body = opts && opts.body ? JSON.parse(opts.body) : null;
  window.__calls.push({ url: u, method: (opts && opts.method) || 'GET', body });
  if (u.startsWith('/api/settings')) return j(Object.entries(SETTINGS).map(([key, value]) => ({ key, value })));
  if (u.startsWith('/api/customers/locations')) return j({ cities: ['ירושלים', 'בית שמש', 'בני ברק', 'מודיעין עילית'], streets: ['עמוס', 'הרב קוק', 'יפו', 'בר אילן'] });
  if (u.startsWith('/api/customers') && opts && opts.method === 'POST') return j({ id: 'c99', ...body });
  if (u.startsWith('/api/customers')) {
    const q = new URL(u, location.origin).searchParams;
    const s = (q.get('search') || q.get('phone') || '').replace(/\D/g, '');
    const t = q.get('search') || '';
    const list = q.get('phone') !== null ? CUSTOMERS.filter(c => s && c.phone1.replace(/\D/g, '') === s)
      : CUSTOMERS.filter(c => !t || `${c.firstName} ${c.lastName}`.includes(t) || (s && c.phone1.replace(/\D/g, '').includes(s)) || c.city.includes(t));
    return j({ data: list });
  }
  if (u.startsWith('/api/employees')) return j([{ id: 'e1', firstName: 'שרה', lastName: 'כהן', roleId: 1, approvals: { 'feature:special_spacing_approval': true, 'feature:payment_exit_approval': true, 'feature:missing_contact_approval': true, 'feature:past_date_order_approval': true } }, { id: 'e2', firstName: 'רחל', lastName: 'לוי', roleId: 0, approvals: {} }]);
  if (u.startsWith('/api/me')) return j({ success: true, employee: { id: 'e1', firstName: 'שרה', lastName: 'כהן', roleId: 1 } });
  if (u.startsWith('/api/inventory/models')) { const q = new URL(u, location.origin).searchParams.get('q') || ''; return j({ models: MODELS.filter(m => !q || m.name.includes(q) || m.barcodePrefix.includes(q)) }); }
  if (u.startsWith('/api/inventory/preload')) return j({ stock, bookings: [], settings: { bufferDays: 3, skipWeekends: true } });
  if (u.startsWith('/api/orders/pricing')) return j({ basePrice: PRICE });
  if (u.startsWith('/api/orders/calculate')) {
    const items = (body && body.items) || [];
    const calc = items.map(i => { const rc = (i.neckAlteration ? 30 : 0) + (i.sleeveAlteration ? 30 : 0) + (i.lengthAlteration ? 40 : 0); return { ...i, calculatedPrice: PRICE + rc, repairsCost: rc }; });
    const del = body && body.isDelivery && body.deliveryCity ? 60 * (body.deliveryDirection === 'הלוך-חזור' ? 2 : 1) : 0;
    return j({ totalAmount: calc.reduce((a, c) => a + c.calculatedPrice, 0) + del, calculatedItems: calc, deliveryAmount: del });
  }
  if (u.startsWith('/api/orders/validate-inventory')) return j({ valid: qs.get('scn') !== 'shortage', errors: [{ dressName: 'שמלת תחרה קרם', sizeText: '38', requested: 1, available: 0, isCustomSpacingIssue: true }] });
  if (u.startsWith('/api/orders/draft')) return j({ orderId: 53412 });
  if (u.startsWith('/api/orders/reserve')) return j({ orderId: 53412 });
  if (u.startsWith('/api/auth/verify-pin')) return j({ success: true });
  if (u === '/api/orders' && opts && opts.method === 'POST') {
    if (qs.get('scn') === 'save409') return j({ validationErrors: [{ dressName: 'שמלת תחרה קרם', sizeText: '38', requested: 1, available: 0 }] }, 409);
    if (qs.get('scn') === 'save500') return j({ error: 'Failed to create order', details: 'timeout' }, 500);
    return j({ orderId: 53412, customerId: body.customerId });
  }
  if (u.startsWith('/api/nedarim')) return j({ success: false, error: 'שגיאה בחיוב הכרטיס' });
  return j({});
};
window.open = (u) => { window.__calls.push({ url: String(u), method: 'OPEN' }); return null; };
createRoot(document.getElementById('root')).render(<NewOrderA5 />);
