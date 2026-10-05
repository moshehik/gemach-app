// /employees/<id>/attendance — דף "נוכחות עובד" (עריכת השורות של עובד אחד לחודש אחד) של ההנהלה. ?y=2026&m=8 (m מ-0), ברירת מחדל:
// החודש הקודם. השער: app/employees/layout.js; הכתיבה: /api/employees/<id>/shifts (בדיקת בעלות בשרת - lib/attendance/access.js).
import AttendanceSwitch from '@/app/components/attendance/AttendanceSwitch';
import { parseAttendanceQuery } from '@/app/components/attendance/routeParams';

export const metadata = { title: 'נוכחות עובד' };

export default async function EmployeeAttendanceRoute({ params, searchParams }) {
  const { id } = await params;
  const q = parseAttendanceQuery((await searchParams) || {});
  const empId = /^[A-Za-z0-9_-]{1,64}$/.test(String(id || '')) ? String(id) : undefined;
  return <AttendanceSwitch mode="manager" initial={{ ...q, view: 'emp', empId }} />;
}
