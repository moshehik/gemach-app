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

// POST /api/pdf `html` mode with a `surface` - the designed print / PDF sheets of the new (A5) screens (app/components/a5-print).
// The browser paginates the A4 sheets by measuring the real layout and posts them as static HTML (no JS, locked network - see lib/pdf.js);
// the surface name says WHICH document it is, and therefore which page permission must be held to have it rendered:
//   a5-employees-list  the employees list sheets   -> page:employees   (head management / programmer only, like /employees itself)
//   a5-models-list     the models catalogue sheets -> page:dresses_catalog
//   a5-model-card      model card / items list / rentals list / barcode labels of ONE model -> page:dresses_catalog
// A new designed document (orders list, customers list...) = one entry here + one entry in app/components/a5-print/pkRegistry.js.
export const PDF_HTML_SURFACE_KEYS = {
  'a5-employees-list': ['page:employees'],
  'a5-models-list': ['page:dresses_catalog'],
  'a5-model-card': ['page:dresses_catalog'],
  // management lists (docs/a5-staff-models/print-specs.md): same page keys as their pages / management-only APIs (/api/admin/*-list)
  'a5-orders-list': ['page:admin_orders_list'],
  'a5-customers-list': ['page:admin_customers_list'],
};
