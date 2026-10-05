// /admin/site-settings — "הגדרות אתר" (מתכנת בלבד, השער ב-layout.js). אותו מסך "ישן / חדש" כמו /admin/settings (מסך 'settings').
import { getRequestUiVariant } from '@/app/lib/uiVariantServer';
import SettingsSimSwitch from '@/app/components/settings-sim/SettingsSimSwitch';
import VariantFrame from '@/app/components/variant/VariantFrame';
import LegacySiteSettingsPage from './LegacySiteSettingsPage';

export const metadata = {
  title: 'הגדרות אתר',
};

export const dynamic = 'force-dynamic';

export default async function SiteSettingsPage() {
  const variant = await getRequestUiVariant('settings');
  return (
    <VariantFrame screen="settings" variant={variant}>
      {variant === 'legacy' ? <LegacySiteSettingsPage /> : <SettingsSimSwitch view="site" />}
    </VariantFrame>
  );
}
