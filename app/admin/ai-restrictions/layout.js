import { checkPageAccess, DEVELOPER_ONLY_ROLES } from '@/lib/auth';
import NoAccessMessage from '@/app/components/NoAccessMessage';

// מתכנת בלבד (החלטת הבעלים 4.10.2026, answers-admin-cards: "רק מתכנת") — שער נוסף מעבר ל-app/admin/layout.js (הנהלה ראשית / מתכנת),
// באותו דפוס כמו app/admin/site-settings/layout.js. ה-API שמאחורי הדף לא שונה כאן (ר' lib/adminHubCatalog.js).
export default async function DeveloperOnlyLayout({ children }) {
  if (!(await checkPageAccess(DEVELOPER_ONLY_ROLES))) {
    return <NoAccessMessage />;
  }
  return children;
}
