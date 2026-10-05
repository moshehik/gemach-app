'use client';

import dynamic from 'next/dynamic';

// המסך החדש נטען בנפרד (כמו AdminHubSwitch / ProfileSwitch): קובץ ה-CSS של הפלטה (~450KB) וקוד הדף נטענים רק בכניסה למסכי ההגדרות.
// view: 'sys' (/admin/settings) | 'site' (/admin/site-settings) | 'names' (/admin/labels).
const SettingsSimPage = dynamic(() => import('./SettingsSimPage'), {
  ssr: false,
  loading: () => (
    <div className="page-loading">
      <span className="spinner lg" />
      טוען הגדרות...
    </div>
  ),
});

export default function SettingsSimSwitch({ view }) {
  return <SettingsSimPage view={view} />;
}
