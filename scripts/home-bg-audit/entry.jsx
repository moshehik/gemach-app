import '../../app/globals.css';
import '../../app/design-overrides.css';
import '../../app/design-system.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import HomeA5 from '../../app/components/home/HomeA5.js';

const CUST = [{ id: 'c1', firstName: 'רחל', lastName: 'כהן', phone1: '0501234567', city: 'ירושלים' }, { id: 'c2', firstName: 'שרה', lastName: 'כהן', phone1: '0527654321', city: 'בני ברק' }];
const ORD = Array.from({ length: 6 }, (_, i) => ({ id: 'o' + i, orderId: 1000 + i, firstName: 'רחל', lastName: 'כהן', eventDateHebrew: "י\"ב בסיון תשפ\"ו", totalAmount: 1200, itemCount: 2, status: i % 3 ? '' : 'מושכר' }));
const RENT = Array.from({ length: 5 }, (_, i) => ({ orderId: 1000 + i, catalogName: 'שמלת נסיכה', barcode: '10' + i, sizeText: '38' }));
// חיפוש ברקוד (4.10.2026): אותו פריט בשלוש השכרות — מושכר עכשיו / הוחזר (תאריך מחושב מ-eventDate) / טרם נלקח בלי לקוחה ותאריך
const BC_RENT = [
  { id: 'i1', orderId: 52001, catalogName: '551', barcode: '5511205', sizeText: '12', isTaken: true, isReturned: false, firstName: 'רחל', lastName: 'כהן-פרידמן', eventDateHebrew: 'ט״ו תשרי תשפ״ז', eventDate: '2026-10-03T00:00:00.000Z' },
  { id: 'i2', orderId: 47310, catalogName: '551', barcode: '5511205', sizeText: '12', isTaken: true, isReturned: true, firstName: 'לאה', lastName: 'גולדשטיין', eventDateHebrew: null, eventDate: '2025-06-11T21:00:00.000Z' },
  { id: 'i3', orderId: 39002, catalogName: '551', barcode: '5511205', sizeText: '12', isTaken: false, isReturned: false, firstName: null, lastName: null, eventDateHebrew: null, eventDate: null },
];
const BOOT = { authenticated: true, requireLogin: false, employee: { id: 'e1', firstName: 'שולמית' }, isHead: true, isManager: true, aiAllowed: true,
  settings: { home_welcome_title: 'שלום! מה תרצי לחפש?', gmach_name: 'גמ״ח שמלות' },
  navGroups: [{ items: ['/customers', '/orders', '/rentals', '/alterations', '/deliveries', '/dashboard/dresses'].map((h) => ({ href: h, label: h })) }] };
const j = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
const realFetch = window.fetch.bind(window);
window.fetch = async (url, opts) => {
  const u = String(url);
  await new Promise((r) => setTimeout(r, window.__delay || 30));
  if (u.includes('/api/a5/boot')) return j(BOOT);
  if (u.includes('/api/a5/version')) return j({ version: '1.2.3', date: '2026-10-02' });
  if (u.includes('/api/global-search')) { if (u.includes(encodeURIComponent('שגיאה'))) return new Response('{}', { status: 500 }); if (u.includes(encodeURIComponent('אין'))) return j({ customers: [], orders: [], rentals: [] }); if (u.includes('q=5511205')) return j({ customers: [], orders: [], rentals: BC_RENT }); } if (u.includes('/api/global-search')) return j({ customers: CUST, orders: ORD, rentals: RENT });
  if (u.includes('/api/ai')) return j({ response: 'מצאתי 3 הזמנות פעילות לרחל כהן.', data: ORD.slice(0, 3).map((o) => ({ 'מספר הזמנה': o.orderId, 'שם': 'רחל כהן', 'סכום': 1200 })) });
  // תפוסה (/api/a5/adv-b?focus=capacity): 'הרבה' = מגבלת צמדי דגם/מידה (400), 'תקלה' = שגיאת שרת (500), אחרת 10 הזמנות + סיכום
  if (u.includes('/api/a5/adv-b') && u.includes('focus=capacity')) {
    const model = new URL(u, location.href).searchParams.get('model') || '';
    if (model.includes('הרבה')) return new Response(JSON.stringify({ error: 'יותר מדי דגמים/מידות תואמים - צמצמו את שם הדגם או הוסיפו מידה' }), { status: 400 });
    if (model.includes('תקלה') && !window.__capOk) return new Response(JSON.stringify({ error: 'שגיאה בחישוב תפוסה' }), { status: 500 });
    const names = ['רחל כהן', 'לאה כהן-פרידמן', 'שרה כהנוב', 'מרים כהן', 'חנה לוי', 'דבורה שפירא', '', 'יעל גרין', 'תמר וייס', 'מלכה רוזן'];
    const dates = ['ט״ו תשרי', 'כ״ב תשרי', 'ג׳ חשון', 'י׳ תשרי', 'ח׳ תשרי', 'ב׳ תשרי', 'ה׳ חשון', 'ז׳ חשון', 'י״א חשון', 'י״ג חשון'];
    return j({ cols: ['שם', 'תאריך אירוע', 'כמות', 'טלפון'], rows: names.map((n, i) => [n, dates[i], String((i % 3) + 1), i === 6 ? '' : '05' + (2 + (i % 4)) + '-44182' + (10 + i)]),
      links: names.map((_, i) => '/orders/' + (48133 + i)), al: [], namesRev: names.map((n) => n.split(' ').reverse().join(' ')), capstats: { stock: 6, busy: 4, res: 1 }, truncated: false, gaps: [] });
  }
  if (u.includes('/api/')) return j({ cols: ['הזמנה', 'שם', 'סכום'], rows: ORD.map((o) => [String(o.orderId), 'רחל כהן', '1200']), links: ORD.map((o) => '/orders/' + o.orderId), al: [], namesRev: [], truncated: false, gaps: [] });
  return realFetch(url, opts);
};
createRoot(document.getElementById('root')).render(<HomeA5 />);
