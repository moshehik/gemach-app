import { checkPageAccess, DEVELOPER_ONLY_ROLES } from '@/lib/auth';
import NoAccessMessage from '@/app/components/NoAccessMessage';

// חסימה נוספת מעבר לשער של app/admin/layout.js (שם מותרים גם הנהלה ראשית
// roleId 0 וגם מתכנת roleId 2): הטאבים כאן (מסד נתונים / מערכת / מיילים)
// הם תצורה טכנית של המתכנת בלבד ולא הגדרות עסקיות של הגמ"ח - הנהלה ראשית
// לא אמורה לראות או לערוך אותן.
export default async function SiteSettingsLayout({ children }) {
  if (!(await checkPageAccess(DEVELOPER_ONLY_ROLES))) {
    return <NoAccessMessage />;
  }
  return children;
}
