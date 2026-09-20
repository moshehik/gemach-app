import PageGate from '@/app/components/PageGate';

// Access is decided by the "page:messages" item of the permissions catalog (lib/permissionsMetadata.js,
// editable at /admin/permissions) - see lib/permissions.js canOpenPage().
export default async function MessagesLayout({ children }) {
  return <PageGate pageKey="page:messages">{children}</PageGate>;
}
