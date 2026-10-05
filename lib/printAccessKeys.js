// The page-permission key arrays behind each print surface - plain data, NO imports.
// Kept apart from lib/printAccess.js (which imports lib/permissions.js -> next/headers + prisma)
// so client components (the schedule print registry, PrintWizard, /schedule/print/[page]) can read
// them without dragging server-only modules into the client bundle - that broke `next build`
// ("You're importing a module that depends on next/headers"). lib/printAccess.js re-exports these;
// see the comments there for which regular pages each list mirrors.
// Guarded by scripts/schedule-print-tests (client import-graph test).

// /print/order (+ /api/print/missing-dresses) - order details. Opened from the order card
// (/orders/[id], page:orders), the rentals screen's rental modal (page:rentals), and the batch
// "פירוט הזמנות להכנה" on the monthly board (page:board) and the orders list (page:orders).
// page:orders_new is deliberately absent: /orders/new also requires page:orders (see
// app/orders/layout.js), so it can never be the only key a user holds.
export const PRINT_ORDER_PAGE_KEYS = ['page:orders', 'page:rentals', 'page:board'];

// /print/alterations - alterations / orders-with-alterations report. Opened from the wizard
// (PrintWizardModal) that lives on /alterations, /orders and /board.
export const PRINT_ALTERATIONS_PAGE_KEYS = ['page:alterations', 'page:orders', 'page:board'];

// /print/delivery-courier and /print/delivery-bag - delivery lists; opened only from /deliveries.
export const PRINT_DELIVERIES_PAGE_KEYS = ['page:deliveries'];

// /print/customer - כרטיס לקוחה / דף חשבון / דף פרטי קשר. נפתח מכרטיס הלקוח (/customers/[id], page:customers) בלבד.
export const PRINT_CUSTOMER_PAGE_KEYS = ['page:customers'];
