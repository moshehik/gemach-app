import SettingsClient from '../settings/SettingsClient';

export const metadata = {
  title: 'הגדרות אתר',
};

export default function SiteSettingsPage() {
  return <SettingsClient mode="developer" />;
}
