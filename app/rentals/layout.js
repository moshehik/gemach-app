import PageGate from '@/app/components/PageGate';

// Access is decided by the "page:rentals" item of the permissions catalog (lib/permissionsMetadata.js,
// editable at /admin/permissions) - see lib/permissions.js canOpenPage().
export default async function RentalsLayout({ children }) {
  return <PageGate pageKey="page:rentals">{children}</PageGate>;
}
