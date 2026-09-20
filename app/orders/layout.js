import PageGate from '@/app/components/PageGate';

// page:orders covers everything under /orders - the list and every order card - INCLUDING /orders/new.
// (A parent layout cannot tell its children apart on client-side navigation, so the two catalog items
// are enforced per segment: this layout for page:orders, app/orders/new/layout.js for page:orders_new;
// opening the new-order screen therefore needs both.)
export default async function OrdersLayout({ children }) {
  return <PageGate pageKey="page:orders">{children}</PageGate>;
}
