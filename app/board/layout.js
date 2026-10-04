import PageGate from '@/app/components/PageGate';
import BoardGate from '@/app/components/board/BoardGate';

// Access is decided by the "page:board" item of the permissions catalog (lib/permissionsMetadata.js,
// editable at /admin/permissions) - see lib/permissions.js canOpenPage(). Unchanged by the redesign (BRD-E19 "כן").
// The "no access" window itself is the new uniform design (BRD-E19 / BRD-UNV-4): BoardGate -> NoAccessCard
// (app/components/gate/NoAccessCard.js, the dark window of the new login page) instead of the legacy NoAccessMessage.
export const metadata = { title: 'לוח חודשי - גמ"ח שמלות' };

export default async function BoardLayout({ children }) {
  return <PageGate pageKey="page:board" fallback={<BoardGate />}>{children}</PageGate>;
}
