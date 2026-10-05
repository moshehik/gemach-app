// הלוח החודשי האמיתי (BoardPage + board.css + schedule.css + כל ה-CSS הגלובלי של האתר) עם API מדומה - בלי DB ובלי שרת פיתוח.
// תרחישים לפי ?scn=: (ריק) לוח רגיל | loading (ההזמנות לא חוזרות) | nostages (403 על המונים) | noschedule (המדומה: עובדת בלי הרשאה
// ללו״ז - ללוח זה לא משנה, BD-O3) | gate (חלון "אין הרשאה" לעובדת) | guest (חלון "אין הרשאה" לאורח) | legacy (חלון ההשכרה הקיים
// RentalReturnModal - בדיקת ה-hook המשותף) | bpp (enable_batch_print_prep - לא בשימוש בלוח) | noalt (enable_alterations=false).
import '../../app/globals.css';
import '../../app/design-overrides.css';
import '../../app/design-system.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { LabelsProvider } from '../../app/components/LabelsContext.js';
import BoardPage from '../../app/components/board/BoardPage.js';
import NoAccessCard from '../../app/components/gate/NoAccessCard.js';
import RentalReturnModal from '../../components/orders/RentalReturnModal.js';
import { monthRangeKeys, localKey } from '../../app/components/board/boardLogic.js';

const scn = new URLSearchParams(location.search).get('scn') || '';
window.__calls = [];
window.__nav = [];
window.__opened = [];
window.open = (u) => { window.__opened.push(String(u)); return null; };
// החלונות של PopupProvider (בחלון הקיים): אישור אוטומטי, מתועד
window.customConfirm = async (m) => { window.__calls.push({ url: 'customConfirm', body: m }); return true; };
window.customPrompt = async (m) => { window.__calls.push({ url: 'customPrompt', body: m }); return 'הערה'; };

const range = monthRangeKeys(new Date());
const keyAdd = (k, n) => { const [y, m, d] = k.split('-').map(Number); return localKey(new Date(y, m - 1, d + n, 12)); };
const todayKey = localKey(new Date());
const iso = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12).toISOString(); };
const NAMES = ['מרים לוי', 'שרה כהן', 'רחל פרידמן', 'לאה גולדברג', 'חנה שפירא', 'אסתר מזרחי', 'דבורה וייס', 'רבקה קליין', 'יעל רוזנברג', 'תמר שטרן'];
const items = (spec) => spec.map((s, i) => ({ id: 'it' + Math.random().toString(36).slice(2, 8) + i, isDeleted: false, isTaken: !!s.t, isReturned: !!s.r, neckAlteration: s.alt ? 1 : 0, lengthAlteration: null, sleeveAlteration: 0, alterationDetails: s.alt ? 'קיצור' : '' }));
let oid = 51000;
const mkOrder = (k, i, kind) => {
  const n = NAMES[(oid + i) % NAMES.length];
  const spec = {
    returned: [{ t: 1, r: 1 }, { t: 1, r: 1 }], rented: [{ t: 1 }, { t: 0 }], repairs: [{ alt: 1 }], unpaid: [{}],
    completed: [{}], empty: [], late: [{ t: 1 }],
  }[kind] || [{}];
  const total = kind === 'empty' ? 0 : 450;
  const paid = kind === 'unpaid' || kind === 'repairs' ? 100 : total;
  return { orderId: oid++, eventDate: iso(k), eventDateHebrew: 'י״ד תשרי תשפ״ז', customerName: n, customerPhone: '052-3456789', customerId: oid % 5 ? 'c' + oid : null, items: items(spec), totalAmount: total, totalPaid: paid, customSpacing: oid % 4 === 0 ? 2 : null };
};
const ORDERS = [];
const KINDS = ['completed', 'unpaid', 'rented', 'returned', 'repairs', 'empty'];
for (let k = range.from, i = 0; k <= range.to; k = keyAdd(k, 1), i++) {
  const n = [0, 1, 2, 4, 1, 0, 3][i % 7];
  for (let j = 0; j < n; j++) {
    const past = k < todayKey;
    const kind = past && j === 0 && i % 3 === 0 ? 'late' : KINDS[(i + j) % KINDS.length];
    ORDERS.push(mkOrder(k, j, kind));
  }
}
const STAGES = [
  { key: 'order', number: 1, label: 'הזמנה', plural: 'הזמנות', enabled: true, infoOnly: true },
  { key: 'repair', number: 2, label: 'תיקונים', plural: 'תיקונים', enabled: scn !== 'noalt', infoOnly: false },
  { key: 'prep', number: 4, label: 'הכנה', plural: 'הכנות', enabled: true, infoOnly: false },
  { key: 'dout', number: 5, label: 'משלוח הלוך', plural: 'משלוחי הלוך', enabled: true, infoOnly: false },
  { key: 'pick', number: 6, label: 'איסוף מקומי', plural: 'איסופים מקומיים', enabled: true, infoOnly: false },
  { key: 'event', number: 7, label: 'אירוע', plural: 'אירועים', enabled: true, infoOnly: true },
  { key: 'manret', number: 8, label: 'החזרה ידנית', plural: 'החזרות ידניות', enabled: true, infoOnly: false },
  { key: 'dback', number: 9, label: 'משלוח חזור', plural: 'משלוחי חזור', enabled: true, infoOnly: false },
];
const DAYS = {};
for (let k = range.from, i = 0; k <= range.to; k = keyAdd(k, 1), i++) {
  const s = {};
  if (i % 7 !== 6) {
    s.order = { t: 1 + (i % 3), a: 0 };
    if (i % 2) s.prep = { t: 2, a: k < todayKey && i % 4 === 1 ? 1 : 0 };
    if (i % 3 === 0) s.pick = { t: 1, a: 0 };
    if (i % 5 === 0) s.dout = { t: 1, a: 0 };
    s.event = { t: [0, 1, 2, 4, 1, 0, 3][i % 7], a: 0 };
    if (i % 4 === 2) s.manret = { t: 2, a: k < todayKey ? 1 : 0 };
    if (scn !== 'noalt' && i % 6 === 1) s.repair = { t: 1, a: 0 };
  }
  for (const kk of Object.keys(s)) if (!s[kk].t) delete s[kk];
  DAYS[k] = { s, alerts: Object.values(s).reduce((a, v) => a + v.a, 0), nonWorkingDay: i % 7 === 6 };
}
const RENTAL = (id) => ({
  orderId: Number(id), eventDate: iso(todayKey), eventDateHebrew: 'י״ד תשרי תשפ״ז', notes: 'להביא שקית', isAbroad: false,
  customer: { id: 'c1', firstName: 'שרה', lastName: 'כהן', phone1: '052-3456789' },
  items: [
    { id: 'r1', description: 'שמלת ערב 4512', sizeText: '38', barcode: null, isTaken: false, isReturned: false, isDeleted: false, alterationDetails: 'קיצור אורך' },
    { id: 'r2', description: 'שמלת ערב 3087', sizeText: '40', barcode: '308740001', isTaken: false, isReturned: false, isDeleted: false },
    { id: 'r3', description: 'שמלת ילדה 1893', sizeText: '10', barcode: '189310002', isTaken: true, takenDate: iso(keyAdd(todayKey, -3)), isReturned: false, isDeleted: false },
    { id: 'r4', description: 'שמלת ערב 2214', sizeText: '42', barcode: '221442003', isTaken: true, isReturned: true, returnedOk: true, takenDate: iso(keyAdd(todayKey, -5)), returnDate: iso(keyAdd(todayKey, -1)), isDeleted: false },
    { id: 'r5', description: 'שמלת ערב 5021', sizeText: '36', barcode: '502136004', isTaken: true, isReturned: true, returnedOk: false, takenDate: iso(keyAdd(todayKey, -5)), returnDate: iso(keyAdd(todayKey, -1)), isDeleted: false },
  ],
  totalAmount: 900, totalPaid: 900,
});
const j = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const realFetch = window.fetch.bind(window);
window.fetch = async (url, opts) => {
  const u = String(url);
  if (!u.startsWith('/api/')) return realFetch(url, opts);
  window.__calls.push({ url: u, method: (opts && opts.method) || 'GET', body: opts && opts.body ? String(opts.body) : null });
  const delay = scn === 'loading' && u.startsWith('/api/orders?') ? 120000 : 40;
  await new Promise((r, rej) => {
    const t = setTimeout(r, delay);
    if (opts && opts.signal) opts.signal.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('aborted', 'AbortError')); });
  });
  if (u.startsWith('/api/settings/labels')) return j({});
  if (u.startsWith('/api/settings')) return j([
    { key: 'enable_alterations', value: scn === 'noalt' ? 'false' : 'true' },
    { key: 'hide_custom_spacing', value: 'false' },
    { key: 'enable_batch_print_prep', value: scn === 'bpp' ? 'true' : 'false' },
    { key: 'late_return_threshold_days', value: '7' },
  ]);
  if (u.startsWith('/api/board/stages')) {
    if (scn === 'nostages') return j({ error: 'Forbidden' }, 403);
    return j({ from: range.from, to: range.to, today: todayKey, stages: STAGES, days: DAYS, truncated: false });
  }
  if (/^\/api\/orders\/\d+/.test(u)) return j(RENTAL(u.split('/')[3].split('?')[0]));
  if (u.startsWith('/api/orders?')) return j({ data: ORDERS });
  if (u.startsWith('/api/audit/order-item/')) return j([{ id: 'h1', action: 'UPDATE', createdAt: iso(keyAdd(todayKey, -1)), changesJson: JSON.stringify({ isReturned: { from: false, to: true } }) }]);
  if (u.startsWith('/api/rentals/cancel') || u.startsWith('/api/returns/scan') || u.startsWith('/api/rentals/toggle') || u.startsWith('/api/returns/report-issue')) return j({ success: true, item: { id: 'r3', isReturned: true, returnedOk: true } });
  if (u.startsWith('/api/rentals/scan')) return j({ id: 'r1', barcode: '451238000', isTaken: false });
  if (u.startsWith('/api/rentals/confirm')) return j({ success: true });
  return j({});
};

function App() {
  if (scn === 'gate') return <NoAccessCard guest={false} page="הלוח החודשי" />;
  if (scn === 'guest') return <NoAccessCard guest page="הלוח החודשי" />;
  if (scn === 'legacy') return <RentalReturnModal orderId={51001} onClose={() => window.__calls.push({ url: 'legacy-close' })} onUpdate={() => window.__calls.push({ url: 'legacy-update' })} />;
  return <BoardPage />;
}
createRoot(document.getElementById('root')).render(<LabelsProvider><App /></LabelsProvider>);
