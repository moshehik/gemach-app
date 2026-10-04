import { redirect } from 'next/navigation';

// /employees/report — "דוח נוכחות חודשי" הישן הוחלף ב"סיכום נוכחות" (/employees/attendance): טבלה כללית, דוח לכל עובד, והדפסה /
// PDF / Excel של כל העובדים ברצף - עובד בגיליון משלו (החלטת הבעלים AT-02, 4.10.2026). הנתיב נשאר חי (קישורים ישנים, התפריט,
// lib/permissionsMetadata.js page:employees_report) ומפנה לדף החדש. השער: app/employees/layout.js (לפני ההפניה).
export default function AttendanceReportRedirect() {
  redirect('/employees/attendance');
}
