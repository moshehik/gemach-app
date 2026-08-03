// Status marking an order row that exists only to hold a number for a credit-card charge
// made before the order itself was saved (see app/api/orders/reserve/route.js). A row with
// this status carries no items, no payments and is flagged isDeleted; POST /api/orders
// fills it in when the order is finally saved.
export const RESERVED_ORDER_STATUS = 'שמור לחיוב';

export function isReservedOrderPlaceholder(order) {
  if (!order) return false;
  return order.status === RESERVED_ORDER_STATUS
    && order.isDeleted === true
    && (order.items?.length || 0) === 0
    && (order.payments?.length || 0) === 0;
}

// Status of an order the new-order screen saved by itself while it was still being filled in
// (see app/api/orders/draft/route.js). Unlike the reservation placeholder it does carry items -
// held as 'pending', so `inventory_hold_minutes` releases them if the screen is abandoned -
// but never payments. POST /api/orders fills it in when the order is finally saved.
export const DRAFT_ORDER_STATUS = 'טיוטה';

export function isFillableDraftOrder(order) {
  if (!order) return false;
  return order.status === DRAFT_ORDER_STATUS
    && order.isDeleted !== true
    && (order.payments?.length || 0) === 0;
}

// Both kinds of row the new-order screen may have already put on disk under the number it is
// about to save under.
export function isOrderShell(order) {
  return isReservedOrderPlaceholder(order) || isFillableDraftOrder(order);
}
