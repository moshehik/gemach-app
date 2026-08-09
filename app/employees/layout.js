import { checkPageAccess } from '@/lib/auth';
import NoAccessMessage from '@/app/components/NoAccessMessage';

// חסימת דפי העובדים בצד שרת: כשחובת התחברות פעילה, רק מנהל (roleId 1)
// או מתכנת (roleId 2) מגיעים לדפים תחת /employees — כולל דפי פרופיל עובד,
// וכל אחד אחר רואה מסך "אין הרשאה".
// החתמת שעון נוכחות נשארת פתוחה לכולם בדף /punch-clock הנפרד.
export default async function EmployeesLayout({ children }) {
  if (!(await checkPageAccess())) {
    return <NoAccessMessage />;
  }
  return children;
}
