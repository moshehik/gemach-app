// הדף "ימי אי-פעילות" האמיתי (NonWorkingDaysPage + non-working-days.css + ה-CSS הגלובלי של האתר) בלי שרת ובלי DB.
// ה-API מדומה כאן (fetch): ?role=edit (ברירת מחדל, canEdit) | view (צפייה בלבד); ?state=few (ברירת מחדל) | empty;
// ?today=YYYY-MM-DD (ברירת מחדל: היום הישראלי של הדפדפן). שמירה (POST /api/settings) מתקבלת ומעדכנת את הערך המדומה.
import '../../app/globals.css';
import '../../app/design-overrides.css';
import '../../app/design-system.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import NonWorkingDaysPage from '../../app/components/nonWorkingDays/NonWorkingDaysPage.js';
import { isNonWorkingDay } from '../../lib/businessDays.js';
import { getIsraelTodayKey, addDaysToDateKey } from '../../lib/hebrewDate.js';

const sp = new URLSearchParams(location.search);
const today = sp.get('today') || getIsraelTodayKey();
const canEdit = sp.get('role') !== 'view';
// כמו applyState('few') בעיצוב: ימי עבודה פתוחים מהיום, וסימונים על השלישי / הרביעי / העשירי, ושני תאריכים קבועים
const open = []; for (let d = today; open.length < 40; d = addDaysToDateKey(d, 1)) if (!isNonWorkingDay(d, null)) open.push(d);
let value = sp.get('state') === 'empty' ? '' : JSON.stringify({ version: 2,
  days: [{ date: open[2], note: 'סגור לרגל אירוע משפחתי' }, { date: open[3] }, { date: open[9], note: 'הדברה בסניף' }],
  ranges: [], recurringHebrew: [{ month: 'Shvat', day: 26, note: 'יום זיכרון משפחתי' }, { month: 'Cheshvan', day: 5, note: 'אירוע שנתי בסניף' }] });
const rv = (n) => { let a = (n * 2654435761) >>> 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
window.fetch = async (url, opts = {}) => {
  const u = new URL(url, location.href);
  if (u.pathname === '/api/non-working-days') return json({ key: 'non_working_days_extra', name: 'ימים ללא פעילות (רשימת הבעלים)', value, today, canEdit });
  if (u.pathname === '/api/non-working-days/activity') {
    const days = {}; let d = u.searchParams.get('from'); const to = u.searchParams.get('to');
    for (; d <= to; d = addDaysToDateKey(d, 1)) { const r = rv(Date.parse(d) / 864e5); if (r >= 0.35) { const ev = 1 + Math.floor(r * 5); days[d] = { events: ev, deliveries: Math.floor(ev * 0.6) }; } }
    return json({ days });
  }
  if (u.pathname === '/api/settings' && opts.method === 'POST') { value = JSON.parse(opts.body)[0].value; window.__saved = value; return json({ ok: true }); }
  return json({ error: 'not mocked' }, 404);
};
createRoot(document.getElementById('root')).render(<NonWorkingDaysPage />);
