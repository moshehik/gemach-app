import { redirect } from 'next/navigation';
import { checkPageAccess } from '@/lib/auth';

// חסימת דף הזיכויים בצד שרת: כשחובת התחברות פעילה, רק מנהל (roleId 1)
// או מתכנת (roleId 2) מגיעים ל-/refunds — כל אחד אחר מוחזר לדף הבית.
export default async function RefundsLayout({ children }) {
  if (!(await checkPageAccess())) {
    redirect('/');
  }
  return children;
}
