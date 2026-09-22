import { checkPageAccess, HEAD_MANAGEMENT_ROLES } from '@/lib/auth';
import NoAccessMessage from '@/app/components/NoAccessMessage';

// אזור ניהול ישן-מקביל ל-/admin (איפוס נתונים / יומן מיילים / היסטוריית גלישה) שמעולם
// לא קיבל שער גישה משלו - כל עובד מחובר יכול היה לפתוח אותו ישירות. מיושר עם
// app/admin/layout.js: רק הנהלה ראשית (roleId 0) או מתכנת (roleId 2). נמצא בביקורת
// חיווט ההרשאות מ-2026-09-22, ר' docs/permissions-wiring-audit-2026-09-22.md.
export default async function ManagementLayout({ children }) {
  if (!(await checkPageAccess(HEAD_MANAGEMENT_ROLES))) {
    return <NoAccessMessage />;
  }
  return children;
}
