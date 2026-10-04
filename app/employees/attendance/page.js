// /employees/attendance — "סיכום נוכחות" של ההנהלה (עיצוב מאושר 4.10.2026: תצוגות-עיצוב/סיכום-נוכחות.html, רכיבי פלטה בלבד).
// מחליף את לשונית "נוכחות" ב-/employees ואת הדוח החודשי /employees/report (שמפנה לכאן - החלטת הבעלים AT-02).
// השער: app/employees/layout.js (הנהלה ראשית / מתכנת, כמו היום - AT-09); ה-API (/api/attendance-sheet) בודק שוב.
// ?view=month|byemp|emp&emp=<id>&y=2026&m=8 (m מ-0) - מצב פתיחה אופציונלי.
import AttendanceSwitch from '@/app/components/attendance/AttendanceSwitch';
import { parseAttendanceQuery } from '@/app/components/attendance/routeParams';

export const metadata = { title: 'סיכום נוכחות' };

export default async function EmployeesAttendanceRoute({ searchParams }) {
  const initial = parseAttendanceQuery((await searchParams) || {});
  return <AttendanceSwitch mode="manager" initial={initial} />;
}
