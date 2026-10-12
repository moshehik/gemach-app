// /station-analytics - "המרות בעמדה הציבורית": כניסות לעמדה, מילוי פרטים, אימות והזמנות סגורות, בגרפים (בקשת הבעלים, נושא 13).
// השער: app/station-analytics/layout.js (PageGate על page:station_analytics מקטלוג ההרשאות; הנהלה ראשית / מתכנת תמיד, אחרים לפי שורת הרשאה; אחרת כרטיס "אין הרשאה").
// וה-API שמאחוריו (/api/admin/station-analytics*) שומר על אותו מפתח בנפרד (canOpenPage). בלי גרסה ישנה. ההגדרות המלאות: docs/station-analytics.md.
import StationAnalyticsSwitch from '@/app/components/station-analytics/StationAnalyticsSwitch';

export const metadata = {
  title: 'המרות בעמדה הציבורית',
};

export const dynamic = 'force-dynamic';

export default function StationAnalyticsPage() {
  return <StationAnalyticsSwitch />;
}
