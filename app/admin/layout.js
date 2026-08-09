import { checkPageAccess } from '@/lib/auth';
import NoAccessMessage from '@/app/components/NoAccessMessage';

// חסימת אזור הניהול בצד שרת: כשחובת התחברות פעילה, רק מנהל (roleId 1)
// או מתכנת (roleId 2) מגיעים לדפים תחת /admin — כל אחד אחר רואה מסך "אין הרשאה".
export default async function AdminLayout({ children }) {
  if (!(await checkPageAccess())) {
    return <NoAccessMessage />;
  }
  return children;
}
