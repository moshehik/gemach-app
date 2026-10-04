// "ישן / חדש" (4.10.2026, מסך 'attendance'): בגרסה הישנה - הדוח הישן LegacyReportPage.js (f3b1f771^1:app/employees/report/page.js
// כפי שהוא, נתמך ע"י נתיב התאימות המוקשח GET /api/employees/attendance). ההכרעה בשרת: getRequestUiVariant('attendance').
import { redirect } from 'next/navigation';
import VariantFrame from '@/app/components/variant/VariantFrame';
import { getRequestUiVariant } from '@/app/lib/uiVariantServer';
import LegacyReportPage from './LegacyReportPage';

// /employees/report — "דוח נוכחות חודשי" הישן הוחלף ב"סיכום נוכחות" (/employees/attendance): טבלה כללית, דוח לכל עובד, והדפסה /
// PDF / Excel של כל העובדים ברצף - עובד בגיליון משלו (החלטת הבעלים AT-02, 4.10.2026). הנתיב נשאר חי (קישורים ישנים, התפריט,
// lib/permissionsMetadata.js page:employees_report) ומפנה לדף החדש. השער: app/employees/layout.js (לפני ההפניה).
export default async function AttendanceReportRedirect() {
  if ((await getRequestUiVariant('attendance')) === 'legacy') {
    return (
      <VariantFrame screen="attendance" variant="legacy">
        <LegacyReportPage />
      </VariantFrame>
    );
  }
  redirect('/employees/attendance');
}
