import PageGate from '@/app/components/PageGate';
import { PRINT_ORDER_PAGE_KEYS } from '@/lib/printAccess';

// Server-side gate for /print/order (the page itself is a client component, so the check lives here):
// same permission as the regular pages that open it - see lib/printAccess.js.
export default async function PrintOrderLayout({ children }) {
  return <PageGate pageKeys={PRINT_ORDER_PAGE_KEYS}>{children}</PageGate>;
}
