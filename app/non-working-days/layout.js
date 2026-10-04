import { checkAuth } from '@/lib/auth';
import NoAccessMessage from '@/app/components/NoAccessMessage';

// /non-working-days - "ימי אי-פעילות". לא תחת /admin בכוונה: app/admin/layout.js פתוח להנהלה ראשית / מתכנת בלבד, ואילו
// הבעלים החליט (NWD-Q08) שזו שורת הרשאה רגילה (feature:non_working_days_manage) שאפשר לפתוח גם למחלקות אחרות, ושמי שנכנס
// בלי ההרשאה רואה את הימים בלי עריכה (פירוש 9). לכן השער כאן הוא "מחובר" (או אתר פתוח כשההתחברות כבויה), והעריכה נאכפת
// בשרת: GET /api/non-working-days מחזיר canEdit, ו-POST /api/settings בודק את אותה הרשאה. הרשימה עצמה ממילא גלויה
// (GET /api/settings ציבורי), אז אין כאן חשיפה חדשה.
export default async function NonWorkingDaysLayout({ children }) {
  if (!(await checkAuth())) return <NoAccessMessage />;
  return children;
}
