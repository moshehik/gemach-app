// הגרסה הישנה של "הגדרות מערכת" — הגוף של app/admin/settings/page.js כפי שהיה עד 4.10.2026 (לפני העיצוב "סימולציה"), בלי שינוי.
// נבחרת ב-page.js לפי getRequestUiVariant('settings') (ר' lib/uiVariant.js). SettingsClient.js עצמו לא שונה.
import SettingsClient from './SettingsClient';

export default function LegacySettingsPage() {
  return <SettingsClient data-element-name="רכיב_page_1" />;
}
