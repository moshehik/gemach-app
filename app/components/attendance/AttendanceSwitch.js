'use client';

import dynamic from 'next/dynamic';

// "סיכום נוכחות" נטען בנפרד (כמו ProfileSwitch / StockCheckSwitch): קובץ ה-CSS של הפלטה (~450KB) וקוד הדף נטענים רק בכניסה
// לדפים שלו (/employees/attendance, /employees/<id>/attendance, /my-hours). הדף מתארח בתוך אזור התוכן של כל מעטפת (ישנה או A5).
const AttendancePage = dynamic(() => import('./AttendancePage'), { ssr: false });

export default function AttendanceSwitch(props) {
  return <AttendancePage {...props} />;
}
