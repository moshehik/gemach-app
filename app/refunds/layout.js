import PageGate from '@/app/components/PageGate';

// Access is decided by the "page:refunds" item of the permissions catalog (lib/permissionsMetadata.js,
// editable at /admin/permissions) - see lib/permissions.js canOpenPage().
export default async function RefundsLayout({ children }) {
  return <PageGate pageKey="page:refunds">{children}</PageGate>;
}
