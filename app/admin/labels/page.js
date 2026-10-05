// /admin/labels — "שינוי שמות" (מתכנת בלבד, השער ב-layout.js). אותו מסך "ישן / חדש" כמו /admin/settings (מסך 'settings').
// הישן: LegacyLabelsPage.js (העתק מילולי של הדף עד 4.10.2026). החדש: מסך "שינוי שמות" של העיצוב "סימולציה".
import { getRequestUiVariant } from '@/app/lib/uiVariantServer';
import SettingsSimSwitch from '@/app/components/settings-sim/SettingsSimSwitch';
import VariantFrame from '@/app/components/variant/VariantFrame';
import LegacyLabelsPage from './LegacyLabelsPage';

export const dynamic = 'force-dynamic';

export default async function LabelsPage() {
  const variant = await getRequestUiVariant('settings');
  return (
    <VariantFrame screen="settings" variant={variant}>
      {variant === 'legacy' ? <LegacyLabelsPage /> : <SettingsSimSwitch view="names" />}
    </VariantFrame>
  );
}
