import PageGate from '@/app/components/PageGate';

// page:orders_new - the new-order screen (the parent app/orders/layout.js also requires page:orders).
export default async function NewOrderLayout({ children }) {
  return <PageGate pageKey="page:orders_new">{children}</PageGate>;
}
