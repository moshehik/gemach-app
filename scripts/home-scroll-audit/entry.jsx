import '../../app/globals.css';
import '../../app/design-overrides.css';
import '../../app/design-system.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import HomeA5 from '../../app/components/home/HomeA5.js';

// כמו scripts/home-bg-audit/entry.jsx, אבל עם הרבה שורות (40 לכל סוג) כדי שיופיע "עוד N" גם בחיפוש הכללי וגם במתקדם.
const N = 40;
const CUST = Array.from({ length: N }, (_, i) => ({ id: 'c' + i, firstName: 'רחל' + i, lastName: 'כהן', phone1: '05012345' + (10 + i), city: 'ירושלים' }));
const ORD = Array.from({ length: N }, (_, i) => ({ id: 'o' + i, orderId: 1000 + i, firstName: 'רחל', lastName: 'כהן' + i, eventDateHebrew: "י\"ב בסיון תשפ\"ו", totalAmount: 1200, itemCount: 2, status: i % 3 ? '' : 'מושכר' }));
const RENT = Array.from({ length: N }, (_, i) => ({ orderId: 1000 + i, catalogName: 'שמלת נסיכה ארוכה עם שרוולים ' + i, barcode: '10' + i, sizeText: '38' }));
const BOOT = { authenticated: true, requireLogin: false, employee: { id: 'e1', firstName: 'שולמית' }, isHead: true, isManager: true, aiAllowed: true,
  settings: { home_welcome_title: 'שלום! מה תרצי לחפש?', gmach_name: 'גמ״ח שמלות' },
  navGroups: [{ items: ['/customers', '/orders', '/rentals', '/alterations', '/deliveries', '/dashboard/dresses'].map((h) => ({ href: h, label: h })) }] };
const j = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
const realFetch = window.fetch.bind(window);
window.fetch = async (url, opts) => {
  const u = String(url);
  await new Promise((r) => setTimeout(r, 30));
  if (u.includes('/api/a5/boot')) return j(BOOT);
  if (u.includes('/api/a5/version')) return j({ version: '1.2.3', date: '2026-10-02' });
  if (u.includes('/api/global-search')) return j({ customers: CUST, orders: ORD, rentals: RENT });
  if (u.includes('/api/a5/options')) return j({ options: [] });
  if (u.includes('/api/a5/adv')) return j({ cols: ['הזמנה', 'שם', 'סכום'], rows: ORD.map((o, i) => [String(o.orderId), 'רחל כהן ' + i, 'שמלה ארוכה מאוד עם שרוולים ' + i + ' בצבע ורוד עתיק']), links: ORD.map((o) => '/orders/' + o.orderId), al: [], namesRev: [], truncated: false, gaps: [] });
  if (u.includes('/api/')) return j({});
  return realFetch(url, opts);
};
createRoot(document.getElementById('root')).render(<HomeA5 />);
