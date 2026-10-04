// /employees/attendance — "סיכום נוכחות" של ההנהלה (עיצוב מאושר 4.10.2026: תצוגות-עיצוב/סיכום-נוכחות.html, רכיבי פלטה בלבד).
// מחליף את לשונית "נוכחות" ב-/employees ואת הדוח החודשי /employees/report (שמפנה לכאן - החלטת הבעלים AT-02).
// השער: app/employees/layout.js (הנהלה ראשית / מתכנת, כמו היום - AT-09); ה-API (/api/attendance-sheet) בודק שוב.
// ?view=month|byemp|emp&emp=<id>&y=2026&m=8 (m מ-0) - מצב פתיחה אופציונלי.
// "ישן / חדש" (4.10.2026, lib/uiVariantScreens.js מסך 'attendance'): בגרסה הישנה אין דף כזה - הנוכחות הייתה לשונית ב-/employees
// (app/employees/LegacyEmployeesPage.js), ולכן מפנים לשם (הפניית שרת). ההכרעה: getRequestUiVariant (עקיפה אישית > הגדרת ארגון
// ui_variant_attendance > ברירת מחדל לפי תפקיד: מתכנת חדש, כל השאר ישן).
import { redirect } from 'next/navigation';
import AttendanceSwitch from '@/app/components/attendance/AttendanceSwitch';
import { parseAttendanceQuery } from '@/app/components/attendance/routeParams';
import VariantFrame from '@/app/components/variant/VariantFrame';
import { getRequestUiVariant } from '@/app/lib/uiVariantServer';

export const metadata = { title: 'סיכום נוכחות' };

export default async function EmployeesAttendanceRoute({ searchParams }) {
  if ((await getRequestUiVariant('attendance')) === 'legacy') redirect('/employees');
  const initial = parseAttendanceQuery((await searchParams) || {});
  return (
    <VariantFrame screen="attendance" variant="a5">
      <AttendanceSwitch mode="manager" initial={initial} />
    </VariantFrame>
  );
}
