// lib/adminEmailLogsServer.js - השאילתות של יומן שליחת המיילים החדש (נקרא רק מ-app/api/admin/email-logs/*, שמוגן למתכנת בלבד - אותו שער כמו /api/email-logs).
// הלוגיקה הטהורה (סוגים, SQL, שורות) ב-lib/adminEmailLogs.js. כל שאילתה עוברת דרך guarded() (SET LOCAL statement_timeout) ובקשה כבדה דרך runLimited
// (מגבלת מקביליות) - חריגה = 503 "צמצמו את הסינון". הרשימה היא עמוד אחד (עד 100 / ייצוא 500) - לעולם לא כל הטבלה; שמות הלקוחות והעובדים נשלפים בנפרד
// לפי מזהים של העמוד בלבד (חיפוש לפי מפתח ראשי).
import prisma from '@/app/lib/prisma';
import { getIsraelDayRange, getIsraelTodayKey } from '@/lib/hebrewDate';
import { guarded, runLimited } from '@/lib/adminListDb';
import { createDeadline } from '@/lib/adminListGuards';
import {
  PRESET_PERIOD_KEYS, countSql, countsSql, listSql, mapEmailLogRow, periodTimeRanges, personName, resolvePeriod, shapeCounts,
} from '@/lib/adminEmailLogs';

const dayRange = (key) => getIsraelDayRange(key);

function rangesOf(params) {
  return periodTimeRanges(params.period, getIsraelTodayKey(), params.from, params.to, dayRange);
}

async function lookups(rows) {
  const customerIds = [...new Set(rows.map((r) => r.customerId).filter(Boolean))];
  const employeeIds = [...new Set(rows.map((r) => r.employeeId).filter(Boolean))];
  const [customers, employees] = await Promise.all([
    customerIds.length ? guarded(prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, legacyId: true, firstName: true, lastName: true } })) : [],
    employeeIds.length ? guarded(prisma.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, firstName: true, lastName: true, fullName: true } })) : [],
  ]);
  return { customers: new Map(customers.map((c) => [c.id, c])), employees: new Map(employees.map((e) => [e.id, e])) };
}

/** עמוד של הרשימה: { data: שורות, total }. */
export async function queryEmailLogs(params) {
  return runLimited(async () => {
    const deadline = createDeadline();
    const ranges = rangesOf(params);
    const l = listSql(params, ranges);
    const c = countSql(params, ranges);
    const [rows, totalRows] = await Promise.all([
      guarded(prisma.$queryRawUnsafe(l.sql, ...l.args)),
      guarded(prisma.$queryRawUnsafe(c.sql, ...c.args)),
    ]);
    deadline.check();
    const maps = await lookups(rows);
    return { data: rows.map((r) => mapEmailLogRow(r, maps)), total: Number(totalRows[0] && totalRows[0].n) || 0 };
  });
}

/** ספירות האפשרויות של חלון הסינון (כל קבוצה: שאר הקבוצות + החיפוש מוחלים). */
export async function queryEmailLogsCounts(params) {
  return runLimited(async () => {
    const deadline = createDeadline();
    const ranges = rangesOf(params);
    const today = getIsraelTodayKey();
    const presets = {};
    for (const k of PRESET_PERIOD_KEYS) {
      const r = resolvePeriod(k, today);
      presets[k] = { from: dayRange(r.from).start.toISOString(), to: dayRange(r.to).end.toISOString() };
    }
    const custom = resolvePeriod('custom', today, params.from, params.to);
    if (custom) presets.custom = { from: custom.from ? dayRange(custom.from).start.toISOString() : null, to: custom.to ? dayRange(custom.to).end.toISOString() : null };
    const q = countsSql(params, ranges, presets);
    const run = (x) => guarded(prisma.$queryRawUnsafe(x.sql, ...x.args));
    const [total, types, statuses, period, senders] = await Promise.all([run(q.total), run(q.types), run(q.statuses), run(q.period), run(q.senders)]);
    deadline.check();
    // שמות השולחים: רק לעובדים שמופיעים באפשרויות (עד 25)
    const ids = senders.map((s) => s.k).filter((k) => k !== 'none');
    const emps = ids.length ? await guarded(prisma.employee.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, fullName: true } })) : [];
    const names = new Map(emps.map((e) => [e.id, personName(e)]));
    const shaped = shapeCounts({ total: total[0] && total[0].n, types, statuses, period: period[0] || {}, senders });
    return { ...shaped, senders: shaped.senders.map((s) => ({ ...s, label: s.k === 'none' ? '' : (names.get(s.k) || '') })) };
  });
}
