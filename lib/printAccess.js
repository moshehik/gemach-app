// One place that says which catalog page permission ("page:*", lib/permissionsMetadata.js) unlocks
// each print surface - read by the print routes' layout.js files (through <PageGate pageKeys=...>),
// by POST /api/pdf and by GET /api/print/missing-dresses, so the page, the PDF route and the data
// route behind it can never disagree. Before 2026-10-01 these surfaces only needed a login:
// an employee without page:deliveries could open /print/delivery-courier and read the day's
// customer names, addresses and phones.
//
// A print surface is opened from the regular pages listed next to it; the keys below are exactly
// the regular pages that contain a button/link to it today, so anyone who could print before
// through the UI still can. To tighten a surface later, edit the array - nothing else changes.
//
// Identity/role resolution is the same canOpenAnyPage() the regular pages use, so head management /
// programmer (always allowed), employee overrides, department rows and the open-mode rule for
// anonymous visitors (require_login off) all behave exactly as on the matching page.
import { canOpenAnyPage } from '@/lib/permissions';

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

// Server-rendered HTML -> PDF (POST /api/pdf, `html` mode). The only caller is OrderPrintMenu
// (order / rental report attached to an email), which is reachable from the same pages that can
// open /print/order.
export const PDF_HTML_PAGE_KEYS = PRINT_ORDER_PAGE_KEYS;

// Pathname -> keys for the routes POST /api/pdf may render in `path` mode. Must contain every
// entry of ALLOWED_URL_PATHS in app/api/pdf/route.js (that route derives its allowlist from here).
export const PRINT_PATH_PAGE_KEYS = {
  '/print/order': PRINT_ORDER_PAGE_KEYS,
  '/print/alterations': PRINT_ALTERATIONS_PAGE_KEYS,
};

// true when the current request may open at least one of the pages.
export function canUsePrintSurface(pageKeys) {
  return canOpenAnyPage(pageKeys);
}
