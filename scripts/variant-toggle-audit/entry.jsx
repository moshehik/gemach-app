// בדיקת התצוגה של אייקון המעבר "ישן / חדש" (PageVariantToggle) על הדפים האמיתיים - בגרסה החדשה ובישנה - עם API מדומה,
// בלי DB ובלי שרת פיתוח. ?scn= אחד מ-SCENARIOS; ?allow=0 = משתמש שאינו רשאי להחליף; ?path= דורס את הנתיב (למשל /punch-clock).
// קריאות ה-API נרשמות ב-sessionStorage('pvt-calls') כדי שיישרדו את הטעינה מחדש אחרי לחיצה על האייקון.
import '../../app/globals.css';
import '../../app/design-overrides.css';
import '../../app/design-system.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { UiVariantProvider } from '../../app/components/UiVariantContext.js';
import VariantFrame from '../../app/components/variant/VariantFrame.js';
import ProfilePage from '../../app/components/profile/ProfilePage.js';
import LegacyProfilePage from '../../app/profile/LegacyProfilePage.js';
import AdminHubPage from '../../app/components/admin-hub/AdminHubPage.js';
import LegacyAdminPage from '../../app/admin/LegacyAdminPage.js';
import AttendancePage from '../../app/components/attendance/AttendancePage.js';
import LegacyMyHoursPage from '../../app/my-hours/LegacyMyHoursPage.js';
import ErrorReportButton from '../../app/components/ErrorReportButton.js';
import { selectHub, accessForRole } from '../../lib/adminHubCatalog.js';
import { api as attApi } from '../attendance-bg-audit/data.mjs';

const q = new URLSearchParams(location.search);
const scn = q.get('scn') || 'profile-new';
const allow = q.get('allow') !== '0';
const hub = selectHub(accessForRole(0), { nedarimEnabled: true });

const SCENARIOS = {
  'profile-new': { path: '/profile', screen: 'profile', v: 'a5', el: () => <ProfilePage /> },
  'profile-old': { path: '/profile', screen: 'profile', v: 'legacy', el: () => <LegacyProfilePage /> },
  'admin-new': { path: '/admin', screen: 'admin_hub', v: 'a5', el: () => <AdminHubPage tools={hub.tools} categories={hub.categories} userKey="emp-0" /> },
  'admin-old': { path: '/admin', screen: 'admin_hub', v: 'legacy', el: () => <LegacyAdminPage /> },
  'att-new': { path: '/my-hours', screen: 'attendance', v: 'a5', el: () => <AttendancePage mode="self" initial={{}} /> },
  'att-old': { path: '/my-hours', screen: 'attendance', v: 'legacy', el: () => <LegacyMyHoursPage /> },
  'att-emp': { path: '/employees/e1/attendance', screen: 'attendance', v: 'a5', el: () => <AttendancePage mode="manager" initial={{ view: 'emp', empId: 'e1' }} /> },
  'er-new': { path: '/orders', screen: 'error_report', v: 'a5', el: () => <ErrorReportButton />, noFrame: true },
  'er-old': { path: '/orders', screen: 'error_report', v: 'legacy', el: () => <ErrorReportButton />, noFrame: true },
};
const S = SCENARIOS[scn];
window.__PATH = q.get('path') || S.path;

const j = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const log = (c) => { try { const a = JSON.parse(sessionStorage.getItem('pvt-calls') || '[]'); a.push(c); sessionStorage.setItem('pvt-calls', JSON.stringify(a)); } catch { /* */ } };
const realFetch = window.fetch.bind(window);
const PROFILE = { id: 'e1', firstName: 'שרה', lastName: 'כהן', fullName: 'שרה כהן', phone1: '052-345-6789', email: 'sara@example.com', city: 'ירושלים', street: 'הנביאים', houseNum: '14', receiveEmailAlerts: true, profileImage: '', department: { name: 'מכירות' } };
window.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (!u.startsWith('/api/')) return realFetch(url, opts);
  await new Promise((r) => setTimeout(r, 20));
  const method = opts.method || 'GET';
  log({ url: u, method, body: opts.body ? String(opts.body) : null });
  if (u.startsWith('/api/me/ui-variant/')) return j({ success: true });
  if (u.startsWith('/api/me/profile')) return j(PROFILE);
  if (u.startsWith('/api/me/auto-clock-in')) return j({ success: true, enabled: false, employeeId: 'e1' });
  if (u.startsWith('/api/me/shifts')) return j({ success: true, shifts: [{ id: 's1', date: new Date().toISOString(), entryTime: new Date(Date.now() - 4 * 3600e3).toISOString(), exitTime: new Date().toISOString(), totalMinutes: 240 }] });
  if (u.startsWith('/api/settings')) return j([]);
  if (u.startsWith('/api/attendance-sheet')) { const r = attApi(u.split('?')[1] || '', scn === 'att-emp' ? 'mgr' : 'emp', ''); return r.__status ? j(r, r.__status) : j(r); }
  if (u.startsWith('/api/error-report')) return j({ success: true, reports: [], isProgrammer: false, isManager: true });
  if (u.startsWith('/api/agent/fix-loop')) return j({ success: true, enabled: false });
  return j({});
};

const values = { shell: 'legacy', [S.screen]: S.v };
const page = S.el();
createRoot(document.getElementById('root')).render(
  <UiVariantProvider value={values} canSelfSwitch={allow}>
    {S.noFrame ? page : <VariantFrame screen={S.screen} variant={S.v}>{page}</VariantFrame>}
  </UiVariantProvider>,
);
