import PageGate from '@/app/components/PageGate';

// Access is decided by the "page:alterations" item of the permissions catalog (lib/permissionsMetadata.js,
// editable at /admin/permissions) - see lib/permissions.js canOpenPage().
export default async function AlterationsLayout({ children }) {
  return <PageGate pageKey="page:alterations">{children}</PageGate>;
}
