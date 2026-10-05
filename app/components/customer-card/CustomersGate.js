import { getSessionEmployee } from '@/lib/auth';
import NoAccessCard from '@/app/components/gate/NoAccessCard';

// חלון "אין הרשאה" של כרטיס הלקוח / רשימת הלקוחות (רכיב שרת; PageGate מרנדר אותו רק כשאין גישה ל-page:customers).
// תשובת הבעלים CC-O8 (4.10.2026): "כן, אותו חלון" - אותו חלון כהה חדש של הלוח החודשי (gate/NoAccessCard), לא NoAccessMessage הישן.
// מבחין בין עובדת מחוברת בלי הרשאה (חזרה לדף הבית) לבין אורח (כניסה למערכת).
export default async function CustomersGate() {
  let employee = null;
  try { employee = await getSessionEmployee(); } catch { employee = null; }
  return <NoAccessCard guest={!employee} page="כרטיס הלקוח" />;
}
