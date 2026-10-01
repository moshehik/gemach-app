import '../../app/globals.css';
import '../../app/design-overrides.css';
import '../../app/design-system.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import HomeA5 from '../../app/components/home/HomeA5.js';

const CUST = [{ id: 'c1', firstName: 'רחל', lastName: 'כהן', phone1: '0501234567', city: 'ירושלים' }, { id: 'c2', firstName: 'שרה', lastName: 'כהן', phone1: '0527654321', city: 'בני ברק' }];
const ORD = Array.from({ length: 6 }, (_, i) => ({ id: 'o' + i, orderId: 1000 + i, firstName: 'רחל', lastName: 'כהן', eventDateHebrew: "י\"ב בסיון תשפ\"ו", totalAmount: 1200, itemCount: 2, status: i % 3 ? '' : 'מושכר' }));
const RENT = Array.from({ length: 5 }, (_, i) => ({ orderId: 1000 + i, catalogName: 'שמלת נסיכה', barcode: '10' + i, sizeText: '38' }));
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
  if (u.includes('/api/global-search')) { if (u.includes(encodeURIComponent('שגיאה'))) return new Response('{}', { status: 500 }); if (u.includes(encodeURIComponent('אין'))) return j({ customers: [], orders: [], rentals: [] }); } if (u.includes('/api/global-search')) return j({ customers: CUST, orders: ORD, rentals: RENT });
  if (u.includes('/api/ai')) return j({ response: 'מצאתי 3 הזמנות פעילות לרחל כהן.', data: ORD.slice(0, 3).map((o) => ({ 'מספר הזמנה': o.orderId, 'שם': 'רחל כהן', 'סכום': 1200 })) });
  if (u.includes('/api/')) return j({ cols: ['הזמנה', 'שם', 'סכום'], rows: ORD.map((o) => [String(o.orderId), 'רחל כהן', '1200']), links: ORD.map((o) => '/orders/' + o.orderId), al: [], namesRev: [], truncated: false, gaps: [] });
  return realFetch(url, opts);
};
createRoot(document.getElementById('root')).render(<HomeA5 />);
