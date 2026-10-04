// הדף האמיתי של "סיכום נוכחות" (AttendancePage + attendance.css + כל ה-CSS הגלובלי של האתר) עם API מדומה - בלי DB, בלי שרת פיתוח.
// ?role=mgr|emp (emp = /my-hours, העובדת e4) &view=month|byemp|emp &emp=<id> &scn=''|empty|loading|unauth
// הנתונים: data.mjs (אותם נתונים כמו העיצוב). כתיבות (POST/PUT/DELETE) מצליחות ונרשמות ב-window.__calls.
import '../../app/globals.css';
import '../../app/design-overrides.css';
import '../../app/design-system.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import AttendancePage from '../../app/components/attendance/AttendancePage.js';
import { api } from './data.mjs';

const q = new URLSearchParams(location.search);
const role = q.get('role') || 'mgr';
const scn = q.get('scn') || '';
const j = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
window.__calls = [];
const realFetch = window.fetch.bind(window);
window.fetch = async (url, opts) => {
  const u = String(url);
  if (!u.startsWith('/api/')) return realFetch(url, opts);
  await new Promise((r) => setTimeout(r, scn === 'loading' ? 60000 : 20));
  window.__calls.push({ url: u, method: (opts && opts.method) || 'GET', body: opts && opts.body ? String(opts.body) : null });
  if (scn === 'unauth') return j({ error: 'יש להתחבר' }, 401);
  if (u.startsWith('/api/attendance-sheet')) { const r = api(u.split('?')[1] || '', role, scn); return r.__status ? j(r, r.__status) : j(r); }
  if (u.startsWith('/api/employees/') && u.includes('/shifts')) return j({ id: 'new', totalMinutes: 60 });
  if (u.startsWith('/api/pdf')) return j({ error: 'אין שרת PDF בבדיקה' }, 500);
  return j({});
};
const initial = { view: q.get('view') || undefined, empId: q.get('emp') || undefined };
createRoot(document.getElementById('root')).render(<AttendancePage mode={role === 'emp' ? 'self' : 'manager'} initial={initial} />);
