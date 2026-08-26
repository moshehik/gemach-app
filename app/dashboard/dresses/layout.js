import prisma from '@/app/lib/prisma';
import { getAllCachedSettings, getCachedSetting } from '@/lib/settingsCache';
import { checkPageAccess, HEAD_MANAGEMENT_ROLES } from '@/lib/auth';
import NoAccessMessage from '@/app/components/NoAccessMessage';

// חסימת קטלוג הדגמים (/dashboard/dresses וכל מה שמתחתיו) בצד שרת - מותנית בהגדרה
// restrict_dress_catalog_to_head_management (ר' /admin/settings), ברירת מחדל 'true'
// (ההגבלה שהתבקשה במקור): רק הנהלה ראשית (roleId 0) או מתכנת (roleId 2) מגיעים.
// כשההגדרה='false' הדף נשאר פתוח לכל עובד, כמו שהיה לפני התוספת הזו.
export default async function DressesLayout({ children }) {
  const setting = await getCachedSetting('restrict_dress_catalog_to_head_management');
  const restricted = !setting || setting.value !== 'false';

  if (restricted && !(await checkPageAccess(HEAD_MANAGEMENT_ROLES))) {
    return <NoAccessMessage />;
  }
  return children;
}