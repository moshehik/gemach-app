import { redirect } from 'next/navigation';
import { checkPageAccess } from '@/lib/auth';

// חסימת דפי העובדים בצד שרת: כשחובת התחברות פעילה, רק מנהל (roleId 1)
// או מתכנת (roleId 2) מגיעים לדפים תחת /employees — כולל דפי פרופיל עובד.
// החתמת שעון נוכחות נשארת פתוחה לכולם בדף /punch-clock הנפרד.
export default async function EmployeesLayout({ children }) {
  if (!(await checkPageAccess())) {
    redirect('/');
  }
  return children;
}
