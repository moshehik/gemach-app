// /admin/settings — "הגדרות מערכת". נתיב דק: "ישן / חדש" לפי getRequestUiVariant('settings') (עקיפה אישית > הגדרת ארגון
// ui_variant_settings > ברירת מחדל לפי תפקיד: מתכנת — החדש, כל השאר — הישן; lib/uiVariant.js).
// הישן: LegacySettingsPage (SettingsClient בלי שינוי). החדש: העיצוב "סימולציה" (תצוגות-עיצוב/הגדרות-סימולציה.html),
// נטען בנפרד (dynamic) כדי שקובץ ה-CSS של הפלטה לא ייכנס ל-bundle של שאר הדפים. השער (הנהלה ראשית / מתכנת) — app/admin/layout.js.
import { getRequestUiVariant } from '@/app/lib/uiVariantServer';
import SettingsSimSwitch from '@/app/components/settings-sim/SettingsSimSwitch';
import LegacySettingsPage from './LegacySettingsPage';

export const metadata = {
  title: 'הגדרות מערכת',
};

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const variant = await getRequestUiVariant('settings');
  return variant === 'legacy' ? <LegacySettingsPage /> : <SettingsSimSwitch view="sys" />;
}
