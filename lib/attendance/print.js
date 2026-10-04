// lib/attendance/print.js — מטען דפי ההדפסה / ה-PDF / ה-Excel של "סיכום נוכחות" (טהור: שרת, דפדפן ובדיקות).
//
// שלושה סוגי דוח (כמו באשף של העיצוב המאושר, TYPE_LBL):
//   'full'    דוח מלא לכל עובד - גיליון נפרד לכל עובד (עובד אחד, כמה, או "כל העובדים ברצף" - דף אחרי דף, החלטת הבעלים AT-02)
//   'summary' טבלת סיכום בלבד - כל העובדים בטבלה אחת (הנהלה בלבד)
//   'byemp'   לפי עובד - כל החודשים (AT-14: מכל הנתונים) - גיליון לכל עובד
// הדף המודפס עצמו: app/components/attendance/print/AttendancePrintSheets.js בתוך המעטפת של דפי הלו״ז (PrintShell.js + print.css).
// wages=false (עובד רגיל): בלי עמודות שכר ונסיעות (AT-10). שעות תמיד h:mm (AT-06).
import { hLong, greg, israelKey, israelTime } from '../schedule/print/format.js';
import { aggregate, sumRows, monthRows, monthLabel, hebSpan, hm, hDayShort, hDayYear, weekdayShort, israelTime as ilTime, isIncomplete } from './summary.js';

export const PRINT_TYPES = ['full', 'summary', 'byemp'];
export const TYPE_LABEL = { full: 'דוח מלא לכל עובד', summary: 'טבלת סיכום בלבד', byemp: 'לפי עובד - כל החודשים' };

function meta({ gmach = {}, printedBy = '', now = new Date(), wages }) {
  const today = israelKey(now);
  return {
    gmach: { name: gmach.name || 'גמ״ח שמלות', address: gmach.address || '', phone: gmach.phone || '' },
    printedBy: printedBy || '',
    dateHebrew: hLong(today),
    dateGreg: greg(today),
    producedKey: today,
    producedTime: israelTime(now),
    wages: !!wages,
  };
}

function shiftLine(s, wages) {
  return {
    id: s.id,
    dayKey: s.dayKey,
    day: hDayShort(s.dayKey),
    weekday: weekdayShort(s.dayKey),
    entry: ilTime(s.entryTime),
    exit: ilTime(s.exitTime),
    minutes: Number(s.minutes) || 0,
    incomplete: isIncomplete(s),
    notes: s.notes || '',
    ...(wages ? { pay: Number(s.pay) || 0, travel: Number(s.travel) || 0, wage: s.wage } : {}),
  };
}

/** גיליון "דוח נוכחות עובד" לחודש אחד */
export function employeeSheet(emp, shifts, period, wages) {
  const act = (shifts || []).filter((s) => !s.isDeleted);
  const T = aggregate(act);
  const per = monthLabel(period.y, period.m);
  return {
    kind: 'employee',
    key: 'e-' + emp.id,
    chip: 'דוח נוכחות',
    title: 'דוח נוכחות עובד: ' + emp.name,
    sub: (emp.dept ? 'מחלקה: ' + emp.dept + ' · ' : '') + 'תקופה: ' + per,
    sum: { b: T.shiftCount + ' משמרות', small: hm(T.minutes) + ' שעות' },
    employee: { id: emp.id, name: emp.name, dept: emp.dept || '' },
    shifts: act.map((s) => shiftLine(s, wages)),
    totals: wages ? T : { ...T, pay: undefined, travels: undefined },
  };
}

/** גיליון "טבלת סיכום - כלל העובדים" (הנהלה בלבד) */
export function summarySheet(rows, period) {
  const R = rows.map((r) => ({ id: r.id, name: r.name, dept: r.dept || '', minutes: r.minutes, days: r.days, shiftCount: r.shiftCount, issues: r.issues, pay: r.pay, travels: !!r.travels }));
  return {
    kind: 'summary',
    key: 'summary',
    chip: 'סיכום נוכחות',
    title: 'טבלת סיכום נוכחות - כלל העובדים',
    sub: 'תקופה: ' + monthLabel(period.y, period.m),
    sum: { b: R.length + ' עובדים', small: hebSpan(period.y, period.m) },
    rows: R,
    totals: sumRows(R),
  };
}

/** גיליון "סיכום לפי עובד - כל החודשים" */
export function monthsSheet(emp, months, wages) {
  const T = sumRows(months);
  const first = months[months.length - 1];
  const last = months[0];
  const range = first ? monthLabel(first.y, first.m) + ' – ' + monthLabel(last.y, last.m) : '';
  return {
    kind: 'months',
    key: 'm-' + emp.id,
    chip: 'סיכום לפי עובד',
    title: 'סיכום נוכחות: ' + emp.name,
    sub: (emp.dept ? 'מחלקה: ' + emp.dept + (range ? ' · ' : '') : '') + range,
    sum: { b: months.length + ' חודשים', small: hm(T.minutes) },
    employee: { id: emp.id, name: emp.name, dept: emp.dept || '' },
    months: months.map((mo) => ({ y: mo.y, m: mo.m, label: monthLabel(mo.y, mo.m), minutes: mo.minutes, days: mo.days, shiftCount: mo.shiftCount, issues: mo.issues, ...(wages ? { pay: mo.pay, travels: !!mo.travels } : {}) })),
    totals: wages ? T : { ...T, pay: undefined },
  };
}

/**
 * המטען המלא לדף ההדפסה. input לפי הסוג:
 *   full:    { employees: [{ id, name, dept, shifts }] }   (עובדים בלי משמרות בחודש לא מקבלים גיליון)
 *   summary: { employees: [...] }  -> monthRows
 *   byemp:   { months: [{ employee, months }] }
 */
export function buildAttendancePrintPayload({ type, period = null, wages, gmach, printedBy, now = new Date(), employees = [], monthsBy = [] }) {
  const sheets = [];
  if (type === 'summary') {
    const rows = monthRows(employees);
    if (rows.length) sheets.push(summarySheet(rows, period));
  } else if (type === 'byemp') {
    for (const x of monthsBy) if (x.months && x.months.length) sheets.push(monthsSheet(x.employee, x.months, wages));
  } else {
    for (const e of employees) {
      const act = (e.shifts || []).filter((s) => !s.isDeleted);
      if (act.length) sheets.push(employeeSheet(e, act, period, wages));
    }
  }
  return {
    meta: meta({ gmach, printedBy, now, wages }),
    type,
    typeLabel: TYPE_LABEL[type] || '',
    period: period ? { y: period.y, m: period.m, label: monthLabel(period.y, period.m), span: hebSpan(period.y, period.m) } : null,
    sheets,
  };
}

// ---------- Excel (הנהלה בלבד - JDG-04; AT-08: בלי מגבלת שורות) ----------
const yn = (b) => (b ? 'כן' : 'לא');
/** גיליונות ל-downloadScheduleXlsx: [{ sheetName, rows:[{עמודה: ערך}] }] */
export function payloadToSheets(payload) {
  const out = [];
  const W = payload.meta.wages;
  for (const sh of payload.sheets) {
    if (sh.kind === 'summary') {
      const rows = sh.rows.map((r) => ({ 'שם': r.name, 'מחלקה': r.dept, 'סה"כ שעות': hm(r.minutes), 'סה"כ דקות': r.minutes, 'כמות ימים': r.days, 'משמרות': r.shiftCount, 'תקלות': r.issues, ...(W ? { 'סה"כ לתשלום': r.pay, 'נסיעות': yn(r.travels) } : {}) }));
      rows.push({ 'שם': 'סה"כ', 'מחלקה': '', 'סה"כ שעות': hm(sh.totals.minutes), 'סה"כ דקות': sh.totals.minutes, 'כמות ימים': sh.totals.days, 'משמרות': sh.totals.shiftCount, 'תקלות': sh.totals.issues, ...(W ? { 'סה"כ לתשלום': sh.totals.pay, 'נסיעות': '' } : {}) });
      out.push({ sheetName: 'סיכום ' + (payload.period ? payload.period.label : ''), rows });
    } else if (sh.kind === 'employee') {
      const rows = sh.shifts.map((s) => ({ 'תאריך': hDayYear(s.dayKey), 'יום': s.weekday, 'תאריך לועזי': s.dayKey ? s.dayKey + 'T12:00:00.000Z' : '', 'כניסה': s.entry || '', 'יציאה': s.exit || '', 'סה"כ שעות': hm(s.minutes), 'סה"כ דקות': s.minutes, ...(W ? { 'שכר שעה': s.wage ?? '', 'נסיעות': s.travel || 0, 'סה"כ יומי': s.pay || 0 } : {}), 'הערות': s.notes || '' }));
      out.push({ sheetName: sh.employee.name || 'עובד', rows });
    } else if (sh.kind === 'months') {
      const rows = sh.months.map((mo) => ({ 'חודש': mo.label, 'סה"כ שעות': hm(mo.minutes), 'סה"כ דקות': mo.minutes, 'כמות ימים': mo.days, 'משמרות': mo.shiftCount, 'תקלות': mo.issues, ...(W ? { 'סה"כ לתשלום': mo.pay, 'נסיעות': yn(mo.travels) } : {}) }));
      rows.push({ 'חודש': 'סה"כ לכל התקופה', 'סה"כ שעות': hm(sh.totals.minutes), 'סה"כ דקות': sh.totals.minutes, 'כמות ימים': sh.totals.days, 'משמרות': sh.totals.shiftCount, 'תקלות': sh.totals.issues, ...(W ? { 'סה"כ לתשלום': sh.totals.pay, 'נסיעות': '' } : {}) });
      out.push({ sheetName: sh.employee.name || 'עובד', rows });
    }
  }
  // "דוח מלא" לכמה עובדים: גיליון ריכוז ראשון (כמו האקסל של /employees/report: "ריכוז נתונים" + גיליון לכל עובד)
  if (payload.type === 'full' && payload.sheets.length > 1) {
    const rows = payload.sheets.map((sh) => ({ 'שם': sh.employee.name, 'מחלקה': sh.employee.dept, 'סה"כ שעות': hm(sh.totals.minutes), 'סה"כ דקות': sh.totals.minutes, 'כמות ימים': sh.totals.days, 'משמרות': sh.totals.shiftCount, 'תקלות': sh.totals.issues, ...(W ? { 'סה"כ לתשלום': sh.totals.pay, 'נסיעות': yn(sh.totals.travels) } : {}) }));
    out.unshift({ sheetName: 'ריכוז נתונים', rows });
  }
  return out;
}

/** שם הקובץ: נוכחות_9_2026 / נוכחות_כל_החודשים_<שם> */
export function fileBase(payload) {
  if (payload.type === 'byemp') return 'נוכחות_כל_החודשים' + (payload.sheets.length === 1 ? '_' + payload.sheets[0].employee.name : '');
  const p = payload.period;
  const base = 'נוכחות_' + (p ? (p.m + 1) + '_' + p.y : '');
  return payload.sheets.length === 1 && payload.sheets[0].employee ? base + '_' + payload.sheets[0].employee.name : base;
}
