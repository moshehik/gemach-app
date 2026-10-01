import PageGate from '@/app/components/PageGate';

// בדיקת מלאי: הגישה נקבעת לפי פריט ההרשאה "page:orders" של קטלוג ההרשאות (lib/permissionsMetadata.js,
// נערך ב-/admin/permissions) — החלטת הבעלים GQ-06a (2.10.2026): אותו שער כמו דפי ההזמנות, בלי פריט חדש.
// ה-API (app/api/stock-check/route.js, STOCK_CHECK_PAGE_KEY) בודק את אותו מפתח בשרת.
export default async function StockCheckLayout({ children }) {
  return <PageGate pageKey="page:orders">{children}</PageGate>;
}
