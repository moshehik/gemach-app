import PageGate from '@/app/components/PageGate';
import CustomersGate from '@/app/components/customer-card/CustomersGate';

// Access is decided by the "page:customers" item of the permissions catalog (lib/permissionsMetadata.js,
// editable at /admin/permissions) - see lib/permissions.js canOpenPage(). Unchanged.
// The "no access" window is the new uniform design (owner CC-O8): CustomersGate -> NoAccessCard
// (app/components/gate/NoAccessCard.js, the dark window of the new login page) instead of the legacy NoAccessMessage.
export default async function CustomersLayout({ children }) {
  return <PageGate pageKey="page:customers" fallback={<CustomersGate />}>{children}</PageGate>;
}
