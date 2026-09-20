import PageGate from '@/app/components/PageGate';

// Access is decided by the "page:customers" item of the permissions catalog (lib/permissionsMetadata.js,
// editable at /admin/permissions) - see lib/permissions.js canOpenPage().
export default async function CustomersLayout({ children }) {
  return <PageGate pageKey="page:customers">{children}</PageGate>;
}
