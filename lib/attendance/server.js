// lib/attendance/server.js — קריאות ה-DB של "סיכום נוכחות" (קריאה בלבד, בלי $transaction, בלי כתיבה).
// הנתיב היחיד שמשתמש בזה: app/api/attendance-sheet/route.js. ההרשאות: lib/attendance/access.js (טהור).
import prisma from '@/app/lib/prisma';
import { checkAuth, checkPageAccess, getSessionEmployee, HEAD_MANAGEMENT_ROLES } from '@/lib/auth';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { decideShiftWrite } from './access.js';
import {
  shapeShift, sortShifts, monthQueryRange, dayKeyInMonth, israelDayKey, editInfoByShift, shapeHistory, monthsFromShifts,
  fullName, HISTORY_LIMIT,
} from './summary.js';

/**
 * מי צופה: null = לא מחובר (כשחובת ההתחברות פעילה). isManager = אותו שער כמו /employees (הנהלה ראשית / מתכנת / אורח במצב פתוח).
 * employeeId = העובד המחובר לפי העוגייה המאומתת (null לאורח).
 */
export async function getAttendanceViewer() {
  if (!(await checkAuth())) return null;
  const me = await getSessionEmployee();
  return { isManager: await isAttendanceManager(me), employeeId: me ? me.id : null };
}

// עובד מחובר נשפט לפי התפקיד שלו ב-DB (בלי ה-fail-open של checkPageAccess בשגיאת DB - כאן זה היה מעניק הרשאת מנהל לכתיבה);
// בלי עובד מחובר (אורח במצב פתוח, או עוגייה ישנה לפי legacyId) - אותו שער כמו הדפים: checkPageAccess.
async function isAttendanceManager(me) {
  if (me) return HEAD_MANAGEMENT_ROLES.includes(me.roleId);
  return !!(await checkPageAccess(HEAD_MANAGEMENT_ROLES));
}

const EMP_SELECT = { id: true, firstName: true, lastName: true, fullName: true, isActive: true, roleId: true, department: { select: { name: true } } };
const SHIFT_SELECT = { id: true, employeeId: true, date: true, hebrewDate: true, entryTime: true, exitTime: true, totalMinutes: true, totalCalculated: true, hourlyWageSnapshot: true, travelExpensesSnapshot: true, notes: true, isDeleted: true };
const empOut = (e) => ({ id: e.id, name: fullName(e), firstName: e.firstName || '', lastName: e.lastName || '', dept: (e.department && e.department.name) || '', isActive: e.isActive !== false });

export async function loadEmployeeBasic(id) {
  const e = await prisma.employee.findUnique({ where: { id }, select: EMP_SELECT });
  return e ? empOut(e) : null;
}

/** כל העובדים (לבורר "עובד" של ההנהלה): פעילים קודם, לפי שם */
export async function loadEmployeeList() {
  const list = await prisma.employee.findMany({ select: EMP_SELECT, orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }] });
  return list.map(empOut).sort((a, b) => (a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1));
}

async function namesFor(ids) {
  const uniq = [...new Set((ids || []).filter(Boolean))];
  if (!uniq.length) return {};
  const rows = await prisma.employee.findMany({ where: { id: { in: uniq } }, select: { id: true, firstName: true, lastName: true, fullName: true } });
  return Object.fromEntries(rows.map((r) => [r.id, fullName(r)]));
}

/** טבלת החודש: כל העובדים שיש להם משמרות בחודש (פעילים וגם לא פעילים עם משמרות - כמו /api/employees/attendance) */
export async function loadMonth(y, m) {
  const range = monthQueryRange(y, m);
  const employees = await prisma.employee.findMany({
    select: { ...EMP_SELECT, shifts: { where: { isDeleted: false, date: range }, select: SHIFT_SELECT, orderBy: [{ date: 'asc' }, { entryTime: 'asc' }] } },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });
  return employees
    .map((e) => ({ ...empOut(e), shifts: sortShifts((e.shifts || []).map((s) => shapeShift(s, { wages: true })).filter((s) => dayKeyInMonth(s.dayKey, y, m))) }))
    .filter((e) => e.isActive || e.shifts.length > 0);
}

/** משמרות של עובד אחד בחודש (+ מחוקות לפי בקשה) עם סימון "נערך ידנית" מההיסטוריה */
export async function loadEmployeeMonth(employeeId, y, m, { includeDeleted = false, wages = false } = {}) {
  const raw = await prisma.shift.findMany({
    where: { employeeId, date: monthQueryRange(y, m), ...(includeDeleted ? {} : { isDeleted: false }) },
    select: SHIFT_SELECT,
    orderBy: [{ date: 'asc' }, { entryTime: 'asc' }],
  });
  const inMonth = raw.filter((s) => dayKeyInMonth(israelDayKey(s.date) || israelDayKey(s.entryTime), y, m));
  const ids = inMonth.map((s) => s.id);
  let edits = {};
  if (ids.length) {
    const logs = await prisma.auditLog.findMany({ where: { entityType: 'Shift', entityId: { in: ids } }, select: { entityId: true, action: true, createdAt: true, employeeId: true, changesJson: true }, orderBy: { createdAt: 'asc' } });
    edits = editInfoByShift(logs, await namesFor(logs.map((l) => l.employeeId)));
  }
  return sortShifts(inMonth.map((s) => shapeShift(s, { wages, edit: edits[s.id] || null })));
}

/** כל המשמרות (לא מחוקות) של עובד, מקובצות לחודשים - תצוגת "לפי עובד" (AT-14: מכל הנתונים) */
export async function loadEmployeeMonths(employeeId, { wages = false } = {}) {
  const raw = await prisma.shift.findMany({ where: { employeeId, isDeleted: false }, select: SHIFT_SELECT, orderBy: [{ date: 'asc' }, { entryTime: 'asc' }] });
  const shifts = raw.map((s) => shapeShift(s, { wages }));
  const months = monthsFromShifts(shifts);
  if (!wages) months.forEach((mo) => { delete mo.pay; delete mo.travels; });
  return months;
}

/** לכל עובד: סיכום כל החודשים (אשף ההדפסות, "לפי עובד") - שאילתה אחת על כל המשמרות הלא מחוקות, שדות מינימליים */
export async function loadAllTotals() {
  const [emps, raw] = await Promise.all([
    loadEmployeeList(),
    prisma.shift.findMany({ where: { isDeleted: false }, select: { id: true, employeeId: true, date: true, entryTime: true, exitTime: true, totalMinutes: true } }),
  ]);
  const by = new Map();
  for (const s of raw) {
    if (!by.has(s.employeeId)) by.set(s.employeeId, []);
    by.get(s.employeeId).push(shapeShift(s, { wages: false }));
  }
  return emps.map((e) => {
    const months = monthsFromShifts(by.get(e.id) || []);
    const T = months.reduce((a, mo) => ({ minutes: a.minutes + mo.minutes, days: a.days + mo.days, shiftCount: a.shiftCount + mo.shiftCount, issues: a.issues + mo.issues }), { minutes: 0, days: 0, shiftCount: 0, issues: 0 });
    return { ...e, months: months.length, ...T };
  });
}

/** היסטוריית השינויים במשמרות של עובד (או של משמרת אחת שלו) - מהחדש לישן, עד HISTORY_LIMIT */
export async function loadHistory(employeeId, { shiftId = null, wages = false } = {}) {
  const shifts = await prisma.shift.findMany({ where: { employeeId, ...(shiftId ? { id: shiftId } : {}) }, select: { id: true, date: true, entryTime: true } });
  if (!shifts.length) return [];
  const dayOf = Object.fromEntries(shifts.map((s) => [s.id, israelDayKey(s.date) || israelDayKey(s.entryTime)]));
  const logs = await prisma.auditLog.findMany({
    where: { entityType: 'Shift', entityId: { in: shifts.map((s) => s.id) } },
    select: { id: true, entityId: true, action: true, createdAt: true, employeeId: true, changesJson: true },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_LIMIT,
  });
  const names = await namesFor(logs.map((l) => l.employeeId));
  return logs.map((l) => shapeHistory(l, { wages, names, shiftDayKey: dayOf[l.entityId] || null }));
}

/**
 * שער הכתיבה של נתיבי המשמרות (AT-13): הנהלה (אותו שער כמו /employees) - כל עובד; עובד רגיל - רק המשמרות של עצמו.
 * מחזיר את decideShiftWrite + actorId (העובד המחובר, לעמודת "מי ערך" ביומן; null לאורח במצב פתוח).
 */
export async function authorizeShiftWrite({ routeEmployeeId, shiftEmployeeId }) {
  const me = await getSessionEmployee();
  const isManager = await isAttendanceManager(me);
  const decision = decideShiftWrite({ isManager, sessionEmployeeId: me ? me.id : null, routeEmployeeId, shiftEmployeeId });
  return { ...decision, actorId: me ? me.id : null };
}

/** פרטי הגמ״ח לכותרת הדף המודפס + שם המדפיס/ה (אותן הגדרות כמו דפי ההדפסה של הלו״ז) */
export async function loadPrintMeta(viewerEmployeeId) {
  const [settingsRows, me] = await Promise.all([
    getAllCachedSettings().catch(() => []),
    viewerEmployeeId ? prisma.employee.findUnique({ where: { id: viewerEmployeeId }, select: { firstName: true, lastName: true, fullName: true } }).catch(() => null) : Promise.resolve(null),
  ]);
  const setting = (k) => { const r = (settingsRows || []).find((s) => s && s.key === k); return r ? r.value : ''; };
  return {
    gmach: { name: setting('gmach_name') || 'גמ״ח שמלות', address: setting('gmach_address') || '', phone: setting('gmach_phone') || '' },
    printedBy: me ? fullName(me) : '',
  };
}
