import { checkPageAccess, HEAD_MANAGEMENT_ROLES } from '@/lib/auth';
import NoAccessMessage from '@/app/components/NoAccessMessage';

// חסימת דף המחירון בצד שרת: כשחובת התחברות פעילה, רק הנהלה ראשית (roleId 0)
// או מתכנת (roleId 2) מגיעים ל-/dashboard/pricelist - כל עובד אחר, כולל מנהל
// סניף רגיל (roleId 1), רואה מסך "אין הרשאה", גם אם הגיע לכתובת ישירות ולא
// דרך כרטיס בדף הבית. סוכם ב-2026-08-24 בעקבות דיווחי משתמש מנהל.
// לא שם ב-app/dashboard/layout.js המשותף כי זה היה חוסם גם את /dashboard/dresses.
export default async function PricelistLayout({ children }) {
  if (!(await checkPageAccess(HEAD_MANAGEMENT_ROLES))) {
    return <NoAccessMessage />;
  }
  return children;
}
