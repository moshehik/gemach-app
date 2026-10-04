import PageGate from '@/app/components/PageGate';
import { PRINT_PATH_PAGE_KEYS } from '@/lib/printAccess';

// Server-side gate for /print/order-history (W6: printing / PDF of the order card's history feed). Same keys as the
// history API itself (page:orders, PLAN §C.5) - read from lib/printAccess.js so the page, POST /api/pdf and the
// data route can never disagree.
export default async function PrintOrderHistoryLayout({ children }) {
  return <PageGate pageKeys={PRINT_PATH_PAGE_KEYS['/print/order-history']}>{children}</PageGate>;
}
