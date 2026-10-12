'use client';

import dynamic from 'next/dynamic';

// המסך נטען בנפרד (dynamic, בלי SSR): קובץ ה-CSS של הפלטה (~450KB) וקוד הגרפים לא נכנסים ל-bundle של שאר דפי הניהול (אותה מוסכמה כמו AdminHubSwitch / CustomersListLoader).
const StationAnalyticsPage = dynamic(() => import('./StationAnalyticsPage'), {
  ssr: false,
  loading: () => (
    <div className="page-loading">
      <span className="spinner lg" />
      טוען מדדים...
    </div>
  ),
});

export default function StationAnalyticsSwitch() {
  return <StationAnalyticsPage />;
}
