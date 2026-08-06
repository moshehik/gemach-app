import { redirect } from 'next/navigation';
import { checkPageAccess } from '@/lib/auth';

// חסימת אזור הניהול בצד שרת: כשחובת התחברות פעילה, רק מנהל (roleId 1)
// או מתכנת (roleId 2) מגיעים לדפים תחת /admin — כל אחד אחר מוחזר לדף הבית.
export default async function AdminLayout({ children }) {
  if (!(await checkPageAccess())) {
    redirect('/');
  }
  return children;
}
