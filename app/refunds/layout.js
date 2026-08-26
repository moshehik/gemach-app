import prisma from '@/app/lib/prisma';
import { getAllCachedSettings, getCachedSetting } from '@/lib/settingsCache';
import { checkPageAccess, HEAD_MANAGEMENT_ROLES } from '@/lib/auth';
import NoAccessMessage from '@/app/components/NoAccessMessage';

// חסימת דף הזיכויים בצד שרת - מותנית בהגדרה restrict_refunds_to_head_management
// (ר' /admin/settings), ברירת מחדל 'true' (ההגבלה שהתבקשה במקור): רק הנהלה ראשית
// (roleId 0) או מתכנת (roleId 2) מגיעים ל-/refunds. כשההגדרה='false' חוזרים
// להתנהגות המקורית - מנהל (roleId 1) או מתכנת (roleId 2).
export default async function RefundsLayout({ children }) {
  const setting = await getCachedSetting('restrict_refunds_to_head_management');
  const restrictToHeadManagement = !setting || setting.value !== 'false';
  const allowedRoles = restrictToHeadManagement ? HEAD_MANAGEMENT_ROLES : [1, 2];

  if (!(await checkPageAccess(allowedRoles))) {
    return <NoAccessMessage />;
  }
  return children;
}