import { checkPageAccess } from '@/lib/auth';
import NoAccessMessage from '@/app/components/NoAccessMessage';

// חסימת דף המחירון בצד שרת: כשחובת התחברות פעילה, רק מנהל (roleId 1) או
// מתכנת (roleId 2) מגיעים ל-/dashboard/pricelist - כל עובד אחר רואה מסך
// "אין הרשאה", גם אם הגיע לכתובת ישירות ולא דרך כרטיס בדף הבית.
// לא שם ב-app/dashboard/layout.js המשותף כי זה היה חוסם גם את /dashboard/dresses.
export default async function PricelistLayout({ children }) {
  if (!(await checkPageAccess())) {
    return <NoAccessMessage />;
  }
  return children;
}
