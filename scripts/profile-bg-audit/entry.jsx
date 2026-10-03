// הדף האמיתי של "הפרופיל שלי" (ProfilePage + profile.css + כל ה-CSS הגלובלי של האתר) עם API מדומה - בלי DB, בלי שרת פיתוח.
// תרחישים לפי ?scn=: photo (תמונת פרופיל), noimg (ההגדרה כבויה), loading, unauth (401), saveerr (שמירה נכשלת), pwerr (שינוי סיסמה נכשל).
import '../../app/globals.css';
import '../../app/design-overrides.css';
import '../../app/design-system.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import ProfilePage from '../../app/components/profile/ProfilePage.js';

const scn = new URLSearchParams(location.search).get('scn') || '';
const SAMPLE = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bcc2c8"/><stop offset="1" stop-color="#7fb8e6"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/><circle cx="32" cy="25" r="11" fill="#0f2c52"/><path d="M10 64c2-16 12-22 22-22s20 6 22 22z" fill="#0f2c52"/></svg>');
const PROFILE = { id: 'e1', firstName: 'שרה', lastName: 'כהן', fullName: 'שרה כהן', joinDate: '2021-03-15T12:00:00.000Z', phone1: '052-345-6789', phone2: '02-123-4567', email: 'sara.cohen@example.com', city: 'ירושלים', street: 'הנביאים', houseNum: '14', receiveEmailAlerts: true, profileImage: scn === 'photo' ? SAMPLE : '', department: { name: 'מכירות' } };
const j = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
window.__calls = [];
const realFetch = window.fetch.bind(window);
window.fetch = async (url, opts) => {
  const u = String(url);
  await new Promise((r) => setTimeout(r, scn === 'loading' && u.includes('/api/me/profile') ? 60000 : 30));
  if (!u.startsWith('/api/')) return realFetch(url, opts);
  window.__calls.push({ url: u, method: (opts && opts.method) || 'GET', body: opts && opts.body ? String(opts.body).replace(/"(oldPassword|newPassword)":"[^"]*"/g, '"$1":"<redacted>"') : null });
  if (u.startsWith('/api/me/profile')) {
    if (scn === 'unauth') return j({ error: 'x' }, 401);
    if (opts && opts.method === 'PUT') return scn === 'saveerr' ? j({ success: false, error: 'כתובת המייל אינה תקינה' }) : j({ success: true });
    return j(PROFILE);
  }
  if (u.startsWith('/api/settings')) return j([{ key: 'show_employee_profile_image', value: scn === 'noimg' ? 'false' : 'true' }]);
  if (u.startsWith('/api/me/auto-clock-in')) return j({ success: true, enabled: false, employeeId: 'e1' });
  if (u.includes('/password')) return scn === 'pwerr' ? j({ success: false, message: 'הסיסמא הישנה שגויה' }) : j({ success: true });
  return j({});
};
createRoot(document.getElementById('root')).render(<ProfilePage />);
