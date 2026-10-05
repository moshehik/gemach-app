// נתוני הדוגמה של העיצוב המאושר (תצוגות-עיצוב/סיכום-נוכחות.html: EMPS / shiftsOf / seedHist) בצורה של GET /api/attendance-sheet,
// כדי שהדף האמיתי יוצג על אותם נתונים כמו העיצוב ויהיה אפשר להשוות סגנונות שורה מול שורה. "היום" = 4.10.2026 כמו בעיצוב.
import { israelTimeToIso, aggregate, monthsFromShifts, sortShifts, shapeHistory } from '../../lib/attendance/summary.js';
import { buildAttendancePrintPayload } from '../../lib/attendance/print.js';

export const TODAY = '2026-10-04';
const CUR = { y: 2026, m: 9 };
const PREV = { y: 2026, m: 8 };
const FIRST = { y: 2025, m: 0 };
const pad = (n) => (n < 10 ? '0' : '') + n;
const fromIso = (s) => { const p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); };
const addDays = (iso, n) => { const d = fromIso(iso); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
export const EMPS = [
  { id: 'e1', fn: 'שרה', ln: 'כהן', dept: 'ניהול', wage: 62, travel: 0, p: 0.78 },
  { id: 'e2', fn: 'רחל', ln: 'לוי', dept: 'מכירות', wage: 42, travel: 20, p: 0.8 },
  { id: 'e3', fn: 'מרים', ln: 'אברמוביץ', dept: 'מכירות', wage: 40, travel: 20, p: 0.72 },
  { id: 'e4', fn: 'לאה', ln: 'פרידמן', dept: 'תפירות', wage: 45, travel: 0, p: 0.76 },
  { id: 'e5', fn: 'חנה', ln: 'גולדברג', dept: 'תפירות', wage: 46, travel: 15, p: 0.7 },
  { id: 'e6', fn: 'אסתר', ln: 'שפירא', dept: 'משלוחים', wage: 44, travel: 0, p: 0.6 },
  { id: 'e7', fn: 'דבורה', ln: 'מזרחי', dept: 'מכירות', wage: 41, travel: 20, p: 0.74 },
  { id: 'e8', fn: 'רבקה', ln: 'ישראלי', dept: 'משלוחים', wage: 43, travel: 25, p: 0.55 },
  { id: 'e9', fn: 'נעמי', ln: 'בן דוד', dept: 'תפירות', wage: 48, travel: 0, p: 0.68 },
];
export const ME = 'e4';
const FORCE = { 'e4|2026-9': 'exit', 'e7|2026-9': 'entry', 'e7|2026-8': 'exit', 'e2|2026-9': 'exit' };
const full = (e) => e.fn + ' ' + e.ln;
const empOf = (id) => EMPS.find((e) => e.id === id);
function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const cache = {};
function demoShifts(emp, y, m) {
  const key = emp.id + '|' + y + '-' + m;
  if (cache[key]) return cache[key];
  const r = rng(hash(key)); const out = []; const dim = new Date(y, m + 1, 0).getDate();
  for (let d = 1; d <= dim; d++) {
    const iso = y + '-' + pad(m + 1) + '-' + pad(d); if (iso > TODAY) break; const wd = fromIso(iso).getDay(); if (wd === 6) continue;
    const p = wd === 5 ? 0.22 : emp.p; if (r() > p) continue;
    const entry = wd === 5 ? 480 + 15 * Math.floor(r() * 7) : 450 + 15 * Math.floor(r() * 13);
    const dur = wd === 5 ? 210 + 5 * Math.floor(r() * 30) : 300 + 5 * Math.floor(r() * 80);
    const pay = Math.round(((dur / 60) * emp.wage + emp.travel) * 100) / 100;
    out.push({ id: emp.id + '-' + iso, date: iso, entry, exit: entry + dur, mins: dur, pay, travel: emp.travel, notes: '', del: false });
  }
  if (FORCE[key] && out.length > 5) { const s = out[4]; if (FORCE[key] === 'exit') s.exit = null; else s.entry = null; s.mins = 0; s.pay = 0; }
  if (key === 'e4|2026-8' && out.length > 5) { out[2].notes = 'החלפה במשמרת של מיכל'; const d = out[3].date; out.splice(4, 0, { id: 'e4-x1', date: d, entry: 17 * 60 + 30, exit: 18 * 60 + 30, mins: 60, pay: 45, travel: 0, notes: 'נרשם בטעות', del: true }); }
  if ((key === 'e1|2026-8' || key === 'e4|2026-8') && out.length > 5) {
    const b = out.slice(0, 4).filter((s) => s.exit != null && !s.del).sort((p, q) => p.exit - q.exit)[0];
    const en = b.exit + 45; const ex = en + 90;
    out.splice(out.indexOf(b) + 1, 0, { id: b.id + '-b', date: b.date, entry: en, exit: ex, mins: ex - en, pay: Math.round(((ex - en) / 60) * emp.wage * 100) / 100, travel: 0, notes: 'משמרת ערב קצרה', del: false });
  }
  return (cache[key] = out);
}
const hhmm = (min) => (min == null ? null : pad(Math.floor(min / 60)) + ':' + pad(min % 60));
// ההיסטוריה (seedHist בעיצוב) כשורות AuditLog
const HIST = [];
function logH(e, s, act, before, o) {
  const at = israelTimeToIso(o.d, o.t);
  const id = 'h' + (HIST.length + 1);
  const en = (v) => (v == null ? null : israelTimeToIso(s.date, hhmm(v)));
  let changesJson;
  if (act === 'add') changesJson = JSON.stringify({ entryTime: en(s.entry), exitTime: en(s.exit) });
  else if (act === 'edit') changesJson = JSON.stringify({ entryTime: { from: en(before.en), to: en(s.entry) }, exitTime: { from: en(before.ex), to: en(s.exit) } });
  else changesJson = JSON.stringify({ isDeleted: { from: false, to: true } });
  HIST.push({ id, entityId: s.id, action: act === 'add' ? 'CREATE' : act === 'del' ? 'DELETE' : 'UPDATE', createdAt: at, employeeId: o.who === 'שרה כהן' ? 'e1' : 'e4', changesJson, emp: e.id, sdate: s.date });
}
(function seedHist() {
  const day = (iso, n) => { const x = addDays(iso, n); return x > TODAY ? TODAY : x; };
  const e1 = empOf('e1'); const e4 = empOf('e4');
  let L = demoShifts(e1, PREV.y, PREV.m); let base = L.filter((s) => !/-b$/.test(s.id) && !s.del);
  let x = L.find((s) => /-b$/.test(s.id)); if (x) logH(e1, x, 'add', null, { who: 'שרה כהן', d: day(x.date, 1), t: '09:12' });
  let s = base[6]; if (s && s.exit != null) logH(e1, s, 'edit', { en: s.entry, ex: null }, { who: 'שרה כהן', d: day(s.date, 1), t: '08:47' });
  L = demoShifts(e4, PREV.y, PREV.m); base = L.filter((q) => !/-b$/.test(q.id) && !q.del && q.entry != null && q.exit != null);
  x = L.find((q) => /-b$/.test(q.id)); if (x) logH(e4, x, 'add', null, { who: 'לאה פרידמן', d: x.date, t: '21:05' });
  s = base[0]; if (s) logH(e4, s, 'edit', { en: s.entry + 15, ex: s.exit }, { who: 'שרה כהן', d: day(s.date, 2), t: '10:30' });
  s = base[5]; if (s) logH(e4, s, 'edit', { en: s.entry, ex: null }, { who: 'לאה פרידמן', d: day(s.date, 1), t: '07:58' });
  x = L.find((q) => q.id === 'e4-x1'); if (x) { logH(e4, x, 'add', null, { who: 'לאה פרידמן', d: x.date, t: '18:40' }); logH(e4, x, 'del', null, { who: 'שרה כהן', d: day(x.date, 1), t: '09:03' }); }
})();
const NAMES = Object.fromEntries(EMPS.map((e) => [e.id, full(e)]));
function editOf(id) {
  const L = HIST.filter((h) => h.entityId === id && h.action !== 'DELETE');
  if (!L.length) return null;
  const last = L[L.length - 1];
  return { kind: L.every((h) => h.action === 'CREATE') ? 'added' : 'edited', at: last.createdAt, by: NAMES[last.employeeId] };
}
function apiShift(s, wages) {
  const o = { id: s.id, dayKey: s.date, hebrewDate: null, entryTime: s.entry == null ? null : israelTimeToIso(s.date, hhmm(s.entry)), exitTime: s.exit == null ? null : israelTimeToIso(s.date, hhmm(s.exit)), minutes: s.entry != null && s.exit != null ? s.mins : null, notes: s.notes, isDeleted: !!s.del, edit: editOf(s.id) };
  if (wages) { o.pay = s.pay || null; o.travel = s.entry != null && s.exit != null ? s.travel : 0; o.wage = empOf(s.id.split('-')[0]) ? empOf(s.id.split('-')[0]).wage : null; }
  return o;
}
const empOut = (e) => ({ id: e.id, name: full(e), firstName: e.fn, lastName: e.ln, dept: e.dept, isActive: true });
function monthShifts(e, y, m, { wages, deleted }) {
  return sortShifts(demoShifts(e, y, m).filter((s) => deleted || !s.del).map((s) => apiShift(s, wages)));
}
function allMonths(e, wages) {
  const sh = [];
  for (let k = CUR.y * 12 + CUR.m; k >= FIRST.y * 12 + FIRST.m; k--) sh.push(...monthShifts(e, Math.floor(k / 12), k % 12, { wages, deleted: false }));
  const ms = monthsFromShifts(sh);
  if (!wages) ms.forEach((mo) => { delete mo.pay; delete mo.travels; });
  return ms;
}

/** תשובת GET /api/attendance-sheet?<qs> לתפקיד role ('mgr' | 'emp'), scn: '' | 'empty' */
export function api(qs, role, scn) {
  const sp = new URLSearchParams(qs);
  const mgr = role !== 'emp';
  const viewer = { isManager: mgr, employeeId: mgr ? 'e1' : ME };
  const scope = sp.get('scope');
  const y = +sp.get('y'); const m = +sp.get('m');
  const empty = scn === 'empty';
  const empId = mgr ? (sp.get('emp') || 'e1') : ME;
  const e = empOf(empId);
  if (scope === 'month') return mgr ? { viewer, period: { y, m }, employees: EMPS.map((x) => ({ ...empOut(x), shifts: empty ? [] : monthShifts(x, y, m, { wages: true }) })) } : { __status: 403, error: 'אין הרשאה' };
  if (scope === 'employee') return { viewer, period: { y, m }, employee: empOut(e), shifts: empty ? [] : monthShifts(e, y, m, { wages: mgr, deleted: sp.get('deleted') === '1' }) };
  if (scope === 'months') return { viewer, employee: empOut(e), months: empty ? [] : allMonths(e, mgr), ...(mgr ? { employees: EMPS.map(empOut) } : {}) };
  if (scope === 'employees') return { viewer, employees: EMPS.map(empOut) };
  if (scope === 'totals') return { viewer, employees: EMPS.map((x) => { const ms = empty ? [] : allMonths(x, false); const T = ms.reduce((a, mo) => ({ minutes: a.minutes + mo.minutes, days: a.days + mo.days, shiftCount: a.shiftCount + mo.shiftCount, issues: a.issues + mo.issues }), { minutes: 0, days: 0, shiftCount: 0, issues: 0 }); return { ...empOut(x), months: ms.length, ...T }; }) };
  if (scope === 'history') {
    const sid = sp.get('shift');
    const entries = HIST.filter((h) => h.emp === empId && (!sid || h.entityId === sid)).slice().reverse().map((h) => shapeHistory(h, { wages: mgr, names: NAMES, shiftDayKey: h.sdate }));
    return { viewer, employee: empOut(e), entries };
  }
  if (scope === 'print') return printPayload(sp, role, scn);
  return { __status: 400, error: 'scope' };
}

export function printPayload(sp, role, scn) {
  const mgr = role !== 'emp';
  const wages = mgr && sp.get('wages') !== '0';
  const type = sp.get('type') || 'full';
  let ids = (sp.get('ids') || '').split(',').filter(Boolean);
  if (!mgr) ids = [ME];
  const now = new Date('2026-10-04T05:12:00Z');
  const meta = { gmach: { name: 'גמ״ח שמלות', address: 'רחוב הדוגמה 12, ירושלים', phone: '02-555-0100' }, printedBy: mgr ? 'שרה כהן' : 'לאה פרידמן', now };
  if (type === 'byemp') return buildAttendancePrintPayload({ type, wages, ...meta, monthsBy: (ids.length ? ids : EMPS.map((x) => x.id)).map((id) => ({ employee: empOut(empOf(id)), months: scn === 'empty' ? [] : allMonths(empOf(id), wages) })) });
  const y = +sp.get('y'); const m = +sp.get('m');
  const list = (ids.length ? ids : EMPS.map((x) => x.id)).map((id) => ({ ...empOut(empOf(id)), shifts: scn === 'empty' ? [] : monthShifts(empOf(id), y, m, { wages }) }));
  return buildAttendancePrintPayload({ type, period: { y, m }, wages, ...meta, employees: list });
}
export { aggregate };
