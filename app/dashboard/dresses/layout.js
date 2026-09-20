import PageGate from '@/app/components/PageGate';

// Access is decided by the "page:dresses_catalog" item of the permissions catalog (lib/permissionsMetadata.js,
// editable at /admin/permissions) - see lib/permissions.js canOpenPage().
export default async function DressesLayout({ children }) {
  return <PageGate pageKey="page:dresses_catalog">{children}</PageGate>;
}
