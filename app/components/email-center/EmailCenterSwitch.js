'use client';

import dynamic from 'next/dynamic';

// נטען בנפרד (כמו SettingsSimSwitch): ה-CSS של הפלטה (~450KB) וקוד המסך נטענים רק בכניסה למרכז המיילים.
const EmailCenterPage = dynamic(() => import('./EmailCenterPage'), {
  ssr: false,
  loading: () => (
    <div className="page-loading">
      <span className="spinner lg" />
      טוען את מרכז המיילים...
    </div>
  ),
});

export default function EmailCenterSwitch() {
  return <EmailCenterPage />;
}
