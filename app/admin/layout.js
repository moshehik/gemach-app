import { checkPageAccess, HEAD_MANAGEMENT_ROLES } from '@/lib/auth';
import NoAccessMessage from '@/app/components/NoAccessMessage';

// חסימת אזור הניהול בצד שרת: כשחובת התחברות פעילה, רק הנהלה ראשית (roleId 0)
// או מתכנת (roleId 2) מגיעים לדפים תחת /admin — כל אחד אחר, כולל מנהל סניף
// רגיל (roleId 1), רואה מסך "אין הרשאה". סוכם ב-2026-08-24 בעקבות כמה דיווחי
// משתמש מנהל שמצא גישה לאזור הניהול המלא.
export default async function AdminLayout({ children }) {
  if (!(await checkPageAccess(HEAD_MANAGEMENT_ROLES))) {
    return <NoAccessMessage />;
  }
  return children;
}
