import PermissionsSwitch from '@/app/components/permissions-a5/PermissionsSwitch';

// Gated by app/admin/layout.js (HEAD_MANAGEMENT_ROLES) same as every other /admin page;
// the API routes underneath additionally require 'הנהלה ראשית' specifically.
// הדף הישן (PermissionsClient.js) והחדש (app/components/permissions-a5/PermissionsA5.js) - הבחירה לפי הדגל ui_variant_permissions (PermissionsSwitch).
export default function PermissionsPage() {
  return <PermissionsSwitch />;
}
