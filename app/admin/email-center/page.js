// /admin/email-center - "מרכז המיילים": עריכת כל המיילים שהמערכת שולחת (נושא ושורות עם שדות מוחלפים, הפעלה/כיבוי, תזמון), נתונים קבועים
// (שם גמ"ח, כתובת, טלפון, לוגו, חתימה) ודיוורים. עיצוב "הגדרות מערכת". השער (הנהלה ראשית / מתכנת): app/admin/layout.js, וכל ה-API תחת /api/admin/email-center.
import EmailCenterSwitch from '@/app/components/email-center/EmailCenterSwitch';

export const metadata = {
  title: 'מרכז המיילים',
};

export const dynamic = 'force-dynamic';

export default function EmailCenterRoute() {
  return <EmailCenterSwitch />;
}
