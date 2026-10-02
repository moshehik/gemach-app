// /schedule/print/* - דפי ההדפסה של הלו״ז. השער page:schedule כבר נאכף ב-app/schedule/layout.js (האב);
// ההרשאות הנוספות לכל דף (מחירים, משלוחים, תיקונים) נאכפות ב-GET /api/schedule/print לפי lib/schedule/print/registry.js.
// הדף עצמו לא טוען את ערכת הנושא (כלל CLAUDE.md להדפסה): print.css עם צבעים קבועים בלבד.
export const metadata = { title: 'הדפסה - לוח זמנים' };

export default function SchedulePrintLayout({ children }) {
  return children;
}
