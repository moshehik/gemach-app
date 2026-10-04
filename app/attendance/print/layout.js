import { Suspense } from 'react';

// /attendance/print - דף ההדפסה של "סיכום נוכחות". השער: התחברות (המעטפת הגלובלית) + ה-API של הנתונים
// (GET /api/attendance-sheet?scope=print, lib/attendance/access.js). הדף לא טוען את ערכת הנושא: print.css עם צבעים קבועים.
// Suspense: הדף קורא useSearchParams (נתיב סטטי - בלי גבול Suspense הבנייה נכשלת ב-prerender).
export const metadata = { title: 'הדפסה - סיכום נוכחות' };

export default function AttendancePrintLayout({ children }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
