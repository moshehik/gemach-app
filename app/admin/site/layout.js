import { redirect } from 'next/navigation';
import { checkPageAccess, DEVELOPER_ONLY_ROLES } from '@/lib/auth';

// "ניהול אתר" (/admin/site, מסך הקטגוריות הישן) — מתכנת בלבד (החלטת הבעלים 4.10.2026, answers-admin-cards: cov:/admin/site "רק מתכנת").
// מסך הניהול הראשי החדש ב-/admin מכיל את כל הכלים, ולכן כל מי שאינו מתכנת (כולל הנהלה ראשית) מועבר לשם ולא למסך "אין הרשאה":
// קישורים ישנים וכפתורי "חזרה" בדפי הניהול (שמפנים ל-/admin/site) ממשיכים לעבוד. השער הכללי של /admin נשאר ב-app/admin/layout.js.
export default async function AdminSiteLayout({ children }) {
  if (!(await checkPageAccess(DEVELOPER_ONLY_ROLES))) {
    redirect('/admin');
  }
  return children;
}
