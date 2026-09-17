import PermissionsClient from './PermissionsClient';

// Gated by app/admin/layout.js (HEAD_MANAGEMENT_ROLES) same as every other /admin page;
// the API routes underneath additionally require 'הנהלה ראשית' specifically.
export default function PermissionsPage() {
  return <PermissionsClient />;
}
