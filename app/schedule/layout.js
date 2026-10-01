import PageGate from '@/app/components/PageGate';
import '@/design-system/components.css';
import './schedule.css';

// דף הלו״ז היומי (קריאה בלבד, V1). הגישה נקבעת ע"י פריט הקטלוג "page:schedule" (lib/permissionsMetadata.js,
// /admin/permissions) - סגור כברירת מחדל: בלי שורת הרשאה רק הנהלה ראשית/מתכנת נכנסים. אותו דפוס כמו
// app/messages/layout.js. components.css נטען כאן ובתוך .gm-ds בלבד, ולכן לא משנה שום דף אחר.
export const metadata = { title: 'לוח זמנים - גמ"ח שמלות' };

export default async function ScheduleLayout({ children }) {
  return <PageGate pageKey="page:schedule">{children}</PageGate>;
}
