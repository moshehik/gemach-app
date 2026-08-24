import { checkPageAccess, HEAD_MANAGEMENT_ROLES } from '@/lib/auth';
import NoAccessMessage from '@/app/components/NoAccessMessage';

// חסימת דפי העובדים בצד שרת: כשחובת התחברות פעילה, רק הנהלה ראשית (roleId 0)
// או מתכנת (roleId 2) מגיעים לדפים תחת /employees — כולל רשימת עובדים ודוח
// נוכחות חודשי — וכל אחד אחר, כולל מנהל סניף רגיל (roleId 1), רואה מסך "אין
// הרשאה". סוכם ב-2026-08-24 בעקבות דיווחי משתמש מנהל.
// החתמת שעון נוכחות נשארת פתוחה לכולם בדף /punch-clock הנפרד.
export default async function EmployeesLayout({ children }) {
  if (!(await checkPageAccess(HEAD_MANAGEMENT_ROLES))) {
    return <NoAccessMessage />;
  }
  return children;
}
