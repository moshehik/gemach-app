import PageGate from '@/app/components/PageGate';

// Access is decided by the "page:board" item of the permissions catalog (lib/permissionsMetadata.js,
// editable at /admin/permissions) - see lib/permissions.js canOpenPage().
export default async function BoardLayout({ children }) {
  return <PageGate pageKey="page:board">{children}</PageGate>;
}
