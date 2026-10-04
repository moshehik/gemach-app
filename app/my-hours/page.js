// /my-hours — "השעות שלי": הנוכחות של העובד המחובר בלבד, בעיצוב "סיכום נוכחות" (תצוגות-עיצוב/סיכום-נוכחות.html, תצוגת "עובדת").
// החלטות הבעלים 4.10.2026: העובד רואה ועורך את השעות של עצמו (AT-12; השורה מסומנת "נערך ידנית" ויש היסטוריית שינויים),
// מדפיס ומוריד PDF של הדוח שלו (AT-10), בלי שכר ובלי Excel. השער: התחברות; ה-API (/api/attendance-sheet + נתיבי המשמרות)
// מחזיר ומקבל רק את המשמרות של העובד המחובר (lib/attendance/access.js - ה-id מהעוגייה המאומתת, לא מהדפדפן).
// ?view=month|byemp|emp&y=2026&m=8 (m מ-0) - מצב פתיחה אופציונלי.
// "ישן / חדש" (4.10.2026, מסך 'attendance'): בגרסה הישנה - LegacyMyHoursPage.js (f3b1f771^1:app/my-hours/page.js כפי שהוא,
// קורא ל-GET /api/me/shifts שלא השתנה). ההכרעה בשרת: getRequestUiVariant('attendance').
import AttendanceSwitch from '@/app/components/attendance/AttendanceSwitch';
import { parseAttendanceQuery } from '@/app/components/attendance/routeParams';
import VariantFrame from '@/app/components/variant/VariantFrame';
import { getRequestUiVariant } from '@/app/lib/uiVariantServer';
import LegacyMyHoursPage from './LegacyMyHoursPage';

export const metadata = { title: 'השעות שלי' };

export default async function MyHoursRoute({ searchParams }) {
  if ((await getRequestUiVariant('attendance')) === 'legacy') {
    return (
      <VariantFrame screen="attendance" variant="legacy">
        <LegacyMyHoursPage />
      </VariantFrame>
    );
  }
  const { view, y, m } = parseAttendanceQuery((await searchParams) || {});
  return (
    <VariantFrame screen="attendance" variant="a5">
      <AttendanceSwitch mode="self" initial={{ view, y, m }} />
    </VariantFrame>
  );
}
