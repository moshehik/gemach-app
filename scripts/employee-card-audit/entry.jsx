// כרטיס העובד האמיתי (EmployeeCardA5 + employee-card.css + כל ה-CSS הגלובלי של האתר) עם API מדומה - בלי DB ובלי שרת פיתוח.
// הנתונים = העובדת של העיצוב המאושר (אסתר גולד, משמרות ספטמבר-אוקטובר 2026, 7 תיעודי היסטוריה) כדי שההשוואה מול כרטיס-עובד-ניהול.html
// תהיה אחד-לאחד. תרחישים לפי ?scn=: '' (עובד קיים, כרטיס של עצמי), new (עובד חדש), deptfail (רשימת מחלקות לא נטענה), deptslow
// (מחלקות בטעינה), mgr (כרטיס של עובד אחר: סיסמת מנהל), savefail (שמירה נכשלת), noimg (תמונת פרופיל כבויה).
import '../../app/globals.css';
import '../../app/design-overrides.css';
import '../../app/design-system.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import EmployeeCardA5 from '../../app/components/employee-card/EmployeeCardA5.js';
import { PERMISSION_CATALOG, defaultValueForRoleId } from '../../lib/permissionsMetadata.js';
import { hebFull } from '../../app/components/attendance/parts.js';

const scn = new URLSearchParams(location.search).get('scn') || '';
const EID = scn === 'new' ? 'new' : 'emp-1';
const SAMPLE = {
  id: 'emp-1', firstName: 'אסתר', lastName: 'גולד', fullName: 'אסתר גולד', joinDate: '2021-03-15T00:00:00.000Z', phone1: '052-345-6789', phone2: '02-123-4567', email: 'esther.gold@example.com',
  city: 'ירושלים', street: 'הנביאים', houseNum: '14', roleId: 3, notes: 'משמרות בוקר', hourlyWage: 40, paymentMethod: 'העברה בנקאית', travelExpenses: true, isActive: true, receiveEmailAlerts: true, password: '', profileImage: '',
};
const mins = (en, ex) => {
  if (!en || !ex) return null;
  const [h1, m1] = en.split(':').map(Number);
  const [h2, m2] = ex.split(':').map(Number);
  let d = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (d < 0) d += 1440;
  return d;
};
let SID = 100;
const SHIFTS = [];
const addSh = (date, en, ex, notes, del) => {
  const mn = mins(en, ex);
  SHIFTS.push({
    id: `s${++SID}`, date: `${date}T00:00:00.000Z`, hebrewDate: '',
    entryTime: en ? new Date(`${date}T${en}:00+03:00`).toISOString() : null, exitTime: ex ? new Date(`${date}T${ex}:00+03:00`).toISOString() : null,
    totalMinutes: mn, totalCalculated: mn == null ? null : parseFloat(((mn / 60) * 40).toFixed(2)), notes: notes || '', isDeleted: !!del,
  });
};
for (let d = 1; d <= 30; d++) {
  const iso = `2026-09-${String(d).padStart(2, '0')}`;
  const dow = new Date(`${iso}T12:00:00`).getDay();
  if (dow === 6 || d === 13 || d === 21) continue;
  addSh(iso, `08:${['00', '15', '30'][d % 3]}`, dow === 5 ? '13:00' : ['16:00', '16:30'][d % 2], d === 8 ? 'החלפה במשמרת של מיכל' : '');
}
addSh('2026-10-01', '08:00', '16:30', '');
addSh('2026-10-01', '17:30', null, '');
addSh('2026-10-02', '08:30', '13:00', '');
addSh('2026-10-02', '10:00', '11:00', 'נרשם בטעות', true);
const J = JSON.stringify;
const LOGS = [
  { id: 'h1', entityType: 'Employee', action: 'UPDATE', employeeName: 'שרה לוי', t: '2026-09-28T10:42', changes: { hourlyWage: { from: 38, to: 40 }, travelExpenses: { from: false, to: true } } },
  { id: 'h2', entityType: 'Shift', action: 'UPDATE', employeeName: 'שרה לוי', t: '2026-09-24T17:05', changes: { exitTime: { from: '16:00', to: '16:30' } } },
  { id: 'h3', entityType: 'Shift', action: 'CREATE', employeeName: 'שרה לוי', t: '2026-09-22T09:12', changes: { date: '2026-09-22', hebrewDate: hebFull('2026-09-22'), entryTime: '08:15', exitTime: '16:00', notes: 'נוספה ידנית' } },
  { id: 'h4', entityType: 'Employee', action: 'EMAIL_SENT', employeeName: 'רחל כהן', t: '2026-09-15T13:20', changes: { subject: 'שעות עבודה לחגים', to: 'esther.gold@example.com', cc: '', body: 'שלום אסתר,\nמצורף לוח המשמרות לחגים.\nתודה.', sendMode: 'email' } },
  { id: 'h5', entityType: 'Shift', action: 'DELETE', employeeName: 'דנה אברהם', t: '2026-09-02T08:55', changes: { date: '2026-09-02', hebrewDate: hebFull('2026-09-02'), entryTime: '08:00', exitTime: null } },
  { id: 'h6', entityType: 'Employee', action: 'UPDATE', employeeName: 'דנה אברהם', t: '2026-08-30T11:30', changes: { phone1: { from: '052-345-0000', to: '052-345-6789' }, email: { from: '', to: 'esther.gold@example.com' } } },
  { id: 'h7', entityType: 'Employee', action: 'CREATE', employeeName: 'דנה אברהם', t: '2021-03-15T09:00', changes: { firstName: 'אסתר', lastName: 'גולד', phone1: '052-345-0000', roleId: 3, hourlyWage: 32, isActive: true } },
].map((l) => ({
  id: l.id, entityType: l.entityType, entityId: 'emp-1', action: l.action, changesJson: J(l.changes),
  createdAt: new Date(`${l.t}:00+0${l.t < '2021-03-26' ? 2 : 3}:00`).toISOString(), employeeId: 'a1', employeeName: l.employeeName,
}));
const DEPTS = [{ roleId: 0, name: 'הנהלה ראשית' }, { roleId: 1, name: 'מנהלת סניף' }, { roleId: 2, name: 'מתכנת' }, { roleId: 3, name: 'מכירות' }, { roleId: 4, name: 'תפירה' }];
const MGRS = [
  { id: 'm1', firstName: 'שרה', lastName: 'לוי', roleId: 1, isActive: true, approvals: { 'feature:customer_email_approval': true }, department: { name: 'מנהלת' } },
  { id: 'm2', firstName: 'רחל', lastName: 'כהן', roleId: 1, isActive: true, approvals: { 'feature:customer_email_approval': true }, department: { name: 'מנהלת סניף' } },
  { id: 'm3', firstName: 'דנה', lastName: 'אברהם', roleId: 2, isActive: true, approvals: { 'feature:customer_email_approval': true }, department: { name: 'הנהלה ראשית' } },
];
const OVER = { 'feature:ai': true, 'page:alterations': true, 'page:board': true };
const LISTED = ['page:orders', 'page:orders_new', 'page:customers', 'page:rentals', 'page:schedule'];
const OTHER = ['feature:debt_approval', 'feature:payment_exit_approval', 'feature:manual_payment_credit_add', 'feature:item_change_approval'];
const permItems = PERMISSION_CATALOG.map((item) => {
  const dd = defaultValueForRoleId(item, 3, {});
  const ov = OVER[item.key];
  let rows = [];
  if (LISTED.includes(item.key)) rows = [{ id: 'r1', name: 'צוות מכירות', itemCount: 5, employeeListed: true }];
  else if (OTHER.includes(item.key)) rows = [{ id: 'r2', name: 'אישורי מנהלת', itemCount: 4, employeeListed: false }];
  return {
    key: item.key, departmentDefault: dd, rows, locked: !!item.notConfigurable, alwaysAllowed: false,
    override: ov === undefined ? null : { value: ov, note: '', updatedAt: '2026-09-01T00:00:00.000Z', fromRow: false }, effective: ov === undefined ? dd : ov,
  };
});
const j = (o, status = 200) => new Response(J(o), { status, headers: { 'Content-Type': 'application/json' } });
window.__calls = [];
const realFetch = window.fetch.bind(window);
window.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (!u.startsWith('/api/')) return realFetch(url, opts);
  const method = opts.method || 'GET';
  window.__calls.push({ url: u, method, body: opts.body ? String(opts.body).replace(/"(pin|authPin|password|oldPassword|newPassword|managerPassword)":"[^"]*"/g, '"$1":"<redacted>"').slice(0, 400) : null });
  await new Promise((r) => setTimeout(r, 20));
  if (u.startsWith('/api/departments')) {
    if (scn === 'deptfail') return j({ error: 'x' }, 500);
    if (scn === 'deptslow') await new Promise((r) => setTimeout(r, 60000));
    return j(DEPTS);
  }
  if (u.startsWith('/api/settings')) return j(scn === 'noimg' ? [{ key: 'show_employee_profile_image', value: 'false' }] : []);
  if (u.startsWith('/api/me')) return j({ success: true, employee: { id: scn === 'mgr' ? 'm3' : 'emp-1', firstName: 'אסתר', lastName: 'גולד', roleId: scn === 'mgr' ? 2 : 3 } });
  if (u.startsWith('/api/admin/permissions/employees/')) return j({ employeeId: 'emp-1', roleId: 3, items: permItems });
  if (u.startsWith('/api/employees/emp-1/history')) return j(LOGS);
  if (u.startsWith('/api/employees/emp-1/shifts')) return j({ success: true });
  if (u.startsWith('/api/employees/emp-1/')) return j({ success: true, message: 'בוצע' });
  if (u.startsWith('/api/employees/emp-1')) {
    if (method === 'PUT') return scn === 'savefail' ? j({ error: 'אין הרשאה' }, 403) : j({ success: true, ...JSON.parse(opts.body) });
    return j({ ...SAMPLE, shifts: SHIFTS });
  }
  if (u === '/api/employees' && method === 'POST') return j({ id: 'emp-1' });
  if (u.startsWith('/api/employees')) return j(MGRS);
  if (u.startsWith('/api/send-email')) return j({ success: true, driveLinks: [] });
  return j({});
};
createRoot(document.getElementById('root')).render(<EmployeeCardA5 employeeId={EID} />);
