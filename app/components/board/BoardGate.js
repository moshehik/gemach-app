import { getSessionEmployee } from '@/lib/auth';
import NoAccessCard from '@/app/components/gate/NoAccessCard';

// חלון "אין הרשאה" של הלוח החודשי (רכיב שרת; PageGate מרנדר אותו רק כשאין גישה ל-page:board). מבחין בין עובדת מחוברת
// בלי הרשאה (חזרה לדף הבית) לבין אורח (כניסה למערכת) - BRD-UNV-4: "עיצוב חדש לחלון, אחיד עם חלונות הכניסה".
export default async function BoardGate() {
  let employee = null;
  try { employee = await getSessionEmployee(); } catch { employee = null; }
  return <NoAccessCard guest={!employee} page="הלוח החודשי" />;
}
