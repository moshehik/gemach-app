import PageGate from '@/app/components/PageGate';
import NoAccessMessage from '@/app/components/NoAccessMessage';
import BoardGate from '@/app/components/board/BoardGate';
import BoardGateSwitch from '@/app/components/board/BoardGateSwitch';

// Access is decided by the "page:board" item of the permissions catalog (lib/permissions metadata,
// editable at /admin/permissions) - see lib/permissions.js canOpenPage(). Unchanged by the redesign (BRD-E19 "כן").
// The "no access" window follows the old/new switch of the board (BD-O1): the legacy screen keeps the legacy
// NoAccessMessage, the new one shows BoardGate -> NoAccessCard (app/components/gate/NoAccessCard.js, the dark window
// of the new login page, BRD-E19 / BRD-UNV-4).
export const metadata = { title: 'לוח חודשי - גמ"ח שמלות' };

export default async function BoardLayout({ children }) {
  return (
    <PageGate pageKey="page:board" fallback={<BoardGateSwitch legacy={<NoAccessMessage />} next={<BoardGate />} />}>
      {children}
    </PageGate>
  );
}
