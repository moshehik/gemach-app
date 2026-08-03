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
