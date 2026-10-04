// הדף האמיתי של הלו״ז (ScheduleDay + schedule.css + הפלטה + כל ה-CSS הגלובלי של האתר) עם API מדומה - בלי DB, בלי שרת פיתוח.
// אותו סדר טעינת CSS כמו באתר: globals -> design-overrides -> design-system -> (layout של /schedule:) components.css -> schedule.css.
import '../../app/globals.css';
import '../../app/design-overrides.css';
import '../../app/design-system.css';
import '../../design-system/components.css';
import '../../app/schedule/schedule.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import ScheduleDay from '../../app/components/schedule/ScheduleDay.js';

// מצב ההדמיה: stages.mjs מעביר אותו ב-hash של הכתובת (#m=<json>) לפני כל טעינה
let fromHash = {};
try { const h = new URLSearchParams(location.hash.slice(1)); if (h.get('m')) fromHash = JSON.parse(h.get('m')); } catch { /* בלי hash - ברירות מחדל */ }
// marks: טבלת הסימונים קיימת (ברירת מחדל - כמו בשני ה-DB); canMark: הרשאת סימון (false = אורח במצב פתוח)
window.__mock = Object.assign({ today: '2026-10-04', err: 0, delay: 30, mgmt: true, branches: false, truncated: false, marks: true, canMark: true }, fromHash);
const M = window.__mock;
const MARKS_ON = M.marks !== false;

const pad = (n) => String(n).padStart(2, '0');
const addDays = (key, n) => { const [y, m, d] = key.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };
const dow = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
const FN = ['מרים', 'שרה', 'רחל', 'לאה', 'חנה', 'אסתר', 'דבורה', 'רבקה', 'שושנה', 'יעל', 'תמר', 'נעמי'];
const LN = ['אברמוביץ', 'לוי', 'כהן', 'פרידמן', 'גולדברג', 'שפירא', 'מזרחי', 'ישראלי', 'בן דוד', 'גרין'];
const CITIES = ['ירושלים', 'בית שמש', 'בני ברק', 'ביתר עילית', 'אלעד'];
const STREETS = ['הרב קוק 12', 'הנביאים 8', 'בן יהודה 3', 'רבי עקיבא 45'];
const STAGES = [
  { key: 'order', number: 1, label: 'הזמנה', plural: 'הזמנות', infoOnly: true, doneSource: null, showModel: true, showAddress: false },
  { key: 'repair', number: 2, label: 'תיקונים', plural: 'תיקונים', infoOnly: false, doneSource: 'alterationDone', showModel: true, showAddress: false },
  { key: 'prep', number: 4, label: 'הכנה', plural: 'הכנות', infoOnly: false, doneSource: null, showModel: true, showAddress: false },
  { key: 'dout', number: 5, label: 'משלוח הלוך', plural: 'משלוחי הלוך', infoOnly: false, doneSource: null, showModel: false, showAddress: true },
  { key: 'pick', number: 6, label: 'איסוף מקומי', plural: 'איסופים מקומיים', infoOnly: false, doneSource: 'isTaken', showModel: true, showAddress: false },
  { key: 'event', number: 7, label: 'אירוע', plural: 'אירועים', infoOnly: true, doneSource: null, showModel: true, showAddress: false },
  { key: 'manret', number: 8, label: 'החזרה ידנית', plural: 'החזרות ידניות', infoOnly: false, doneSource: 'isReturned', showModel: false, showAddress: true },
  { key: 'dback', number: 9, label: 'משלוח חזור', plural: 'משלוחי חזור', infoOnly: false, doneSource: null, showModel: false, showAddress: true },
];
const HEB = { '2026-10-02': 'כ״א תשרי תשפ״ז', '2026-10-03': 'כ״ב תשרי תשפ״ז', '2026-10-04': 'כ״ג תשרי תשפ״ז' };
const hebOf = (key) => HEB[key] || ('כ״ה תשרי תשפ״ז');

function row(stage, i, kind) {
  const id = 50000 + i * 7 + stage.number;
  const name = FN[(i * 3 + stage.number) % FN.length] + ' ' + LN[(i * 5 + stage.number) % LN.length];
  const past = kind === 'past';
  const future = kind === 'future';
  const src = stage.doneSource || (MARKS_ON ? 'mark' : null); // מקור "בוצע": שדה קיים או טבלת הסימונים
  const items = [{ orderItemId: 'it' + id, model: 'שמלת ערב "ורד"', modelPrefix: '4512', size: '38', location: i % 2 ? 'מדף 3' : '', inRepair: i % 4 === 0 }];
  const dressCount = 1 + (i % 3 === 0 ? 1 : 0);
  const r = {
    orderId: id, stage: stage.key, customer: { name, firstName: name.split(' ')[0], lastName: name.split(' ')[1], phone1: '052-' + (4000000 + i * 1111), phone2: i % 3 ? '' : '02-6543210' },
    eventDate: '2026-10-05T21:00:00.000Z', eventKey: '2026-10-06', eventDateHebrew: 'כ״ה תשרי תשפ״ז', dressCount, branch: M.branches ? (i % 2 ? 'נווה יעקב' : 'בית שמש') : '', pickupBranch: '',
    flags: { isAbroad: i % 5 === 0, extraDay: i % 7 === 0 ? 'before' : null, customSpacing: null },
    notes: i % 2 ? 'להתקשר לפני' : '', internalNotes: M.mgmt && i % 3 === 0 ? 'הנחה מיוחדת אושרה' : undefined,
    done: stage.infoOnly ? null : (src ? (past ? i % 6 !== 0 : (!future && i % 3 === 0)) : null), doneSource: stage.doneSource, alerts: [],
  };
  // כמו applyMarksToRows (lib/schedule/marks.js): מי סימן ומתי, הרשאת סימון לשורה
  if (!stage.infoOnly && src) Object.assign(r, { doneVia: r.done ? (stage.doneSource || 'mark') : null, doneBy: r.done && !stage.doneSource ? 'רחלי לוי' : null, doneAt: r.done ? '2026-10-04T07:12:00.000Z' : null, outcome: null, canMark: M.canMark !== false });
  if (!stage.infoOnly && src && past && r.done === false) r.alerts.push({ code: 'late_not_done', label: 'באיחור - לא סומן כבוצע', daysLate: stage.key === 'manret' ? 9 : 7 });
  if (stage.key === 'order') Object.assign(r, { orderDate: '2026-10-02T06:00:00.000Z', registeredBy: 'רחלי', totalAmount: 1200 + i * 50, isPaid: i % 2 === 0 });
  if (stage.key === 'repair') r.items = items.map((it) => ({ ...it, neckAlteration: 1, lengthAlteration: i % 2 ? '3' : '', sleeveAlteration: 0, done: r.done, taken: false, returned: false }));
  if (stage.key === 'prep' || stage.key === 'event') r.items = items;
  if (stage.key === 'pick') { r.items = items.map((it) => ({ ...it, taken: r.done })); r.pickupBranch = M.branches ? 'נווה יעקב' : ''; }
  if (stage.key === 'dout' || stage.key === 'dback') {
    const missing = i % 4 === 1;
    r.address = missing ? { street: '', city: CITIES[i % CITIES.length], full: '' } : { street: STREETS[i % STREETS.length], city: CITIES[i % CITIES.length], full: '' };
    if (missing) r.alerts.push({ code: 'missing_delivery_address', label: 'חסרה כתובת משלוח' });
    r.dispatchDate = '2026-10-04T21:00:00.000Z'; r.chargeExists = i % 2 === 0;
    if (stage.key === 'dback') r.returnCondition = past ? (i % 5 === 0 ? 'not_ok' : 'ok') : null;
  }
  if (stage.key === 'manret') Object.assign(r, { address: { street: STREETS[i % STREETS.length], city: CITIES[i % CITIES.length], full: '' }, takenCount: dressCount, returnedCount: r.done ? dressCount : 0, returnCondition: r.done ? (i % 5 === 0 ? 'not_ok' : 'ok') : null, dueKey: '2026-10-07', dueKeyRaw: '2026-10-07' });
  return r;
}

function mkDay(key) {
  const today = M.today;
  const nonWorking = dow(key) === 6 || dow(key) === 5;
  const empty = key === addDays(today, 5) || nonWorking;
  const kind = key < today ? 'past' : key > today ? 'future' : 'today';
  const stages = STAGES.map((s) => {
    const n = empty ? 0 : (kind === 'future' ? 2 : (s.key === 'repair' ? 3 : s.key === 'event' ? 10 : 4));
    const items = Array.from({ length: n }, (_, i) => row(s, i + s.number, kind));
    const done = items.filter((r) => r.done === true).length;
    const src = s.doneSource || (MARKS_ON ? 'mark' : null);
    const unknown = s.infoOnly || !src ? items.length : 0;
    return { ...s, what: '', enabled: true, offsetBusinessDays: 0, shift: s.key === 'dout' ? 'am' : 'none', shiftLabel: s.key === 'dout' ? 'בוקר' : '',
      counts: { total: items.length, done, pending: src ? items.length - done : 0, unknown, alerts: items.filter((r) => r.alerts.length).length }, items };
  });
  return {
    date: key, dateHebrew: hebOf(key), weekday: ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'][dow(key)], isToday: key === today, today, tomorrow: addDays(today, 1),
    nonWorkingDay: nonWorking, dayStatus: nonWorking ? { working: false, reasons: [dow(key) === 6 ? 'shabbat' : 'friday'], titles: [], note: null } : { working: true, reasons: [], titles: [], note: null },
    generatedAt: new Date().toISOString(),
    settings: { deliveriesEnabled: true, alterationsEnabled: true, branchesEnabled: !!M.branches, branches: M.branches ? ['נווה יעקב', 'בית שמש'] : [], branchFilter: null, lateReturnThresholdDays: 7, pickupHours: '20:00-21:30', deliveryDaysBefore: 1, deliveryDaysAfter: 1, includeInternalNotes: !!M.mgmt },
    staff: M.mgmt ? [{ employeeId: 'e1', name: 'רחלי לוי', entryTime: '2026-10-02T06:00:00.000Z', exitTime: null, open: true }] : [],
    marks: { available: MARKS_ON, canMark: MARKS_ON && M.canMark !== false, canMarkAll: MARKS_ON && M.canMark !== false && !!M.mgmt },
    stages, totals: { total: 0, done: 0, pending: 0, unknown: 0, alerts: 0 }, truncated: !!M.truncated, warnings: [],
  };
}

const j = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const realFetch = window.fetch.bind(window);
window.fetch = async (url, opts) => {
  const u = String(url);
  if (!u.includes('/api/schedule')) return realFetch(url, opts);
  await new Promise((r) => setTimeout(r, M.delay));
  if (M.err) return j({ error: M.err === 403 ? 'Forbidden' : 'שגיאה פנימית' }, M.err);
  // POST /api/schedule/marks (lib/schedule/marks.js): מחזיר את הטלאי של השורה / השורות כמו השרת
  if (u.includes('/api/schedule/marks')) {
    if (!MARKS_ON) return j({ error: 'סימון "בוצע" עדיין לא זמין' }, 503);
    let b = {};
    try { b = JSON.parse(opts && opts.body || '{}'); } catch { /* ריק */ }
    const now = new Date().toISOString();
    const patch = (orderId, done, outcome) => ({ orderId, stage: b.stageKey, done, doneVia: done ? 'mark' : null, doneBy: done ? 'רחלי לוי' : null, doneAt: done ? now : null, outcome: done ? outcome || null : null, ...(done && outcome ? { returnCondition: outcome } : {}), alerts: [], canMark: true });
    if (b.action === 'mark_all') return j({ rows: (b.orderIds || []).map((id) => patch(id, true, 'ok')), counts: { marked: (b.orderIds || []).length }, skipped: [] });
    return j({ row: patch(b.orderId, b.action === 'mark', b.outcome) });
  }
  const sp = new URL(u, location.origin).searchParams;
  return j(mkDay(sp.get('date') || M.today));
};
createRoot(document.getElementById('root')).render(<ScheduleDay />);
