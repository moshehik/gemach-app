import PageGate from '@/app/components/PageGate';
import { PRINT_ALTERATIONS_PAGE_KEYS } from '@/lib/printAccess';

// Server-side gate for /print/alterations (the page itself is a client component, so the check lives here):
// same permission as the regular pages that open it - see lib/printAccess.js.
export default async function PrintAlterationsLayout({ children }) {
  return <PageGate pageKeys={PRINT_ALTERATIONS_PAGE_KEYS}>{children}</PageGate>;
}
