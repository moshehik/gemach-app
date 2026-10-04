import PageGate from '@/app/components/PageGate';
import { PRINT_CUSTOMER_PAGE_KEYS } from '@/lib/printAccess';

// Server-side gate for /print/customer (the page itself is a client component, so the check lives here):
// same permission as the customer card that opens it - see lib/printAccess.js.
export default async function PrintCustomerLayout({ children }) {
  return <PageGate pageKeys={PRINT_CUSTOMER_PAGE_KEYS}>{children}</PageGate>;
}
