// /admin — "מסך ניהול ראשי" בעיצוב המאושר (תצוגות-עיצוב/ניהול-ראשי-כרטיסים.html, תשובות הבעלים 4.10.2026).
// הנתיב דק: השרת מחליט אילו כלים מוצגים, עם אותה פונקציה שהדפים עצמם בודקים (checkPageAccess + מערכי התפקיד של lib/auth.js),
// ומעביר לרכיב רק את מזהי הכלים המותרים — כלי מתכנת לא נשלח בכלל לדפדפן של מי שאינו מתכנת. הקטלוג: lib/adminHub.js.
// הדף נטען בנפרד (dynamic, כמו /profile) כדי שקובץ ה-CSS הגדול של הפלטה לא ייכנס ל-bundle של שאר הדפים.
// השער של האזור כולו (הנהלה ראשית / מתכנת) נשאר ב-app/admin/layout.js.
import { checkPageAccess, getSessionEmployee, HEAD_MANAGEMENT_ROLES, DEVELOPER_ONLY_ROLES } from '@/lib/auth';
import { GATE_ROLES, visibleToolIds } from '@/lib/adminHub';
import AdminHubSwitch from '@/app/components/admin-hub/AdminHubSwitch';

export const dynamic = 'force-dynamic';

export default async function AdminHubPage() {
  const [head, dev, headOnly, me] = await Promise.all([
    checkPageAccess(HEAD_MANAGEMENT_ROLES),
    checkPageAccess(DEVELOPER_ONLY_ROLES),
    checkPageAccess(GATE_ROLES.headOnly),
    getSessionEmployee(),
  ]);
  const ids = visibleToolIds({ head, dev, headOnly });
  return <AdminHubSwitch toolIds={ids} userKey={me ? me.id : null} />;
}
