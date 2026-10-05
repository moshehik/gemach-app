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
  navGroups: [{ items: ['/customers', '/orders', '/rentals', '/alterations', '/deliveries', '/dashboard/dresses', '/refunds'].map((h) => ({ href: h, label: h })) }] };
const j = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
const realFetch = window.fetch.bind(window);
window.fetch = async (url, opts) => {
  const u = String(url);
  (window.__reqs = window.__reqs || []).push(u); // נקרא על ידי test_run_directive.mjs
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
  // כספים (HM-03, /api/a5/adv-b?focus=finance): אותן ארבע שורות כמו בדמו המאושר; name='תקלה' = שגיאת שרת (500)
  if (u.includes('/api/a5/adv-b') && u.includes('focus=finance')) {
    if ((new URL(u, location.href).searchParams.get('name') || '').includes('תקלה')) return new Response(JSON.stringify({ error: 'שגיאה בחיפוש המתקדם' }), { status: 500 });
    return j({ cols: ['שם', 'סכום', 'תאריך אירוע', 'טלפון'], rows: [['רחל כהן', ['חוב ₪450', 'amtd'], 'ט״ו תשרי', '052-4418210'], ['לאה כהן-פרידמן', ['זיכוי ₪120', 'amtc'], 'כ״ב תשרי', '054-8812034'], ['שרה כהנוב', ['חוב ₪900', 'amtd'], 'ג׳ חשון', '050-7741122'], ['מרים כהן', ['זיכוי ₪300', 'amtc'], 'י׳ תשרי', '053-3101177']],
      links: ['/orders/48131', '/orders/47920', '/orders/47552', '/customers/c4'], al: [], namesRev: ['כהן רחל', 'כהן-פרידמן לאה', 'כהנוב שרה', 'כהן מרים'], truncated: false, gaps: [] });
  }
  // התראות (HM-04 / F23, /api/a5/adv-alerts): שלוש השורות של ההצעה (איחור / שמלה שלא חזרה / חוב פתוח). name='חלקי' = סוג אחד לא נטען (failed), 'שגיאה' = 500, 'ריק' = אין התראות
  if (u.includes('/api/a5/adv-alerts')) {
    const nm = new URL(u, location.href).searchParams.get('name') || '';
    if (nm.includes('שגיאה')) return new Response(JSON.stringify({ error: 'שגיאה בחיפוש ההתראות' }), { status: 500 });
    if (nm.includes('ריק')) return j({ cols: ['שם', 'הזמנה', 'תאריך אירוע', 'התראה', 'טלפון'], rows: [], links: [], al: [], namesRev: [], tags: [], truncated: false, gaps: [], failed: [] });
    return j({ cols: ['שם', 'הזמנה', 'תאריך אירוע', 'התראה', 'טלפון'], rows: [['רחל כהן', 'הזמנה 48131', 'י״ג תשרי', ['איחור בהחזרה (9 ימים)', 'red'], '052-4418210'], ['לאה פרידמן', 'הזמנה 47920', 'י״ג תשרי', ['שמלה שלא חזרה', 'amber'], '054-8812034'], ['שרה לוי', 'הזמנה 47552', 'י״ג תשרי', ['חוב פתוח ₪450', 'gold'], '050-7741122']],
      links: ['/orders/48131', '/orders/47920', '/orders/47552'], al: [], namesRev: ['כהן רחל', 'פרידמן לאה', 'לוי שרה'], tags: ['return', 'return', 'order'], truncated: false, gaps: [], failed: nm.includes('חלקי') ? ['חובות'] : [] });
  }
  if (u.includes('/api/')) return j({ cols: ['הזמנה', 'שם', 'סכום'], rows: ORD.map((o) => [String(o.orderId), 'רחל כהן', '1200']), links: ORD.map((o) => '/orders/' + o.orderId), al: [], namesRev: [], truncated: false, gaps: [] });
  return realFetch(url, opts);
};
createRoot(document.getElementById('root')).render(<HomeA5 />);
