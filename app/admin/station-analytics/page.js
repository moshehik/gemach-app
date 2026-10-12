// /admin/station-analytics - "המרות בעמדה הציבורית": כניסות לעמדה, מילוי פרטים, אימות והזמנות סגורות, בגרפים (בקשת הבעלים, נושא 13).
// השער: app/admin/layout.js (checkPageAccess(HEAD_MANAGEMENT_ROLES) = הנהלה ראשית / מתכנת; אחרת כרטיס "אין הרשאה"; לא מחובר - מסך הכניסה של app/layout.js)
// וה-API שמאחוריו (/api/admin/station-analytics*) שומר על אותו שער בנפרד (checkAuth('הנהלה ראשית')). בלי גרסה ישנה. ההגדרות המלאות: docs/station-analytics.md.
import StationAnalyticsSwitch from '@/app/components/station-analytics/StationAnalyticsSwitch';

export const metadata = {
  title: 'המרות בעמדה הציבורית',
};

export const dynamic = 'force-dynamic';

export default function StationAnalyticsPage() {
  return <StationAnalyticsSwitch />;
}
