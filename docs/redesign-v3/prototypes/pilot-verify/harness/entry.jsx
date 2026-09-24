import { createRoot } from 'react-dom/client';
import IconSprite from '@/app/components/IconSprite';
import PilotProviders from '@/app/v3/pilot/PilotProviders';
import CustomerCardV3 from '@/app/v3/pilot/customer/CustomerCardV3';

const P = new URLSearchParams(location.search);
const profile = P.get('profile') || 'org2';
const data = P.get('data') || 'full';
const fail = P.get('fail'); // load | history | save409 | verify | mail
const role = Number(P.get('role') ?? 0);

const SETTINGS = {
  org1: { hide_marketing_consent_field: 'true', require_customer_id_number: 'false', mandatory_field_groups: '[["phone2","email"]]' },
  org2: { hide_marketing_consent_field: 'false', require_customer_id_number: 'true', mandatory_field_groups: '[["phone2","email"]]' },
  minimal: {},
};
const day = (d) => new Date(Date.now() + d * 864e5).toISOString();
const order = (orderId, evDays, items, total, paid, extra = {}) => ({
  id: 'o' + orderId, orderId, eventDate: day(evDays), eventDateHebrew: '', orderDate: day(evDays - 30), createdAt: day(evDays - 30),
  items, obligations: [{ id: 'ob' + orderId, amount: total, isDeleted: false }], payments: paid ? [{ id: 'p' + orderId, amount: paid, isDeleted: false, paymentDate: day(evDays - 20), paymentMethod: 'אשראי', notes: '' }] : [], ...extra,
});
const it = (taken, ret) => ({ id: Math.random().toString(36), isDeleted: false, isTaken: taken, isReturned: ret });
const LONG = P.get('long') === '1';
const customer = {
  id: 'c1', legacyId: data === 'nonum' ? null : 20418,
  firstName: LONG ? 'רבקה-חיה-שרה-מלכה' : 'רבקה', lastName: LONG ? 'פרידמן-רוזנבלום-אברמוביץ-גולדשטיין-הלוי' : 'פרידמן',
  phone1: '0527134455', phone2: data === 'sparse' ? '' : '025810090', email: data === 'sparse' ? '' : 'rivka.f@example.com', emailSuffix: null,
  city: data === 'sparse' ? '' : 'ירושלים', street: data === 'sparse' ? '' : 'הרב קוק', houseNum: data === 'sparse' ? null : 12, zeout: null, marketingConsent: true,
  notes: data === 'sparse' ? '' : '[18.8.2026] אוטומטי: שמלה 41238 (הזמנה 53120) הוחזרה עם כתם קטן בשרוול\nמעדיפה שיחה בשעות הבוקר.',
  bankName: 'לאומי', bankBranch: '902', bankAccount: '', bankAccountName: 'רבקה פרידמן',
  isBlocked: true, blockedReason: LONG ? 'שמלה לא הוחזרה בזמן פעמיים ולאחר מכן גם לא נענו שלוש פניות טלפוניות וגם מכתב רשמי' : 'שמלה לא הוחזרה בזמן פעמיים',
  updatedAt: day(-1), isDeleted: false,
  orders: data === 'none' ? [] : data === 'sparse' ? [order(53501, 40, [it(false, false)], 150, 250)] : [
    order(53412, 20, [it(false, false)], LONG ? 4200000 : 420, LONG ? 2000000 : 200),
    order(53120, -37, [it(true, true)], 380, 380),
    order(52877, -110, [it(true, true), it(true, false)], 260, 150, { isWeekdayEvent: true, fromDate: day(-112), toDate: day(-110) }),
    order(52101, -120, [], 0, 0, { isDeleted: true }),
  ],
};
const refunds = data === 'none' ? [] : [{ id: 'r1', orderId: 53120, amount: 50, reason: 'יום השכרה שלא נוצל', isExecuted: true, executionDate: day(-15), createdAt: day(-22) }];
const logs = [
  { id: 'a1', entityType: 'Customer', entityId: 'c1', action: 'EMAIL_SENT', createdAt: day(-1), employeeName: 'מרים גולד', changesJson: JSON.stringify({ subject: 'תזכורת', to: 'rivka.f@example.com', sendMode: 'email', files: [] }) },
  { id: 'a2', entityType: 'Customer', entityId: 'c1', action: 'UPDATE', createdAt: day(-2), employeeName: 'שולמית לוי', changesJson: JSON.stringify({ phone2: { from: '025810000', to: '025810090' } }) },
  { id: 'a3', entityType: 'Customer', entityId: 'c1', action: 'CREATE', createdAt: day(-300), employeeName: null, changesJson: JSON.stringify({ firstName: { from: null, to: 'רבקה' } }) },
];
const employees = [
  { id: 'e1', firstName: 'שולמית', lastName: 'לוי', department: { name: 'הנהלה ראשית' }, approvals: { 'feature:customer_email_approval': true } },
  { id: 'e2', firstName: 'מרים', lastName: 'גולד', department: { name: 'הנהלה ראשית' }, approvals: { 'feature:customer_email_approval': true } },
  { id: 'e3', firstName: 'נחמה', lastName: 'כהן', department: { name: 'מזכירות' }, approvals: { 'feature:customer_email_approval': false } },
];
window.__calls = [];
const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
window.fetch = (url, opts = {}) => {
  const u = String(url); const m = (opts.method || 'GET').toUpperCase();
  window.__calls.push({ m, u, body: opts.body ? JSON.parse(opts.body) : undefined });
  return new Promise((res) => setTimeout(res, 120)).then(() => {
    if (u.startsWith('/api/me')) return json({ success: true, employee: { id: 'e1', firstName: 'שולמית', lastName: 'לוי', roleId: role } });
    if (u.startsWith('/api/settings')) return json(Object.entries(SETTINGS[profile] || {}).map(([key, value]) => ({ key, value })));
    if (u.startsWith('/api/employees')) return json(employees);
    if (u.startsWith('/api/customers/locations')) return json({ cities: ['ירושלים', 'בית שמש'], streets: ['הרב קוק', 'עמוס'] });
    if (u.startsWith('/api/customers/c1') && m === 'GET') return fail === 'load' ? Promise.reject(new TypeError('Failed to fetch')) : json(customer);
    if (u.startsWith('/api/customers/c1') && m === 'PUT') {
      if (fail === 'save409') return json({ error: 'Data Collision', message: 'לקוח זה עודכן בשרת לאחר הסנכרון האחרון שלך.' }, 409);
      const b = JSON.parse(opts.body); const { orders, ...rest } = b; return json({ ...rest, houseNum: rest.houseNum === '' || rest.houseNum == null ? null : parseInt(rest.houseNum, 10), zeout: rest.zeout || null, updatedAt: new Date().toISOString() });
    }
    if (u.startsWith('/api/customers/c1') && m === 'PATCH') return fail === 'unblock' ? json({ error: 'פעולה זו מוגבלת להנהלה ראשית בלבד' }, 403) : json({ ok: true });
    if (u.startsWith('/api/refunds')) return json(refunds);
    if (u.startsWith('/api/audit')) return fail === 'history' ? json({ error: 'x' }, 500) : json({ logs });
    if (u.startsWith('/api/auth/verify-pin')) { const b = JSON.parse(opts.body); return json(b.pin === '0000' ? { success: false, error: 'סיסמה שגויה או משתמש לא פעיל' } : { success: true }); }
    if (u.startsWith('/api/send-email')) return fail === 'mail' ? json({ success: false, message: 'השליחה נכשלה: mailer' }) : json({ success: true, driveLinks: JSON.parse(opts.body).sendMode === 'email' ? [] : [{ fileName: 'a.pdf', url: 'https://example.com/a' }] });
    if (u.startsWith('/api/customers') && m === 'POST') return json({ id: 'c2' });
    return json({ error: 'not mocked ' + u }, 404);
  });
};
createRoot(document.getElementById('root')).render(<><IconSprite /><PilotProviders><CustomerCardV3 id={P.get('id') || 'c1'} /></PilotProviders></>);
