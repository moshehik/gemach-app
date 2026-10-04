import { NextResponse } from 'next/server';
import { getAttendanceViewer, loadAllTotals, loadMonth, loadEmployeeMonth, loadEmployeeMonths, loadMonthsForEmployees, loadHistory, loadEmployeeBasic, loadEmployeeList, loadPrintMeta } from '@/lib/attendance/server';
import { decideReadAccess, cleanEmployeeId } from '@/lib/attendance/access';
import { parsePeriod } from '@/lib/attendance/summary';
import { buildAttendancePrintPayload, PRINT_TYPES } from '@/lib/attendance/print';

// GET /api/attendance-sheet — הנתונים של "סיכום נוכחות" (app/components/attendance/*, /employees/attendance, /my-hours, /attendance/print).
// קריאה בלבד. ההרשאות (lib/attendance/access.js):
//   scope=month     &y&m             טבלת כל העובדים לחודש (שכר + שעות של כולם) - הנהלה ראשית / מתכנת בלבד, כמו /api/employees/attendance שהוסר
//   scope=employee  &emp&y&m[&deleted=1]  משמרות של עובד אחד בחודש + סימון "נערך ידנית" - הנהלה: כל עובד; עובד רגיל: רק עצמו
//   scope=months    &emp             החודשים של עובד מכל הנתונים (AT-14) - כנ"ל; להנהלה גם רשימת העובדים לבורר
//   scope=history   &emp[&shift]     היסטוריית השינויים במשמרות (לפני/אחרי, מי, מתי - AT-12/AT-16) - כנ"ל
//   scope=print     &type=full|summary|byemp&ids=a,b&y&m   מטען הדף המודפס / ה-PDF / ה-Excel (summary = הנהלה בלבד)
// עובד רגיל: ה-emp/ids שנשלחו חייבים להיות הוא עצמו (403 אחרת), והתשובה בלי שדות שכר. מי הוא - מהעוגייה המאומתת בלבד.
// כל תשובה כוללת viewer: { isManager, employeeId } כדי שהדף יציג את מה שמותר (השרת אוכף בכל מקרה).
export const dynamic = 'force-dynamic';
const MAX_IDS = 400;
const json = (body, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request) {
  const viewer = await getAttendanceViewer();
  if (!viewer) return json({ error: 'יש להתחבר כדי לצפות בנוכחות' }, 401);
  const sp = new URL(request.url).searchParams;
  const scope = sp.get('scope') || '';
  const view = { isManager: viewer.isManager, employeeId: viewer.employeeId };
  try {
    if (scope === 'month') {
      const acc = decideReadAccess({ ...access(viewer), scope: 'month' });
      if (!acc.ok) return json({ error: acc.error }, acc.status);
      const period = parsePeriod(sp.get('y'), sp.get('m'));
      if (!period) return json({ error: 'חודש לא תקין' }, 400);
      return json({ viewer: view, period, employees: await loadMonth(period.y, period.m) });
    }

    if (scope === 'employee' || scope === 'months' || scope === 'history') {
      const requested = sp.get('emp') ? cleanEmployeeId(sp.get('emp')) : null;
      if (sp.get('emp') && !requested) return json({ error: 'עובד לא תקין' }, 400);
      const acc = decideReadAccess({ ...access(viewer), requestedEmployeeId: requested, scope });
      if (!acc.ok) return json({ error: acc.error }, acc.status);
      const employee = await loadEmployeeBasic(acc.employeeId);
      if (!employee) return json({ error: 'העובד לא נמצא' }, 404);
      if (scope === 'employee') {
        const period = parsePeriod(sp.get('y'), sp.get('m'));
        if (!period) return json({ error: 'חודש לא תקין' }, 400);
        const shifts = await loadEmployeeMonth(acc.employeeId, period.y, period.m, { includeDeleted: sp.get('deleted') === '1', wages: acc.wages });
        return json({ viewer: view, period, employee, shifts });
      }
      if (scope === 'months') {
        const [months, employees] = await Promise.all([
          loadEmployeeMonths(acc.employeeId, { wages: acc.wages }),
          viewer.isManager ? loadEmployeeList() : Promise.resolve(undefined),
        ]);
        return json({ viewer: view, employee, months, ...(employees ? { employees } : {}) });
      }
      const shiftId = sp.get('shift') ? cleanEmployeeId(sp.get('shift')) : null;
      if (sp.get('shift') && !shiftId) return json({ error: 'משמרת לא תקינה' }, 400);
      return json({ viewer: view, employee, entries: await loadHistory(acc.employeeId, { shiftId, wages: acc.wages }) });
    }

    if (scope === 'totals') {
      // אשף ההדפסות, "לפי עובד - כל החודשים": לכל עובד - כמה חודשים / שעות / ימים / תקלות מכל הנתונים (הנהלה בלבד)
      if (!viewer.isManager) return json({ error: 'אין הרשאה' }, viewer.employeeId ? 403 : 401);
      return json({ viewer: view, employees: await loadAllTotals() });
    }

    if (scope === 'employees') {
      if (!viewer.isManager) return json({ error: 'אין הרשאה' }, viewer.employeeId ? 403 : 401);
      return json({ viewer: view, employees: await loadEmployeeList() });
    }

    if (scope === 'print') {
      const type = sp.get('type') || 'full';
      if (!PRINT_TYPES.includes(type)) return json({ error: 'סוג דוח לא תקין' }, 400);
      const rawIds = (sp.get('ids') || '').split(',').map((x) => x.trim()).filter(Boolean);
      if (rawIds.length > MAX_IDS) return json({ error: 'יותר מדי עובדים' }, 400);
      const ids = rawIds.map(cleanEmployeeId);
      if (ids.some((x) => !x)) return json({ error: 'עובד לא תקין' }, 400);
      if (type === 'summary' && !viewer.isManager) return json({ error: 'טבלת הסיכום של כל העובדים זמינה להנהלה בלבד' }, viewer.employeeId ? 403 : 401);
      // עובד רגיל: רק הדוח של עצמו (ids ריק = עצמו; כל id אחר = 403)
      let targetIds = ids;
      // wages=0: הדוח בלי שכר גם להנהלה (דף "השעות שלי" - אותו דוח כמו של עובד רגיל)
      let wages = sp.get('wages') !== '0';
      if (!viewer.isManager) {
        const acc = decideReadAccess({ ...access(viewer), requestedEmployeeId: ids.find((x) => x !== viewer.employeeId) || null, scope: 'employee' });
        if (!acc.ok) return json({ error: acc.error }, acc.status);
        targetIds = [acc.employeeId];
        wages = false;
      }
      const meta = await loadPrintMeta(viewer.employeeId);
      if (type === 'byemp') {
        if (!targetIds.length) return json({ error: 'לא נבחר עובד' }, 400);
        const monthsBy = await loadMonthsForEmployees(targetIds, { wages }); // שתי שאילתות לכל הבקשה, לא לכל עובד
        return json({ viewer: view, ...buildAttendancePrintPayload({ type, wages, ...meta, monthsBy }) });
      }
      const period = parsePeriod(sp.get('y'), sp.get('m'));
      if (!period) return json({ error: 'חודש לא תקין' }, 400);
      let employees;
      if (viewer.isManager) {
        const all = await loadMonth(period.y, period.m);
        employees = targetIds.length ? targetIds.map((id) => all.find((e) => e.id === id)).filter(Boolean) : all;
      } else {
        const employee = await loadEmployeeBasic(targetIds[0]);
        employees = employee ? [{ ...employee, shifts: await loadEmployeeMonth(employee.id, period.y, period.m, { wages: false }) }] : [];
      }
      return json({ viewer: view, ...buildAttendancePrintPayload({ type, period, wages, ...meta, employees }) });
    }

    return json({ error: 'scope לא מוכר' }, 400);
  } catch (error) {
    console.error('attendance-sheet GET failed:', error);
    return json({ error: 'שגיאה בטעינת נתוני הנוכחות' }, 500);
  }
}

function access(viewer) {
  return { isManager: viewer.isManager, sessionEmployeeId: viewer.employeeId };
}
