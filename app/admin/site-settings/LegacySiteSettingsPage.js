// הגרסה הישנה של "הגדרות אתר" — הגוף של app/admin/site-settings/page.js כפי שהיה עד 4.10.2026, בלי שינוי.
import SettingsClient from '../settings/SettingsClient';

export default function LegacySiteSettingsPage() {
  return <SettingsClient mode="developer" />;
}
