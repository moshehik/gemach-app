import { checkPageAccess } from '@/lib/auth';
import NoAccessMessage from '@/app/components/NoAccessMessage';

// חסימת דף הזיכויים בצד שרת: כשחובת התחברות פעילה, רק מנהל (roleId 1)
// או מתכנת (roleId 2) מגיעים ל-/refunds — כל אחד אחר רואה מסך "אין הרשאה".
export default async function RefundsLayout({ children }) {
  if (!(await checkPageAccess())) {
    return <NoAccessMessage />;
  }
  return children;
}
