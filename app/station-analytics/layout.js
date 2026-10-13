import PageGate from '@/app/components/PageGate';

// /station-analytics - "המרות בעמדה הציבורית". לא תחת /admin בכוונה (כמו /non-working-days ו-/refunds): app/admin/layout.js פתוח להנהלה ראשית / מתכנת בלבד,
// ואילו הבעלים החליט (נושא 13, החלטה ד') שהגישה למסך נקבעת במערכת ההרשאות. השער הוא הפריט page:station_analytics בקטלוג (lib/permissionsMetadata.js,
// נערך ב-/admin/permissions): הנהלה ראשית ומתכנת עוברים תמיד, כל אחד אחר לפי שורת הרשאה. ה-API שמאחורי המסך שומר על אותו מפתח בנפרד.
export default async function StationAnalyticsLayout({ children }) {
  return <PageGate pageKey="page:station_analytics">{children}</PageGate>;
}
