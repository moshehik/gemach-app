import PageGate from '@/app/components/PageGate';

// Access is decided by the "page:deliveries" item of the permissions catalog (lib/permissionsMetadata.js,
// editable at /admin/permissions) - see lib/permissions.js canOpenPage().
export default async function DeliveriesLayout({ children }) {
  return <PageGate pageKey="page:deliveries">{children}</PageGate>;
}
